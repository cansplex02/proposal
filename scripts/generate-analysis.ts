/**
 * 경쟁분석 반자동 생성 CLI
 *
 * 사용 예:
 *   npx tsx scripts/generate-analysis.ts --input data/analysis-inputs/sample.json
 *   npx tsx scripts/generate-analysis.ts --slug gangnam-skin --name "○○피부과" --address "서울 강남구 ..." --specialty 피부과
 */
import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { buildAnalysisReport } from "../src/lib/analysis/buildReport";
import { renderAnalysisHtml, writeAnalysisOutputs } from "../src/lib/analysis/renderHtml";
import type { AnalysisInput } from "../src/lib/analysis/types";

config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

function parseArgs(argv: string[]): AnalysisInput | null {
  const inputIdx = argv.indexOf("--input");
  if (inputIdx >= 0 && argv[inputIdx + 1]) {
    const file = path.resolve(argv[inputIdx + 1]);
    return JSON.parse(fs.readFileSync(file, "utf8")) as AnalysisInput;
  }

  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const slug = get("--slug");
  const clinicName = get("--name");
  const address = get("--address");
  const specialty = get("--specialty");

  if (!slug || !clinicName || !address || !specialty) {
    return null;
  }

  const regions = get("--regions")?.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  const topics = get("--topics")?.split(/[,，]/).map((s) => s.trim()).filter(Boolean);

  return {
    slug,
    clinicName,
    address,
    specialty,
    regions,
    keywordTopics: topics,
    radiusMeters: get("--radius") ? Number(get("--radius")) : 1500,
  };
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  if (!input) {
    console.error(`
사용법:
  npx tsx scripts/generate-analysis.ts --input data/analysis-inputs/클라이언트.json

  npx tsx scripts/generate-analysis.ts \\
    --slug gangnam-skin \\
    --name "○○피부과" \\
    --address "서울 서초구 서초대로 123" \\
    --specialty 피부과 \\
    --regions "강남,서초동,양재역" \\
    --topics "피부과,여드름,레이저토닝"
`);
    process.exit(1);
  }

  console.log(`[1/3] API 조회 · ${input.clinicName} · ${input.address}`);
  const report = await buildAnalysisReport(input);

  console.log("[2/3] HTML 렌더");
  const html = renderAnalysisHtml(report);

  console.log("[3/3] 파일 저장");
  const { jsonPath, htmlPath } = writeAnalysisOutputs(report, html);

  console.log("\n완료");
  console.log(`  JSON : ${jsonPath}`);
  console.log(`  HTML : ${htmlPath}`);
  console.log(`  URL  : /analysis/${report.slug}`);
  if (report.meta?.warnings?.length) {
    console.log("\n주의:");
    report.meta.warnings.forEach((w) => console.log(`  - ${w}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
