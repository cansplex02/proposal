import type { PopulationRow } from "./types";
import {
  fetchDetailPopulationViaCapture,
  type Sbiz365FetchContext,
  type Sbiz365PopulationResponse,
} from "./sbiz365DetailPopulation";
import {
  getSbiz365ApiKey,
  getSbiz365Credentials,
  isSbiz365ApiReady,
  loadSbiz365Spec,
  resolveApiPath,
  type Sbiz365ApiId,
} from "./sbiz365Config";

export type { Sbiz365FetchContext, Sbiz365PopulationResponse } from "./sbiz365DetailPopulation";

/** 인증키만 있으면 true (경로는 API별로 따로 확인) */
export function isSbiz365Configured(): boolean {
  return Boolean(getSbiz365Credentials().apiKey);
}

/** 상세분석 → 인구 표 (capture + sang_gwon4.sg) */
export async function fetchDetailAnalysis(
  ctx: Sbiz365FetchContext
): Promise<Sbiz365PopulationResponse | null> {
  if (!isSbiz365ApiReady("detailAnalysis")) return null;

  const certKey = getSbiz365ApiKey("detailAnalysis");
  const customPath = resolveApiPath("detailAnalysis");

  if (customPath) {
    const raw = await callSbiz365Api("detailAnalysis", ctx);
    if (!raw) return null;
    return normalizePopulationPayload(raw);
  }

  return fetchDetailPopulationViaCapture(ctx, certKey);
}

/** 간단분석 → 요약·미니카드 (추후 매핑 확장) */
export async function fetchSimpleAnalysis(
  ctx: Sbiz365FetchContext
): Promise<Record<string, unknown> | null> {
  return callSbiz365Api("simpleAnalysis", ctx);
}

/** 상권지도 → 지도·상권 메타 (추후 매핑 확장) */
export async function fetchMarketMap(
  ctx: Sbiz365FetchContext
): Promise<Record<string, unknown> | null> {
  return callSbiz365Api("marketMap", ctx);
}

/** @deprecated 상세분석과 동일 */
export async function fetchPopulationInRadius(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<Sbiz365PopulationResponse | null> {
  return fetchDetailAnalysis({ lat, lng, radiusMeters });
}

async function callSbiz365Api(
  id: Sbiz365ApiId,
  ctx: Sbiz365FetchContext
): Promise<Record<string, unknown> | null> {
  if (!isSbiz365ApiReady(id)) return null;

  const { baseUrl } = getSbiz365Credentials();
  const apiKey = getSbiz365ApiKey(id);
  const apiPath = resolveApiPath(id)!;
  const spec = loadSbiz365Spec()?.apis?.[id];

  const url = new URL(apiPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  const keyParam =
    process.env.SBIZ365_KEY_PARAM ||
    spec?.queryParams?.certKey ||
    spec?.queryParams?.serviceKey ||
    "certKey";
  url.searchParams.set(keyParam, apiKey);

  const latParam = spec?.queryParams?.lat || "lat";
  const lngParam = spec?.queryParams?.lng || "lng";
  const radiusParam = spec?.queryParams?.radius || "radius";

  url.searchParams.set(latParam, String(ctx.lat));
  url.searchParams.set(lngParam, String(ctx.lng));
  url.searchParams.set(radiusParam, String(ctx.radiusMeters));

  if (spec?.queryParams) {
    for (const [k, v] of Object.entries(spec.queryParams)) {
      if (["serviceKey", "lat", "lng", "radius"].includes(k)) continue;
      if (v && !url.searchParams.has(k)) url.searchParams.set(k, v);
    }
  }

  if (!url.searchParams.has("type")) url.searchParams.set("type", "json");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[${id}] 소상공인365 API 실패 (${res.status}): ${text.slice(0, 300)}`
    );
  }

  return (await res.json()) as Record<string, unknown>;
}

function normalizePopulationPayload(raw: Record<string, unknown>): Sbiz365PopulationResponse {
  const body = (raw.body ?? raw.data ?? raw.result ?? raw) as Record<string, unknown>;

  const pick = (prefix: string): PopulationRow | undefined => {
    const block = (body[prefix] ?? body[`${prefix}Pop`]) as Record<string, number> | undefined;
    if (!block) return undefined;
    return {
      total: num(block.total ?? block.tot),
      male: num(block.male ?? block.m),
      female: num(block.female ?? block.f),
      ages: {
        under10: num(block.under10 ?? block.age0),
        teens: num(block.teens ?? block.age10),
        twentiesThirties: num(block.age2030 ?? block.age20),
        fortiesFifties: num(block.age4050 ?? block.age40),
        sixtiesPlus: num(block.age60 ?? block.sixties),
      },
    };
  };

  return {
    residential: pick("residential") ?? pick("home") ?? pick("live"),
    workplace: pick("workplace") ?? pick("work") ?? pick("office"),
    floating: pick("floating") ?? pick("flow"),
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function placeholderPopulation(): Sbiz365PopulationResponse {
  const empty: PopulationRow = {
    total: 0,
    male: 0,
    female: 0,
    ages: {
      under10: 0,
      teens: 0,
      twentiesThirties: 0,
      fortiesFifties: 0,
      sixtiesPlus: 0,
    },
  };
  return { residential: { ...empty }, workplace: { ...empty } };
}
