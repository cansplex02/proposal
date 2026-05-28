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

export default function AnalysisPage() {
  const html = loadHtmlFile("analysis-body.html");
  const { before, intro, after } = splitAnalysisBody(html);
  return (
    <AnalysisPageView
      htmlBefore={before}
      keywordsIntro={intro}
      htmlAfter={after}
    />
  );
}
