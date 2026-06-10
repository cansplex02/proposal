import { stripHtml } from "./naverOpenSearch";

export type ChannelMark = "O" | "△" | "X";

export type SearchHit = {
  title: string;
  description: string;
  links: string[];
  /** 블로그명·카페명 등 채널 소유 라벨 */
  channelLabel?: string;
};

const MAP_RE =
  /map\.naver|naver\.me|place\.naver|pcmap\.place|m\.place\.naver|openapi\.naver\.com\/l|네이버\s*지도|지도\s*삽입|staticmap|maps\.apigw/i;

/**
 * 채널 판정 (우선순위)
 *
 * - O: 제목에 병원명 OR 자체 채널 OR 네이버 지도 삽입 (자체 채널이 있으면 우선 O)
 * - △: 자체 채널 없음 + (제목에 병원명 OR 지도 삽입)
 * - X: 아무것도 없음, 제목에도 병원명 없음
 */
export type ChannelMarkMode = "default" | "news";

/** 블로그 전용 — 공식 자체 블로그가 있으면 O */
export function markBlogFromHits(
  hits: SearchHit[],
  hospitalName: string
): ChannelMark {
  if (!hits.length) return "X";

  const core = hospitalCoreTokens(hospitalName);

  for (const hit of hits) {
    if (hitLooksLikeOwnBlog(hit, core, hospitalName)) return "O";
  }
  if (detectOfficialBlogAccount(hits, core, hospitalName)) return "O";

  return markChannelFromHits(hits, hospitalName);
}

export function markChannelFromHits(
  hits: SearchHit[],
  hospitalName: string,
  options?: {
    isOwnChannelLink?: (url: string, label?: string) => boolean;
    /** 뉴스·보도자료: 제목 또는 본문에 병원명이 있으면 무조건 O */
    mode?: ChannelMarkMode;
    /** true면 지정 플랫폼 URL만 자체 채널로 인정 (블로그 계정명 등 제외) */
    urlOnlyOwnChannel?: boolean;
  }
): ChannelMark {
  if (!hits.length) return "X";

  const core = hospitalCoreTokens(hospitalName);

  if (options?.mode === "news") {
    for (const hit of hits) {
      const title = stripHtml(hit.title);
      const desc = stripHtml(hit.description);
      if (
        titleMatchesHospital(title, core, hospitalName) ||
        textMatchesHospital(desc, core, hospitalName)
      ) {
        return "O";
      }
    }
    return "X";
  }

  let hasOwnChannel = false;
  let hasNameInTitle = false;
  let hasMap = false;

  for (const hit of hits) {
    const title = stripHtml(hit.title);
    const desc = stripHtml(hit.description);
    const text = `${title} ${desc}`;

    if (hitLooksOwn(hit, core, hospitalName, options)) hasOwnChannel = true;
    if (titleMatchesHospital(title, core, hospitalName)) hasNameInTitle = true;
    if (MAP_RE.test(text)) hasMap = true;
  }

  if (hasOwnChannel) return "O";
  if (hasNameInTitle || hasMap) return "△";
  return "X";
}

function hitLooksOwn(
  hit: SearchHit,
  core: string[],
  hospitalName: string,
  options?: {
    isOwnChannelLink?: (url: string, label?: string) => boolean;
    urlOnlyOwnChannel?: boolean;
  }
): boolean {
  const label = hit.channelLabel ?? "";
  for (const url of hit.links) {
    if (options?.urlOnlyOwnChannel) {
      if (!options.isOwnChannelLink?.(url, label)) continue;
      if (urlLooksLikeOwnChannel(url, label, core, hospitalName)) return true;
      continue;
    }
    if (options?.isOwnChannelLink?.(url, label)) return true;
    if (urlLooksLikeOwnChannel(url, label, core, hospitalName)) return true;
  }
  if (options?.urlOnlyOwnChannel) return false;
  if (label && labelMatchesHospital(label, core, hospitalName)) return true;
  return false;
}

function hitLooksLikeOwnBlog(
  hit: SearchHit,
  core: string[],
  hospitalName: string
): boolean {
  const label = hit.channelLabel ?? "";
  for (const url of hit.links) {
    if (urlLooksLikeOwnChannel(url, label, core, hospitalName)) return true;
  }
  if (label && labelMatchesHospital(label, core, hospitalName)) return true;
  return false;
}

const OFFICIAL_BLOG_TITLE_RE =
  /(?:진료\s*안내|의료진\s*소개|원장\s*소개|대표원장|주말\s*진료|365\s*일|공지|병원\s*소개|클리닉\s*소개)/u;

