/** 반경에 맞는 네이버 정적지도 level (대략 1.5km가 화면에 들어오도록) */
export function naverStaticMapLevel(
  radiusMeters: number,
  lat: number,
  imageWidth = 640
): number {
  const targetWidthM = radiusMeters * 2.6;
  for (let level = 20; level >= 5; level -= 1) {
    const scale = Math.pow(2, 20 - level);
    const mpp =
      (156543.03392 * Math.cos((lat * Math.PI) / 180)) / (scale * 256);
    const visibleW = imageWidth * mpp;
    if (visibleW <= targetWidthM * 1.15) return level;
  }
  return 12;
}

/** 지도 위 1.5km 원 SVG 반경(px) — 정적지도 level 기준 */
export function radiusCirclePx(
  radiusMeters: number,
  lat: number,
  level: number,
  imageWidth = 640
): number {
  const scale = Math.pow(2, 20 - level);
  const mpp =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / (scale * 256);
  return Math.min(imageWidth * 0.46, radiusMeters / mpp);
}

export function marketMapImageUrl(
  lat: number,
  lng: number,
  opts?: { w?: number; h?: number; radiusMeters?: number }
): string {
  const w = opts?.w ?? 640;
  const h = opts?.h ?? 360;
  const radius = opts?.radiusMeters ?? 1500;
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    w: String(w),
    h: String(h),
    radius: String(radius),
  });
  return `/api/analysis/map-image?${params}`;
}

export function naverMapSearchUrl(address: string): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(address)}`;
}
