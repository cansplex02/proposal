import {
  detectFacilityTier,
  inferCategoryFromPlaceName,
  parseNaverCategoryLabel,
} from "./competitorFilter";
import { haversineMeters } from "./utils";

export type PlaceCoordResult = {
  lat: number;
  lng: number;
  address?: string;
};

/** 반경·행정구역 기준으로 지역검색 결과 선택 */
export type PlaceLookupContext = {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  regionHints: string[];
};

/** 네이버 검색 Open API — 지역 검색 (Playwright 실패 시 폴백) */
export type LocalSearchItem = {
  title: string;
  link: string;
  address?: string;
  roadAddress?: string;
  lat?: number;
  lng?: number;
  naverCategory?: string;
  facilityTier?: ReturnType<typeof detectFacilityTier>;
};

/** 네이버 지역검색 mapx/mapy → WGS84 (도 단위 × 10⁷) */
export function naverLocalToWgs84(
  mapx: string | number,
  mapy: string | number
): { lat: number; lng: number } {
  return {
    lng: Number(mapx) / 10_000_000,
    lat: Number(mapy) / 10_000_000,
  };
}

function isConfigured(): boolean {
  return Boolean(
    process.env.NAVER_OPEN_API_CLIENT_ID &&
      process.env.NAVER_OPEN_API_CLIENT_SECRET
  );
}

