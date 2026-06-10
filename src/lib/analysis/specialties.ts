/** 진료과 선택 목록 (검색 폼 datalist) */
export const SPECIALTY_OPTIONS = [
  "정형외과",
  "마취통증의학과",
  "통증의학과",
  "재활의학과",
  "신경외과",
  "피부과",
  "성형외과",
  "내과",
  "가정의학과",
  "산부인과",
  "안과",
  "이비인후과",
  "비뇨의학과",
  "치과",
  "한의원",
  "한방병원",
  "항문외과",
] as const;

/** 구 명칭 → 공식 진료과명 (키워드 주제는 SPECIALTY_TOPICS 그대로) */
export const SPECIALTY_ALIASES: Record<string, string> = {
  비뇨기과: "비뇨의학과",
  여성비뇨기과: "여성비뇨의학과",
  "대장,항문과": "항문외과",
  대장항문과: "항문외과",
};

export function resolveCanonicalSpecialty(specialty: string): string {
  const normalized = specialty.trim();
  return SPECIALTY_ALIASES[normalized] ?? normalized;
}

/** 진료과별 기본 공략 키워드 주제 (지역명 + 주제 조합) */
export const SPECIALTY_TOPICS: Record<string, string[]> = {
  정형외과: [
    "정형외과",
    "허리디스크",
    "목디스크",
    "디스크치료",
    "퇴행성관절염",
    "관절염치료",
    "허리통증",
    "무릎통증",
    "어깨통증",
    "팔꿈치통증",
    "테니스엘보",
    "골프엘보",
    "팔꿈치염좌",
    "목통증",
    "도수치료",
    "재활치료",
    "주사치료",
    "신경차단술",
    "신경성형술",
    "척추정형외과",
    "관절정형외과",
    "어깨정형외과",
    "무릎정형외과",
    "족부정형외과",
    "수부정형외과",
    "발목통증",
    "손목통증",
    "족저근막염",
    "손목터널증후군",
    "아킬레스건염",
    "발목염좌",
    "방아쇠수지",
    "체외충격파",
    "교통사고후유증",
  ],
  내과: [
    "내과",
    "건강검진",
    "위내시경",
    "대장내시경",
    "고혈압",
    "당뇨",
    "비만클리닉",
    "비만치료",
    "갑상선검사",
    "혈액검사",
  ],
  투석내과: [
    "투석내과",
    "혈액검사",
    "투석치료",
    "혈액투석",
    "고혈압",
    "당뇨",
    "야간투석",
  ],
  피부과: [
    "피부과",
    "피부관리",
    "여드름",
    "기미",
    "레이저토닝",
    "보톡스",
    "필러",
    "리쥬란",
    "스킨보톡스",
    "물광주사",
    "제모",
    "아토피",
    "인모드",
    "울쎄라",
    "스컬트라",
    "대상포진",
  ],
  치과: [
    "치과",
    "임플란트",
    "라미네이트",
    "치아교정",
    "사랑니",
    "매복사랑니",
    "충치치료",
    "신경치료",
    "잇몸치료",
  ],
  유방외과: [
    "유방외과",
    "유방외과전문의",
    "유방외과추천",
    "유방초음파",
    "유방암검사",
    "맘모톰",
    "갑상선",
    "미세석회화",
  ],
  안과: [
    "안과",
    "라식",
    "라섹",
    "스마일라식",
    "백내장",
    "녹내장",
    "드림렌즈",
    "소아안과",
    "망막",
  ],
  성형외과: [
    "성형외과",
    "코성형",
    "눈성형",
    "리프팅",
    "가슴성형",
    "남자성형",
    "성형외과추천",
  ],
  산부인과: [
    "산부인과",
    "산전검진",
    "임신",
    "여성검진",
    "자궁근종",
    "질염",
    "불임",
    "피임",
    "난임",
    "여의사산부인과",
  ],
  영상의학과: [
    "영상의학과",
    "MRI",
    "CT",
    "유방초음파",
    "갑상선초음파",
    "건강검진영상",
    "영상의학과전문의",
  ],
  재활의학과: [
    "재활의학과",
    "도수치료",
    "물리치료",
    "재활치료",
    "척추재활",
    "뇌졸중재활",
    "스포츠재활",
    "통증재활",
  ],
  요양병원: [
    "요양병원",
    "요양병원입원",
    "장기요양",
    "요양병원추천",
    "재활병원",
    "요양병원비용",
    "노인요양",
  ],
  여성의학과: [
    "여성의학과",
    "여성검진",
    "질염",
    "생리불순",
    "갱년기",
    "불임",
    "난임",
    "여성호르몬",
    "방광염",
    "여성비뇨의학과",
  ],
  항문외과: [
    "항문외과",
    "치질",
    "치핵",
    "지방종",
    "피지낭종",
    "항문질환",
    "항문통증",
  ],
  비뇨의학과: [
    "비뇨기과",
    "비뇨의학과",
    "전립선",
    "전립선비대증",
    "요로결석",
    "방광염",
    "조루",
    "갱년기",
  ],
  신경외과: [
    "신경외과",
    "허리디스크",
    "목디스크",
    "다리저림",
    "디스크치료",
    "정형외과",
    "신경차단술",
    "신경성형술",
    "대상포진",
  ],
  신경과: [
    "신경과",
    "두통",
    "치매",
    "파킨슨",
    "뇌졸중",
    "손발저림",
    "어지럼증",
    "경련",
    "대상포진",
  ],
  가정의학과: [
    "가정의학과",
    "다이어트",
    "만성통증",
    "고혈압",
    "당뇨",
    "예방접종",
    "갱년기",
  ],
  정신건강의학과: [
    "정신건강의학과",
    "우울증",
    "불면증",
    "공황장애",
    "불안장애",
    "ADHD",
    "심리상담",
    "정신과",
  ],
  여성비뇨의학과: [
    "여성비뇨기과",
    "여성비뇨의학과",
    "요실금",
    "방광염",
    "골반저근",
    "배뇨장애",
    "갱년기",
    "여의사비뇨의학과",
  ],
  소아청소년과: [
    "소아과",
    "소아청소년과",
    "소아감기",
    "예방접종",
    "성장클리닉",
    "소아알레르기",
    "소아천식",
    "소아비만",
    "소아청소년과전문의",
  ],
  한의원: [
    "한의원",
    "추나요법",
    "교통사고후유증",
    "침치료",
    "한방다이어트",
    "허리디스크",
    "목디스크",
    "디스크치료",
    "교통사고한의원",
    "산후조리한의원",
    "한의원야간진료",
    "한약",
  ],
  한방병원: [
    "한방병원",
    "한방병원입원",
    "입원치료",
    "한방재활",
    "허리디스크",
    "목디스크",
    "디스크치료",
    "교통사고입원",
    "교통사고후유증",
    "추나요법",
    "도수치료",
    "통증치료",
    "한방병원추천",
  ],
  화상외과: [
    "화상외과",
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
};

/** 진료과별 함께 노출할 추가 주제 (예: 한방병원 → 한의원) */
const SPECIALTY_TOPIC_COMPANIONS: Record<string, string[]> = {
  한방병원: ["한의원"],
};

function companionTopicsForSpecialty(specialty: string): string[] {
  const normalized = resolveCanonicalSpecialty(specialty);
  if (SPECIALTY_TOPIC_COMPANIONS[normalized]) {
    return SPECIALTY_TOPIC_COMPANIONS[normalized];
  }
  for (const [key, companions] of Object.entries(SPECIALTY_TOPIC_COMPANIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) return companions;
  }
  return [];
}

/** 주제 목록에 동반 키워드를 삽입 (한방병원 바로 다음에 한의원 등) */
export function withCompanionTopics(specialty: string, topics: string[]): string[] {
  const companions = companionTopicsForSpecialty(specialty);
  if (!companions.length) return topics;

  const result = [...topics];
  const anchor = specialty.trim();
  const anchorIdx = result.findIndex(
    (t) => t === anchor || t.includes("한방병원")
  );
  let insertAt = anchorIdx >= 0 ? anchorIdx + 1 : 0;

  for (const companion of companions) {
    if (result.includes(companion)) continue;
    result.splice(insertAt, 0, companion);
    insertAt += 1;
  }
  return result;
}

export function topicsForSpecialty(specialty: string): string[] {
  const normalized = resolveCanonicalSpecialty(specialty);
  if (SPECIALTY_TOPICS[normalized]) return SPECIALTY_TOPICS[normalized];
  for (const [key, topics] of Object.entries(SPECIALTY_TOPICS)) {
    if (normalized.includes(key) || key.includes(normalized)) return topics;
  }
  return [
    normalized,
    `${normalized}전문의`,
    `${normalized}추천`,
    `${normalized}잘하는곳`,
    `${normalized}야간진료`,
  ];
}
