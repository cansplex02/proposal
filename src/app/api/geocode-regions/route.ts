import { NextRequest, NextResponse } from "next/server";
import {
  extractRegionHintsFromInput,
  resolveRegionsForLocation,
} from "@/lib/analysis/resolveRegions";

async function fetchNearbyStations(lat: number, lng: number): Promise<string[]> {
  // OpenStreetMap Overpass: 좌표 주변 지하철역 후보 수집
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
    "https://overpass.nchc.org.tw/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Accept: "application/json",
          // Overpass는 User-Agent/연락처 없으면 차단하는 경우가 있어요.
          "User-Agent": "cansplex-proposal/1.0 (contact: cansplex02@gmail.com)",
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
        // 영문명(예: Gangnam Station)도 들어올 수 있어 '역'을 무조건 붙이진 않음
        if (/[가-힣]+역$/.test(clean)) names.add(clean);
        else if (/역$/.test(clean)) names.add(clean);
        else if (/Station$/i.test(clean)) names.add(clean);
        else names.add(`${clean}역`);
        if (names.size >= 6) break;
      }

      // 결과가 있으면 즉시 반환
      if (names.size > 0) return [...names].slice(0, 6);
    } catch {
      // 다음 endpoint로
    }
  }

  return [];
}

async function fetchNearbyDongs(lat: number, lng: number): Promise<string[]> {
  // 1) 네이버 Reverse Geocoding을 "주변 표본점"으로 여러 번 찍어서 행정동 후보를 수집
  const naver = await fetchNearbyDongsByNaverSampling(lat, lng);
  if (naver.length > 0) return naver;

  // 2) (fallback) OpenStreetMap Overpass: 좌표 주변 "동" 후보 수집 (데이터 품질은 지역별 편차 있음)
  const radiusMeters = 1500;
  const query = `
[out:json][timeout:25];
(
  nwr(around:${radiusMeters},${lat},${lng})["place"~"neighbourhood|suburb|quarter|village"]["name"];
  nwr(around:${radiusMeters},${lat},${lng})["boundary"="administrative"]["admin_level"="10"]["name"];
);
out tags 60;
`.trim();

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Accept: "application/json",
          "User-Agent": "cansplex-proposal/1.0 (contact: cansplex02@gmail.com)",
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
        const raw = el.tags?.name?.trim();
        if (!raw) continue;
        const clean = raw.replace(/\(.+?\)/g, "").trim();
        if (!clean) continue;

        // "동"만 추려서 통일
        if (/[가-힣0-9]+동$/.test(clean)) {
          names.add(clean.replace(/[0-9]/g, ""));
        } else if (/[가-힣]+(읍|면|리)$/.test(clean)) {
          // 읍/면/리는 그대로 포함 (선택)
          names.add(clean);
        }
        if (names.size >= 6) break;
      }

      if (names.size > 0) return [...names].slice(0, 6);
    } catch {
      // next endpoint
    }
  }

  return [];
}

function isNaverReverseConfigured(): boolean {
  return Boolean(process.env.NAVER_MAP_CLIENT_ID && process.env.NAVER_MAP_CLIENT_SECRET);
}

async function fetchNearbyDongsByNaverSampling(lat: number, lng: number): Promise<string[]> {
  if (!isNaverReverseConfigured()) return [];

  // 표본점: 중심 + 반경 0.7R / R 에서 8방향
  const R = 1500;
  const radii = [0, Math.round(R * 0.7), R];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => (d * Math.PI) / 180);

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

function moveMeters(lat: number, lng: number, meters: number, rad: number): { lat: number; lng: number } {
  // 간단 평면 근사 (짧은 거리에서 충분)
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLng = (meters * Math.sin(rad)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

async function reverseGeocodeDong(lat: number, lng: number): Promise<string | null> {
  const clientId = process.env.NAVER_MAP_CLIENT_ID!;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET!;

  const url = new URL("https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc");
  // 네이버는 coords=경도,위도 순서
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
    results?: {
      region?: {
        area3?: { name?: string };
        area4?: { name?: string };
      };
    }[];
  };

  const r0 = data.results?.[0]?.region;
  const dong = (r0?.area3?.name || r0?.area4?.name || "").trim();
  if (!dong) return null;
  // '역삼동' 같은 형태만 우선
  if (/[가-힣0-9]+동$/.test(dong)) return dong.replace(/[0-9]/g, "");
  return dong;
}

export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get("location")?.trim();
  if (!location) {
    return NextResponse.json({ error: "location 파라미터가 없습니다." }, { status: 400 });
  }

  const inputHints = extractRegionHintsFromInput(location);

  try {
    const { regions, roadAddress } = await resolveRegionsForLocation(location);
    return NextResponse.json({
      roadAddress,
      regions,
      provider: "merged",
    });
  } catch {
    if (inputHints.length > 0) {
      return NextResponse.json({
        roadAddress: location,
        lat: null,
        lng: null,
        regions: inputHints,
        provider: "input",
      });
    }
    return NextResponse.json(
      { error: `위치를 찾을 수 없습니다: ${location}` },
      { status: 500 }
    );
  }
}
