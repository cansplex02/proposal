import { geocodeAddress } from "./geocode";
import { fetchMarketFacilities } from "./sbiz365Facilities";
import { fetchStoresInRadius, countMedicalStores } from "./sbizStore";
import {
  fetchDetailAnalysis,
  isSbiz365Configured,
  placeholderPopulation,
} from "./sbiz365";
import { getSbiz365Labels, listSbiz365Readiness } from "./sbiz365Config";
import {
  buildStoreStatusMarket,
  type StoreStatusMarket,
} from "./sbiz365StoreStatus";
import { demandMixCard, formatNumber, peakAgeInsight } from "./utils";
import type { AnalysisReport, FacilityCount, PopulationRow } from "./types";

const DEFAULT_RADIUS_M = 1500;

export type RegionReportInput = {
  address: string;
  radiusMeters?: number;
};

export async function buildRegionReport(
  input: RegionReportInput
): Promise<AnalysisReport> {
  const radiusMeters = input.radiusMeters ?? DEFAULT_RADIUS_M;
  const geo = await geocodeAddress(input.address.trim());

  const warnings: string[] = [];
  let stores: Awaited<ReturnType<typeof fetchStoresInRadius>> = [];

  try {
    stores = await fetchStoresInRadius(geo.lng, geo.lat, radiusMeters);
  } catch (e) {
    warnings.push(
      e instanceof Error ? e.message : "상가 API 조회 실패 — 시설 수는 0으로 표시"
    );
  }

  const sbizCtx = {
    lat: geo.lat,
    lng: geo.lng,
    radiusMeters,
    address: geo.roadAddress,
  };

  let storeStatus: StoreStatusMarket | null = null;
  try {
    storeStatus = await buildStoreStatusMarket(geo.roadAddress);
  } catch (e) {
    warnings.push(
      e instanceof Error ? e.message : "소상공인365 업소현황 조회 실패"
    );
  }

  const {
    facilities,
    ok: facilitiesOk,
    error: facilitiesError,
    source: facilitySource,
  } = await fetchMarketFacilities(sbizCtx, stores);
  // 업소현황(시군구 업종별)이 있으면 주요시설 폴백 경고는 표시하지 않음
  if (!storeStatus && !facilitiesOk && facilitiesError) {
    warnings.push(facilitiesError);
  }

  // 반경 기반 의료·복지 수 (반경 상가 불릿용)
  const radiusMedicalCount =
    facilitySource === "store"
      ? countMedicalStores(stores)
      : (facilities.find((f) => f.label === "의료·복지")?.count ?? 0);

  const marketFacilities: FacilityCount[] = storeStatus
    ? storeStatus.facilities
    : facilities;
  const marketSource: AnalysisReport["market"]["facilitySource"] = storeStatus
    ? "storeStatus"
    : facilitySource;
  const facilityCaption = storeStatus?.caption;
  const medicalCardCount = storeStatus?.medicalCount ?? radiusMedicalCount;
  const medicalCardTitle = storeStatus?.medicalCardTitle ?? "의료·복지 시설 밀집";
  const storeStatusBullets = storeStatus?.medicalBullet
    ? [storeStatus.medicalBullet]
    : [];

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
            : `${labels.detailAnalysis} API 실패`
        );
      }
    } else {
      warnings.push(
        `${labels.detailAnalysis} 인증키 미설정(SBIZ365_DETAIL_KEY)`
      );
    }
  } else {
    warnings.push(
      "SBIZ365_DETAIL_KEY 미설정 — 인구 표는 0으로 표시됩니다"
    );
  }

  const residential = popData.residential!;
  const workplace = popData.workplace!;

  return {
    slug: "region-preview",
    clinicName: "",
    address: geo.roadAddress,
    specialty: "",
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
      facilities: marketFacilities,
      facilitySource: marketSource,
      facilityCaption,
      summaryBullets: [
        `<strong>주거인구:</strong> ${peakAgeInsight(residential, "주거")}`,
        `<strong>직장인구:</strong> ${peakAgeInsight(workplace, "직장")}`,
        ...storeStatusBullets,
        `<strong>반경 ${radiusMeters / 1000}km 상가:</strong> ${formatNumber(stores.length)}개 업소${storeStatus ? "" : ` · 의료·복지 ${formatNumber(radiusMedicalCount)}개`}`,
      ],
      miniCards: [
        {
          title: medicalCardTitle,
          value: `${formatNumber(medicalCardCount)}개`,
          sub: storeStatus ? "시군구 전체 기준" : `반경 ${radiusMeters / 1000}km 내`,
          accent: "green",
          icon: "medical",
          trend:
            storeStatus?.medicalUpdownPer !== undefined
              ? {
                  text: `${Math.abs(storeStatus.medicalUpdownPer)}% 직전 반기 대비`,
                  dir:
                    storeStatus.medicalUpdownPer > 0
                      ? "up"
                      : storeStatus.medicalUpdownPer < 0
                        ? "down"
                        : "flat",
                }
              : undefined,
        },
        {
          title: "상권 업소 밀도",
          value: `${formatNumber(stores.length)}개`,
          sub: `반경 ${radiusMeters / 1000}km 상가`,
          accent: "blue",
          icon: "store",
        },
        demandMixCard(residential.total, workplace.total),
      ],
      mapNote: `${geo.roadAddress} 중심 반경 ${radiusMeters / 1000}km`,
    },
    keywords: {
      subtitle: "",
      columns: [],
      rows: [],
      strategyCards: [],
    },
    meta: {
      dataSources: [
        "소상공인시장진흥공단 상가(상권)정보 API",
        isSbiz365Configured()
          ? "소상공인365 상세분석"
          : "소상공인365 (미연동)",
        ...(storeStatus ? ["소상공인365 업소현황"] : []),
        "카카오/네이버 지오코딩",
      ],
      warnings: warnings.length ? warnings : undefined,
    },
  };
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

export function regionReportSummary(report: AnalysisReport): string {
  const r = report.population.residential;
  const w = report.population.workplace;
  const storeN = report.market.summaryBullets[2]?.match(/(\d[\d,]*)개 업소/)?.[1];
  return [
    `✓ ${report.address}`,
    r.total
      ? `주거 ${formatNumber(r.total)}명 · 직장 ${formatNumber(w.total)}명`
      : null,
    storeN ? `반경 ${report.radiusKm}km 상가 ${storeN}개` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
