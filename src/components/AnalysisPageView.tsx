"use client";

import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import KeywordGeneratorPanel from "@/components/KeywordGeneratorPanel";

type Props = {
  htmlBefore: string;
  keywordsIntro: string;
  htmlAfter: string;
};

export default function AnalysisPageView({
  htmlBefore,
  keywordsIntro,
  htmlAfter,
}: Props) {
  return (
    <div className="analysis-page">
      <LegacyHtmlPage html={htmlBefore} />
      <section className="section alt" id="keywords">
        {keywordsIntro ? (
          <LegacyHtmlPage html={keywordsIntro} />
        ) : null}
        <div className="keyword-tool-inner">
          <KeywordGeneratorPanel />
        </div>
      </section>
      <LegacyHtmlPage html={htmlAfter} />
    </div>
  );
}
