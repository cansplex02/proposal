const SECTION1_START = "<!-- ============ 섹션 1 · 인구 현황 ============ -->";
const SEARCH_SECTION_START = "<!-- ============ 섹션 3 · 검색량 ============ -->";
const KEYWORDS_SECTION_START =
  "<!-- ============ 섹션 4 · 키워드 지도 ============ -->";
const FOOTER_START = "<!-- FOOTER CTA -->";
const SEARCH_TOOL = '<div id="analysis-search-tool"></div>';

function endOfSectionIntro(html: string, introStart: number): number {
  if (introStart < 0) return -1;
  let depth = 0;
  let i = introStart;
  while (i < html.length) {
    const nextOpen = html.indexOf("<div", i);
    const nextClose = html.indexOf("</div>", i);
    if (nextClose < 0) return -1;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
      continue;
    }
    depth -= 1;
    i = nextClose + "</div>".length;
    if (depth === 0) return i;
  }
  return -1;
}

function splitSearchSection(beforeKeywords: string): {
  beforeSearch: string;
  searchIntro: string;
  searchBody: string;
} {
  const s3 = beforeKeywords.indexOf(SEARCH_SECTION_START);
  const s4 = beforeKeywords.indexOf(KEYWORDS_SECTION_START);
  // beforeKeywords는 섹션 4 주석 직전까지만 잘리므로 s4가 -1일 수 있음
  const end = s4 >= 0 ? s4 : beforeKeywords.length;
  if (s3 < 0 || end <= s3) {
    return { beforeSearch: beforeKeywords, searchIntro: "", searchBody: "" };
  }

  const sectionOpen = beforeKeywords.indexOf("<section", s3);
  const introStart = beforeKeywords.indexOf('<div class="section-intro">', s3);
  const introEnd = endOfSectionIntro(beforeKeywords, introStart);

  const toolIdx = beforeKeywords.indexOf(SEARCH_TOOL, s3);
  const beforeSearch = beforeKeywords.slice(
    0,
    sectionOpen >= 0 ? sectionOpen : s3
  );

  const trimSectionClose = (chunk: string) =>
    chunk.replace(/\s*<\/section>\s*$/i, "").trim();

  if (toolIdx >= s3 && toolIdx < end && introStart >= 0) {
    return {
      beforeSearch,
      searchIntro: beforeKeywords.slice(introStart, toolIdx).trim(),
      searchBody: trimSectionClose(
        beforeKeywords.slice(toolIdx + SEARCH_TOOL.length, end)
      ),
    };
  }

  if (introEnd > introStart && introEnd < end) {
    return {
      beforeSearch,
      searchIntro: beforeKeywords.slice(introStart, introEnd).trim(),
      searchBody: trimSectionClose(beforeKeywords.slice(introEnd, end)),
    };
  }

  return {
    beforeSearch,
    searchIntro: "",
    searchBody: trimSectionClose(beforeKeywords.slice(s3, end)),
  };
}

export function splitAnalysisBody(html: string): {
  beforeSearch: string;
  searchIntro: string;
  searchBody: string;
  intro: string;
  after: string;
} {
  const sectionStart = html.indexOf(KEYWORDS_SECTION_START);
  const footerStart = html.indexOf(FOOTER_START);

  if (sectionStart < 0 || footerStart < 0 || footerStart <= sectionStart) {
    const search = splitSearchSection(html);
    return { ...search, intro: "", after: "" };
  }

  const beforeKeywords = html.slice(0, sectionStart);
  const search = splitSearchSection(beforeKeywords);

  const keywordsBlock = html.slice(sectionStart, footerStart);
  const introStart = keywordsBlock.indexOf('<div class="section-intro">');
  const introEnd = keywordsBlock.indexOf('<div id="analysis-keyword-tool">');
  const intro =
    introStart >= 0 && introEnd > introStart
      ? keywordsBlock.slice(introStart, introEnd).trim()
      : "";

  return {
    ...search,
    intro,
    after: html.slice(footerStart),
  };
}

/** 생성된 전체 body HTML에서 섹션 03 차트·채널 블록만 추출 */
export function extractSearchBodyFromHtml(html: string): string {
  return splitAnalysisBody(html).searchBody;
}

const HERO_SUB_RE = /<p class="hero-sub">[\s\S]*?<\/p>/;

/** 네비+히어로 / 섹션01·02 분리 */
export function splitNavHeroAndDemographics(html: string): {
  navHero: string;
  demographicsMarket: string;
} {
  const s1 = html.indexOf(SECTION1_START);
  if (s1 < 0) {
    return { navHero: html, demographicsMarket: "" };
  }
  return {
    navHero: html.slice(0, s1),
    demographicsMarket: html.slice(s1),
  };
}

export function patchHeroSub(navHero: string, address: string, radiusKm: number): string {
  const sub = `<p class="hero-sub">
      <strong>${escapeHtmlLite(address)}</strong> 중심<br>
      반경 ${radiusKm}km 인구·상권 분석 결과
    </p>`;
  if (HERO_SUB_RE.test(navHero)) {
    return navHero.replace(HERO_SUB_RE, sub);
  }
  return navHero;
}

function escapeHtmlLite(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
