import { auditChannelMatrix } from "./channelAudit";
import { deduplicateMapPlaces, deduplicateRivalNames } from "./competitorDedup";
import { filterCompetitorPlaces } from "./competitorFilter";
import { resolveCanonicalSpecialty } from "./specialties";
import {
  filterCompetitorsWithinRadiusAdaptive,
  regionHintFromAddress,
} from "./competitorRadius";
import type { MapPlaceHit } from "./naverMapCompetitors";
import { resolveMapPlaces } from "./resolveMapPlaces";
import { isNaverOpenSearchConfigured } from "./naverOpenSearch";
import {
  fetchKeywordVolumes,
  isNaverSearchAdConfigured,
  keywordCandidatesForPlace,
  mergePlaceVolumes,
  resolveVolumePairForPlace,
  type KeywordVolume,
} from "./naverSearchAd";
import { buildDefaultSearchInsights } from "./searchInsights";
import type { AnalysisReport, SearchVolumeRow } from "./types";
export type AutoSearchParams = {
  mainSearchKeyword: string;
  clinicName: string;
  specialty: string;
  /** 우리 병원 좌표 (주소 지오코딩) */
  centerLat: number;
  centerLng: number;
  /** 경쟁사 포함 반경 (기본 1500m) */
  radiusMeters?: number;
  /** 좌표 조회 힌트 (미입력 시 clinicAddress에서 추출) */
  regionHint?: string;
  /** 상호 좌표 조회 시 추가 시도 힌트 */
  regionHints?: string[];
  clinicAddress?: string;
  /** 검색광고·검색량 API용 (미입력 시 clinicName) */
  brandSearchKeyword?: string;
  /** true면 지도 '광고' 표시 업체 제외 */
  excludeMapAds?: boolean;
};

/**
 * 메인 키워드 → 지도 1페이지 경쟁사 → 검색량(상대 순위) → 인사이트 A·B·E
 * overrides.search.competitors 가 있으면 호출하지 않음
 */
