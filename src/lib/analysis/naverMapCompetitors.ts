import { chromium, type Frame } from "playwright";
import {
  detectFacilityTier,
  inferCategoryFromPlaceName,
  matchMedicalCategoryToken,
  type MapPlaceHit,
} from "./competitorFilter";

export type { MapPlaceHit } from "./competitorFilter";
export { isOurPlace } from "./competitorFilter";

const MEDICAL_RE = /(의원|병원|클리닉|센터|의료원|한의원|치과)/;
const SKIP_LINE_RE =
  /전문의|진료|광고|리뷰|\bkm\b|구 |동 |예약|휠체어|이미지|출발|거리|접수|휴게|야간|365|비수술|블로그|방문자|저장|공유|길찾기|전화|복사|신규|쿠폰|바로가기|더보기|필터|정렬|현재 위치/;

/** 네이버 지도 검색 1페이지 업체 (우리 병원 제외는 호출측) */
export async function fetchNaverMapPlaceNames(
  query: string,
  options?: { maxResults?: number; headless?: boolean }
): Promise<MapPlaceHit[]> {
  const maxResults = options?.maxResults ?? 15;
  const searchUrl = `https://map.naver.com/p/search/${encodeURIComponent(query.trim())}`;

  const browser = await chromium.launch({
    headless: options?.headless ?? true,
  });

  try {
    const page = await browser.newPage({
      locale: "ko-KR",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    let listFrame: Frame | null = null;
    for (let i = 0; i < 40; i++) {
      listFrame =
        page.frames().find((f) => {
          const u = f.url();
          return u.includes("pcmap.place.naver.com") && u.includes("/list");
        }) ?? null;
      if (listFrame) break;
      await page.waitForTimeout(500);
    }

    if (!listFrame) {
      throw new Error(
        "네이버 지도 검색 목록을 불러오지 못했습니다. Playwright·Chromium 설치 후 재시도하세요."
      );
    }

    await page.waitForTimeout(2500);

    await listFrame.evaluate(async () => {
      const scrollers = [
        document.querySelector("#_pcmap_list_scroll_container"),
        document.querySelector('[class*="scroll"]'),
        document.scrollingElement,
      ].filter(Boolean) as HTMLElement[];
      const el = scrollers[0] ?? document.body;
      for (let i = 0; i < 6; i++) {
        el.scrollTop += 700;
        await new Promise((r) => setTimeout(r, 350));
      }
    });
    await page.waitForTimeout(1200);

    const innerText = await listFrame.evaluate(() => document.body?.innerText ?? "");
    return parsePlaceListFromInnerText(innerText).slice(0, maxResults);
  } finally {
    await browser.close();
  }
}

export function parsePlaceListFromInnerText(innerText: string): MapPlaceHit[] {
  const lines = innerText
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const result: MapPlaceHit[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = extractPrimaryPlaceName(raw);
    if (!line) continue;
    if (!MEDICAL_RE.test(line)) continue;
    if (line.length < 4 || line.length > 50) continue;
    if (SKIP_LINE_RE.test(line)) continue;
    if (/^의\d{3,}/.test(line)) continue;
    if (/^\d+[,.]?\d*$/.test(line)) continue;

    const window = lines.slice(i + 1, i + 10);
    const isAd = window.some((w) => w === "광고");
    const naverCategory =
      extractNaverCategoryFromWindow(window) ??
      inferCategoryFromPlaceName(line) ??
      undefined;
    const facilityTier = detectFacilityTier(line);
    if (seen.has(line)) continue;
    seen.add(line);
    result.push({ name: line, isAd, naverCategory, facilityTier });
  }

  return result;
}

/** 한 줄에 붙은 상호+진료과 라벨 분리 (예: ○○의원정형외과 → ○○의원) */
export function extractPrimaryPlaceName(line: string): string | null {
  const t = line.replace(/\s+/g, " ").trim();
  if (!MEDICAL_RE.test(t)) return null;

  const m = t.match(/^(.+?(?:의원|병원|클리닉|센터|의료원))/u);
  if (!m) return null;

  let name = m[1];
  const gluedCategory =
    /(마취통증의학과|통증의학과|정형외과|가정의학과|재활의학과|신경외과|피부과|성형외과|내과|외과|영상의학과|비뇨의학과)$/;
  if (gluedCategory.test(name) && name.length > 8) {
    const cut = name.replace(gluedCategory, "");
    if (/(의원|병원|클리닉|센터|의료원)$/u.test(cut)) name = cut;
  }

  return name;
}

const CATEGORY_WINDOW_SKIP_RE =
  /^(광고|영업\s*중|리뷰|방문|저장|신규|쿠폰|예약|더보기|이미지|\d|★|⭐|점$|m$|km$|m\b|별)/;

/** 지도 목록에서 상호 바로 아래 진료과 라벨 추출 */
function extractNaverCategoryFromWindow(window: string[]): string | null {
  for (const raw of window) {
    const w = raw.replace(/\s+/g, " ").trim();
    if (!w || w.length > 35) continue;
    if (CATEGORY_WINDOW_SKIP_RE.test(w)) continue;
    if (SKIP_LINE_RE.test(w)) continue;
    if (/^[\d,.]+(km|m)?$/.test(w)) continue;

    const hit = matchMedicalCategoryToken(w);
    if (hit) return hit;
  }
  return null;
}

