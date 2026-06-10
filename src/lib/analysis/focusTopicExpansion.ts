import { topicsForSpecialty, withCompanionTopics } from "./specialties";

/** 공략에 지방흡입만 넣을 때 표시할 부위별 키워드 */
export const LIPOSUCTION_FOCUS_TOPICS = [
  "지방흡입",
  "팔지방흡입",
  "복부지방흡입",
  "얼굴지방흡입",
  "등지방흡입",
  "허벅지지방흡입",
  "종아리지방흡입",
  "엉덩이지방흡입",
] as const;

/**
 * 공략 키워드(씨앗) → 함께 노출할 연관 주제 (하이브리드 A: 수동 그룹)
 * 진료과 기본 목록에 없어도 SEO 주제로 포함 가능
 */
export const FOCUS_TOPIC_CLUSTERS: Record<string, string[]> = {
  // 척추·디스크
  허리디스크: [
    "허리디스크",
    "목디스크",
    "디스크치료",
    "허리통증",
    "목통증",
    "신경차단술",
    "신경성형술",
    "척추정형외과",
  ],
  목디스크: [
    "허리디스크",
    "목디스크",
    "디스크치료",
    "허리통증",
    "목통증",
    "신경차단술",
    "신경성형술",
  ],
  디스크치료: ["허리디스크", "목디스크", "디스크치료", "허리통증", "목통증"],
  허리통증: ["허리통증", "목통증", "허리디스크", "도수치료", "신경차단술"],
  목통증: ["목통증", "허리통증", "목디스크", "도수치료"],
  // 관절
  퇴행성관절염: [
    "퇴행성관절염",
    "관절염치료",
    "무릎통증",
    "관절정형외과",
    "무릎정형외과",
  ],
  관절염치료: ["퇴행성관절염", "관절염치료", "무릎통증", "관절정형외과"],
  무릎통증: ["무릎통증", "무릎정형외과", "퇴행성관절염", "관절염치료"],
  어깨통증: ["어깨통증", "어깨정형외과", "도수치료", "재활치료"],
  // 팔꿈치(엘보)
  팔꿈치통증: [
    "팔꿈치통증",
    "테니스엘보",
    "골프엘보",
    "팔꿈치염좌",
    "어깨정형외과",
    "주사치료",
    "도수치료",
  ],
  테니스엘보: [
    "테니스엘보",
    "골프엘보",
    "팔꿈치통증",
    "팔꿈치염좌",
    "주사치료",
    "체외충격파",
    "도수치료",
  ],
  골프엘보: ["골프엘보", "테니스엘보", "팔꿈치통증", "주사치료", "도수치료"],
  팔꿈치염좌: ["팔꿈치염좌", "팔꿈치통증", "테니스엘보", "골프엘보"],
  엘보: ["테니스엘보", "골프엘보", "팔꿈치통증", "팔꿈치염좌", "주사치료"],
  // 족부
  족부정형외과: [
    "족부정형외과",
    "발목통증",
    "족저근막염",
    "아킬레스건염",
    "발목염좌",
    "체외충격파",
    "도수치료",
  ],
  족저근막염: [
    "족저근막염",
    "발목통증",
    "아킬레스건염",
    "발목염좌",
    "족부정형외과",
    "체외충격파",
    "도수치료",
  ],
  발목염좌: [
    "발목염좌",
    "발목통증",
    "아킬레스건염",
    "족부정형외과",
    "발목인대파열",
  ],
  발목통증: ["발목통증", "발목염좌", "족저근막염", "아킬레스건염", "족부정형외과"],
  아킬레스건염: ["아킬레스건염", "발목통증", "족저근막염", "족부정형외과"],
  // 수부
  수부정형외과: [
    "수부정형외과",
    "손목통증",
    "손목터널증후군",
    "방아쇠수지",
    "손목염좌",
    "주사치료",
    "도수치료",
  ],
  손목터널증후군: [
    "손목터널증후군",
    "손목통증",
    "손목염좌",
    "방아쇠수지",
    "수부정형외과",
    "주사치료",
  ],
  방아쇠수지: ["방아쇠수지", "손목통증", "손가락통증", "수부정형외과"],
  손목통증: ["손목통증", "손목터널증후군", "손목염좌", "방아쇠수지", "수부정형외과"],
  // 치과
  임플란트: ["임플란트", "충치치료", "신경치료", "잇몸치료", "라미네이트"],
  치아교정: ["치아교정", "라미네이트", "사랑니", "매복사랑니"],
  사랑니: ["사랑니", "매복사랑니", "치아교정"],
  // 유방
  유방초음파: ["유방초음파", "유방암검사", "맘모톰", "미세석회화"],
  유방암검사: ["유방초음파", "유방암검사", "맘모톰", "미세석회화"],
  맘모톰: ["맘모톰", "유방초음파", "유방암검사", "미세석회화"],
  // 안과
  라식: ["라식", "라섹", "스마일라식", "백내장"],
  라섹: ["라식", "라섹", "스마일라식"],
  백내장: ["백내장", "녹내장", "망막"],
  // 피부·성형
  쁘띠: [
    "쁘띠",
    "보톡스",
    "필러",
    "리쥬란",
    "스킨보톡스",
    "물광주사",
    "레이저토닝",
    "리프팅",
    "인모드",
    "울쎄라",
  ],
  쁘띠시술: [
    "쁘띠시술",
    "보톡스",
    "필러",
    "리쥬란",
    "스킨보톡스",
    "물광주사",
    "레이저토닝",
    "인모드",
  ],
  보톡스: ["보톡스", "필러", "쁘띠", "리프팅", "레이저토닝", "스킨보톡스"],
  필러: ["필러", "보톡스", "쁘띠", "리프팅", "리쥬란"],
  리쥬란: ["리쥬란", "쁘띠", "스킨보톡스", "물광주사", "보톡스", "필러"],
  스킨보톡스: ["스킨보톡스", "쁘띠", "보톡스", "물광주사", "리쥬란"],
  물광주사: ["물광주사", "쁘띠", "리쥬란", "스킨보톡스"],
  여드름: ["여드름", "기미", "레이저토닝", "아토피"],
  레이저토닝: ["레이저토닝", "기미", "여드름", "제모", "쁘띠"],
  내성발톱: ["내성발톱", "발톱", "제모", "아토피"],
  // 화상외과
  화상치료: [
    "화상치료",
    "손화상",
    "얼굴화상",
    "발화상",
    "허벅지화상",
    "1도화상",
    "2도화상",
    "고데기화상",
    "자외선화상",
  ],
  손화상: ["손화상", "얼굴화상", "화상치료", "1도화상", "2도화상"],
  코성형: ["코성형", "눈성형", "리프팅"],
  눈성형: ["눈성형", "코성형", "리프팅"],
  지방흡입: [...LIPOSUCTION_FOCUS_TOPICS],
  안면거상: ["안면거상", "리프팅", "눈성형", "코성형"],
  리프팅: ["리프팅", "안면거상", "눈성형", "코성형"],
  // 산부·여성
  불임: ["불임", "난임", "산전검진", "여성검진"],
  난임: ["불임", "난임"],
  자궁근종: ["자궁근종", "여성검진", "산전검진"],
  // 비뇨
  전립선: ["전립선", "전립선비대증", "전립선염", "요로결석"],
  전립선비대증: ["전립선", "전립선비대증", "전립선염", "요로결석"],
  전립선염: ["전립선염", "전립선", "전립선비대증", "발기부전"],
  발기부전: ["발기부전", "전립선염", "조루", "갱년기"],
  정관수술: ["정관수술", "포경수술", "비뇨기과"],
  포경수술: ["포경수술", "정관수술", "비뇨기과"],
  요실금: ["요실금", "골반저근", "방광염", "배뇨장애"],
  // 내과·검진
  건강검진: ["건강검진", "위내시경", "대장내시경", "혈액검사"],
  위내시경: ["위내시경", "대장내시경", "건강검진"],
  고혈압: ["고혈압", "당뇨"],
  당뇨: ["고혈압", "당뇨"],
  투석치료: ["투석치료", "혈액투석", "야간투석"],
  // 재활·한방
  도수치료: ["도수치료", "재활치료", "물리치료", "척추재활"],
  추나요법: ["추나요법", "교통사고후유증", "도수치료", "침치료", "한약"],
  교통사고후유증: [
    "교통사고후유증",
    "추나요법",
    "허리디스크",
    "목디스크",
    "디스크치료",
  ],
  // 항문
  치질: ["치질", "치핵", "항문질환", "항문통증"],
  치핵: ["치질", "치핵", "항문질환"],
  // 신경
  두통: ["두통", "어지럼증", "손발저림"],
  치매: ["치매", "파킨슨", "뇌졸중"],
  // 정신
  우울증: ["우울증", "불면증", "불안장애", "심리상담"],
  // 소아
  소아감기: ["소아감기", "소아알레르기", "소아천식", "예방접종"],
};

