import { config } from "dotenv";
config({ path: ".env.local" });

import { geocodeAddress } from "../src/lib/analysis/geocode";
import {
  filterCompetitorPlaces,
  inferCategoryFromPlaceName,
  placeMatchesCategory,
  resolveAllowedNaverCategories,
  type MapPlaceHit,
} from "../src/lib/analysis/competitorFilter";
import {
  filterCompetitorsWithinRadius,
  primaryRegionHintFromGeocode,
  regionHintsForPlaceLookup,
} from "../src/lib/analysis/competitorRadius";
import { fetchPlaceCoordinates } from "../src/lib/analysis/naverLocalSearch";
import { resolveMapPlaces } from "../src/lib/analysis/resolveMapPlaces";
import { haversineMeters } from "../src/lib/analysis/utils";

const EXPECTED = [
  "서울비뇨기과의원 부천",
  "명비뇨기과",
  "탑비뇨기과",
  "서울N비뇨의학과의원 부천",
  "제니스비뇨의학과의원",
  "트루맨남성의원 부천점",
  "중동비뇨기과의원",
];

async function main() {
  const specialty = "비뇨기과";
  const keyword = "부천 비뇨기과";
  const address = "경기도 부천시 원미구 길주로 183-3";
  const clinicName = "";

  const geo = await geocodeAddress(address);
  const hint = primaryRegionHintFromGeocode(geo);
  const hints = regionHintsForPlaceLookup(geo, keyword);
  const ctx = {
    centerLat: geo.lat,
    centerLng: geo.lng,
    radiusMeters: 1500,
    regionHint: hint,
    regionHints: hints,
  };
  const filterCtx = { clinicName, specialty, mainSearchKeyword: keyword };
  const allowed = resolveAllowedNaverCategories(filterCtx);

  console.log("center:", geo.lat, geo.lng, geo.roadAddress);
  console.log("regionHint:", hint);
  console.log("allowed categories:", [...allowed]);

  const places = await resolveMapPlaces(keyword, hint, specialty);
  const names = new Set(places.map((p) => p.name));
  console.log("\n=== collected from map+local:", places.length);
  for (const e of EXPECTED) {
    const hit = places.find((p) => p.name.includes(e.replace(/\s/g, "")) || e.includes(p.name.replace(/\s/g, "")));
    console.log(
      e,
      hit ? `FOUND as "${hit.name}" coords=${hit.lat != null}` : "NOT in collection"
    );
  }

  const catFiltered = filterCompetitorPlaces(places, filterCtx);
  const catNames = new Set(catFiltered.map((p) => p.name));
  console.log("\n=== after category filter:", catFiltered.length);

  const radiusFiltered = await filterCompetitorsWithinRadius(catFiltered, ctx);
  const radiusNames = new Set(radiusFiltered.map((p) => p.name));
  console.log("=== after radius 1.5km:", radiusFiltered.length);
  console.log("kept:", radiusFiltered.map((p) => p.name).join(", "));

  console.log("\n=== per expected clinic diagnostic ===");
  for (const name of EXPECTED) {
    const place: MapPlaceHit = {
      name,
      isAd: false,
      naverCategory: inferCategoryFromPlaceName(name) ?? undefined,
    };
    const inCollect = [...names].some(
      (n) => n.replace(/\s/g, "").includes(name.replace(/\s/g, "")) || name.replace(/\s/g, "").includes(n.replace(/\s/g, ""))
    );
    const catOk = placeMatchesCategory(place, allowed, keyword);
    const coords = await fetchPlaceCoordinates(name, hint, {
      centerLat: geo.lat,
      centerLng: geo.lng,
      radiusMeters: 1500,
      regionHints: hints,
    });
    const dist = coords
      ? Math.round(haversineMeters(geo.lat, geo.lng, coords.lat, coords.lng))
      : null;
    const radiusOk = dist != null && dist <= 1500;
    console.log({
      name,
      inCollect,
      inferredCat: place.naverCategory,
      catOk,
      coords: coords ? `${coords.lat},${coords.lng}` : null,
      distM: dist,
      radiusOk,
      inCatFilter: [...catNames].some((n) => n.includes(name.slice(0, 4))),
      inRadiusFilter: [...radiusNames].some((n) => n.includes(name.slice(0, 4))),
    });
    await new Promise((r) => setTimeout(r, 300));
  }
}

main().catch(console.error);
