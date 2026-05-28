import { geocodeAddress } from "./geocode";
import { topicsForSpecialty } from "./specialties";
import { buildKeywordMap, buildStrategyCards } from "./keywords";
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
        `${labels.detailAnalysis} URL 미설정 — 인구 표는 overrides 또는 수동 입력`
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
      "SBIZ365_API_KEY 미설정 — 365 데이터는 overrides 또는 수동 입력"
    );
  }

  const regions =
    input.regions?.length ? input.regions : geo.regionHints.slice(0, 9);
  const topics = input.keywordTopics?.length
    ? input.keywordTopics
    : topicsForSpecialty(input.specialty);

  const { columns, rows } = buildKeywordMap(regions, topics);
  const strategyCards = buildStrategyCards(input.specialty, regions, topics);

  const residential = popData.residential!;
  const workplace = popData.workplace!;

  const base: AnalysisReport = {
    slug: input.slug,
    clinicName: input.clinicName,
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
    keywords: {
      subtitle: `${regions.slice(0, 4).join("·")}권 ${input.specialty} 공략 키워드`,
      columns,
      rows,
      strategyCards,
    },
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
