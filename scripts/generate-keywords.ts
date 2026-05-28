/**
 * 키워드 지도만 생성 (API 불필요)
 *
 * 예:
 *   npm run generate:keywords -- --specialty 유방외과 --regions "강남,서초동,양재역,매봉역"
 *   npm run generate:keywords -- --specialty 피부과 --topics "피부과,여드름,레이저토닝" --regions "수원,영통"
 */
import fs from "fs";
import path from "path";
import { buildKeywordMap, buildStrategyCards } from "../src/lib/analysis/keywords";
import { topicsForSpecialty } from "../src/lib/analysis/specialties";

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const specialty = getArg("--specialty");
  const regionsRaw = getArg("--regions");
  const topicsRaw = getArg("--topics");
  const slug = getArg("--slug") || "keywords-output";

  if (!specialty || !regionsRaw) {
    console.error(`
사용법:
  npm run generate:keywords -- --specialty 유방외과 --regions "강남,서초동,양재역"

옵션:
  --topics  "유방초음파,유방암,맘모톰"  (비우면 진료과 템플릿)
  --slug    파일명 (기본: keywords-output)
`);
    process.exit(1);
  }

  const regions = regionsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  const topics = topicsRaw
    ? topicsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    : topicsForSpecialty(specialty);

  const { columns, rows } = buildKeywordMap(regions, topics);
  const strategyCards = buildStrategyCards(specialty, regions, topics);

  const outDir = path.join(process.cwd(), "data", "keywords");
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `${slug}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ specialty, regions, topics, columns, rows, strategyCards }, null, 2),
    "utf8"
  );

  const topicCols = columns.filter((c) => c.id !== "region");
  const header = ["지역", ...topicCols.map((c) => c.label)].join("\t");
  const lines = rows.map((r) =>
    [r.region, ...topicCols.map((c) => r.keywords[c.id] || "")].join("\t")
  );
  const tsvPath = path.join(outDir, `${slug}.tsv`);
  fs.writeFileSync(tsvPath, [header, ...lines].join("\n"), "utf8");

  console.log("\n✓ 키워드 생성 완료 (API 없음)\n");
  console.log(`  진료과: ${specialty}`);
  console.log(`  지역 ${regions.length}개 · 주제 ${topics.length}개\n`);
  console.log(header);
  console.log(lines.slice(0, 5).join("\n"));
  if (lines.length > 5) console.log(`  ... 외 ${lines.length - 5}행\n`);
  console.log("전략 카드:");
  strategyCards.forEach((c) => console.log(`  · ${c.label}: ${c.body.replace(/<[^>]+>/g, "")}`));
  console.log(`\n저장:\n  ${jsonPath}\n  ${tsvPath}`);
  console.log("\n엑셀에서 열기: .tsv 파일 더블클릭\n");
}

main();
