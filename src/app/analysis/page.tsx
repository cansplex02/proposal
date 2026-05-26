import type { Metadata } from "next";
import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import { loadHtmlFile } from "@/lib/loadContent";
import "@/styles/analysis.css";

export const metadata: Metadata = {
  title: "CANSPLEX · 경쟁분석 결과",
  description: "캔즈플렉스 경쟁분석 샘플",
};

export default function AnalysisPage() {
  const html = loadHtmlFile("analysis-body.html");
  return <LegacyHtmlPage html={html} />;
}