const AUTO_STEM_BLOCKLIST = new Set([
  "치료",
  "검사",
  "클리닉",
  "전문의",
  "추천",
  "진료",
  "외과",
  "내과",
  "의학",
  "병원",
  "관리",
  "입원",
  "재활",
  "통증",
  "야간",
  "잘하는",
  "후기",
  "비용",
  "위치",
  "전문",
  "한의",
  "한방",
  "소아",
  "여성",
  "남자",
  "남성",
]);

function clusterForSeed(seed: string): string[] {
  if (FOCUS_TOPIC_CLUSTERS[seed]) return FOCUS_TOPIC_CLUSTERS[seed];

  let best: string[] | null = null;
  let bestKeyLen = 0;
  for (const [key, group] of Object.entries(FOCUS_TOPIC_CLUSTERS)) {
    if (seed.includes(key) || key.includes(seed)) {
      if (key.length > bestKeyLen) {
        bestKeyLen = key.length;
        best = group;
      }
    }
  }
  return best ?? [];
}

/** 진료과 기본 목록에서 부분 문자열로 연관 주제 자동 확장 */
function autoRelatedFromPool(
  seed: string,
  pool: string[],
  mainSpecialty: string
): string[] {
  let bestStem = "";
  let bestHits = 0;

  for (let len = Math.min(seed.length, 10); len >= 3; len--) {
    for (let i = 0; i <= seed.length - len; i++) {
      const sub = seed.slice(i, i + len);
      if (AUTO_STEM_BLOCKLIST.has(sub)) continue;
      const hits = pool.filter(
        (t) => t !== mainSpecialty && t !== seed && t.includes(sub)
      ).length;
      if (hits > bestHits) {
        bestHits = hits;
        bestStem = sub;
      }
    }
  }

  if (!bestStem || bestHits < 1) return [];

  return pool.filter(
    (t) =>
      t !== mainSpecialty &&
      t !== seed &&
      t.includes(bestStem) &&
      !AUTO_STEM_BLOCKLIST.has(t)
  );
}

