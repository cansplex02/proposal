import crypto from "crypto";

export type KeywordVolume = {
  keyword: string;
  pc: number;
  mobile: number;
  total: number;
};

const BASE_URL = "https://api.searchad.naver.com";
const KEYWORD_URI = "/keywordstool";

export function missingSearchAdEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NAVER_SEARCHAD_CUSTOMER_ID?.trim()) {
    missing.push("NAVER_SEARCHAD_CUSTOMER_ID");
  }
  if (!process.env.NAVER_SEARCHAD_API_KEY?.trim()) {
    missing.push("NAVER_SEARCHAD_API_KEY");
  }
  if (!process.env.NAVER_SEARCHAD_SECRET_KEY?.trim()) {
    missing.push("NAVER_SEARCHAD_SECRET_KEY");
  }
  return missing;
}

export function isNaverSearchAdConfigured(): boolean {
  return missingSearchAdEnvVars().length === 0;
}

export function searchAdConfigErrorMessage(): string {
  const missing = missingSearchAdEnvVars();
  if (!missing.length) return "";
  const where = process.env.VERCEL ? "Vercel 환경 변수" : ".env.local";
  return `${missing.join(", ")} 미설정 (${where}) — 네이버 검색광고 > 도구 > API 사용 관리에서 확인`;
}

function sign(timestamp: string, method: string, uri: string, secret: string): string {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac("sha256", secret).update(message).digest("base64");
}

function normalizeKeywordKey(s: string): string {
  return s.replace(/\s+/g, "").trim().toLowerCase();
}

function rowToVolume(row: {
  relKeyword?: string;
  monthlyPcQcCnt?: unknown;
  monthlyMobileQcCnt?: unknown;
}): KeywordVolume | null {
  const keyword = (row.relKeyword ?? "").replace(/\s+/g, "");
  if (!keyword) return null;
  const pc = parseQcCnt(row.monthlyPcQcCnt);
  const mobile = parseQcCnt(row.monthlyMobileQcCnt);
  return { keyword, pc, mobile, total: pc + mobile };
}

/** hint·relKeyword 정확 일치로만 검색량 찾기 (부분 일치 시 '정형외과' 등 오매칭 방지) */
export function lookupKeywordVolume(
  key: string,
  volumes: Map<string, KeywordVolume>
): KeywordVolume | null {
  const norm = normalizeKeywordKey(key);
  if (!norm) return null;

  for (const [k, v] of volumes) {
    if (normalizeKeywordKey(k) === norm) return v;
  }
  return null;
}

function parseQcCnt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    if (value.includes("<")) return 5;
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const MEDICAL_SUFFIX_RE = /(의원|병원|클리닉|센터|의료원|한의원|치과)$/u;

/** 상호에서 의원·병원 등 접미사 제거 (예: 부평그린마취통증의학과의원 → 부평그린마취통증의학과) */
export function stripMedicalSuffix(placeName: string): string | null {
  const bare = placeName.replace(/\s+/g, "").trim();
  const short = bare.replace(MEDICAL_SUFFIX_RE, "");
  if (short.length >= 3 && short !== bare) return short;
  return null;
}

/** 병원 상호 → 키워드 도구 조회용 후보 (공백 제거·짧은 브랜드) */
export function keywordCandidatesForPlace(
  placeName: string,
  brandSearchKeyword?: string
): string[] {
  const candidates = new Set<string>();
  const add = (s: string) => {
    const t = s.replace(/\s+/g, "").trim();
    if (t.length >= 2) candidates.add(t);
  };

  if (brandSearchKeyword) add(brandSearchKeyword);
  add(placeName);

  const short = stripMedicalSuffix(placeName);
  if (short) add(short);

  return [...candidates];
}

export type PlaceVolumePair = {
  full: KeywordVolume | null;
  short: KeywordVolume | null;
  shortKeyword: string | null;
};

/** 상호 전체·짧은 브랜드 중 검색량이 큰 쪽 1개만 사용 (합산 시 중복·과대 계산 방지) */
export function mergePlaceVolumes(
  full: KeywordVolume | null,
  short: KeywordVolume | null
): KeywordVolume | null {
  if (full && short) {
    return full.total >= short.total ? full : short;
  }
  return full ?? short ?? null;
}

