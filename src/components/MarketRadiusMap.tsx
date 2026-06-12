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

export default function MarketRadiusMap({
  address,
  radiusKm,
  mapNote,
  embedUrl,
  externalUrl = "https://bigdata.sbiz.or.kr/",
}: Props) {
  return (
    <div className="map-area map-area--live map-area--sbiz365">
      {embedUrl ? (
        <iframe
          title={`${address} 소상공인365 상권지도`}
          className="market-map-iframe market-map-iframe--sbiz365"
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="geolocation"
        />
      ) : (
        <div className="map-area-loading map-area-loading--warn">
          SBIZ365_MARKET_KEY 미설정 — .env.local에 상권지도 인증키를 추가하세요.
        </div>
      )}
      <div className="map-area-footer">
        <div className="map-area-footer-text">
          <div className="map-placeholder-title">{address}</div>
          {mapNote ? (
            <div className="map-placeholder-sub">{mapNote}</div>
          ) : null}
          <div className="map-placeholder-sub">소상공인365 상권지도 · 반경 {radiusKm}km</div>
        </div>
        <a
          className="map-area-link"
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          365에서 크게 보기
        </a>
      </div>
    </div>
  );
}
