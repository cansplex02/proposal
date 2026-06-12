import { geocodeAddress, type GeocodeResult } from "./geocode";

export function extractRegionHintsFromInput(input: string): string[] {
  const hints = new Set<string>();
  const station = input.match(/([가-힣]+역)/g);
  station?.forEach((s) => hints.add(s));
  const dong = input.match(/([가-힣]+동)/g);
  dong?.forEach((d) => hints.add(d));
  const gu = input.match(/([가-힣]+구)/g);
  gu?.forEach((g) => hints.add(g));
  const si = input.match(/([가-힣]+시)/g);
  si?.forEach((s) => hints.add(s.slice(0, -1)));
  const areas = input.match(/^([가-힣]{2,4})$/);
  if (areas) hints.add(areas[1]);
  return [...hints];
}

async function fetchNearbyStations(lat: number, lng: number): Promise<string[]> {
  const radiusMeters = 1500;
  const query = `
[out:json][timeout:25];
(
  nwr(around:${radiusMeters},${lat},${lng})["station"="subway"]["name"];
  nwr(around:${radiusMeters},${lat},${lng})["railway"="station"]["name"];
);
out tags center 30;
`.trim();

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Accept: "application/json",
          "User-Agent": "cansplex-proposal/1.0",
        },
        body: query,
        cache: "no-store",
      });
      if (!res.ok) continue;

      const data = (await res.json()) as {
        elements?: { tags?: { name?: string } }[];
      };

      const names = new Set<string>();
      for (const el of data.elements ?? []) {
        const name = el.tags?.name?.trim();
        if (!name) continue;
        const clean = name.replace(/\(.+?\)/g, "").trim();
        if (!clean) continue;
        if (/[가-힣]+역$/.test(clean)) names.add(clean);
        else if (/역$/.test(clean)) names.add(clean);
        else names.add(`${clean}역`);
        if (names.size >= 6) break;
      }
      if (names.size > 0) return [...names].slice(0, 6);
    } catch {
      /* next */
    }
  }
  return [];
}

function moveMeters(
  lat: number,
  lng: number,
  meters: number,
  rad: number
): { lat: number; lng: number } {
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLng =
    (meters * Math.sin(rad)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

async function reverseGeocodeDong(lat: number, lng: number): Promise<string | null> {
  const clientId = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const url = new URL("https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc");
  url.searchParams.set("coords", `${lng},${lat}`);
  url.searchParams.set("orders", "admcode");
  url.searchParams.set("output", "json");

  const res = await fetch(url.toString(), {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    results?: { region?: { area3?: { name?: string }; area4?: { name?: string } } }[];
  };
  const r0 = data.results?.[0]?.region;
  const dong = (r0?.area3?.name || r0?.area4?.name || "").trim();
  if (!dong) return null;
  if (/[가-힣0-9]+동$/.test(dong)) return dong.replace(/[0-9]/g, "");
  return dong;
}

async function fetchNearbyDongsByNaver(lat: number, lng: number): Promise<string[]> {
  const R = 1500;
  const radii = [0, Math.round(R * 0.7), R];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315].map(
    (d) => (d * Math.PI) / 180
  );
  const names = new Set<string>();

  for (const r of radii) {
    if (r === 0) {
      const dong = await reverseGeocodeDong(lat, lng);
      if (dong) names.add(dong);
      continue;
    }
    for (const a of angles) {
      const { lat: lat2, lng: lng2 } = moveMeters(lat, lng, r, a);
      const dong = await reverseGeocodeDong(lat2, lng2);
      if (dong) names.add(dong);
      if (names.size >= 8) break;
    }
    if (names.size >= 8) break;
  }
  return [...names].slice(0, 8);
}

/** 주소·좌표 기준 키워드 지역 열 후보 */
export async function resolveRegionsForLocation(
  location: string,
  geo?: GeocodeResult
): Promise<{ regions: string[]; roadAddress: string }> {
  const inputHints = extractRegionHintsFromInput(location);

  try {
    const resolved = geo ?? (await geocodeAddress(location));
    const stationHints = await fetchNearbyStations(resolved.lat, resolved.lng);
    const dongHints = await fetchNearbyDongsByNaver(resolved.lat, resolved.lng);
    const merged = [
      ...new Set([
        ...inputHints,
        ...resolved.regionHints,
        ...dongHints,
        ...stationHints,
      ]),
    ].slice(0, 12);

    return { regions: merged, roadAddress: resolved.roadAddress };
  } catch {
    if (inputHints.length > 0) {
      return { regions: inputHints, roadAddress: location };
    }
    throw new Error(`위치를 찾을 수 없습니다: ${location}`);
  }
}