async function fetchLocalSearchPage(
  query: string,
  start: number,
  display: number
): Promise<LocalSearchItem[]> {
  if (!isConfigured()) return [];

  const url = new URL("https://openapi.naver.com/v1/search/local.json");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("display", String(Math.min(display, 10)));
  url.searchParams.set("start", String(Math.max(1, start)));
  url.searchParams.set("sort", "comment");

  const res = await fetchLocalWithRetry(url.toString(), {
    headers: {
      "X-Naver-Client-Id": process.env.NAVER_OPEN_API_CLIENT_ID!,
      "X-Naver-Client-Secret": process.env.NAVER_OPEN_API_CLIENT_SECRET!,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`네이버 지역 검색 API 실패 (${res.status}): ${text.slice(0, 120)}`);
  }

  const data = (await res.json()) as {
    items?: {
      title?: string;
      link?: string;
      category?: string;
      address?: string;
      roadAddress?: string;
      mapx?: string;
      mapy?: string;
    }[];
  };

  return (data.items ?? []).map((item) => {
    const title = stripHtml(item.title ?? "");
    const naverCategory =
      parseNaverCategoryLabel(item.category ?? "") ??
      inferCategoryFromPlaceName(title) ??
      undefined;
    const coords =
      item.mapx && item.mapy
        ? naverLocalToWgs84(item.mapx, item.mapy)
        : undefined;
    return {
      title,
      link: item.link ?? "",
      address: item.roadAddress || item.address,
      lat: coords?.lat,
      lng: coords?.lng,
      naverCategory,
      facilityTier: detectFacilityTier(title),
    };
  });
}

/** 지역검색 1페이지 (최대 10건, 좌표 포함) */
export async function fetchLocalSearchPlaces(
  query: string,
  display = 10
): Promise<LocalSearchItem[]> {
  return fetchLocalSearchPage(query, 1, display);
}

/** 여러 페이지 조회 — 반경 필터용 좌표 확보 (최대 50건) */
export async function fetchLocalSearchPlacesUpTo(
  query: string,
  maxTotal = 50
): Promise<LocalSearchItem[]> {
  if (!isConfigured()) return [];

  const out: LocalSearchItem[] = [];
  const seen = new Set<string>();

  for (let start = 1; start <= maxTotal && out.length < maxTotal; start += 10) {
    const page = await fetchLocalSearchPage(query, start, 10);
    if (!page.length) break;
    for (const item of page) {
      const key = normalizePlaceTitle(item.title);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    if (page.length < 10) break;
    if (start > 1) await delay(350);
  }

  return out.slice(0, maxTotal);
}

async function fetchLocalWithRetry(
  url: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i <= retries; i++) {
    last = await fetch(url, init);
    if (last.status !== 429) return last;
    await new Promise((r) => setTimeout(r, 900 * (i + 1)));
  }
  return last!;
}

function scoreLocalSearchHit(
  item: LocalSearchItem,
  placeName: string,
  ctx: PlaceLookupContext
): number {
  const key = normalizePlaceTitle(placeName);
  const title = normalizePlaceTitle(item.title);
  let score = 0;
  if (title === key) score += 100;
  else if (title.includes(key) || key.includes(title)) score += 55;
  else return -1;

  const addr = (item.address ?? "").replace(/\s+/g, "");
  for (const h of ctx.regionHints) {
    const token = h.replace(/\s+/g, "");
    if (token.length >= 2 && addr.includes(token)) score += 25;
  }

  const gu = ctx.regionHints.find((h) => /[구군]$/.test(h));
  if (gu) {
    const guCompact = gu.replace(/\s/g, "");
    if (addr.includes(guCompact)) score += 35;
    // 인천 부평 등 타 상권 분석 시에만 인근 타시(부천 등) 감점 — 부천 상권 분석에는 적용 안 함
    const analyzingBucheon = ctx.regionHints.some((h) =>
      /부천/.test(h.replace(/\s/g, ""))
    );
    const analyzingBupyeong = ctx.regionHints.some((h) =>
      /부평/.test(h.replace(/\s/g, ""))
    );
    if (analyzingBupyeong && !analyzingBucheon) {
      if (/부천|김포시|서울특별|서울시|안양|광명|시흥|구로구|영등포/.test(addr)) {
        score -= 250;
      }
    }
  }

  if (item.lat != null && item.lng != null) {
    const dist = haversineMeters(
      ctx.centerLat,
      ctx.centerLng,
      item.lat,
      item.lng
    );
    if (dist > ctx.radiusMeters) score -= 200;
    score -= dist / 80;
  } else {
    score -= 50;
  }

  return score;
}

export function pickBestLocalSearchHit(
  items: LocalSearchItem[],
  placeName: string,
  ctx: PlaceLookupContext
): LocalSearchItem | null {
  let best: { item: LocalSearchItem; score: number } | null = null;
  for (const item of items) {
    const score = scoreLocalSearchHit(item, placeName, ctx);
    if (score < 50) continue;
    if (!best || score > best.score) best = { item, score };
  }
  return best?.item ?? null;
}

/** 상호명 + 지역 힌트로 좌표 조회 (지역검색 API) */
export async function fetchPlaceCoordinates(
  placeName: string,
  regionHint: string,
  ctx?: PlaceLookupContext
): Promise<PlaceCoordResult | null> {
  const q = `${placeName} ${regionHint}`.trim();
  let items: LocalSearchItem[] = [];
  try {
    items = await fetchLocalSearchPlaces(q, 8);
  } catch {
    return null;
  }

  if (ctx) {
    const hit = pickBestLocalSearchHit(items, placeName, ctx);
    if (hit?.lat != null && hit.lng != null) {
      const dist = haversineMeters(
        ctx.centerLat,
        ctx.centerLng,
        hit.lat,
        hit.lng
      );
      if (dist > ctx.radiusMeters) return null;
      return { lat: hit.lat, lng: hit.lng, address: hit.address };
    }
    return null;
  }

  const key = normalizePlaceTitle(placeName);
  const hit =
    items.find((i) => normalizePlaceTitle(i.title) === key) ??
    items.find((i) => {
      const t = normalizePlaceTitle(i.title);
      return t.includes(key) || key.includes(t);
    });
  if (hit?.lat != null && hit.lng != null) {
    return { lat: hit.lat, lng: hit.lng, address: hit.address };
  }
  return null;
}

export function normalizePlaceTitle(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 병원명으로 네이버 지역검색 → 주소 (상권·지오코딩용) */
export async function resolveAddressFromClinicName(
  clinicName: string
): Promise<string | null> {
  const items = await fetchLocalSearchPlaces(clinicName.trim(), 3);
  if (!items.length) return null;
  const key = normalizePlaceTitle(clinicName);
  const hit =
    items.find((i) => normalizePlaceTitle(i.title) === key) ??
    items.find((i) => {
      const t = normalizePlaceTitle(i.title);
      return t.includes(key) || key.includes(t);
    }) ??
    items[0];
  return hit?.address?.trim() || null;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}
