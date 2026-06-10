import { config } from "dotenv";
config({ path: ".env.local" });

import { geocodeAddress } from "../src/lib/analysis/geocode";
import {
  fetchPlaceCoordinates,
  fetchLocalSearchPlaces,
} from "../src/lib/analysis/naverLocalSearch";
import { regionHintsForPlaceLookup } from "../src/lib/analysis/competitorRadius";
import { haversineMeters } from "../src/lib/analysis/utils";

async function main() {
  const geo = await geocodeAddress("인천 부평구 부평동 549-6");
  const hints = regionHintsForPlaceLookup(geo, "부평 비뇨기과");
  const ctx = {
    centerLat: geo.lat,
    centerLng: geo.lng,
    radiusMeters: 1500,
    regionHints: hints,
  };

  for (const q of [
    `탑 비뇨기과의원 ${hints[0]}`,
    "탑 비뇨기과의원 부평",
    "탑 비뇨기과의원 부천",
    "탑 비뇨기과의원",
  ]) {
    console.log("\nquery:", q);
    const items = await fetchLocalSearchPlaces(q, 5);
    for (const i of items) {
      const d =
        i.lat && i.lng
          ? Math.round(haversineMeters(geo.lat, geo.lng, i.lat, i.lng))
          : null;
      console.log(
        i.title,
        "|",
        i.address,
        "|",
        d != null ? `${d}m` : "no-coord"
      );
    }
  }

  const picked = await fetchPlaceCoordinates("탑 비뇨기과의원", hints[0], ctx);
  console.log("\nnew logic picked:", picked ?? "null (excluded)");

  const geo2 = await geocodeAddress(`탑 비뇨기과의원 ${hints[0]}`);
  const d2 = Math.round(
    haversineMeters(geo.lat, geo.lng, geo2.lat, geo2.lng)
  );
  console.log(
    "geocode fallback:",
    geo2.roadAddress,
    geo2.jibunAddress,
    d2 + "m"
  );
}

main().catch(console.error);
