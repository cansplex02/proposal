/** 섹션 03 자동 인사이트 기본 프로필 (A·B·E, 제안서용, 대략 수치) */
export const DEFAULT_SEARCH_INSIGHT_PROFILE = {
  topics: ["brandGap", "mobile", "positioning"] as const,
  tone: "proposal" as const,
  numbers: "approximate" as const,
};

export type SearchInsightTopic = (typeof DEFAULT_SEARCH_INSIGHT_PROFILE.topics)[number];