export async function buildAutoSearchSection(
  params: AutoSearchParams
): Promise<NonNullable<AnalysisReport["search"]>> {
  const regionHint =
    params.regionHint ??
    (params.clinicAddress
      ? regionHintFromAddress(params.clinicAddress)
      : "");

  const places = await resolveMapPlaces(
    params.mainSearchKeyword,
    regionHint,
    params.specialty
  );

  const categoryFiltered = deduplicateMapPlaces(
    filterCompetitorPlaces(
      places.filter((p) => !params.excludeMapAds || !p.isAd),
      {
        clinicName: params.clinicName,
        specialty: resolveCanonicalSpecialty(params.specialty),
        mainSearchKeyword: params.mainSearchKeyword,
      }
    )
  );

  const radiusMeters = params.radiusMeters ?? 1500;
  const radiusResult = await filterCompetitorsWithinRadiusAdaptive(
    categoryFiltered,
    {
      centerLat: params.centerLat,
      centerLng: params.centerLng,
      radiusMeters,
      regionHint,
      regionHints: params.regionHints,
    }
  );
  const filtered = deduplicateMapPlaces(radiusResult.places);
  const afterRadiusCount = filtered.length;

  const uniqueRivals = deduplicateRivalNames(filtered.map((p) => p.name));

  const clinicName = params.clinicName.trim();
  const brandKw = params.brandSearchKeyword ?? clinicName;
  const hintKeywords = [
    ...uniqueRivals.flatMap((n) => keywordCandidatesForPlace(n)),
    ...(clinicName
      ? keywordCandidatesForPlace(clinicName, brandKw)
      : []),
  ];

  let volumes = new Map<string, KeywordVolume>();
  let volumeFetchError: string | undefined;

  if (uniqueRivals.length > 0 || clinicName) {
    if (!isNaverSearchAdConfigured()) {
      volumeFetchError =
        "NAVER_SEARCHAD_CUSTOMER_ID·API_KEY·SECRET_KEY 미설정 (.env.local)";
    } else if (hintKeywords.length > 0) {
      try {
        volumes = await fetchKeywordVolumes(hintKeywords);
      } catch (e) {
        volumeFetchError =
          e instanceof Error ? e.message : "검색광고 API 조회 실패";
        volumes = new Map();
      }
    }
  }

  const toRow = (name: string, isOurs: boolean): SearchVolumeRow => {
    const pair = resolveVolumePairForPlace(
      name,
      volumes,
      isOurs ? brandKw : undefined
    );
    const merged = mergePlaceVolumes(pair.full, pair.short);
    if (merged) {
      return {
        name,
        volume: merged.total,
        volumePc: merged.pc,
        volumeMobile: merged.mobile,
        shortKeyword: pair.shortKeyword ?? undefined,
        isOurs,
        volumeEstimated: false,
      };
    }
    return {
      name,
      volume: 0,
      isOurs,
      volumeEstimated: true,
    };
  };

  const competitorRows: SearchVolumeRow[] = uniqueRivals.map((name) =>
    toRow(name, false)
  );

  const competitors: SearchVolumeRow[] = [...competitorRows];
  if (clinicName) {
    competitors.push(toRow(clinicName, true));
    competitors.sort((a, b) => b.volume - a.volume);
    const ours = competitors.find((c) => c.isOurs);
    if (ours) {
      const rest = competitors.filter((c) => !c.isOurs);
      competitors.length = 0;
      competitors.push(...rest, ours);
    }
  }

  const ourRow = competitors.find((c) => c.isOurs);
  const mobileShareHigh =
    ourRow && ourRow.volumeMobile != null && ourRow.volume > 0
      ? ourRow.volumeMobile / ourRow.volume >= 0.55
      : true;

  const insights = buildDefaultSearchInsights({
    mainSearchKeyword: params.mainSearchKeyword,
    clinicName: clinicName || "개원 예정",
    specialty: params.specialty,
    competitors,
    mobileShareHigh,
  });

  let channelMatrix = buildChannelMatrixSkeleton(competitors);

  if (isNaverOpenSearchConfigured()) {
    try {
      channelMatrix = await auditChannelMatrix(
        competitors.map((c) => ({ name: c.name, isOurs: c.isOurs }))
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[channel] audit partial/failed:", msg);
    }
  }

  const rivalRows = competitors.filter((c) => !c.isOurs);
  const volumeMatchedCount = rivalRows.filter(
    (c) => !c.volumeEstimated && c.volume > 0
  ).length;

  return {
    competitors,
    insights,
    channelMatrix,
    meta: {
      mapQuery: params.mainSearchKeyword,
      rivalCount: uniqueRivals.length,
      radiusFallback: false,
      radiusMetersUsed: radiusResult.radiusMetersUsed,
      radiusExpanded: radiusResult.radiusExpanded,
      mapPlaceCount: places.length,
      afterCategoryCount: categoryFiltered.length,
      afterRadiusCount,
      volumeMatchedCount,
      volumeFetchError,
      searchAdConfigured: isNaverSearchAdConfigured(),
    },
  };
}

const CHANNEL_PENDING = "—";

/** 채널 수집(2단계) 전 — 경쟁사·우리 병원 행만 맞춰 둔 표 골격 */
export function buildChannelMatrixSkeleton(
  competitors: SearchVolumeRow[]
): NonNullable<
  NonNullable<AnalysisReport["search"]>["channelMatrix"]
> {
  return competitors.map((c) => ({
    hospital: c.name,
    isOurs: c.isOurs,
    homepage: CHANNEL_PENDING,
    blog: CHANNEL_PENDING,
    cafe: CHANNEL_PENDING,
    news: CHANNEL_PENDING,
    kin: CHANNEL_PENDING,
    sns: CHANNEL_PENDING,
    video: CHANNEL_PENDING,
  }));
}

export function resolveMainSearchKeyword(input: {
  mainSearchKeyword?: string;
  regions?: string[];
  specialty: string;
}): string | null {
  const explicit = input.mainSearchKeyword?.trim();
  if (explicit) return explicit;
  const region = input.regions?.[0]?.trim();
  const specialty = input.specialty?.trim();
  if (region && specialty) return `${region} ${specialty}`;
  return null;
}

export function hasManualSearchOverride(
  overrides?: Partial<AnalysisReport>
): boolean {
  const list = overrides?.search?.competitors;
  return Boolean(list && list.length > 0);
}
