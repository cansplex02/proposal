import { geocodeAddress, type GeocodeResult } from "./geocode";
import type { MapPlaceHit } from "./competitorFilter";
import {
  fetchPlaceCoordinates,
  type PlaceCoordResult,
  type PlaceLookupContext,
} from "./naverLocalSearch";
import { haversineMeters } from "./utils";

export type RadiusFilterContext = {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  /** geocode·지역검색 쿼리 힌트 (예: 인천 부평구 부평동) */
  regionHint: string;
  /** 상호 좌표 조회 시 순차 시도할 추가 힌트 */
  regionHints?: string[];
};

const coordCache = new Map<string, PlaceCoordResult | null>();

/** 분석 기준 행정구역과 다른 지역 주소(부천 등) 제외 */
export function placeAddressMatchesAnalysisRegion(
  address: string | undefined,
  regionHints: string[]
): boolean {
  if (!address?.trim()) return true;
  const a = address.replace(/\s+/g, "");

  const gu = regionHints.find((h) => /[구군]$/.test(h));
  if (gu?.includes("부평") && /부천/.test(a)) return false;

  if (
    regionHints.some((h) => h === "인천" || h.includes("인천")) &&
    /부천시|경기도부천|김포시|서울특별시|서울시(?![가-힣]*인천)/.test(a)
  ) {
    return false;
  }

  if (gu) {
    const guCompact = gu.replace(/\s/g, "");
    if (
      (a.includes("인천") || a.includes("인천광역시")) &&
      !a.includes(guCompact)
    ) {
      const otherGu = a.match(/인천광역시([가-힣]+구)/)?.[1];
      if (otherGu && otherGu !== guCompact) return false;
    }
  }

  return true;
}

function placeLookupContext(ctx: RadiusFilterContext): PlaceLookupContext {
  return {
    centerLat: ctx.centerLat,
    centerLng: ctx.centerLng,
    radiusMeters: ctx.radiusMeters,
    regionHints: lookupHints(ctx),
  };
}

function placeAllowedInRadius(
  place: MapPlaceHit,
  coords: { lat: number; lng: number },
  ctx: RadiusFilterContext
): boolean {
  const dist = haversineMeters(
    ctx.centerLat,
    ctx.centerLng,
    coords.lat,
    coords.lng
  );
  if (dist > ctx.radiusMeters) return false;

  const hints = lookupHints(ctx);
  const addr = place.address;
  if (!placeAddressMatchesAnalysisRegion(addr, hints)) return false;

  return true;
}

function cacheKey(name: string, hint: string): string {
  return `${name}|${hint}`;
}

