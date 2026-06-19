import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AnalysisPageView from "@/components/AnalysisPageView";
import PublicAnalysisNav from "@/components/PublicAnalysisNav";
import { buildPublishedAnalysisProps } from "@/lib/publish/buildPublishedAnalysisProps";
import {
  loadDraftReport,
  loadPublishedReport,
} from "@/lib/publish/reportStore";
import "@/styles/analysis.css";
import "@/styles/studio.css";
import "@/styles/responsive.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const report =
    (await loadPublishedReport(slug)) ?? (await loadDraftReport(slug));
  return {
    title: report
      ? `CANSPLEX · ${report.clinicName || slug} 경쟁분석`
      : "CANSPLEX · 경쟁분석",
    description: "캔즈플렉스 경쟁분석 결과",
  };
}

export default async function PublicReportPage({ params }: Props) {
  const { slug } = await params;
  const report =
    (await loadPublishedReport(slug)) ?? (await loadDraftReport(slug));
  if (!report) notFound();

  const loaded = buildPublishedAnalysisProps(report);

  return (
    <>
      <PublicAnalysisNav slug={slug} clinicName={report.clinicName} />
      <AnalysisPageView
      mode="public"
      beforeSearch={loaded.beforeSearch}
      searchIntro={loaded.searchIntro}
      searchBody=""
      keywordsIntro={loaded.keywordsIntro}
      htmlAfter={loaded.htmlAfter}
      showInitialSearchResults
      initialSearchData={loaded.initialSearchData}
      initialMarketMap={loaded.marketMap}
      initialKeywords={loaded.keywordData}
      initialKeywordRegions={loaded.keywordRegions}
      initialKeywordFormCtx={loaded.keywordFormCtx}
      initialResolvedAddress={loaded.resolvedAddress}
      initialSlug={slug}
      initialPublishStatus="published"
      initialPublishedAt={report.publish?.publishedAt}
    />
    </>
  );
}
