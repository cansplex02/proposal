import { buildCustomFocusTopicList } from "./focusTopicExpansion";
import { buildKeywordMap, buildStrategyCards } from "./keywords";
import { topicsForSpecialty, withCompanionTopics } from "./specialties";
import {
  applyTreatmentModeTopics,
  type TreatmentMode,
} from "./treatmentMode";
import type { AnalysisReport } from "./types";

export function buildKeywordSection(
  specialty: string,
  regions: string[],
  focusTopicsRaw: string[],
  treatmentMode: TreatmentMode = "nonsurgery"
): AnalysisReport["keywords"] {
  const focusSeeds = focusTopicsRaw.map((s) => s.trim()).filter(Boolean);
  const baseTopics = focusSeeds.length
    ? buildCustomFocusTopicList(specialty, focusSeeds)
    : withCompanionTopics(specialty, topicsForSpecialty(specialty));

  const topics = applyTreatmentModeTopics(
    baseTopics,
    specialty,
    treatmentMode
  );

  const { columns, rows } = buildKeywordMap(regions, topics);
  const strategyCards = buildStrategyCards(specialty, regions, topics, {
    focusTopics: focusSeeds.length ? focusSeeds : undefined,
  });

  return {
    subtitle: `${regions.slice(0, 4).join("·")}권 ${specialty} 공략 키워드`,
    columns,
    rows,
    strategyCards,
  };
}
