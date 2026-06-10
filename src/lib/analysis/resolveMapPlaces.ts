import { corePlaceKey, deduplicateMapPlaces } from "./competitorDedup";
import type { MapPlaceHit } from "./competitorFilter";
import { fetchNaverMapPlaceNames } from "./naverMapCompetitors";
import {
  fetchLocalSearchPlaces,
  fetchLocalSearchPlacesUpTo,
  normalizePlaceTitle,
  type LocalSearchItem,
} from "./naverLocalSearch";
import { isNaverOpenSearchConfigured } from "./naverOpenSearch";
import {
  naverCategoriesForSpecialty,
  preferNaverCategory,
} from "./competitorFilter";
import { resolveCanonicalSpecialty } from "./specialties";

/** 지점·지역 접미사 제거 후 상호 매칭 (예: ○○의원 인천부평) */
function loosePlaceMatchKey(title: string): string {
  return corePlaceKey(title);
}

function localItemToMapHit(item: LocalSearchItem): MapPlaceHit {
  return {
    name: item.title,
    isAd: false,
    naverCategory: item.naverCategory,
    facilityTier: item.facilityTier,
    lat: item.lat,
    lng: item.lng,
    address: item.address,
  };
}

/** 지역검색 좌표를 지도 목록 상호에 매칭 */
export function enrichPlacesWithLocalCoords(
  places: MapPlaceHit[],
  localItems: LocalSearchItem[]
): MapPlaceHit[] {
  const byTitle = new Map<string, LocalSearchItem>();
  for (const item of localItems) {
    if (item.lat == null || item.lng == null) continue;
    byTitle.set(normalizePlaceTitle(item.title), item);
  }

  return places.map((place) => {
    const key = normalizePlaceTitle(place.name);
    let hit = byTitle.get(key);
    if (!hit) {
      for (const [k, item] of byTitle) {
        if (k.includes(key) || key.includes(k)) {
          hit = item;
          break;
        }
      }
    }
    if (!hit) {
      const loose = loosePlaceMatchKey(key);
      for (const [k, item] of byTitle) {
        if (loosePlaceMatchKey(k) === loose) {
          hit = item;
          break;
        }
      }
    }
    if (!hit) return place;

    return {
      ...place,
      lat: place.lat ?? hit.lat,
      lng: place.lng ?? hit.lng,
      address: place.address ?? hit.address,
      naverCategory: preferNaverCategory(hit.naverCategory, place.naverCategory),
      facilityTier: place.facilityTier ?? hit.facilityTier,
    };
  });
}

/** 네이버 지도 + 지역검색(좌표·카테고리) 병합 */
export async function resolveMapPlaces(
  query: string,
  regionHint?: string,
  specialty?: string
): Promise<MapPlaceHit[]> {
  const merged = new Map<string, MapPlaceHit>();
  const localPool: LocalSearchItem[] = [];

  const queries = new Set<string>();
  const q0 = query.trim();
  if (q0) queries.add(q0);
  const hint = regionHint?.trim();
  if (hint && q0) queries.add(`${hint} ${q0}`.trim());
  const spec = specialty?.trim()
    ? resolveCanonicalSpecialty(specialty.trim())
    : "";
  if (hint && spec) {
    queries.add(`${hint} ${spec}`.trim());
    for (const cat of naverCategoriesForSpecialty(spec)) {
      if (cat !== spec) queries.add(`${hint} ${cat}`.trim());
    }
  }

  if (isNaverOpenSearchConfigured()) {
    for (const q of [...queries]) {
      try {
        const local = await fetchLocalSearchPlacesUpTo(q, 50);
        localPool.push(...local);
        for (const item of local) {
          const hit = localItemToMapHit(item);
          merged.set(hit.name, hit);
        }
      } catch {
        /* 다음 쿼리 시도 */
      }
      const all = [...queries];
      if (all.indexOf(q) < all.length - 1) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  try {
    const fromMap = await fetchNaverMapPlaceNames(q0 || query, { maxResults: 30 });
    for (const p of fromMap) {
      const prev = merged.get(p.name);
      merged.set(
        p.name,
        prev
          ? {
              ...prev,
              ...p,
              lat: prev.lat ?? p.lat,
              lng: prev.lng ?? p.lng,
              address: prev.address ?? p.address,
              naverCategory: preferNaverCategory(
                prev.naverCategory,
                p.naverCategory
              ),
            }
          : p
      );
    }
  } catch {
    /* Playwright 실패 시 지역검색만 */
  }

  const enriched = enrichPlacesWithLocalCoords([...merged.values()], localPool);
  for (const p of enriched) merged.set(p.name, p);

  const withCoords = await backfillMissingCoords(
    [...merged.values()],
    regionHint
  );
  const list = deduplicateMapPlaces(withCoords);
  if (list.length) return list;

  throw new Error(
    "경쟁사 자동 수집 실패 — `npx playwright install chromium` 실행 또는 NAVER_OPEN_API_CLIENT_ID·SECRET 설정"
  );
}

/** 지도 상호(좌표 없음) → 지역검색 API로 개별 좌표 보강 */
async function backfillMissingCoords(
  places: MapPlaceHit[],
  regionHint?: string
): Promise<MapPlaceHit[]> {
  if (!isNaverOpenSearchConfigured()) return places;

  const shortHints = [
    regionHint?.match(/부천/)?.[0] ?? "",
    regionHint?.match(/[가-힣]+동/)?.[0] ?? "",
    regionHint?.split(/\s+/).find((p) => /[가-힣]+시$/.test(p)) ?? "",
    regionHint?.split(/\s+/).find((p) => /[가-힣]+구$/.test(p)) ?? "",
    regionHint ?? "",
  ].filter((h, i, arr) => h.length >= 2 && arr.indexOf(h) === i);

  const out: MapPlaceHit[] = [];
  for (const place of places) {
    if (place.lat != null && place.lng != null) {
      out.push(place);
      continue;
    }

    let hit: LocalSearchItem | undefined;
    for (const hint of shortHints) {
      try {
        const items = await fetchLocalSearchPlaces(
          `${place.name} ${hint}`.trim(),
          5
        );
        hit =
          items.find((i) => i.lat != null && namesRoughlyMatch(place.name, i.title)) ??
          items.find((i) => i.lat != null);
        if (hit?.lat != null) break;
      } catch {
        /* 다음 힌트 */
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    if (hit?.lat != null && hit.lng != null) {
      out.push({
        ...place,
        lat: hit.lat,
        lng: hit.lng,
        address: place.address ?? hit.address,
        naverCategory: preferNaverCategory(hit.naverCategory, place.naverCategory),
        facilityTier: place.facilityTier ?? hit.facilityTier,
      });
    } else {
      out.push(place);
    }
  }
  return out;
}

function namesRoughlyMatch(a: string, b: string): boolean {
  const na = corePlaceKey(a);
  const nb = corePlaceKey(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}
