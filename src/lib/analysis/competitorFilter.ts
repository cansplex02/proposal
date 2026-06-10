import { resolveCanonicalSpecialty } from "./specialties";

/** 네이버 플레이스 등록 카테고리(진료과) — 지도 목록·지역검색 API에서 매칭 */
export const NAVER_MEDICAL_CATEGORIES = [
  "마취통증의학과",
  "통증의학과",
  "정형외과",
  "재활의학과",
  "신경외과",
  "신경과",
  "가정의학과",
  "내과",
  "외과",
  "대장항문과",
  "피부과",
  "성형외과",
  "비뇨의학과",
  "산부인과",
  "소아청소년과",
  "안과",
  "이비인후과",
  "정신건강의학과",
  "영상의학과",
  "치과",
  "한의원",
  "한방내과",
  "한방부인과",
  "한방소아과",
  "한방신경정신과",
  "한방안이비인후피부과",
  "한방재활의학과",
] as const;

export type NaverMedicalCategory = (typeof NAVER_MEDICAL_CATEGORIES)[number];

const GENERIC_NAVER_CATEGORIES = new Set(["외과", "내과"]);

/** 지역검색 API(정확) vs 지도 텍스트 추론(대략) — 구체적 카테고리 우선 */
export function preferNaverCategory(
  primary?: string,
  secondary?: string
): string | undefined {
  if (!primary && !secondary) return undefined;
  if (!primary) return secondary;
  if (!secondary) return primary;
  if (
    GENERIC_NAVER_CATEGORIES.has(primary) &&
    !GENERIC_NAVER_CATEGORIES.has(secondary)
  ) {
    return secondary;
  }
  if (
    GENERIC_NAVER_CATEGORIES.has(secondary) &&
    !GENERIC_NAVER_CATEGORIES.has(primary)
  ) {
    return primary;
  }
  return primary;
}

export type FacilityTier =
  | "clinic"
  | "hospital"
  | "oriental_hospital"
  | "oriental_clinic"
  | "dental"
  | "unknown";

export type MapPlaceHit = {
  name: string;
  isAd: boolean;
  naverCategory?: string;
  facilityTier?: FacilityTier;
  lat?: number;
  lng?: number;
  /** 지역검색·지오코딩으로 확인된 주소 (타 지역 오매칭 방지) */
  address?: string;
};

/** 제안서 진료과 → 경쟁으로 볼 네이버 카테고리 */
const SPECIALTY_TO_NAVER_CATEGORIES: Record<string, string[]> = {
  마취통증의학과: ["정형외과", "마취통증의학과", "통증의학과", "재활의학과"],
  통증의학과: ["정형외과", "마취통증의학과", "통증의학과", "재활의학과"],
  정형외과: ["정형외과", "마취통증의학과", "통증의학과", "재활의학과", "신경외과"],
  재활의학과: ["재활의학과", "정형외과", "마취통증의학과", "통증의학과"],
  신경외과: ["신경외과", "정형외과", "마취통증의학과"],
  신경과: ["신경과", "정형외과"],
  가정의학과: ["가정의학과", "내과"],
  내과: ["내과", "가정의학과"],
  피부과: ["피부과", "성형외과"],
  성형외과: ["성형외과", "피부과"],
  치과: ["치과"],
  한의원: ["한의원", "한방내과", "한방재활의학과", "한방신경정신과", "한방안이비인후피부과", "한방부인과", "한방소아과"],
  한방병원: ["한의원", "한방내과", "한방재활의학과", "한방신경정신과", "한방안이비인후피부과", "한방부인과", "한방소아과"],
  비뇨의학과: ["비뇨의학과", "비뇨기과"],
  여성비뇨의학과: ["여성비뇨의학과", "여성비뇨기과"],
  산부인과: ["산부인과"],
  안과: ["안과"],
  이비인후과: ["이비인후과"],
  소아청소년과: ["소아청소년과", "소아과"],
  정신건강의학과: ["정신건강의학과", "정신과"],
  항문외과: ["대장항문과"],
  여성의학과: ["여성의학과", "산부인과"],
};

export type CompetitorFilterContext = {
  clinicName: string;
  specialty: string;
  mainSearchKeyword?: string;
};

export function detectFacilityTier(placeName: string): FacilityTier {
  const n = placeName.replace(/\s+/g, "");
  if (/한방병원/.test(n)) return "oriental_hospital";
  if (/한의원/.test(n)) return "oriental_clinic";
  if (/치과/.test(n)) return "dental";
  if (/병원/.test(n)) return "hospital";
  if (/(의원|클리닉|센터|의료원)/.test(n)) return "clinic";
  return "unknown";
}

function facilityGroup(
  tier: FacilityTier
): "western" | "oriental" | "dental" | "unknown" {
  if (tier === "oriental_hospital" || tier === "oriental_clinic") {
    return "oriental";
  }
  if (tier === "dental") return "dental";
  if (tier === "hospital" || tier === "clinic") return "western";
  return "unknown";
}

