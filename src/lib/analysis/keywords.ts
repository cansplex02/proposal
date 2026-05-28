import type { KeywordColumn, KeywordRow } from "./types";

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
  topics: string[]
): { label: string; body: string }[] {
  const mainSpecialty = specialty.trim() || "진료과";
  const primary = regions.slice(0, 3).join("·");
  const expert =
    topics
      .filter((t) => t !== mainSpecialty)
      .slice(0, 3)
      .join(" · ") || topics.slice(1, 4).join(" · ") || topics[0] || "";

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
