export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

/** 큰 수를 만/억 단위로 압축 (예: 162438 → "16.2만") */
export function compactKoNumber(n: number): string {
  const v = Math.round(n);
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1).replace(/\.0$/, "")}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(1).replace(/\.0$/, "")}만`;
  return formatNumber(v);
}

type MiniCardData = {
  title: string;
  sub: string;
  value?: string;
  accent?: "blue" | "green" | "violet";
  icon?: "medical" | "store" | "people";
  trend?: { text: string; dir: "up" | "down" | "flat" };
};

/** 주거/직장 인구 구성으로 수요 유형(주거형·직장형·혼합형) 미니카드 생성 */
export function demandMixCard(
  residentialTotal: number,
  workplaceTotal: number
): MiniCardData {
  const hasPop = residentialTotal > 0 && workplaceTotal > 0;
  if (!hasPop) {
    return {
      title: "주거+직장 혼합 수요",
      sub: "인구·유동 데이터 확인 권장",
      accent: "violet",
      icon: "people",
    };
  }
  let label = "혼합형";
  if (workplaceTotal > residentialTotal * 1.3) label = "직장 중심형";
  else if (residentialTotal > workplaceTotal * 1.3) label = "주거 중심형";
  return {
    title: "주거+직장 수요 유형",
    value: label,
    sub: `주거 ${compactKoNumber(residentialTotal)} · 직장 ${compactKoNumber(workplaceTotal)}`,
    accent: "violet",
    icon: "people",
  };
}

/** 검색량 막대 너비(%) — 최댓값 대비 실제 비율 */
export function searchVolumeBarWidth(volume: number, maxVolume: number): number {
  if (maxVolume <= 0 || volume <= 0) return 0;
  const pct = (volume / maxVolume) * 100;
  return pct < 1 ? Math.round(pct * 100) / 100 : Math.round(pct * 10) / 10;
}

export function pct(part: number, total: number): string {
  if (!total) return "0";
  return (Math.round((part / total) * 1000) / 10).toFixed(1);
}

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  patch?: Partial<T>
): T {
  if (!patch) return base;
  const out = { ...base } as T;
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const pv = patch[key];
    const bv = base[key];
    if (
      pv &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[key] = deepMerge(
        bv as Record<string, unknown>,
        pv as Record<string, unknown>
      ) as T[keyof T];
    } else if (pv !== undefined) {
      out[key] = pv as T[keyof T];
    }
  }
  return out;
}

export function peakAgeInsight(row: { ages: { under10: number; teens: number; twentiesThirties: number; fortiesFifties: number; sixtiesPlus: number }; total: number; female: number; male: number }, label: string): string {
  const bands = [
    ["60대 이상", row.ages.sixtiesPlus],
    ["40~50대", row.ages.fortiesFifties],
    ["20~30대", row.ages.twentiesThirties],
    ["10대", row.ages.teens],
    ["10대 미만", row.ages.under10],
  ] as const;
  const peak = bands.reduce((a, b) => (b[1] > a[1] ? b : a));
  const femalePct = row.total ? (row.female / row.total) * 100 : 0;
  return `${label} 총 ${formatNumber(row.total)}명 · ${peak[0]} ${pct(peak[1], row.total)}% · 여성 ${femalePct.toFixed(1)}%`;
}
