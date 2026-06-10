import { DEFAULT_SEARCH_INSIGHT_PROFILE } from "./searchConfig";
import type { SearchInsight, SearchVolumeRow } from "./types";

type InsightCtx = {
  mainSearchKeyword: string;
  clinicName: string;
  specialty: string;
  competitors: SearchVolumeRow[];
  mobileShareHigh?: boolean;
};

/** A·B·E, 제안서용, 대략 수치 */
export function buildDefaultSearchInsights(ctx: InsightCtx): SearchInsight[] {
  const profile = DEFAULT_SEARCH_INSIGHT_PROFILE;
  const rivals = ctx.competitors.filter((c) => !c.isOurs);
  const ours = ctx.competitors.find((c) => c.isOurs);
  const topNames = rivals
    .slice(0, 3)
    .map((c) => c.name)
    .filter(Boolean);

  const cards: SearchInsight[] = [];

  for (const topic of profile.topics) {
    if (topic === "brandGap") {
      const lead =
        topNames.length >= 2
          ? `<strong>${topNames.slice(0, 2).join(", ")}</strong> 등 지도 상위 노출 병원`
          : "지도 검색 상위에 노출되는 병원";
      const oursNote = ours
        ? ` <strong>${ctx.clinicName}</strong>의 브랜드 검색은 상대적으로 낮은 편`
        : ctx.clinicName === "개원 예정"
          ? " 개원 전·브랜드 미정 단계에서는 검색 인지도가 형성되지 않은 편"
          : " 우리 병원의 브랜드 검색 인지도는 상대적으로 낮은 편";
      cards.push({
        title: "브랜드 검색량 격차",
        body: `${lead} 대비${oursNote}으로, <strong>직접 검색 유도</strong>와 브랜드 노출 확대가 필요합니다.`,
      });
    }

    if (topic === "mobile") {
      const mobileHint = ctx.mobileShareHigh
        ? "검색의 상당 부분이 <strong>모바일</strong>에서 발생하는 것으로 보이며"
        : "지역·진료 키워드 검색은 <strong>모바일 비중이 큰 편</strong>이며";
      cards.push({
        title: "모바일 검색·플레이스",
        body: `${mobileHint}, <strong>네이버 플레이스·모바일 예약·진료시간</strong> 정보 정비가 필수적입니다.`,
      });
    }

    if (topic === "positioning") {
      const kw = ctx.mainSearchKeyword;
      const spec = ctx.specialty;
      cards.push({
        title: "검색 키워드와 포지션",
        body:
          ctx.clinicName === "개원 예정"
            ? `검색 수요는 <strong>${kw}</strong> 중심입니다. 개원 전에는 <strong>${spec}</strong>·통증·비수술 등 <strong>차별 포지션·롱테일 키워드</strong>를 미리 설계해 두는 것이 유효합니다.`
            : `검색 수요는 <strong>${kw}</strong> 중심인 반면, <strong>${ctx.clinicName}</strong>의 강점(<strong>${spec}</strong>·통증·비수술 등)을 연결한 <strong>차별 메시지·롱테일 키워드</strong> 설계가 유효합니다.`,
      });
    }
  }

  return cards;
}
