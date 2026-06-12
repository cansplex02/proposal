import fs from "fs";
import path from "path";

/** 소상공인365 — 상권지도 / 간단분석 / 상세분석 */
export type Sbiz365ApiId = "marketMap" | "simpleAnalysis" | "detailAnalysis";

export type Sbiz365ApiSpec = {
  name: string;
  description?: string;
  method?: string;
  path: string;
  queryParams?: Record<string, string>;
  sampleResponse?: string;
};

export type Sbiz365SpecFile = {
  apiKey?: string;
  baseUrl?: string;
  apis: Partial<Record<Sbiz365ApiId, Sbiz365ApiSpec>>;
};

const API_LABELS: Record<Sbiz365ApiId, string> = {
  marketMap: "상권지도",
  simpleAnalysis: "간단분석",
  detailAnalysis: "상세분석",
};

export function getSbiz365Labels(): Record<Sbiz365ApiId, string> {
  return API_LABELS;
}

export function loadSbiz365Spec(): Sbiz365SpecFile | null {
  const file = path.join(process.cwd(), "data", "sbiz365-api-spec.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Sbiz365SpecFile;
}

const API_KEY_ENV: Record<Sbiz365ApiId, string | undefined> = {
  detailAnalysis:
    process.env.SBIZ365_DETAIL_KEY || process.env.SBIZ365_API_KEY,
  simpleAnalysis: process.env.SBIZ365_SIMPLE_KEY,
  marketMap: process.env.SBIZ365_MARKET_KEY,
};

export function getSbiz365ApiKey(id: Sbiz365ApiId): string {
  const spec = loadSbiz365Spec();
  return API_KEY_ENV[id] || spec?.apiKey || "";
}

export function getSbiz365Credentials(): { baseUrl: string; apiKey: string } {
  const spec = loadSbiz365Spec();
  return {
    baseUrl:
      process.env.SBIZ365_API_BASE_URL ||
      spec?.baseUrl ||
      "https://bigdata.sbiz.or.kr",
    apiKey: getSbiz365ApiKey("detailAnalysis"),
  };
}

/** .env 우선, 없으면 sbiz365-api-spec.json 의 path */
export function resolveApiPath(id: Sbiz365ApiId): string | null {
  const envMap: Record<Sbiz365ApiId, string | undefined> = {
    marketMap: process.env.SBIZ365_API_MARKET_MAP_PATH,
    simpleAnalysis: process.env.SBIZ365_API_SIMPLE_PATH,
    detailAnalysis: process.env.SBIZ365_API_DETAIL_PATH,
  };
  if (envMap[id]) return envMap[id]!;

  const spec = loadSbiz365Spec();
  const p = spec?.apis?.[id]?.path;
  if (p && !p.includes("여기에")) return p;
  return null;
}

export function isSbiz365ApiReady(id: Sbiz365ApiId): boolean {
  const apiKey = getSbiz365ApiKey(id);
  if (!apiKey) return false;
  // 상세분석·상권지도: 내장 경로 (인증키만 필요)
  if (id === "detailAnalysis" || id === "marketMap") return true;
  return Boolean(resolveApiPath(id));
}

export function listSbiz365Readiness(): Record<Sbiz365ApiId, boolean> {
  return {
    marketMap: isSbiz365ApiReady("marketMap"),
    simpleAnalysis: isSbiz365ApiReady("simpleAnalysis"),
    detailAnalysis: isSbiz365ApiReady("detailAnalysis"),
  };
}
