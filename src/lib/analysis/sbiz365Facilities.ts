import type { FacilityCount } from "./types";
import { aggregateFacilities } from "./sbizStore";
import { sbizFetch } from "./sbizFetch";
import { getSbiz365ApiKey, isSbiz365ApiReady } from "./sbiz365Config";
import {
  wgs84ToTm,
  type Sbiz365FetchContext,
} from "./sbiz365DetailPopulation";

/** 소상공인365 상권분석(bizonAnaly.js) 주요시설 차트와 동일 순서·색상 */
export const MARKET_FACILITY_LABELS = [
  "공공기관",
  "금융기관",
  "의료·복지",
  "학교",
  "대형유통",
  "문화시설",
  "숙박시설",
] as const;

const FACILITY_COLORS = [
  "#0395ff",
  "#ff5672",
  "#fb923c",
  "#4ade80",
  "#00b3bf",
  "#c084fc",
  "#facc15",
];

const BASE = "https://bigdata.sbiz.or.kr";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type MarketFacilitiesResult = {
  facilities: FacilityCount[];
  ok: boolean;
  /** sbiz365 | kakao | store */
  source: "sbiz365" | "kakao" | "store" | "none";
  error?: string;
};

const KAKAO_FACILITY_CODES = ["PO3", "BK9", "HP8", "SC4", "MT1", "CT1", "AD5"] as const;

export function emptyMarketFacilities(): FacilityCount[] {
  return MARKET_FACILITY_LABELS.map((label, i) => ({
    label,
    count: 0,
    color: FACILITY_COLORS[i],
  }));
}

export function facilitiesFromCounts(counts: number[]): FacilityCount[] {
  return MARKET_FACILITY_LABELS.map((label, i) => ({
    label,
    count: Math.max(0, Number(counts[i] ?? 0)),
    color: FACILITY_COLORS[i],
  }));
}

type StoreLike = {
  bizesNm?: string;
  indsLclsNm?: string;
  indsMclsNm?: string;
  indsSclsNm?: string;
};

/** 반경 내 주요시설 — 365 → 카카오 POI → 상가 API(원래 업종 차트) */
export async function fetchMarketFacilities(
  ctx: Sbiz365FetchContext,
  stores: StoreLike[] = []
): Promise<MarketFacilitiesResult> {
  if (isSbiz365ApiReady("detailAnalysis")) {
    const certKey = getSbiz365ApiKey("detailAnalysis");
    const fromReport = await fetchFacilitiesFromSangGwon1(ctx, certKey).catch(
      () => null
    );
    if (fromReport) {
      return { facilities: fromReport, ok: true, source: "sbiz365" };
    }
  }

  if (process.env.KAKAO_REST_API_KEY) {
    try {
      const fromKakao = await fetchFacilitiesFromKakao(ctx);
      if (fromKakao.some((f) => f.count > 0)) {
        return { facilities: fromKakao, ok: true, source: "kakao" };
      }
    } catch {
      /* fall through */
    }
  }

  if (stores.length > 0 && process.env.SBIZ365_FACILITY_STORE_FALLBACK === "1") {
    return {
      facilities: aggregateFacilities(stores),
      ok: true,
      source: "store",
    };
  }

  return {
    facilities: emptyMarketFacilities(),
    ok: false,
    source: "none",
    error: "주요시설 데이터를 불러오지 못했습니다.",
  };
}

