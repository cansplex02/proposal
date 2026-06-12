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

async function fetchOsmStaticMap(
  lat: number,
  lng: number,
  w: number,
  h: number,
  radiusMeters: number
): Promise<Response> {
  const dLat = (radiusMeters / 111320) * 1.35;
  const dLng =
    (radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))) * 1.35;
  const zoom = radiusMeters <= 800 ? 15 : radiusMeters <= 1500 ? 14 : 13;

  const url = new URL("https://staticmap.openstreetmap.de/staticmap.php");
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", String(zoom));
  url.searchParams.set("size", `${w}x${h}`);
  url.searchParams.set("maptype", "mapnik");
  url.searchParams.set("markers", `${lat},${lng},red-pushpin`);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
    const embedFallback = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
    return NextResponse.redirect(embedFallback, 302);
  }

  const bytes = await res.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
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
