import { geocodeAddress } from "./geocode";
import { buildKeywordSection } from "./buildKeywordSection";
import { resolveRegionsForLocation } from "./resolveRegions";
import {
  aggregateFacilities,
  countMedicalStores,
  fetchStoresInRadius,
} from "./sbizStore";
import {
  fetchDetailAnalysis,
  fetchMarketMap,
  fetchSimpleAnalysis,
  isSbiz365Configured,
  placeholderPopulation,
} from "./sbiz365";
import { getSbiz365Labels, listSbiz365Readiness } from "./sbiz365Config";
import {
  buildAutoSearchSection,
  hasManualSearchOverride,
  resolveMainSearchKeyword,
} from "./buildAutoSearch";
import {
  primaryRegionHintFromGeocode,
  regionHintsForPlaceLookup,
} from "./competitorRadius";
import { isNaverSearchAdConfigured } from "./naverSearchAd";
import { isNaverOpenSearchConfigured } from "./naverOpenSearch";
import { deepMerge, formatNumber, peakAgeInsight } from "./utils";
import type { AnalysisInput, AnalysisReport, PopulationRow } from "./types";

const DEFAULT_RADIUS_M = 1500;

export async function buildAnalysisReport(
  input: AnalysisInput
): Promise<AnalysisReport> {
  const radiusMeters = input.radiusMeters ?? DEFAULT_RADIUS_M;
  const geo = await geocodeAddress(input.address);

  const warnings: string[] = [];
  let stores: Awaited<ReturnType<typeof fetchStoresInRadius>> = [];

  try {
    stores = await fetchStoresInRadius(geo.lng, geo.lat, radiusMeters);
  } catch (e) {
    warnings.push(
      e instanceof Error ? e.message : "상가 API 조회 실패 — 시설 수는 0으로 표시"
    );
  }

  const facilities = aggregateFacilities(stores);
  const medicalCount = countMedicalStores(stores);

  const sbizCtx = {
    lat: geo.lat,
    lng: geo.lng,
    radiusMeters,
    address: geo.roadAddress,
  };

  let popData = placeholderPopulation();
  const sbizReady = listSbiz365Readiness();
  const labels = getSbiz365Labels();

  if (isSbiz365Configured()) {
    if (sbizReady.detailAnalysis) {
      try {
        const fetched = await fetchDetailAnalysis(sbizCtx);
        if (fetched) popData = { ...popData, ...fetched };
      } catch (e) {
        warnings.push(
          e instanceof Error
            ? e.message
            : `${labels.detailAnalysis} API 실패 — overrides로 보완`
        );
      }
    } else {
      warnings.push(
        `${labels.detailAnalysis} 인증키 미설정(SBIZ365_DETAIL_KEY) — 인구 표는 overrides 또는 수동 입력`
      );
    }

    if (sbizReady.simpleAnalysis) {
      try {
        await fetchSimpleAnalysis(sbizCtx);
        // TODO: 응답 JSON 구조 확인 후 market.summaryBullets 등에 반영
      } catch (e) {
        warnings.push(
          e instanceof Error ? e.message : `${labels.simpleAnalysis} API 실패`
        );
      }
    }

    if (sbizReady.marketMap) {
      try {
        await fetchMarketMap(sbizCtx);
        // TODO: 응답 JSON 구조 확인 후 지도·상권 블록에 반영
      } catch (e) {
        warnings.push(
          e instanceof Error ? e.message : `${labels.marketMap} API 실패`
        );
      }
    }
  } else {
    warnings.push(
      "SBIZ365_DETAIL_KEY(또는 SBIZ365_API_KEY) 미설정 — 365 인구 데이터는 overrides 또는 수동 입력"
    );
  }

  let regions = input.regions?.length ? input.regions : [];
  if (!regions.length) {
    try {
      const resolved = await resolveRegionsForLocation(input.address, geo);
      regions = resolved.regions;
    } catch {
      regions = geo.regionHints.slice(0, 9);
    }
  }

  const focusSeeds = (input.keywordTopics ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const keywords = buildKeywordSection(
    input.specialty,
    regions,
    focusSeeds,
    input.treatmentMode ?? "nonsurgery"
  );

  const residential = popData.residential!;
  const workplace = popData.workplace!;

  const base: AnalysisReport = {
    slug: input.slug,
    clinicName: input.clinicName ?? "",
    address: geo.roadAddress,
    specialty: input.specialty,
    radiusKm: radiusMeters / 1000,
    generatedAt: new Date().toISOString(),
    coordinates: { lat: geo.lat, lng: geo.lng },
    population: {
      residential,
      workplace,
      floating: popData.floating,
      insight: buildPopulationInsight(residential, workplace),
    },
    market: {
      facilities,
      summaryBullets: [
        `<strong>주거인구:</strong> ${peakAgeInsight(residential, "주거")}`,
        `<strong>직장인구:</strong> ${peakAgeInsight(workplace, "직장")}`,
        `<strong>반경 ${radiusMeters / 1000}km 상가:</strong> ${formatNumber(stores.length)}개 업소 · 의료·복지 ${formatNumber(medicalCount)}개`,
      ],
      miniCards: [
        {
          title: "의료·복지 시설 밀집",
          sub: `(${formatNumber(medicalCount)}개)`,
        },
        {
          title: "상권 업소 밀도",
          sub: `총 ${formatNumber(stores.length)}개`,
        },
        {
          title: "주거+직장 혼합 수요",
          sub: "인구·유동 데이터 확인 권장",
        },
      ],
      mapNote: `${geo.roadAddress} 중심 반경 ${radiusMeters / 1000}km`,
    },
    keywords,
    meta: {
      dataSources: [
        "소상공인시장진흥공단 상가(상권)정보 API",
        isSbiz365Configured()
          ? "소상공인365 오픈 API"
          : "소상공인365 (미연동)",
        "카카오 로컬 API",
      ],
      warnings: warnings.length ? warnings : undefined,
    },
  };

  const dong = regions.find((r) => /동$|역$|구$/.test(r));
  const mainKw =
    resolveMainSearchKeyword({
      mainSearchKeyword: input.mainSearchKeyword,
      regions,
      specialty: input.specialty,
    }) ??
    (dong && input.specialty
      ? `${dong} ${input.specialty}`.trim()
      : regions[0] && input.specialty
        ? `${regions[0]} ${input.specialty}`.trim()
        : null);

  if (mainKw && !hasManualSearchOverride(input.overrides)) {
    try {
      base.search = await buildAutoSearchSection({
        mainSearchKeyword: mainKw,
        clinicName: input.clinicName ?? "",
        specialty: input.specialty,
        centerLat: geo.lat,
        centerLng: geo.lng,
        radiusMeters,
        clinicAddress: geo.roadAddress,
        regionHint: primaryRegionHintFromGeocode(geo),
        regionHints: regionHintsForPlaceLookup(geo, mainKw),
        brandSearchKeyword: input.brandSearchKeyword,
        excludeMapAds: !input.includeMapAds,
      });
      if (
        (base.search.meta?.afterCategoryCount ?? 0) === 0 &&
        (base.search.meta?.mapPlaceCount ?? 0) > 0
      ) {
        warnings.push(
          `지도에서 ${base.search.meta!.mapPlaceCount}건 수집됐으나 진료과 필터에서 모두 제외됐습니다. 진료과·네이버 검색 키워드를 맞춰 주세요.`
        );
      }
      if ((base.search.meta?.rivalCount ?? 0) === 0) {
        warnings.push(
          `지도 검색「${mainKw}」에서 동일 진료과·규모 경쟁 병원을 찾지 못했습니다. 고급 설정의 네이버 검색 키워드를 바꿔 보세요.`
        );
      }
      base.meta!.dataSources!.push("네이버 지도 검색 (Playwright)");
      if (isNaverSearchAdConfigured()) {
        base.meta!.dataSources!.push("네이버 검색광고 API (keywordstool)");
      }
      if (isNaverOpenSearchConfigured()) {
        base.meta!.dataSources!.push("네이버 검색 Open API (채널)");
      }
      const sm = base.search.meta;
      const rivalN = sm?.rivalCount ?? 0;
      const volMatched = sm?.volumeMatchedCount ?? 0;
      if (sm?.volumeFetchError && rivalN > 0) {
        warnings.push(`브랜드 검색량 API: ${sm.volumeFetchError}`);
      } else if (
        rivalN > 0 &&
        volMatched === 0 &&
        sm?.searchAdConfigured
      ) {
        warnings.push(
          "브랜드 검색량: API는 연결됐지만 병원명 키워드가 매칭되지 않았습니다. (검색량이 0이거나 상호·연관키워드 불일치)"
        );
      } else if (rivalN > 0 && volMatched > 0 && volMatched < rivalN) {
        warnings.push(
          `브랜드 검색량: ${rivalN}곳 중 ${volMatched}곳만 키워드 도구 수치를 표시했습니다.`
        );
      }
      base.meta!.warnings = warnings.length ? warnings : undefined;
    } catch (e) {
      warnings.push(
        e instanceof Error ? e.message : "검색·경쟁사 자동 수집 실패"
      );
      base.meta!.warnings = warnings;
    }
  } else if (!hasManualSearchOverride(input.overrides)) {
    warnings.push(
      "지도 검색 키워드를 만들 수 없습니다. 주소·진료과 또는 고급 설정「네이버 검색 키워드」를 입력하세요."
    );
    base.meta!.warnings = warnings.length ? warnings : undefined;
  }

  return deepMerge(base, input.overrides as Partial<AnalysisReport>);
}

function buildPopulationInsight(
  residential: PopulationRow,
  workplace: PopulationRow
): string {
  const resPeak =
    residential.ages.sixtiesPlus >= residential.ages.twentiesThirties
      ? "중장년·고령"
      : "2030";
  const workPeak =
    workplace.ages.twentiesThirties >= workplace.ages.fortiesFifties
      ? "3040 직장"
      : "혼합";
  return `주거 <strong>${resPeak}</strong> 수요와 직장 <strong>${workPeak}</strong> 수요가 공존하는 상권으로, ${resPeak === "중장년·고령" ? "신뢰·접근성" : "검색·예약 편의"} 메시지를 병행 설계합니다.`;
}