async function fetchFacilitiesFromKakao(
  ctx: Sbiz365FetchContext
): Promise<FacilityCount[]> {
  const key = process.env.KAKAO_REST_API_KEY!;
  const radius = Math.min(Math.max(Math.floor(ctx.radiusMeters), 1), 20_000);

  const counts = await Promise.all(
    KAKAO_FACILITY_CODES.map(async (code) => {
      const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
      url.searchParams.set("category_group_code", code);
      url.searchParams.set("x", String(ctx.lng));
      url.searchParams.set("y", String(ctx.lat));
      url.searchParams.set("radius", String(radius));
      url.searchParams.set("size", "1");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${key}` },
      });
      if (!res.ok) return 0;

      const data = (await res.json()) as {
        meta?: { total_count?: number; pageable_count?: number };
      };
      return Number(data.meta?.total_count ?? data.meta?.pageable_count ?? 0);
    })
  );

  return facilitiesFromCounts(counts);
}

function mergeCookies(existing: string, res: Response): string {
  const jar = new Map<string, string>();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  for (const sc of setCookies) {
    const [kv] = sc.split(";");
    const eq = kv.indexOf("=");
    if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function sbizHeaders(cookie: string, extra: Record<string, string> = {}) {
  return {
    "User-Agent": UA,
    Cookie: cookie,
    Referer: `${BASE}/gis/openApi/detail`,
    ...extra,
  };
}

type AdminDistrict = { admiCd: string; admiNm: string };

async function resolveAdminDistrict(
  cookie: string,
  tm: { x: number; y: number }
): Promise<AdminDistrict | null> {
  const pad = 500;
  const qs = new URLSearchParams({
    minXAxis: String(tm.x - pad),
    maxXAxis: String(tm.x + pad),
    minYAxis: String(tm.y - pad),
    maxYAxis: String(tm.y + pad),
    mapLevel: "3",
  });
  const res = await sbizFetch(
    `${BASE}/gis/api/getCoordToAdmPoint.json?${qs}`,
    { headers: sbizHeaders(cookie, { Accept: "application/json" }) },
    "행정동"
  ).catch(() => null);
  if (!res?.ok) return null;
  const text = await res.text().catch(() => "");
  try {
    const rows = JSON.parse(text) as {
      dongCd?: string;
      admdstCdNm?: string;
    }[];
    const row = rows?.[0];
    if (!row?.dongCd) return null;
    return {
      admiCd: String(row.dongCd),
      admiNm: String(row.admdstCdNm ?? ""),
    };
  } catch {
    return null;
  }
}

async function fetchFacilitiesHtml(
  cookie: string,
  path: string,
  qs: URLSearchParams
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
    const res = await sbizFetch(`${BASE}/gis/bizonAnls/report/sg/${path}?${qs}`, {
      headers: sbizHeaders(cookie, { Accept: "text/html" }),
    }, "주요시설");
    const html = await res.text();
    if (parseFacilitiesFromSangGwon1(html)) return html;
  }
  return null;
}

/** sang_gwon1.sg / sang_gwon6.sg HTML — statusOfFacs([...]) 파싱 */
export function parseFacilitiesFromSangGwon1(html: string): FacilityCount[] | null {
  const m =
    html.match(/statusOfFacs\s*\(\s*\[([^\]]+)\]/i) ??
    html.match(/facsStatus\s*=\s*\[([^\]]+)\]/i);
  if (!m) return null;

  const nums = m[1]
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));

  if (nums.length < 7) return null;
  return facilitiesFromCounts(nums.slice(0, 7));
}

async function fetchFacilitiesFromSangGwon1(
  ctx: Sbiz365FetchContext,
  certKey: string
): Promise<FacilityCount[] | null> {
  try {
    return await fetchFacilitiesFromSangGwon1WithFetch(ctx, certKey);
  } catch {
    if (process.env.VERCEL) return null;
    return fetchFacilitiesFromSangGwon1WithPlaywright(ctx, certKey);
  }
}

async function fetchFacilitiesFromSangGwon1WithFetch(
  ctx: Sbiz365FetchContext,
  certKey: string
): Promise<FacilityCount[] | null> {
  let cookie = `XTLOGINID=${certKey}`;
  const warmUrl =
    `${BASE}/gis/openApi/detail?certKey=${encodeURIComponent(certKey)}` +
    `&lat=${ctx.lat}&lng=${ctx.lng}&type=detail&rptpType=bizonAnls`;
  const warm = await sbizFetch(warmUrl, {
    headers: sbizHeaders(cookie, { Accept: "text/html" }),
    redirect: "follow",
  }, "주요시설 세션");
  cookie = mergeCookies(cookie, warm);
  await warm.text().catch(() => "");

  const tpbizRes = await sbizFetch(`${BASE}/gis/api/getTpbizLcd`, {
    headers: sbizHeaders(cookie, { Accept: "application/json" }),
  }, "주요시설 업종").catch(() => null);
  if (tpbizRes) {
    cookie = mergeCookies(cookie, tpbizRes);
    await tpbizRes.text().catch(() => "");
  }

  const tm = wgs84ToTm(ctx.lng, ctx.lat);
  const admin = await resolveAdminDistrict(cookie, tm);
  const upjongCd = process.env.SBIZ365_UPJONG_CD?.trim() || "Q1";
  const capRes = await sbizFetch(`${BASE}/gis/com/report/capture.json`, {
    method: "POST",
    headers: sbizHeaders(cookie, {
      "Content-Type": "application/json;charset=utf-8",
      Accept: "application/json",
    }),
    body: JSON.stringify({
      type: "circleRadius",
      analyType: "bizonAnls",
      centerX: ctx.lat,
      centerY: ctx.lng,
      transformX: tm.x,
      transformY: tm.y,
      upjongCd,
      kakaoPathStr: "",
      pathStr: "",
      radius: Math.floor(ctx.radiusMeters),
      mapLevelDecision: Math.floor(ctx.radiusMeters),
      apiLogin: "N",
      sprNo: 0,
    }),
  }, "주요시설 capture");
  cookie = mergeCookies(cookie, capRes);
  const cap = (await capRes.json()) as {
    analyNo?: number;
    analyDate?: string;
    kmAnalyNo?: number;
  };
  if (!cap.analyNo || cap.analyNo <= 0) {
    throw new Error("[주요시설] capture analyNo 없음");
  }

  const fullQs = new URLSearchParams({
    analyNo: String(cap.analyNo),
    analyDate: cap.analyDate ?? "",
    upjongCd,
    xcnts: String(tm.x),
    ydnts: String(tm.y),
    center_x: String(tm.x),
    center_y: String(tm.y),
    a: "01",
    b: "01",
    c: "01",
    apiLogin: "",
    lKey: "",
    xtLoginId: certKey,
    admiCd: admin?.admiCd ?? "",
    admiNm: admin?.admiNm ?? "",
    kmAnalyNo: cap.kmAnalyNo ? String(cap.kmAnalyNo) : "",
  });

  const admiQs = new URLSearchParams({
    analyNo: String(cap.analyNo),
    analyDate: cap.analyDate ?? "",
    upjongCd,
    admiCd: admin?.admiCd ?? "",
    admiNm: admin?.admiNm ?? "",
    kmAnalyNo: String(cap.kmAnalyNo ?? cap.analyNo),
    xtLoginId: certKey,
  });

  // 인구(sg4)와 동일 — 앞 탭·sg4 호출 후 지역현황(sg1/sg6) 조회
  for (const sg of ["sang_gwon1.sg", "sang_gwon2.sg", "sang_gwon3.sg"]) {
    await sbizFetch(`${BASE}/gis/bizonAnls/report/sg/${sg}?${fullQs}`, {
      headers: sbizHeaders(cookie, { Accept: "text/html" }),
    }, "주요시설 준비").catch(() => null);
  }
  await sbizFetch(`${BASE}/gis/bizonAnls/report/sg/sang_gwon4.sg?${fullQs}`, {
    headers: sbizHeaders(cookie, { Accept: "text/html" }),
  }, "주요시설 준비").catch(() => null);

  for (const path of ["sang_gwon1.sg", "sang_gwon6.sg"]) {
    for (const qs of [fullQs, admiQs]) {
      const html = await fetchFacilitiesHtml(cookie, path, qs);
      const parsed = html ? parseFacilitiesFromSangGwon1(html) : null;
      if (parsed) return parsed;
    }
  }

  throw new Error("[주요시설] sang_gwon1·6 응답 없음 (365 API)");
}

async function fetchFacilitiesFromSangGwon1WithPlaywright(
  ctx: Sbiz365FetchContext,
  certKey: string
): Promise<FacilityCount[] | null> {
  const { chromium } = await import("playwright");
  const tm = wgs84ToTm(ctx.lng, ctx.lat);
  const upjongCd = process.env.SBIZ365_UPJONG_CD?.trim() || "Q1";
  const browser = await chromium.launch({ headless: true });
  try {
    const pwCtx = await browser.newContext();
    const page = await pwCtx.newPage();
    await page.goto(
      `${BASE}/gis/openApi/detail?certKey=${encodeURIComponent(certKey)}&lat=${ctx.lat}&lng=${ctx.lng}&type=detail&rptpType=bizonAnls`,
      { waitUntil: "load", timeout: 120000 }
    );
    await page.waitForTimeout(3000);

    const api = pwCtx.request;
    const capRes = await api.post(`${BASE}/gis/com/report/capture.json`, {
      headers: { "Content-Type": "application/json;charset=utf-8" },
      data: {
        type: "circleRadius",
        analyType: "bizonAnls",
        centerX: ctx.lat,
        centerY: ctx.lng,
        transformX: tm.x,
        transformY: tm.y,
        upjongCd,
        kakaoPathStr: "",
        pathStr: "",
        radius: Math.floor(ctx.radiusMeters),
        mapLevelDecision: Math.floor(ctx.radiusMeters),
        apiLogin: "N",
        sprNo: 0,
      },
    });
    const cap = (await capRes.json()) as { analyNo?: number; analyDate?: string };
    if (!cap.analyNo || cap.analyNo <= 0) return null;

    const qs = new URLSearchParams({
      analyNo: String(cap.analyNo),
      analyDate: cap.analyDate ?? "",
      upjongCd,
      xcnts: String(tm.x),
      ydnts: String(tm.y),
      center_x: String(tm.x),
      center_y: String(tm.y),
      a: "01",
      b: "01",
      c: "01",
      apiLogin: "",
      lKey: "",
      xtLoginId: certKey,
    });

    for (let i = 0; i < 3; i++) {
      if (i > 0) await page.waitForTimeout(400 * i);
      const rep = await api.get(
        `${BASE}/gis/bizonAnls/report/sg/sang_gwon1.sg?${qs}`
      );
      const html = await rep.text();
      const parsed = parseFacilitiesFromSangGwon1(html);
      if (parsed) return parsed;
    }
    return null;
  } finally {
    await browser.close();
  }
}
