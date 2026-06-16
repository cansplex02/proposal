import { NextResponse } from "next/server";
import { naverStaticMapLevel } from "@/lib/analysis/marketMap";

export const runtime = "nodejs";

function isNaverMapConfigured(): boolean {
  return Boolean(
    process.env.NAVER_MAP_CLIENT_ID && process.env.NAVER_MAP_CLIENT_SECRET
  );
}

async function fetchNaverStaticMap(
  lat: number,
  lng: number,
  w: number,
  h: number,
  radiusMeters: number
): Promise<Response | null> {
  const clientId = process.env.NAVER_MAP_CLIENT_ID!;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET!;
  const level = naverStaticMapLevel(radiusMeters, lat, w);

  const url = new URL("https://maps.apigw.ntruss.com/map-static/v2/raster");
  url.searchParams.set("w", String(w));
  url.searchParams.set("h", String(h));
  url.searchParams.set("center", `${lng},${lat}`);
  url.searchParams.set("level", String(level));
  url.searchParams.set(
    "markers",
    `type:d|size:mid|pos:${lng} ${lat}|color:0x2b5cd9`
  );

  const res = await fetch(url.toString(), {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
      Accept: "image/png",
    },
  });

  if (!res.ok) return null;

  const bytes = await res.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

function osmZoomForRadius(radiusMeters: number): number {
  if (radiusMeters <= 800) return 15;
  if (radiusMeters <= 1500) return 14;
  return 13;
}

function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

const OSM_FETCH_HEADERS = {
  "User-Agent": "CANSPLEX-proposal/1.0",
  Accept: "image/png,image/jpeg,*/*",
};

/** staticmap.de 장애·차단 시 tile.openstreetmap.org 단일 타일 */
async function fetchOsmTileMap(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<Response> {
  const zoom = osmZoomForRadius(radiusMeters);
  const { x, y } = latLngToTile(lat, lng, zoom);
  const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
  const res = await fetch(url, { headers: OSM_FETCH_HEADERS });
  if (!res.ok) throw new Error(`OSM tile ${res.status}`);

  const bytes = await res.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

async function fetchOsmStaticMap(
  lat: number,
  lng: number,
  w: number,
  h: number,
  radiusMeters: number
): Promise<Response> {
  const zoom = osmZoomForRadius(radiusMeters);

  try {
    const url = new URL("https://staticmap.openstreetmap.de/staticmap.php");
    url.searchParams.set("center", `${lat},${lng}`);
    url.searchParams.set("zoom", String(zoom));
    url.searchParams.set("size", `${w}x${h}`);
    url.searchParams.set("maptype", "mapnik");
    url.searchParams.set("markers", `${lat},${lng},red-pushpin`);

    const res = await fetch(url.toString(), { headers: OSM_FETCH_HEADERS });
    if (res.ok) {
      const bytes = await res.arrayBuffer();
      return new Response(bytes, {
        headers: {
          "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch {
    /* staticmap.de 미응답 → 타일 fallback */
  }

  return fetchOsmTileMap(lat, lng, radiusMeters);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const w = Math.min(1024, Math.max(320, Number(searchParams.get("w") || 640)));
  const h = Math.min(720, Math.max(200, Number(searchParams.get("h") || 360)));
  const radiusMeters = Number(searchParams.get("radius") || 1500);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat·lng 필수" }, { status: 400 });
  }

  try {
    if (isNaverMapConfigured()) {
      const naver = await fetchNaverStaticMap(lat, lng, w, h, radiusMeters);
      if (naver) return naver;
    }

    return await fetchOsmStaticMap(lat, lng, w, h, radiusMeters);
  } catch (e) {
    const message = e instanceof Error ? e.message : "지도 이미지 생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
