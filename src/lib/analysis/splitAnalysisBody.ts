const KEYWORDS_SECTION_START =
  "<!-- ============ 섹션 4 · 키워드 지도 ============ -->";
const FOOTER_START = "<!-- FOOTER CTA -->";

export function splitAnalysisBody(html: string): {
  before: string;
  intro: string;
  after: string;
} {
  const sectionStart = html.indexOf(KEYWORDS_SECTION_START);
  const footerStart = html.indexOf(FOOTER_START);

  if (sectionStart < 0 || footerStart < 0 || footerStart <= sectionStart) {
    return { before: html, intro: "", after: "" };
  }

  const keywordsBlock = html.slice(sectionStart, footerStart);
  const introStart = keywordsBlock.indexOf('<div class="section-intro">');
  const introEnd = keywordsBlock.indexOf('<div id="analysis-keyword-tool">');
  const intro =
    introStart >= 0 && introEnd > introStart
      ? keywordsBlock.slice(introStart, introEnd).trim()
      : "";

  return {
    before: html.slice(0, sectionStart),
    intro,
    after: html.slice(footerStart),
  };
}
