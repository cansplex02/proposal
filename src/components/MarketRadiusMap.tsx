"use client";

type Props = {
  lat: number;
  lng: number;
  address: string;
  radiusKm: number;
  mapNote?: string;
  embedUrl?: string;
  externalUrl?: string;
};

/** SBIZ365 미연동 시 OSM embed (단일 타일 확대보다 선명) */
function osmEmbedUrl(lat: number, lng: number, radiusKm: number): string {
  const radiusMeters = radiusKm * 1000;
  const dLat = (radiusMeters / 111320) * 1.15;
  const dLng =
    (radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))) * 1.15;
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  const params = new URLSearchParams({
    bbox,
    layer: "mapnik",
    marker: `${lat},${lng}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
}

export default function MarketRadiusMap({
  lat,
  lng,
  address,
  radiusKm,
  mapNote,
  embedUrl,
}: Props) {
  const isSbiz365 = Boolean(embedUrl);

  return (
    <div
      className={
        isSbiz365
          ? "map-area map-area--live map-area--sbiz365"
          : "map-area map-area--live map-area--static"
      }
    >
      {isSbiz365 ? (
        <iframe
          title={`${address} 소상공인365 상권지도`}
          className="market-map-iframe market-map-iframe--sbiz365"
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="geolocation"
        />
      ) : (
        <iframe
          title={`${address} 반경 ${radiusKm}km 지도`}
          className="market-map-iframe market-map-iframe--osm"
          src={osmEmbedUrl(lat, lng, radiusKm)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
      <div className="map-area-footer">
        <div className="map-area-footer-text">
          <div className="map-placeholder-title">{address}</div>
          {isSbiz365 && mapNote ? (
            <div className="map-placeholder-sub">{mapNote}</div>
          ) : null}
          <div className="map-placeholder-sub">
            {isSbiz365
              ? `소상공인365 상권지도 · 반경 ${radiusKm}km`
              : `반경 ${radiusKm}km · OpenStreetMap 미리보기`}
          </div>
        </div>
      </div>
    </div>
  );
}
