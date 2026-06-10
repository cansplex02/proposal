import type { Metadata } from "next";
import AnalysisPageView from "@/components/AnalysisPageView";
import { loadHtmlFile } from "@/lib/loadContent";
import { splitAnalysisBody } from "@/lib/analysis/splitAnalysisBody";
import "@/styles/analysis.css";
import "@/styles/responsive.css";

export const metadata: Metadata = {
  title: "CANSPLEX · 경쟁분석 결과",
  description: "캔즈플렉스 경쟁분석 샘플",
};

type Props = { searchParams: Promise<{ admin?: string }> };

export default async function AnalysisPage({ searchParams }: Props) {
  const { admin } = await searchParams;
  const html = loadHtmlFile("analysis-body.html");
  const { beforeSearch, searchIntro, intro, after } = splitAnalysisBody(html);
  return (
    <AnalysisPageView
      beforeSearch={beforeSearch}
      searchIntro={searchIntro}
      searchBody=""
      keywordsIntro={intro}
      htmlAfter={after}
      showReportAdminSecret={admin === "1"}
    />
  );
}