function lookupHints(ctx: RadiusFilterContext): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (h?: string) => {
    const t = h?.trim();
    if (!t || t.length < 2 || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  add(ctx.regionHint);
  for (const h of ctx.regionHints ?? []) add(h);
  return out;
}

async function resolvePlaceCoords(
  place: MapPlaceHit,
  ctx: RadiusFilterContext
): Promise<PlaceCoordResult | null> {
  const lookup = placeLookupContext(ctx);

  if (place.lat != null && place.lng != null) {
    const candidate = {
      lat: place.lat,
      lng: place.lng,
      address: place.address,
    };
    return placeAllowedInRadius(place, candidate, ctx) ? candidate : null;
  }

  for (const hint of lookupHints(ctx)) {
    const key = cacheKey(place.name, hint);
    if (coordCache.has(key)) {
      const cached = coordCache.get(key);
      if (
        cached &&
        placeAllowedInRadius(
          { ...place, address: place.address ?? cached.address },
          cached,
          ctx
        )
      ) {
        return cached;
      }
      continue;
    }

    let coords = await fetchPlaceCoordinates(place.name, hint, lookup);
    if (!coords) {
      try {
        const geo = await geocodeAddress(`${place.name} ${hint}`);
        const addr = geo.jibunAddress || geo.roadAddress;
        if (!placeAddressMatchesAnalysisRegion(addr, lookup.regionHints)) {
          coordCache.set(key, null);
          continue;
        }
        coords = { lat: geo.lat, lng: geo.lng, address: addr };
        const dist = haversineMeters(
          ctx.centerLat,
          ctx.centerLng,
          coords.lat,
          coords.lng
        );
        if (dist > ctx.radiusMeters) {
          coordCache.set(key, null);
          continue;
        }
      } catch {
        coords = null;
      }
    }

    coordCache.set(key, coords);
    if (
      coords &&
      placeAllowedInRadius(
        { ...place, address: place.address ?? coords.address },
        coords,
        ctx
      )
    ) {
      return coords;
    }
  }

  return null;
}

/** 우리 병원(검색 기준 좌표) 기준 반경 내 경쟁 업체만 */
export async function filterCompetitorsWithinRadius(
  places: MapPlaceHit[],
  ctx: RadiusFilterContext
): Promise<MapPlaceHit[]> {
  const kept: MapPlaceHit[] = [];
  const needsLookup: MapPlaceHit[] = [];

  for (const place of places) {
    if (place.lat != null && place.lng != null) {
      if (
        placeAllowedInRadius(
          place,
          { lat: place.lat, lng: place.lng },
          ctx
        )
      ) {
        kept.push(place);
      }
      continue;
    }
    needsLookup.push(place);
  }

  const BATCH = 4;
  for (let i = 0; i < needsLookup.length; i += BATCH) {
    const batch = needsLookup.slice(i, i + BATCH);
    const resolved = await Promise.all(
      batch.map(async (place) => {
        const coords = await resolvePlaceCoords(place, ctx);
        return { place, coords };
      })
    );
    for (const { place, coords } of resolved) {
      if (!coords) continue;
      if (!placeAllowedInRadius(place, coords, ctx)) continue;
      kept.push({
        ...place,
        lat: coords.lat,
        lng: coords.lng,
        address: place.address ?? coords.address,
      });
    }
    if (i + BATCH < needsLookup.length) await delay(200);
  }

  return kept;
}

/** 1.5km에서 부족하면 2.5·3km까지 단계 확대 */
export async function filterCompetitorsWithinRadiusAdaptive(
  places: MapPlaceHit[],
  ctx: RadiusFilterContext
): Promise<{
  places: MapPlaceHit[];
  radiusMetersUsed: number;
  radiusExpanded: boolean;
}> {
  const radii = [ctx.radiusMeters, 2500, 3500, 5000].filter(
    (r, i, arr) => i === 0 || r > arr[i - 1]
  );

  let best: MapPlaceHit[] = [];
  let used = ctx.radiusMeters;

  for (const r of radii) {
    const got = await filterCompetitorsWithinRadius(places, {
      ...ctx,
      radiusMeters: r,
    });
    if (got.length > best.length) {
      best = got;
      used = r;
    }
    if (best.length >= 10) break;
  }

  return {
    places: best,
    radiusMetersUsed: used,
    radiusExpanded: used > ctx.radiusMeters,
  };
}

/** 지오코딩 결과 → 지역검색·좌표 조회용 대표 힌트 (도로명 제외) */
export function primaryRegionHintFromGeocode(
  geo: Pick<GeocodeResult, "roadAddress" | "regionHints">
): string {
  const sido = geo.regionHints.find(
    (h) => /^[가-힣]+$/.test(h) && !/[구군동읍면리]/.test(h)
  );
  const gu = geo.regionHints.find((h) => /[구군]$/.test(h));
  const dong = geo.regionHints.find((h) => /[동읍면]$/.test(h));
  const parts = [sido, gu, dong].filter(Boolean) as string[];
  if (parts.length >= 2) return parts.join(" ");

  const fromRoad = extractAdminFromAddress(geo.roadAddress);
  if (fromRoad) return fromRoad;

  return regionHintFromAddress(geo.roadAddress);
}

/** 상호별 좌표 조회에 쓸 지역 힌트 후보 (실패 시 다음 힌트 시도) */
export function regionHintsForPlaceLookup(
  geo: Pick<GeocodeResult, "roadAddress" | "regionHints">,
  mainSearchKeyword?: string
): string[] {
  const hints = new Set<string>();
  const add = (s?: string) => {
    const t = s?.trim();
    if (t && t.length >= 2) hints.add(t);
  };

  add(primaryRegionHintFromGeocode(geo));
  for (const h of geo.regionHints) add(h);

  const gu = geo.regionHints.find((h) => /구$/.test(h));
  const dong = geo.regionHints.find((h) => /동$/.test(h));
  if (gu && dong) add(`${gu} ${dong}`);
  if (gu) {
    add(gu);
    add(gu.replace(/구$/, ""));
  }

  add(extractAdminFromAddress(geo.roadAddress) ?? undefined);

  const kw = mainSearchKeyword?.trim();
  if (kw) {
    for (const token of kw.split(/\s+/)) {
      if (token.length >= 2 && !/(과|의학|클리닉|병원|의원)/u.test(token)) {
        add(token);
      }
    }
  }

  return [...hints].slice(0, 10);
}

function extractAdminFromAddress(address: string): string | null {
  const s = address.replace(/\s+/g, " ").trim();
  const full = s.match(
    /(?:([가-힣]+(?:특별시|광역시|특별자치시|시|도))?)\s*([가-힣]+구)\s*([가-힣]+동)/
  );
  if (full) {
    const sido = normalizeSidoShort(full[1] ?? "");
    return [sido, full[2], full[3]].filter(Boolean).join(" ");
  }

  const gu = s.match(/([가-힣]+구)/)?.[1];
  const dong = s.match(/([가-힣]+동)/)?.[1];
  if (gu) {
    const sido = s.match(/([가-힣]+(?:특별시|광역시|시|도))/)?.[1];
    return [sido ? normalizeSidoShort(sido) : "", gu, dong ?? ""]
      .filter(Boolean)
      .join(" ");
  }
  return null;
}

function normalizeSidoShort(s: string): string {
  return s
    .replace(/특별시|광역시|특별자치시|자치시/g, "")
    .replace(/도$/, "")
    .trim();
}

/** 입력 주소 문자열에서 행정구역 힌트 (도로명·건물명 제외) */
export function regionHintFromAddress(address: string): string {
  const admin = extractAdminFromAddress(address);
  if (admin) return admin;

  const parts = address
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(
      (p) =>
        p.length >= 2 &&
        !/(대로|로|길|\d|번지|층|호|빌딩|타워|프라자|도시)/.test(p)
    );
  return parts.slice(0, 3).join(" ") || address.trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