/**
 * 공략 키워드 직접 입력 시: 진료과 + 입력 씨앗 + (수동 클러스터 ∪ 진료과 목록 자동 매칭)
 */
export function expandFocusedTopics(specialty: string, seeds: string[]): string[] {
  const main = specialty.trim();
  const pool = topicsForSpecialty(specialty);
  const cleaned = seeds.map((s) => s.trim()).filter(Boolean);
  const expandExclude = buildFocusExcludeSet(cleaned);

  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (topic: string) => {
    const t = topic.trim();
    if (!t || seen.has(t)) return;
    if (expandExclude.has(t) && !cleaned.includes(t)) return;
    seen.add(t);
    ordered.push(t);
  };

  add(main);

  for (const seed of cleaned) {
    if (seed === main) continue;
    add(seed);

    for (const t of clusterForSeed(seed)) add(t);

    for (const t of autoRelatedFromPool(seed, pool, main)) add(t);
  }

  return ordered;
}

/** 공략 씨앗과 겹치지 않게 표시할 짝 (쁘띠 ↔ 쁘띠시술 등) */
const FOCUS_PEER_EXCLUSIONS: Record<string, string[]> = {
  쁘띠: ["쁘띠시술"],
  쁘띠시술: ["쁘띠"],
};

function buildFocusExcludeSet(seeds: string[]): Set<string> {
  const exclude = new Set<string>();
  const cleaned = seeds.map((s) => s.trim()).filter(Boolean);

  for (const seed of cleaned) {
    exclude.add(seed);
    const peers = FOCUS_PEER_EXCLUSIONS[seed];
    if (peers) peers.forEach((p) => exclude.add(p));
    for (const [key, peerList] of Object.entries(FOCUS_PEER_EXCLUSIONS)) {
      if (seed.includes(key) || key.includes(seed)) {
        peerList.forEach((p) => exclude.add(p));
      }
    }
  }
  return exclude;
}

export function exclusiveFocusTopicList(seeds: string[]): string[] | null {
  const cleaned = seeds.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 1 && cleaned[0] === "지방흡입") {
    return [...LIPOSUCTION_FOCUS_TOPICS];
  }
  return null;
}

/** 공략 키워드 직접 입력 시 최종 주제 목록 */
export function buildCustomFocusTopicList(
  specialty: string,
  seeds: string[]
): string[] {
  const exclusive = exclusiveFocusTopicList(seeds);
  if (exclusive) return exclusive;

  let topics = withCompanionTopics(specialty, expandFocusedTopics(specialty, seeds));
  return excludeFocusSeedsFromTopics(topics, seeds);
}

/** 공략 입력 씨앗·짝 키워드는 표 열에서 제외 */
export function excludeFocusSeedsFromTopics(
  topics: string[],
  seeds: string[]
): string[] {
  if (!seeds.length) return topics;
  const exclude = buildFocusExcludeSet(seeds);
  return topics.filter((t) => !exclude.has(t.trim()));
}
