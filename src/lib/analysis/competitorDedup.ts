import type { MapPlaceHit } from "./competitorFilter";
import { normalizePlaceTitle } from "./naverLocalSearch";
import { haversineMeters } from "./utils";

/** 상호 비교용 — 시설·지역 접미사 제거 */
export function corePlaceKey(title: string): string {
  return normalizePlaceTitle(title)
    .replace(/(의원|병원|클리닉|센터|의료원|한의원|치과)$/u, "")
    .replace(
      /(부천|인천|서울|부평|강남|본점|지점|점|역|지역|점|동|구)$/u,
      ""
    );
}

function namesLikelySamePlace(a: string, b: string): boolean {
  const na = normalizePlaceTitle(a);
  const nb = normalizePlaceTitle(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ca = corePlaceKey(a);
  const cb = corePlaceKey(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  return ca.includes(cb) || cb.includes(ca);
}

function preferPlaceName(a: string, b: string): string {
  const hasBranchA = /부천|지점|점|역|동/u.test(a);
  const hasBranchB = /부천|지점|점|역|동/u.test(b);
  if (hasBranchA && !hasBranchB) return a;
  if (hasBranchB && !hasBranchA) return b;
  return a.length >= b.length ? a : b;
}

function mergePlaceHits(a: MapPlaceHit, b: MapPlaceHit): MapPlaceHit {
  const pick =
    a.lat != null && b.lat != null
      ? a
      : a.lat != null
        ? a
        : b.lat != null
          ? b
          : a;
  const other = pick === a ? b : a;
  return {
    ...pick,
    ...other,
    name: preferPlaceName(a.name, b.name),
    lat: pick.lat ?? other.lat,
    lng: pick.lng ?? other.lng,
    address: pick.address ?? other.address,
    naverCategory: pick.naverCategory ?? other.naverCategory,
    facilityTier: pick.facilityTier ?? other.facilityTier,
    isAd: pick.isAd || other.isAd,
  };
}

/** 동일 지점 중복 제거 (예: 서울비뇨기과의원 ↔ 서울비뇨기과의원 부천) */
export function deduplicateMapPlaces(places: MapPlaceHit[]): MapPlaceHit[] {
  const kept: MapPlaceHit[] = [];

  for (const place of places) {
    let merged = false;
    for (let i = 0; i < kept.length; i++) {
      const prev = kept[i];
      const sameName = namesLikelySamePlace(prev.name, place.name);
      if (!sameName) continue;

      if (
        prev.lat != null &&
        prev.lng != null &&
        place.lat != null &&
        place.lng != null
      ) {
        const dist = haversineMeters(
          prev.lat,
          prev.lng,
          place.lat,
          place.lng
        );
        if (dist > 400) continue;
      }

      kept[i] = mergePlaceHits(prev, place);
      merged = true;
      break;
    }
    if (!merged) kept.push(place);
  }

  return kept;
}

/** 최종 경쟁사 상호 목록 중복 제거 */
export function deduplicateRivalNames(names: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    const dup = out.find((n) => namesLikelySamePlace(n, name));
    if (dup) {
      const idx = out.indexOf(dup);
      out[idx] = preferPlaceName(dup, name);
    } else {
      out.push(name);
    }
  }
  return out;
}
