import type { KeywordColumn, KeywordRow } from "./types";
import { SPECIALTY_TOPICS } from "./specialties";

/** 지역·진료 공략키워드 섹션 하단 안내 */
export const KEYWORD_PROPOSAL_NOTICE =
  "해당 키워드는 제안 단계에 선정된 1차 키워드로, 실제 작업 키워드와 차이가 있을 수 있습니다.";

const DEPARTMENT_TOPIC_NAMES = new Set(Object.keys(SPECIALTY_TOPICS));

function isProcedureKeyword(topic: string, mainSpecialty: string): boolean {
  const t = topic.trim();
  if (!t || t === mainSpecialty) return false;
  if (DEPARTMENT_TOPIC_NAMES.has(t)) return false;
  return true;
}

export function buildKeywordMap(
  regions: string[],
  topics: string[]
): { columns: KeywordColumn[]; rows: KeywordRow[] } {
  const columns: KeywordColumn[] = [
    { id: "region", label: "지역" },
    ...topics.map((t) => ({ id: slugify(t), label: t })),
  ];

  const rows: KeywordRow[] = regions.map((region) => {
    const regionKey = normalizeRegion(region);
    const keywords: Record<string, string> = { region };
    for (const topic of topics) {
      const id = slugify(topic);
      keywords[id] = `${regionKey}${topic}`;
    }
    return { region, keywords };
  });

  return { columns, rows };
}

export function buildStrategyCards(
  specialty: string,
  regions: string[],
  topics: string[],
  options?: { focusTopics?: string[] }
): { label: string; body: string }[] {
  const mainSpecialty = specialty.trim() || "진료과";
  const primary = regions.slice(0, 3).join("·");

  const focusSeeds = (options?.focusTopics ?? [])
    .map((t) => t.trim())
    .filter(Boolean);

  const expert = focusSeeds.length
    ? focusSeeds.join(" · ")
    : topics
        .filter((t) => isProcedureKeyword(t, mainSpecialty))
        .slice(0, 3)
        .join(" · ") ||
      topics
        .filter((t) => t !== mainSpecialty)
        .slice(0, 3)
        .join(" · ") ||
      topics[0] ||
      "";

  return [
    {
      label: "핵심 1차 키워드",
      body: `<strong>${primary}</strong> + ${mainSpecialty}`,
    },
    {
      label: "전문성 키워드",
      body: `<strong>${expert}</strong>`,
    },
    {
      label: "브랜드 확장",
      body: `<strong>${mainSpecialty} + 정밀 상담·예약</strong>`,
    },
  ];
}

function normalizeRegion(region: string): string {
  return region
    .replace(/\s/g, "")
    .replace(/특별시|광역시|특별자치시|특별자치도/g, "")
    .trim();
}

function slugify(text: string): string {
  return text
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9가-힣-]/g, "")
    .toLowerCase();
}
