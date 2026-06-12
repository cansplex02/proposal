/** 서버 전용 — renderHtml·API에서만 import (클라이언트 컴포넌트에서 사용 금지) */
import { getSbiz365ApiKey } from "./sbiz365Config";

const BASE = "https://bigdata.sbiz.or.kr";

export function buildSbiz365MarketMapEmbedUrl(ctx: {
  lat: number;
  lng: number;
  radiusMeters: number;
}): string | null {
  const certKey = getSbiz365ApiKey("marketMap");
  if (!certKey) return null;

  const url = new URL(`${BASE}/gis/openApi/startupPublic`);
  url.searchParams.set("certKey", certKey);
  url.searchParams.set("lat", String(ctx.lat));
  url.searchParams.set("lng", String(ctx.lng));
  url.searchParams.set("radius", String(ctx.radiusMeters));
  return url.toString();
}

export function sbiz365MarketMapExternalUrl(ctx: {
  lat: number;
  lng: number;
  radiusMeters: number;
}): string | null {
  const certKey = getSbiz365ApiKey("marketMap");
  if (!certKey) return null;
  return `${BASE}/#/openApi/startupPublic?certKey=${encodeURIComponent(certKey)}`;
}
