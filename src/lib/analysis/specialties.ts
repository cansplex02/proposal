/** 진료과별 기본 공략 키워드 주제 (지역명 + 주제 조합) */
export const SPECIALTY_TOPICS: Record<string, string[]> = {
  유방외과: [
    "영상의학과",
    "유방외과",
    "유방외과전문의",
    "유방외과여의사",
    "유방초음파",
    "유방암",
    "맘모톰",
    "갑상선",
    "미세석회화",
  ],
  피부과: [
    "피부과",
    "여드름",
    "기미",
    "레이저토닝",
    "보톡스",
    "필러",
    "제모",
    "아토피",
    "여의사피부과",
  ],
  정형외과: [
    "정형외과",
    "허리디스크",
    "목디스크",
    "무릎관절",
    "어깨통증",
    "도수치료",
    "비수술치료",
    "척추클리닉",
    "스포츠손상",
  ],
  치과: [
    "치과",
    "임플란트",
    "라미네이트",
    "치아교정",
    "사랑니",
    "충치치료",
    "신경치료",
    "잇몸치료",
    "야간진료",
  ],
  내과: [
    "내과",
    "건강검진",
    "위내시경",
    "대장내시경",
    "고혈압",
    "당뇨",
    "비만클리닉",
    "갑상선",
    "만성질환",
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
  산부인과: [
    "산부인과",
    "산전검진",
    "임신",
    "여성검진",
    "자궁근종",
    "질염",
    "불임",
    "피임",
    "여의사산부인과",
  ],
};

export function topicsForSpecialty(specialty: string): string[] {
  const normalized = specialty.trim();
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
    `${normalized}여의사`,
    `${normalized}비용`,
    `${normalized}후기`,
    `${normalized}예약`,
  ];
}
