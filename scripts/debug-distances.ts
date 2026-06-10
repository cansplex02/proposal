import { config } from "dotenv";
config({ path: ".env.local" });

import { filterCompetitorPlaces } from "../src/lib/analysis/competitorFilter";
import { resolveMapPlaces } from "../src/lib/analysis/resolveMapPlaces";
import {
  filterCompetitorsWithinRadius,
  primaryRegionHintFromGeocode,
  regionHintsForPlaceLookup,
} from "../src/lib/analysis/competitorRadius";
import { geocodeAddress } from "../src/lib/analysis/geocode";
import { fetchPlaceCoordinates } from "../src/lib/analysis/naverLocalSearch";
import { haversineMeters } from "../src/lib/analysis/utils";

const USER_LIST = [
  "조희주비뇨의학과의원",
  "서울바른비뇨의학과의원",
  "부평연세비뇨기과의원",
  "이영재비뇨기과의원",
  "메디포맨남성의원",
  "마로비뇨기과의원",
  "박비뇨기과의원",
];

function norm(s: string) {
  return s.replace(/\s+/g, "").toLowerCase();
}

function matches(name: string, exp: string) {
  const n = norm(name);
  const e = norm(exp);
  return n.includes(e) || e.includes(n);
}

async function main() {
  const address = "인천 부평구 부평동 549-6";
  const keyword = "부평 비뇨기과";
  const specialty = "비뇨기과";
  const geo = await geocodeAddress(address);
  const hint = primaryRegionHintFromGeocode(geo);
  const lookupHints = regionHintsForPlaceLookup(geo, keyword);

  console.log("center:", geo.lat, geo.lng);
  console.log("road:", geo.roadAddress);
  console.log("jibun:", geo.jibunAddress);

  for (const name of USER_LIST) {
    let coords = await fetchPlaceCoordinates(name, hint);
    if (!coords) {
      for (const h of lookupHints) {
        coords = await fetchPlaceCoordinates(name, h);
        if (coords) break;
      }
    }
    if (!coords) {
      console.log(name, "NO COORDS");
      continue;
    }
    const d = haversineMeters(geo.lat, geo.lng, coords.lat, coords.lng);
    console.log(
      name,
      `${Math.round(d)}m`,
      d <= 1500 ? "OK" : "OUTSIDE",
      coords.lat.toFixed(5),
      coords.lng.toFixed(5)
    );
  }

  const places = await resolveMapPlaces(keyword, hint, specialty);
  const filtered = filterCompetitorPlaces(places, {
    clinicName: "",
    specialty,
    mainSearchKeyword: keyword,
  });
  const radius = await filterCompetitorsWithinRadius(filtered, {
    centerLat: geo.lat,
    centerLng: geo.lng,
    radiusMeters: 1500,
    regionHint: hint,
    regionHints: lookupHints,
  });

  console.log("\nIn radius result:", radius.length);
  for (const exp of USER_LIST) {
    const hit = radius.find((p) => matches(p.name, exp));
    console.log(exp, hit ? `YES (${Math.round(haversineMeters(geo.lat, geo.lng, hit.lat!, hit.lng!))}m)` : "MISSING");
  }
}

main().catch(console.error);
