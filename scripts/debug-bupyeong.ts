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

const EXPECTED = [
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

function matchesExpected(name: string, expected: string) {
  const n = norm(name);
  const e = norm(expected);
  return n.includes(e) || e.includes(n);
}

async function main() {
  const specialty = "비뇨기과";
  const keyword = "부평 비뇨기과";
  const address = "인천 부평구 부평동 549-6";
  const clinicName = "";

  const geo = await geocodeAddress(address);
  console.log("geo:", geo.lat, geo.lng, geo.roadAddress);
  console.log("geo.regionHints:", geo.regionHints);
  const hint = primaryRegionHintFromGeocode(geo);
  const lookupHints = regionHintsForPlaceLookup(geo, keyword);
  console.log("regionHint:", hint, "lookupHints:", lookupHints);

  const places = await resolveMapPlaces(keyword, hint, specialty);
  console.log("\ncollected:", places.length);
  for (const p of places.slice(0, 25)) {
    console.log(" -", p.name, p.naverCategory ?? "-", p.lat?.toFixed(5) ?? "no-coord");
  }

  const filtered = filterCompetitorPlaces(places, {
    clinicName,
    specialty,
    mainSearchKeyword: keyword,
  });
  console.log("\nafterCategory:", filtered.length);
  for (const p of filtered) console.log(" *", p.name);

  const radius = await filterCompetitorsWithinRadius(filtered, {
    centerLat: geo.lat,
    centerLng: geo.lng,
    radiusMeters: 1500,
    regionHint: hint,
    regionHints: lookupHints,
  });
  console.log("\nafterRadius(1.5km):", radius.length);
  for (const p of radius) console.log(" +", p.name);

  console.log("\n--- expected vs pipeline ---");
  const top = radius.find((p) => p.name.includes("탑"));
  console.log("탑 비뇨기과의원 in radius:", top ? top.name : "excluded");

  for (const exp of EXPECTED) {
    const inCol = places.find((p) => matchesExpected(p.name, exp));
    const inCat = filtered.find((p) => matchesExpected(p.name, exp));
    const inRad = radius.find((p) => matchesExpected(p.name, exp));
    console.log(
      exp,
      inCol ? "collected" : "MISS collect",
      inCat ? "category" : "MISS cat",
      inRad ? "radius" : "MISS radius"
    );
  }
}

main().catch(console.error);
