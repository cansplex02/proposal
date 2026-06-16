import { buildMarketMapSlotData } from "@/lib/analysis/sbiz365MarketMap";
import { renderAnalysisHtml } from "@/lib/analysis/renderHtml";
import { splitAnalysisBody } from "@/lib/analysis/splitAnalysisBody";
import type { AnalysisReport } from "@/lib/analysis/types";
import type { SearchSectionData } from "@/components/AnalysisSearchResults";

export type PublishedAnalysisViewProps = {
  beforeSearch: string;
  searchIntro: string;
  searchBody: string;
  keywordsIntro: string;
  htmlAfter: string;
  initialSearchData: SearchSectionData | null;
  mapQuery: string | null;
  marketMap: ReturnType<typeof buildMarketMapSlotData>;
  keywordData: AnalysisReport["keywords"];
  keywordRegions: string[];
  keywordFormCtx: {
    specialty: string;
    focusTopics: string;
    treatmentMode: "surgery" | "nonsurgery";
  };
  resolvedAddress: string;
  searchDefaults: {
    specialty: string;
    clinicName: string;
    address: string;
  };
};

export function buildStudioLoadProps(report: AnalysisReport) {
  const base = buildPublishedAnalysisProps(report);
  return {
    ...base,
    showInitialSearchResults: true as const,
    initialSlug: report.slug,
    initialPublishStatus: (report.publish?.status ?? "draft") as
      | "draft"
      | "published",
    initialPublishedAt: report.publish?.publishedAt,
    initialMarketMap: base.marketMap,
    initialKeywords: base.keywordData,
  };
}

export function buildPublishedAnalysisProps(
  report: AnalysisReport
): PublishedAnalysisViewProps {
  const html = renderAnalysisHtml(report);
  const { beforeSearch, searchIntro, intro, after } = splitAnalysisBody(html);
  const search = report.search ?? null;
  const topics = report.keywords.columns
    .filter((c) => c.id !== "region")
    .map((c) => c.label)
    .join(", ");

  return {
    beforeSearch,
    searchIntro,
    searchBody: "",
    keywordsIntro: intro,
    htmlAfter: after,
    initialSearchData: search,
    mapQuery: search?.meta?.mapQuery ?? null,
    marketMap: buildMarketMapSlotData(report),
    keywordData: report.keywords,
    keywordRegions: report.keywords.rows.map((r) => r.region),
    keywordFormCtx: {
      specialty: report.specialty,
      focusTopics: topics,
      treatmentMode: "nonsurgery",
    },
    resolvedAddress: report.address,
    searchDefaults: {
      specialty: report.specialty,
      clinicName: report.clinicName,
      address: report.address,
    },
  };
}