/** 동일 blog.naver.com 계정에서 병원명 글이 반복되면 공식 블로그로 간주 */
function detectOfficialBlogAccount(
  hits: SearchHit[],
  core: string[],
  hospitalName: string
): boolean {
  const byAccount = new Map<
    string,
    { titles: string[]; labels: string[] }
  >();

  for (const hit of hits) {
    const blogId = extractBlogAccountId(hit);
    if (!blogId) continue;
    const entry = byAccount.get(blogId) ?? { titles: [], labels: [] };
    entry.titles.push(stripHtml(hit.title));
    if (hit.channelLabel) entry.labels.push(hit.channelLabel);
    byAccount.set(blogId, entry);
  }

  for (const entry of byAccount.values()) {
    const nameTitles = entry.titles.filter((t) =>
      titleMatchesHospital(t, core, hospitalName)
    );
    if (!nameTitles.length) continue;

    if (nameTitles.length >= 2) return true;

    if (entry.labels.some((l) => labelMatchesHospital(l, core, hospitalName))) {
      return true;
    }

    if (
      nameTitles.some(
        (t) =>
          OFFICIAL_BLOG_TITLE_RE.test(t) ||
          /^\s*\[.+?(의원|병원|클리닉)/u.test(t)
      )
    ) {
      return true;
    }
  }

  return false;
}

function extractBlogAccountId(hit: SearchHit): string | null {
  for (const url of hit.links) {
    const m = url.match(/blog\.naver\.com\/([^/?#]+)/i);
    if (m?.[1] && !/^\d+$/.test(m[1])) return m[1].toLowerCase();
  }
  return null;
}

const MEDICAL_SUFFIX_FOR_BRAND =
  /(마취통증의학과|통증의학과|정형외과|재활의학과|신경외과|신경과|가정의학과|내과|외과|피부과|성형외과|비뇨의학과|산부인과|소아청소년과|안과|이비인후과|정신건강의학과|영상의학과|치과)$/u;

export function hospitalCoreTokens(hospitalName: string): string[] {
  const compact = hospitalName.replace(/\s+/g, "");
  let bare = compact.replace(
    /(의원|병원|클리닉|센터|의료원|한의원|치과)$/u,
    ""
  );
  bare = bare.replace(
    /(교대역점|강남점|본점|분점|[가-힣]{2,6}역점|[가-힣]{2,6}점)$/u,
    ""
  );
  bare = bare.replace(/(의원|병원|클리닉|센터|의료원)$/u, "");

  const tokens: string[] = [];
  if (compact.length >= 3) tokens.push(compact.toLowerCase());
  if (bare.length >= 3) tokens.push(bare.toLowerCase());

  const brand = extractBrandCore(bare || compact);
  if (brand && brand.length >= 2) tokens.push(brand.toLowerCase());

  const parts = hospitalName.match(/[가-힣]{2,}/g) ?? [];
  for (const p of parts) {
    if (p.length >= 2 && !/의원|병원|클리닉|센터|의학과|역점|점$/.test(p)) {
      tokens.push(p.toLowerCase());
    }
  }
  return [...new Set(tokens)];
}

/** 상호에서 진료과·지역 접미를 뺀 브랜드 (부평그린마취통증의학과 → 부평그린) */
function extractBrandCore(bare: string): string | null {
  let s = bare.replace(MEDICAL_SUFFIX_FOR_BRAND, "");
  s = s.replace(/(의원|병원|클리닉|센터|의료원)$/u, "");
  s = s.replace(
    /^(인천|서울|경기)?(부평|강남|서초|역삼|분당|수원|일산|교대)/u,
    ""
  );
  if (s.length >= 2 && s.length <= 14) return s;
  return null;
}

function normalizeHospitalText(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[^가-힣a-z0-9]/gi, "")
    .toLowerCase();
}

function stripMedicalLabel(text: string): string {
  return normalizeHospitalText(text)
    .replace(MEDICAL_SUFFIX_FOR_BRAND, "")
    .replace(/(의원|병원|클리닉|센터|의료원)$/u, "");
}

/** 블로그명·카페명 ↔ 상호 (이립통증의학과 ↔ 이립마취통증의학과 등) */
function labelMatchesHospital(
  label: string,
  core: string[],
  hospitalName: string
): boolean {
  if (textMatchesHospital(label, core, hospitalName)) return true;

  const lab = normalizeHospitalText(label);
  const full = normalizeHospitalText(hospitalName);
  if (full.length >= 4 && lab.length >= 4) {
    if (lab.includes(full) || full.includes(lab)) return true;

    const labStripped = stripMedicalLabel(label);
    const fullStripped = stripMedicalLabel(hospitalName);

    if (labStripped.length >= 2 && fullStripped.length >= 2) {
      const shorter =
        labStripped.length <= fullStripped.length ? labStripped : fullStripped;
      const longer =
        labStripped.length > fullStripped.length ? labStripped : fullStripped;
      if (longer.includes(shorter)) return true;
      if (shorter.length >= 2 && longer.startsWith(shorter.slice(0, 2))) {
        return true;
      }
    }
  }

  return core.some((c) => c.length >= 2 && lab.includes(c));
}

function titleMatchesHospital(
  title: string,
  core: string[],
  hospitalName: string
): boolean {
  const t = title.replace(/\s+/g, "");
  const full = hospitalName.replace(/\s+/g, "");
  if (full.length >= 3 && t.includes(full)) return true;
  return core.some((c) => c.length >= 3 && t.toLowerCase().includes(c));
}

function textMatchesHospital(
  text: string,
  core: string[],
  hospitalName: string
): boolean {
  const t = text.replace(/\s+/g, " ");
  const full = hospitalName.replace(/\s+/g, "");
  if (full.length >= 3 && t.includes(full)) return true;
  return core.some((c) => c.length >= 3 && t.toLowerCase().includes(c));
}

function urlLooksLikeOwnChannel(
  url: string,
  label: string,
  core: string[],
  hospitalName: string
): boolean {
  const u = url.toLowerCase();
  const lab = label.replace(/\s+/g, "").toLowerCase();

  if (/blog\.naver\.com\//i.test(url)) {
    const id = url.split("blog.naver.com/")[1]?.split(/[/?#]/)[0] ?? "";
    if (core.some((c) => id.includes(c) || c.includes(id))) return true;
    if (lab && labelMatchesHospital(label, core, hospitalName)) return true;
  }

  if (/cafe\.naver\.com\//i.test(url)) {
    const slug = url.split("cafe.naver.com/")[1]?.split(/[/?#]/)[0] ?? "";
    if (core.some((c) => slug.includes(c))) return true;
  }

  if (/instagram\.com|facebook\.com|youtube\.com|youtu\.be/i.test(url)) {
    if (core.some((c) => u.includes(c))) return true;
  }

  const full = hospitalName.replace(/\s+/g, "").toLowerCase();
  if (full.length >= 4 && (u.includes(full) || lab.includes(full))) return true;

  return false;
}

export function isOfficialHomepage(url: string): boolean {
  if (!url || /map\.naver|naver\.me|place\.naver|pcmap\.place/i.test(url)) {
    return false;
  }
  return /^https?:\/\//i.test(url);
}

export function isMapPlaceLink(url: string): boolean {
  return /map\.naver|naver\.me\/|place\.naver|pcmap\.place/i.test(url);
}

/** 웹검색 홈페이지 후보에서 제외할 포털·SNS·예약·뉴스·블로그 등 */
const HOMEPAGE_EXCLUDED_HOST_RE =
  /(^|\.)((naver|daum|kakao|google|youtube|youtu|instagram|facebook|twitter|x|tistory|blogspot|wikipedia|namu)\.|blog\.naver|cafe\.naver|map\.naver|place\.naver|pcmap\.place)|(gooddoc|ddocdoc|yeoshin|gangnamunni|babitalk|docdoc|mogok|hospital|jobkorea|saramin|incruit|albamon|worknet|yelp|tripadvisor)/i;

export function isExcludedHomepageHost(url: string): boolean {
  if (!url) return true;
  if (isMapPlaceLink(url)) return true;
  if (/blog\.naver\.com|cafe\.naver\.com/i.test(url)) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return HOMEPAGE_EXCLUDED_HOST_RE.test(host);
  } catch {
    return true;
  }
}

function hostnameCoreMatch(hostname: string, core: string[]): boolean {
  const h = hostname.replace(/^www\./i, "").toLowerCase();
  return core.some((c) => c.length >= 3 && h.includes(c));
}

/**
 * 네이버 웹문서 검색(webkr) 상위 결과로 자체 홈페이지 O/△/X
 * - O: 공식 URL + (제목/본문 병원명 + 도메인·URL에 브랜드 일치)
 * - △: 공식 URL + 제목/본문에 병원명
 */
export function markHomepageFromWebHits(
  hits: SearchHit[],
  hospitalName: string
): ChannelMark {
  if (!hits.length) return "X";

  const core = hospitalCoreTokens(hospitalName);
  let weak = false;

  for (const hit of hits) {
    const url = hit.links[0] ?? "";
    if (!isOfficialHomepage(url) || isExcludedHomepageHost(url)) continue;

    const title = stripHtml(hit.title);
    const desc = stripHtml(hit.description);
    const nameInText =
      titleMatchesHospital(title, core, hospitalName) ||
      textMatchesHospital(desc, core, hospitalName);

    if (!nameInText) continue;

    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }

    const urlBlob = url.toLowerCase();
    const strongUrl =
      hostnameCoreMatch(host, core) ||
      core.some((c) => c.length >= 4 && urlBlob.includes(c));

    if (strongUrl) return "O";
    weak = true;
  }

  return weak ? "△" : "X";
}

/** 지역검색 link 기준 (동기) */
export function markHomepageFromLocal(
  local: { title: string; link: string }[],
  hospital: string
): ChannelMark {
  const hit = local.find((p) => titlesMatchPlace(p.title, hospital));
  if (!hit?.link) return "X";

  if (isMapPlaceLink(hit.link)) return "X";
  if (isOfficialHomepage(hit.link)) return "O";
  return "△";
}

function titlesMatchPlace(placeTitle: string, hospital: string): boolean {
  const a = placeTitle.replace(/\s+/g, "");
  const b = hospital.replace(/\s+/g, "");
  return a.includes(b) || b.includes(a);
}
