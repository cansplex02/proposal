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
const BRANCH_AFTER_CLINIC_RE =
  /^(.+?(?:의원|병원|클리닉|센터|의료원|한의원|치과))(.+)$/u;
const BRANCH_TAIL_RE =
  /^(?:[가-힣]{2,14}(?:역곡역|역점|역|점|동|지점|본점|분점)|부천역곡역|역곡역)$/u;

/** 의원·병원 뒤에 붙은 지역·지점명 제거 (연세안…의원 부천역곡역 → 연세안…의원) */
export function stripBranchAfterMedicalSuffix(placeName: string): string {
  const bare = placeName.replace(/\s+/g, "").trim();
  if (!bare) return bare;

  const m = bare.match(BRANCH_AFTER_CLINIC_RE);
  if (!m) return bare;

  const clinic = m[1];
  const tail = m[2];
  if (!tail || tail.length < 2) return bare;
  if (BRANCH_TAIL_RE.test(tail) || /(?:역|점|동)$/.test(tail)) {
    return clinic;
  }
  return bare;
}

/** 마취통증의학과 → 통증의학과 (검색광고 키워드 조회용) */
export function mapAnesthesiaToPainDept(name: string): string | null {
  if (!name.includes("마취통증의학과")) return null;
  const mapped = name.replace(/마취통증의학과/g, "통증의학과");
  return mapped !== name ? mapped : null;
}

/** 상호에서 의원·병원 등 접미사 제거 (예: 부평그린마취통증의학과의원 → 부평그린마취통증의학과) */
export function stripMedicalSuffix(placeName: string): string | null {
  const bare = stripBranchAfterMedicalSuffix(placeName);
  const short = bare.replace(MEDICAL_SUFFIX_RE, "");
  if (short.length >= 3 && short !== bare) return short;
  return null;
}

function addVolumeKeywordCandidate(target: Set<string>, raw: string): void {
  const t = raw.replace(/\s+/g, "").trim();
  if (t.length >= 2) target.add(t);
}

/** 병원 상호 → 검색광고 API hint·매칭용 키워드 후보 */
export function volumeSearchKeywordsForPlace(
  placeName: string,
  brandSearchKeyword?: string
): string[] {
  const candidates = new Set<string>();

  if (brandSearchKeyword) addVolumeKeywordCandidate(candidates, brandSearchKeyword);

  const compact = placeName.replace(/\s+/g, "").trim();
  const base = stripBranchAfterMedicalSuffix(placeName);

  addVolumeKeywordCandidate(candidates, compact);
  if (base !== compact) addVolumeKeywordCandidate(candidates, base);

  const painFromBase = mapAnesthesiaToPainDept(base);
  if (painFromBase) addVolumeKeywordCandidate(candidates, painFromBase);

  const short = stripMedicalSuffix(base);
  if (short) {
    addVolumeKeywordCandidate(candidates, short);
    const shortPain = mapAnesthesiaToPainDept(short);
    if (shortPain) addVolumeKeywordCandidate(candidates, shortPain);
  }

  return [...candidates];
}

/** 병원 상호 → 키워드 도구 조회용 후보 (공백 제거·짧은 브랜드) */
export function keywordCandidatesForPlace(
  placeName: string,
  brandSearchKeyword?: string
): string[] {
  return volumeSearchKeywordsForPlace(placeName, brandSearchKeyword);
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
  const base = stripBranchAfterMedicalSuffix(placeName);
  const compact = base.replace(/\s+/g, "");
  if (!compact) return null;

  const painCompact = mapAnesthesiaToPainDept(compact) ?? compact;
  const short = stripMedicalSuffix(base);
  const shortPain = short ? mapAnesthesiaToPainDept(short) : null;

  let best: KeywordVolume | null = null;
  let bestScore = 0;

  for (const [key, vol] of volumes) {
    if (vol.total <= 0) continue;
    const k = normalizeKeywordKey(key);
    if (k.length < 3) continue;

    let score = 0;
    if (normalizeKeywordKey(compact) === k || normalizeKeywordKey(painCompact) === k) {
      score = 1000 + k.length;
    } else if (compact.includes(k) || painCompact.includes(k)) {
      score = 500 + k.length;
    } else if (
      k.includes(compact.replace(MEDICAL_SUFFIX_RE, "")) ||
      k.includes(painCompact.replace(MEDICAL_SUFFIX_RE, ""))
    ) {
      score = 400 + k.length;
    } else if (short) {
      const sn = normalizeKeywordKey(short);
      const sp = shortPain ? normalizeKeywordKey(shortPain) : sn;
      if (k.includes(sn) || sn.includes(k) || k.includes(sp) || sp.includes(k)) {
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
  const keys = volumeSearchKeywordsForPlace(placeName, brandSearchKeyword);
  const normalizedBase = stripBranchAfterMedicalSuffix(placeName);

  let best: KeywordVolume | null = null;
  let bestKey: string | null = null;

  for (const key of keys) {
    const vol = lookupKeywordVolume(key, volumes);
    if (vol && vol.total > 0 && (!best || vol.total > best.total)) {
      best = vol;
      bestKey = vol.keyword;
    }
  }

  if (!best) {
    best = findBestVolumeByPlaceName(normalizedBase, volumes);
    if (best) bestKey = best.keyword;
  }
  if (!best && brandSearchKeyword) {
    best = findBestVolumeByPlaceName(brandSearchKeyword, volumes);
    if (best) bestKey = best.keyword;
  }

  const shortKeyword = stripMedicalSuffix(normalizedBase);

  if (best) {
    return {
      full: best,
      short: null,
      shortKeyword: bestKey ?? best.keyword,
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
