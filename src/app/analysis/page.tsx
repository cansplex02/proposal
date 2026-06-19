import type { Metadata } from "next";
import AnalysisPageView from "@/components/AnalysisPageView";
import { loadHtmlFile } from "@/lib/loadContent";
import { splitAnalysisBody } from "@/lib/analysis/splitAnalysisBody";
import { buildStudioLoadProps } from "@/lib/publish/buildPublishedAnalysisProps";
import { loadDraftReport } from "@/lib/publish/reportStore";
import "@/styles/analysis.css";
import "@/styles/studio.css";
import "@/styles/responsive.css";

export const metadata: Metadata = {
  title: "CANSPLEX · 경쟁분석",
  description: "경쟁분석 생성·수정",
};

type Props = {
  searchParams: Promise<{ admin?: string; slug?: string }>;
};

export default async function AnalysisPage({ searchParams }: Props) {
  const { admin, slug } = await searchParams;
  const html = loadHtmlFile("analysis-body.html");
  const { beforeSearch, searchIntro, intro, after } = splitAnalysisBody(html);

  const draft = slug?.trim() ? await loadDraftReport(slug.trim()) : null;
  const loaded = draft ? buildStudioLoadProps(draft) : null;

  return (
    <AnalysisPageView
      mode="studio"
      beforeSearch={beforeSearch}
      searchIntro={searchIntro}
      searchBody=""
      keywordsIntro={intro}
      htmlAfter={after}
      showReportAdminSecret={admin === "1"}
      showInitialSearchResults={Boolean(loaded)}
      searchDefaults={loaded?.searchDefaults}
      initialSearchData={loaded?.initialSearchData ?? null}
      initialMarketMap={loaded?.initialMarketMap ?? null}
      initialKeywords={loaded?.initialKeywords ?? null}
      initialKeywordRegions={loaded?.keywordRegions ?? []}
      initialKeywordFormCtx={loaded?.keywordFormCtx}
      initialResolvedAddress={loaded?.resolvedAddress ?? ""}
      initialSlug={loaded?.initialSlug ?? null}
      initialPublishStatus={loaded?.initialPublishStatus}
      initialPublishedAt={loaded?.initialPublishedAt}
    />
  );
}
