import { config } from "dotenv";
config({ path: ".env.local" });

import {
  fetchKeywordVolumes,
  keywordCandidatesForPlace,
  resolveVolumePairForPlace,
  stripMedicalSuffix,
} from "../src/lib/analysis/naverSearchAd";

const name = "부평그린마취통증의학과의원";

async function main() {
  console.log("short:", stripMedicalSuffix(name));
  console.log("candidates:", keywordCandidatesForPlace(name));

  const volumes = await fetchKeywordVolumes(keywordCandidatesForPlace(name));
  console.log("\nAPI keys returned:", [...volumes.keys()].slice(0, 20));
  console.log("count:", volumes.size);

  const pair = resolveVolumePairForPlace(name, volumes);
  console.log("\nresolve pair:", pair);
}

main().catch(console.error);
