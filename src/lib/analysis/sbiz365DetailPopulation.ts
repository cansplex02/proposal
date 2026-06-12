import proj4 from "proj4";
import type { PopulationRow } from "./types";

export type Sbiz365FetchContext = {
  lat: number;
  lng: number;
  radiusMeters: number;
  address?: string;
};

export type Sbiz365PopulationResponse = {
  residential?: PopulationRow;
  workplace?: PopulationRow;
  floating?: PopulationRow;
};

const BASE = "https://bigdata.sbiz.or.kr";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function sbizHeaders(cookie: string, extra: Record<string, string> = {}) {
  return {
    "User-Agent": UA,
    Cookie: cookie,
    Referer: `${BASE}/gis/openApi/detail`,
    ...extra,
  };
}

proj4.defs(
  "EPSG:5181",
  "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs"
);

export function wgs84ToTm(lng: number, lat: number): { x: number; y: number } {
  const [x, y] = proj4("EPSG:4326", "EPSG:5181", [lng, lat]);
  return { x: Math.floor(x), y: Math.floor(y) };
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
  if (setCookies.length) {
    for (const sc of setCookies) {
      const [kv] = sc.split(";");
      const eq = kv.indexOf("=");
      if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
    }
  } else {
    const raw = res.headers.get("set-cookie");
    if (raw) {
      for (const sc of raw.split(/,(?=[^;]+?=)/)) {
        const [kv] = sc.split(";");
        const eq = kv.indexOf("=");
        if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
      }
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function parseTdInts(fragment: string): number[] {
  return [...fragment.matchAll(/<td[^>]*>([\d,]+)<\/td>/gi)].map((m) =>
    parseInt(m[1].replace(/,/g, ""), 10)
  );
}

/** sang_gwon4.sg HTML — 성별/연령대별 주거·직장 인구 표 */
export function parsePopulationFromSangGwon4(html: string): Sbiz365PopulationResponse {
  const residential = parseGenderAgeSection(
    html,
    "성별/연령대별 주거인구",
    "residential"
  );
  const workplace = parseGenderAgeSection(
    html,
    "성별/연령대별 직장인구",
    "workplace"
  );
  return { residential: residential ?? undefined, workplace: workplace ?? undefined };
}

function parseGenderAgeSection(
  html: string,
  sectionTitle: string,
  kind: "residential" | "workplace"
): PopulationRow | null {
  const idx = html.indexOf(sectionTitle);
  if (idx === -1) return null;
  const chunk = html.slice(idx, idx + 6000);
  const row = chunk.match(/<th scope="row">인구<\/th>([\s\S]*?)<\/tr>/i);
  if (!row) return null;
  const nums = parseTdInts(row[1]);
  if (kind === "residential" && nums.length >= 10) {
    const [total, male, female, u10, a10, a20, a30, a40, a50, a60] = nums;
    return {
      total,
      male,
      female,
      ages: {
        under10: u10,
        teens: a10,
        twentiesThirties: a20 + a30,
        fortiesFifties: a40 + a50,
        sixtiesPlus: a60,
      },
    };
  }
  if (kind === "workplace" && nums.length >= 8) {
    const [total, male, female, a20, a30, a40, a50, a60] = nums;
    return {
      total,
      male,
      female,
      ages: {
        under10: 0,
        teens: 0,
        twentiesThirties: a20 + a30,
        fortiesFifties: a40 + a50,
        sixtiesPlus: a60,
      },
    };
  }
  return null;
}

type CaptureResult = { analyNo: number; analyDate: string };

async function bootstrapSession(certKey: string): Promise<string> {
  let cookie = `XTLOGINID=${certKey}`;
  const warmUrl =
    `${BASE}/gis/openApi/detail?certKey=${encodeURIComponent(certKey)}` +
    `&type=detail&rptpType=bizonAnls`;
  const res = await fetch(warmUrl, {
    headers: sbizHeaders(cookie, { Accept: "text/html" }),
    redirect: "follow",
  });
  cookie = mergeCookies(cookie, res);
  await res.text().catch(() => "");

  const warmApi = await fetch(`${BASE}/gis/api/getTpbizLcd`, {
    headers: sbizHeaders(cookie, { Accept: "application/json" }),
  });
  cookie = mergeCookies(cookie, warmApi);
  await warmApi.text().catch(() => "");

  return cookie;
}

async function postCapture(
  ctx: Sbiz365FetchContext,
  certKey: string,
  cookie: string,
  upjongCd: string
): Promise<{ cap: CaptureResult; cookie: string }> {
  const tm = wgs84ToTm(ctx.lng, ctx.lat);
  const res = await fetch(`${BASE}/gis/com/report/capture.json`, {
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
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[상세분석] capture 실패 (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as CaptureResult;
  if (!data.analyNo) {
    throw new Error("[상세분석] capture 응답에 analyNo 없음");
  }
  return { cap: data, cookie: mergeCookies(cookie, res) };
}

async function fetchSangGwon4(
  cap: CaptureResult,
  ctx: Sbiz365FetchContext,
  certKey: string,
  cookie: string,
  upjongCd: string
): Promise<string> {
  const tm = wgs84ToTm(ctx.lng, ctx.lat);
  const qs = new URLSearchParams({
    analyNo: String(cap.analyNo),
    analyDate: cap.analyDate,
    upjongCd,
    xcnts: String(tm.x),
    ydnts: String(tm.y),
    center_x: String(tm.x),
    center_y: String(tm.y),
    a: "01",
    b: "01",
    c: "01",
    xtLoginId: certKey,
    admiCd: "",
    admiNm: "",
    kmAnalyNo: "",
  });
  const url = `${BASE}/gis/bizonAnls/report/sg/sang_gwon4.sg?${qs}`;
  let lastErr = "";

  for (const sg of ["sang_gwon1.sg", "sang_gwon2.sg", "sang_gwon3.sg"]) {
    await fetch(`${BASE}/gis/bizonAnls/report/sg/${sg}?${qs}`, {
      headers: sbizHeaders(cookie, { Accept: "text/html" }),
    }).catch(() => null);
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    const res = await fetch(url, {
      headers: sbizHeaders(cookie, { Accept: "text/html" }),
    });
    const text = await res.text();
    if (
      res.ok &&
      !text.includes("이용에 불편을 드린 점") &&
      text.includes("성별/연령대별 주거인구")
    ) {
      return text;
    }
    lastErr = `[상세분석] 인구 보고서 실패 (${res.status}): ${text.slice(0, 120)}`;
  }

  throw new Error(lastErr || "[상세분석] 인구 보고서 조회 실패");
}

/** 소상공인365 상세분석(상권분석) → 주거·직장 인구 표 */
export async function fetchDetailPopulationViaCapture(
  ctx: Sbiz365FetchContext,
  certKey: string
): Promise<Sbiz365PopulationResponse> {
  if (process.env.SBIZ365_USE_PLAYWRIGHT === "1") {
    return fetchDetailPopulationWithPlaywright(ctx, certKey);
  }
  try {
    return await fetchDetailPopulationWithFetch(ctx, certKey);
  } catch (fetchErr) {
    try {
      return await fetchDetailPopulationWithPlaywright(ctx, certKey);
    } catch (pwErr) {
      const a = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      const b = pwErr instanceof Error ? pwErr.message : String(pwErr);
      throw new Error(`[상세분석] 인구 조회 실패 — ${a} / ${b}`);
    }
  }
}

async function fetchDetailPopulationWithFetch(
  ctx: Sbiz365FetchContext,
  certKey: string
): Promise<Sbiz365PopulationResponse> {
  const upjongCd = process.env.SBIZ365_UPJONG_CD?.trim() || "Q1";
  let cookie = await bootstrapSession(certKey);
  const { cap, cookie: cookieAfterCap } = await postCapture(
    ctx,
    certKey,
    cookie,
    upjongCd
  );
  cookie = cookieAfterCap;
  const html = await fetchSangGwon4(cap, ctx, certKey, cookie, upjongCd);
  return finalizeParsed(html);
}

async function fetchDetailPopulationWithPlaywright(
  ctx: Sbiz365FetchContext,
  certKey: string
): Promise<Sbiz365PopulationResponse> {
  const { chromium } = await import("playwright");
  const upjongCd = process.env.SBIZ365_UPJONG_CD?.trim() || "Q1";
  const tm = wgs84ToTm(ctx.lng, ctx.lat);
  const browser = await chromium.launch({ headless: true });
  try {
    const pwCtx = await browser.newContext();
    const page = await pwCtx.newPage();
    await page.goto(
      `${BASE}/gis/openApi/detail?certKey=${encodeURIComponent(certKey)}&lat=${ctx.lat}&lng=${ctx.lng}&type=detail&rptpType=bizonAnls`,
      { waitUntil: "load", timeout: 120000 }
    );
    await page.waitForTimeout(5000);

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
    const cap = (await capRes.json()) as CaptureResult;
    if (!cap.analyNo) throw new Error("capture analyNo 없음");

    const qs = new URLSearchParams({
      analyNo: String(cap.analyNo),
      analyDate: cap.analyDate,
      upjongCd,
      xcnts: String(tm.x),
      ydnts: String(tm.y),
      center_x: String(tm.x),
      center_y: String(tm.y),
      a: "01",
      b: "01",
      c: "01",
      xtLoginId: certKey,
      admiCd: "",
      admiNm: "",
      kmAnalyNo: "",
    });

    // 365 서버: 앞 탭(sg 1~3) 호출 후 sg4가 안정적으로 응답하는 경우가 있음
    for (const sg of ["sang_gwon1.sg", "sang_gwon2.sg", "sang_gwon3.sg"]) {
      await api
        .get(`${BASE}/gis/bizonAnls/report/sg/${sg}?${qs}`)
        .catch(() => null);
    }

    let html = "";
    for (let i = 0; i < 4; i++) {
      if (i > 0) await page.waitForTimeout(400 * i);
      const rep = await api.get(
        `${BASE}/gis/bizonAnls/report/sg/sang_gwon4.sg?${qs}`
      );
      html = await rep.text();
      if (
        rep.ok() &&
        !html.includes("이용에 불편을 드린 점") &&
        html.includes("성별/연령대별 주거인구")
      ) {
        return finalizeParsed(html);
      }
    }
    throw new Error(`playwright report 실패: ${html.slice(0, 120)}`);
  } finally {
    await browser.close();
  }
}

function finalizeParsed(html: string): Sbiz365PopulationResponse {
  const parsed = parsePopulationFromSangGwon4(html);
  if (!parsed.residential?.total && !parsed.workplace?.total) {
    throw new Error("[상세분석] 인구 수치 파싱 실패");
  }
  return parsed;
}
