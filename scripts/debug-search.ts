import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { filterCompetitorPlaces, resolveAllowedNaverCategories } from "../src/lib/analysis/competitorFilter";
import { fetchNaverMapPlaceNames, parsePlaceListFromInnerText } from "../src/lib/analysis/naverMapCompetitors";
import { hospitalCoreTokens, markChannelFromHits } from "../src/lib/analysis/channelMarks";
import { naverSearch, toSearchHits, stripHtml } from "../src/lib/analysis/naverOpenSearch";

const clinic = "부평그린마취통증의학과의원";
const keyword = "부평 정형외과";
const specialty = "마취통증의학과";

async function main() {
  console.log("=== core tokens ===");
  console.log(hospitalCoreTokens(clinic));

  console.log("\n=== map raw ===");
  const raw = await fetchNaverMapPlaceNames(keyword, { maxResults: 20 });
  console.log("count:", raw.length);
  for (const p of raw) {
    console.log(` - ${p.name} | cat=${p.naverCategory ?? "?"} | tier=${p.facilityTier} | ad=${p.isAd}`);
  }

  const allowed = resolveAllowedNaverCategories({
    clinicName: clinic,
    specialty,
    mainSearchKeyword: keyword,
  });
  console.log("\nallowed categories:", [...allowed]);

  const filtered = filterCompetitorPlaces(raw, {
    clinicName: clinic,
    specialty,
    mainSearchKeyword: keyword,
  });
  console.log("\n=== after filter ===", filtered.length);
  for (const p of filtered) {
    console.log(` - ${p.name}`);
  }

  console.log("\n=== news (full name) ===");
  const news = await naverSearch("news", clinic, 10);
  console.log("total:", news.total, "items:", news.items.length);
  for (const item of news.items.slice(0, 5)) {
    const title = stripHtml(item.title);
    const desc = stripHtml(item.description);
    console.log(" title:", title);
    console.log(" desc:", desc.slice(0, 80));
  }
  const mark = markChannelFromHits(toSearchHits(news.items, "news"), clinic, {
    mode: "news",
  });
  console.log("news mark (news mode):", mark);

  console.log("\n=== local API (부평 정형외과) ===");
  const { fetchLocalSearchPlaces } = await import("../src/lib/analysis/naverLocalSearch");
  const local = await fetchLocalSearchPlaces(keyword, 10);
  for (const p of local) {
    console.log(` - ${p.title} | ${p.naverCategory ?? "?"}`);
  }

  console.log("\n=== news (부평그린) ===");
  const news2 = await naverSearch("news", "부평그린", 10);
  console.log("total:", news2.total);
  for (const item of news2.items.slice(0, 3)) {
    console.log(" ", stripHtml(item.title));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