/** API relKeyword 중 상호와 가장 잘 맞는 검색량 (부분·브랜드 일치) */
function findBestVolumeByPlaceName(
  placeName: string,
  volumes: Map<string, KeywordVolume>
): KeywordVolume | null {
  const compact = placeName.replace(/\s+/g, "");
  if (!compact) return null;

  let best: KeywordVolume | null = null;
  let bestScore = 0;

  for (const [key, vol] of volumes) {
    if (vol.total <= 0) continue;
    const k = normalizeKeywordKey(key);
    if (k.length < 3) continue;

    let score = 0;
    if (normalizeKeywordKey(compact) === k) score = 1000 + k.length;
    else if (compact.includes(k)) score = 500 + k.length;
    else if (k.includes(compact.replace(MEDICAL_SUFFIX_RE, ""))) score = 400 + k.length;
    else {
      const short = stripMedicalSuffix(placeName);
      if (short && (k.includes(normalizeKeywordKey(short)) || normalizeKeywordKey(short).includes(k))) {
        score = 300 + k.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = vol;
    }
  }

  return best;
}

/** 상호 전체 + 접미사 제거 브랜드명 검색량 각각 조회 */
export function resolveVolumePairForPlace(
  placeName: string,
  volumes: Map<string, KeywordVolume>,
  brandSearchKeyword?: string
): PlaceVolumePair {
  let full = lookupKeywordVolume(placeName, volumes);
  if ((!full || full.total <= 0) && brandSearchKeyword) {
    const alt = lookupKeywordVolume(brandSearchKeyword, volumes);
    if (alt && alt.total > 0) full = alt;
  }
  if (full && full.total <= 0) full = null;

  const shortKeyword = stripMedicalSuffix(placeName);
  const short = shortKeyword
    ? lookupKeywordVolume(shortKeyword, volumes)
    : null;

  const merged = mergePlaceVolumes(
    full && full.total > 0 ? full : null,
    short && short.total > 0 ? short : null
  );
  const best =
    merged ??
    findBestVolumeByPlaceName(placeName, volumes) ??
    (brandSearchKeyword
      ? findBestVolumeByPlaceName(brandSearchKeyword, volumes)
      : null);

  if (best) {
    return {
      full: best,
      short: null,
      shortKeyword: best.keyword,
    };
  }

  return {
    full: null,
    short: null,
    shortKeyword,
  };
}

/**
 * 키워드별 월간 PC·모바일 검색량 (keywordstool)
 * @see https://naver.github.io/searchad-apidoc/
 */
export async function fetchKeywordVolumes(
  hintKeywords: string[]
): Promise<Map<string, KeywordVolume>> {
  if (!isNaverSearchAdConfigured()) {
    return new Map();
  }

  const unique = [
    ...new Set(
      hintKeywords.map((k) => k.replace(/\s+/g, "").trim()).filter(Boolean)
    ),
  ];
  if (!unique.length) return new Map();

  const customerId = process.env.NAVER_SEARCHAD_CUSTOMER_ID!;
  const apiKey = process.env.NAVER_SEARCHAD_API_KEY!;
  const secretKey = process.env.NAVER_SEARCHAD_SECRET_KEY!;

  const out = new Map<string, KeywordVolume>();
  let lastError: string | undefined;
  let okBatches = 0;

  const batchSize = 5;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    try {
      const params = new URLSearchParams({
        hintKeywords: batch.join(","),
        showDetail: "1",
        includeHintKeywords: "1",
      });

      const timestamp = String(Date.now());
      const signature = sign(timestamp, "GET", KEYWORD_URI, secretKey);

      const res = await fetch(`${BASE_URL}${KEYWORD_URI}?${params}`, {
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Timestamp": timestamp,
          "X-API-KEY": apiKey,
          "X-Customer": customerId,
          "X-Signature": signature,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `네이버 검색광고 API (${res.status}): ${text.slice(0, 200)}`
        );
      }

      const data = (await res.json()) as {
        keywordList?: {
          relKeyword?: string;
          monthlyPcQcCnt?: unknown;
          monthlyMobileQcCnt?: unknown;
        }[];
      };

      const rows = data.keywordList ?? [];
      for (const row of rows) {
        const vol = rowToVolume(row);
        if (!vol) continue;
        out.set(vol.keyword, vol);
      }

      for (const hint of batch) {
        const h = hint.replace(/\s+/g, "").trim();
        if (!h || out.has(h)) continue;
        const exact = rows.find(
          (r) =>
            normalizeKeywordKey(r.relKeyword ?? "") === normalizeKeywordKey(h)
        );
        const vol = exact ? rowToVolume(exact) : null;
        if (vol) out.set(h, vol);
      }

      okBatches += 1;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn("[searchad] keyword batch failed:", lastError);
    }

    if (i + batchSize < unique.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  if (out.size === 0 && lastError) {
    throw new Error(lastError);
  }
  if (out.size === 0 && okBatches > 0) {
    console.warn("[searchad] API 응답은 있으나 매칭 키워드 없음");
  }

  return out;
}

/** 후보 키워드 중 API 결과와 매칭되는 첫 검색량 (하위 호환) */
export function resolveVolumeForPlace(
  placeName: string,
  volumes: Map<string, KeywordVolume>,
  brandSearchKeyword?: string
): KeywordVolume | null {
  const { full, short } = resolveVolumePairForPlace(
    placeName,
    volumes,
    brandSearchKeyword
  );
  return full ?? (short && short.total > 0 ? short : null);
}
