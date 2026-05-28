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
