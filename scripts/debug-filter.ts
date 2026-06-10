import { config } from "dotenv";
config({ path: ".env.local" });

import { filterCompetitorPlaces, resolveAllowedNaverCategories } from "../src/lib/analysis/competitorFilter";
import { resolveMapPlaces } from "../src/lib/analysis/resolveMapPlaces";
import { filterCompetitorsWithinRadiusAdaptive, regionHintFromAddress } from "../src/lib/analysis/competitorRadius";

async function main() {
  const specialty = "비뇨기과";
  const keyword = "부평 비뇨기과";
  const address = "인천광역시 부평구 광장로 4";
  const clinicName = "";

  const places = await resolveMapPlaces(keyword, regionHintFromAddress(address), specialty);
  console.log("collected:", places.length);

  const allowed = resolveAllowedNaverCategories({
    clinicName,
    specialty,
    mainSearchKeyword: keyword,
  });
  console.log("allowed:", [...allowed]);

  const filtered = filterCompetitorPlaces(places, {
    clinicName,
    specialty,
    mainSearchKeyword: keyword,
  });
  console.log("afterCategory:", filtered.length);

  const radius = await filterCompetitorsWithinRadiusAdaptive(filtered, {
    centerLat: 37.4910552,
    centerLng: 126.7225348,
    radiusMeters: 1500,
    regionHint: regionHintFromAddress(address),
  });
  console.log("afterRadius:", radius.places.length, radius);
}

main().catch(console.error);
