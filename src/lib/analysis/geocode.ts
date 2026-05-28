export type GeocodeResult = {
  lat: number;
  lng: number;
  roadAddress: string;
  jibunAddress?: string;
  regionHints: string[];
  provider: "naver" | "kakao";
};

function isNaverConfigured(): boolean {
  return Boolean(
    process.env.NAVER_MAP_CLIENT_ID && process.env.NAVER_MAP_CLIENT_SECRET
  );
}

/** 주소·장소명 → 좌표 (네이버 우선, 없으면 카카오) */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (isNaverConfigured()) {
    return geocodeWithNaver(address);
  }
  if (process.env.KAKAO_REST_API_KEY) {
    return geocodeWithKakao(address);
  }
  throw new Error(
    "지오코딩 API 키가 없습니다. .env.local에 NAVER_MAP_CLIENT_ID·NAVER_MAP_CLIENT_SECRET 또는 KAKAO_REST_API_KEY를 추가하세요."
  );
}

/** 네이버 클라우드 Maps Geocoding */
async function geocodeWithNaver(address: string): Promise<GeocodeResult> {
  const clientId = process.env.NAVER_MAP_CLIENT_ID!;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET!;

  const url = new URL(
    "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"
  );
  url.searchParams.set("query", address);

  const res = await fetch(url.toString(), {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `네이버 지오코딩 실패 (${res.status}): ${text.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as {
    status?: string;
    errorMessage?: string;
    addresses?: {
      roadAddress?: string;
      jibunAddress?: string;
      addressElements?: { types: string[]; longName: string }[];
      x?: string;
      y?: string;
    }[];
  };

  if (data.status && data.status !== "OK") {
    throw new Error(
      data.errorMessage || `네이버 지오코딩 오류: ${data.status}`
    );
  }

  const doc = data.addresses?.[0];
  if (!doc?.x || !doc?.y) {
    throw new Error(`주소를 찾을 수 없습니다: ${address}`);
  }

  const road = doc.roadAddress || doc.jibunAddress || address;
  const jibun = doc.jibunAddress || undefined;
  const elements = doc.addressElements ?? [];

  return {
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    roadAddress: road,
    jibunAddress: jibun,
    regionHints: extractRegionHintsFromElements(elements, address),
    provider: "naver",
  };
}

/** 카카오 로컬 API — 주소 → 좌표 */
async function geocodeWithKakao(address: string): Promise<GeocodeResult> {
  const key = process.env.KAKAO_REST_API_KEY!;

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", address);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) {
    throw new Error(`카카오 지오코딩 실패 (${res.status})`);
  }

  const data = (await res.json()) as {
    documents?: {
      x: string;
      y: string;
      address_name?: string;
      road_address?: { address_name?: string };
    }[];
  };

  const doc = data.documents?.[0];
  if (!doc) {
    throw new Error(`주소를 찾을 수 없습니다: ${address}`);
  }

  const road =
    doc.road_address?.address_name || doc.address_name || address;

  return {
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    roadAddress: road,
    jibunAddress: doc.address_name,
    regionHints: extractRegionHints(road),
    provider: "kakao",
  };
}

/** 네이버 addressElements + 입력어 조합으로 지역 힌트 추출 */
function extractRegionHintsFromElements(
  elements: { types: string[]; longName: string }[],
  originalInput: string
): string[] {
  const hints = new Set<string>();

  // 1) addressElements에서 구조화된 행정구역 추출
  for (const el of elements) {
    const name = el.longName?.trim();
    if (!name) continue;
    if (el.types.includes("SIDO")) hints.add(stripSidoSuffix(normalizeSidoName(name))); // 시·도
    if (el.types.includes("SIGUGUN")) hints.add(name);   // 구 (접미사 유지)
    if (el.types.includes("DONGMYUN")) hints.add(name);  // 동·면
  }

  // 2) 입력어 자체가 역/동/구 이름이면 그대로 추가
  const inputClean = originalInput.trim();
  if (/[가-힣]+역$/.test(inputClean)) hints.add(inputClean);
  if (/[가-힣]+동$/.test(inputClean)) hints.add(inputClean);
  if (/[가-힣]+구$/.test(inputClean)) hints.add(inputClean);
  if (/[가-힣]+시$/.test(inputClean)) hints.add(stripSidoSuffix(inputClean));

  // 3) 입력어에서 역·동·구 패턴 추가 추출 (자유 입력 대응)
  const stationMatch = inputClean.match(/([가-힣]+역)/g);
  stationMatch?.forEach((s) => hints.add(s));

  // 4) "강남" 같은 상권명 (역 이름 포함 여부로 판단)
  if (inputClean.includes("강남") && !inputClean.includes("역")) hints.add("강남");

  return [...hints].filter(Boolean).slice(0, 12);
}

function normalizeSidoName(name: string): string {
  if (name.endsWith("특별시")) return `${name.replace("특별시", "")}시`;
  if (name.endsWith("광역시")) return `${name.replace("광역시", "")}시`;
  if (name.endsWith("자치시")) return `${name.replace("자치시", "")}시`;
  return name;
}

function stripSidoSuffix(name: string): string {
  const n = name.trim();
  // "서울시" -> "서울"
  if (n.endsWith("시") && n.length > 1) return n.slice(0, -1);
  return n;
}

/** 주소 문자열 기반 힌트 (카카오·폴백용) */
export function extractRegionHints(address: string): string[] {
  const hints = new Set<string>();
  const dong = address.match(/([가-힣0-9]+(?:동|읍|면|리))/g);
  dong?.forEach((d) => hints.add(d.replace(/[0-9]/g, "").trim() || d));

  const gu = address.match(/([가-힣]+(?:구|군|시))/g);
  gu?.slice(-2).forEach((g) => {
    const cleaned = g.trim();
    if (cleaned.endsWith("시") && cleaned.length > 1) hints.add(cleaned.slice(0, -1));
    else hints.add(cleaned);
  });

  const station = address.match(/([가-힣]+역)/g);
  station?.forEach((s) => hints.add(s));

  if (address.includes("강남")) hints.add("강남");
  return [...hints].filter(Boolean).slice(0, 12);
}