/** 개원 예정 등 병원명 없을 때 진료과·검색 키워드로 시설 규모 추정 */
export function resolveOurFacilityTier(ctx: CompetitorFilterContext): FacilityTier {
  const fromName = detectFacilityTier(ctx.clinicName);
  if (fromName !== "unknown") return fromName;

  const fromSpec = detectFacilityTier(resolveCanonicalSpecialty(ctx.specialty));
  if (fromSpec !== "unknown") return fromSpec;

  const fromKw = extractCategoryFromKeyword(ctx.mainSearchKeyword ?? "");
  if (fromKw) {
    const t = detectFacilityTier(fromKw);
    if (t !== "unknown") return t;
  }

  return "clinic";
}

function normalizeTheirTier(
  theirs: FacilityTier,
  our: FacilityTier
): FacilityTier {
  if (theirs !== "unknown") return theirs;
  return our === "hospital" ? "hospital" : "clinic";
}

/** 의원↔의원, 병원↔병원, 한방병원↔(한방병원·한의원), 한의원↔(한의원·한방병원) */
export function facilityTiersCompatible(
  our: FacilityTier,
  theirs: FacilityTier
): boolean {
  const gOur = facilityGroup(our);
  const gTheirs = facilityGroup(theirs);
  if (gOur === "unknown" || gTheirs === "unknown") return false;
  if (gOur !== gTheirs) return false;

  if (gOur === "oriental") {
    return theirs === "oriental_hospital" || theirs === "oriental_clinic";
  }

  if (gOur === "dental") return theirs === "dental";
  if (our === "hospital") return theirs === "hospital";
  if (our === "clinic") return theirs === "clinic";
  return false;
}

/** 지역검색 API category 경로 또는 한 줄 라벨에서 진료과 추출 */
export function parseNaverCategoryLabel(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return null;

  const compact = t.replace(/\s+/g, "");
  if (/대장[,·]?항문|항문[,·]?대장/u.test(compact)) return "대장항문과";

  const segments = t.split(/[>·,]/).map((s) => s.trim()).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const hit = matchMedicalCategoryToken(segments[i]);
    if (hit) return hit;
  }
  return matchMedicalCategoryToken(t);
}

export function matchMedicalCategoryToken(text: string): string | null {
  const t = text.replace(/\s+/g, "").trim();
  if (!t || t.length > 40) return null;
  if (/(의원|병원|한의원|클리닉)$/.test(t) && t.length > 10) return null;

  if (/^대장[,·]?항문|항문[,·]?대장/u.test(t) || t === "항문과") {
    return "대장항문과";
  }
  if (t === "항문외과" || t.includes("항문외과")) return "대장항문과";

  const sorted = [...NAVER_MEDICAL_CATEGORIES].sort((a, b) => b.length - a.length);
  for (const cat of sorted) {
    if (t === cat || t.startsWith(cat)) return cat;
  }
  return null;
}

/** 상호·키워드에만 쓰이는 표기 → 네이버 카테고리 */
const PLACE_NAME_CATEGORY_HINTS: { pattern: RegExp; category: string }[] = [
  { pattern: /여성비뇨기과|여성비뇨의학/u, category: "여성비뇨의학과" },
  { pattern: /비뇨기과|비뇨의학/u, category: "비뇨의학과" },
  {
    pattern: /항문외과|대장항문|항앤하지|항외과|치질|치핵/u,
    category: "대장항문과",
  },
];

export function inferCategoryFromPlaceName(placeName: string): string | null {
  const compact = placeName.replace(/\s+/g, "");

  for (const { pattern, category } of PLACE_NAME_CATEGORY_HINTS) {
    if (pattern.test(compact)) return category;
  }

  const sorted = [...NAVER_MEDICAL_CATEGORIES].sort((a, b) => b.length - a.length);
  for (const cat of sorted) {
    if (
      cat === "외과" &&
      /[가-힣]+외과(?:의원|병원|클리닉|센터|의료원)/u.test(compact)
    ) {
      continue;
    }
    if (compact.includes(cat)) return cat;
  }
  return null;
}

/** 제안서 진료과 → 네이버 플레이스 검색·필터용 카테고리 (예: 항문외과 → 대장항문과) */
export function naverCategoriesForSpecialty(specialty: string): string[] {
  const spec = resolveCanonicalSpecialty(specialty);
  return [...(SPECIALTY_TO_NAVER_CATEGORIES[spec] ?? [spec])];
}

export function resolveAllowedNaverCategories(
  ctx: CompetitorFilterContext
): Set<string> {
  const allowed = new Set<string>();
  const spec = resolveCanonicalSpecialty(ctx.specialty);

  const mapped = SPECIALTY_TO_NAVER_CATEGORIES[spec];
  if (mapped) mapped.forEach((c) => allowed.add(c));

  const fromKeyword = extractCategoryFromKeyword(ctx.mainSearchKeyword ?? "");
  if (fromKeyword && mapped?.includes(fromKeyword)) {
    allowed.add(fromKeyword);
  }

  if (allowed.size === 0) {
    const self = matchMedicalCategoryToken(spec);
    if (self) allowed.add(self);
    else allowed.add(spec);
  }

  return allowed;
}

