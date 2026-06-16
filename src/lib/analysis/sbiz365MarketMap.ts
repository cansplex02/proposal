import type { AnalysisReport, MarketMapSlotData } from "./types";
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

export function sbiz365MarketMapExternalUrl(_ctx: {
  lat: number;
  lng: number;
  radiusMeters: number;
}): string | null {
  const certKey = getSbiz365ApiKey("marketMap");
  if (!certKey) return null;
  return `${BASE}/#/openApi/startupPublic?certKey=${encodeURIComponent(certKey)}`;
}

/** 분석 리포트 → 상권지도 슬롯 데이터 */
export function buildMarketMapSlotData(
  report: AnalysisReport
): MarketMapSlotData {
  const { lat, lng } = report.coordinates;
  const radiusMeters = Math.round(report.radiusKm * 1000);
  const embedUrl =
    buildSbiz365MarketMapEmbedUrl({ lat, lng, radiusMeters }) ?? undefined;
  const externalUrl =
    sbiz365MarketMapExternalUrl({ lat, lng, radiusMeters }) ??
    "https://bigdata.sbiz.or.kr/";

  return {
    lat,
    lng,
    address: report.address,
    radiusKm: report.radiusKm,
    mapNote: report.market.mapNote,
    embedUrl,
    externalUrl,
  };
}
