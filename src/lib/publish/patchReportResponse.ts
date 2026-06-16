import { buildMarketMapSlotData } from "@/lib/analysis/sbiz365MarketMap";
import { renderAnalysisHtml } from "@/lib/analysis/renderHtml";
import { splitAnalysisBody } from "@/lib/analysis/splitAnalysisBody";
import type { AnalysisReport } from "@/lib/analysis/types";

export function buildReportPatchResponse(report: AnalysisReport) {
  const html = renderAnalysisHtml(report);
  const beforeSearchHtml = splitAnalysisBody(html).beforeSearch;

  return {
    ok: true as const,
    slug: report.slug,
    beforeSearchHtml,
    search: report.search ?? null,
    keywords: report.keywords,
    keywordRegions: report.keywords.rows.map((r) => r.region),
    population: report.population,
    market: report.market,
    marketMap: buildMarketMapSlotData(report),
    publish: report.publish ?? { status: "draft" as const },
  };
}