function extractCategoryFromKeyword(keyword: string): string | null {
  const k = keyword.trim();
  if (!k) return null;
  return matchMedicalCategoryToken(k) ?? inferCategoryFromPlaceName(k);
}

/** 네이버 카테고리·상호 기준으로 분석 진료과와 충돌 시 제외 */
export function placeHasConflictingDepartment(
  place: MapPlaceHit,
  allowed: Set<string>
): boolean {
  if (place.naverCategory) {
    if (!allowed.has(place.naverCategory)) {
      if (
        place.naverCategory === "외과" &&
        allowed.has("대장항문과") &&
        inferCategoryFromPlaceName(place.name) === "대장항문과"
      ) {
        return false;
      }
      return true;
    }
    return false;
  }

  const inferred = inferCategoryFromPlaceName(place.name);
  if (inferred) return !allowed.has(inferred);

  const compact = place.name.replace(/\s+/g, "");
  const hasAllowedToken = [...allowed].some(
    (t) => t.length >= 2 && compact.includes(t)
  );
  if (hasAllowedToken) return false;

  for (const cat of NAVER_MEDICAL_CATEGORIES) {
    if (allowed.has(cat) || !compact.includes(cat)) continue;
    if (cat === "신경과" && compact.includes("신경외과")) continue;
    if (cat === "외과" && /(신경|성형|비뇨|항문|흉부|대장|소화)외과/u.test(compact)) {
      continue;
    }
    if (cat === "내과" && /(비뇨|이비인후|소아|한방내|신경|정신)/u.test(compact)) {
      continue;
    }
    return true;
  }
  return false;
}

/** 지도 검색 키워드 진료과와 충돌 없으면 포함 (상호에 과명이 없는 목록 보완) */
function matchesMapSearchSpecialty(
  place: MapPlaceHit,
  allowed: Set<string>,
  mainSearchKeyword?: string
): boolean {
  const kw = mainSearchKeyword?.trim();
  if (!kw) return false;
  const kwCat = extractCategoryFromKeyword(kw);
  if (!kwCat || !allowed.has(kwCat)) return false;
  if (placeHasConflictingDepartment(place, allowed)) return false;
  const inferred =
    place.naverCategory ?? inferCategoryFromPlaceName(place.name) ?? null;
  if (inferred && !allowed.has(inferred)) return false;
  return true;
}

export function placeMatchesCategory(
  place: MapPlaceHit,
  allowed: Set<string>,
  mainSearchKeyword?: string
): boolean {
  if (placeHasConflictingDepartment(place, allowed)) return false;

  const inferred = inferCategoryFromPlaceName(place.name);
  const cat = place.naverCategory ?? inferred ?? null;
  if (cat) {
    if (allowed.has(cat)) return true;
    if (cat === "외과" && inferred && allowed.has(inferred)) return true;
    return false;
  }

  const compact = place.name.replace(/\s+/g, "");
  for (const token of allowed) {
    if (token.length >= 2 && compact.includes(token)) return true;
  }

  return matchesMapSearchSpecialty(place, allowed, mainSearchKeyword);
}

/** 상호·병원명 일치 (우리 병원 제외) */
export function isOurPlace(placeName: string, clinicName: string): boolean {
  const a = normalizePlaceKey(placeName);
  const b = normalizePlaceKey(clinicName);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;

  const aCore = a.replace(/(의원|병원|클리닉|센터|의료원)$/u, "");
  const bCore = b.replace(/(의원|병원|클리닉|센터|의료원)$/u, "");
  if (aCore.length >= 4 && bCore.length >= 4) {
    if (aCore.includes(bCore) || bCore.includes(aCore)) return true;
  }

  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  let overlap = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) overlap++;
  }
  const minSize = Math.min(aTokens.size, bTokens.size);
  return minSize > 0 && overlap / minSize >= 0.6;
}

function normalizePlaceKey(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function tokenSet(s: string): Set<string> {
  const chunks = s.match(/[가-힣]{2,}|[a-z0-9]{2,}/gi) ?? [];
  return new Set(chunks.map((c) => c.toLowerCase()));
}

export function filterCompetitorPlaces(
  places: MapPlaceHit[],
  ctx: CompetitorFilterContext
): MapPlaceHit[] {
  const ourTier = resolveOurFacilityTier(ctx);
  const allowed = resolveAllowedNaverCategories(ctx);

  return places.filter((place) => {
    if (isOurPlace(place.name, ctx.clinicName)) return false;

    const theirTier = normalizeTheirTier(
      place.facilityTier ?? detectFacilityTier(place.name),
      ourTier
    );
    if (!facilityTiersCompatible(ourTier, theirTier)) return false;

    return placeMatchesCategory(place, allowed, ctx.mainSearchKeyword);
  });
}
