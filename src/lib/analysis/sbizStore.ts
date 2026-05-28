import type { FacilityCount } from "./types";

const BASE = "https://apis.data.go.kr/B553077/api/open/sdsc2";

type StoreItem = {
  bizesNm?: string;
  indsLclsNm?: string;
  indsMclsNm?: string;
  indsSclsNm?: string;
  lat?: string;
  lon?: string;
};

/** 공공데이터포털 상가(상권)정보 — 반경 내 업소 (sbiz 계열) */
export async function fetchStoresInRadius(
  lng: number,
  lat: number,
  radiusMeters: number
): Promise<StoreItem[]> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error(
      "DATA_GO_KR_SERVICE_KEY가 없습니다. 공공데이터포털에서 '상가(상권)정보' API 키를 발급하세요."
    );
  }

  const items: StoreItem[] = [];
  let pageNo = 1;
  const numOfRows = 1000;

  while (pageNo <= 20) {
    const url = new URL(`${BASE}/storeListInRadius`);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("cx", String(lng));
    url.searchParams.set("cy", String(lat));
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(numOfRows));
    url.searchParams.set("type", "json");

    const res = await fetch(url.toString());
    if (!res.ok) break;

    const data = (await res.json()) as {
      body?: {
        items?: StoreItem[] | StoreItem;
        totalCount?: number;
        numOfRows?: number;
      };
    };

    const raw = data.body?.items;
    const batch = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (!batch.length) break;
    items.push(...batch);

    const total = Number(data.body?.totalCount ?? 0);
    const size = Number(data.body?.numOfRows ?? numOfRows);
    if (pageNo * size >= total) break;
    pageNo += 1;
  }

  return items;
}

export function aggregateFacilities(stores: StoreItem[]): FacilityCount[] {
  const buckets: Record<string, number> = {
    "의료·복지": 0,
    음식: 0,
    소매: 0,
    교육: 0,
    "생활서비스": 0,
    기타: 0,
  };

  for (const s of stores) {
    const cls = (s.indsLclsNm || s.indsMclsNm || "").trim();
    if (/의료|병원|약국|보건|치과|한의|의원/.test(cls)) buckets["의료·복지"] += 1;
    else if (/음식|카페|커피|식당/.test(cls)) buckets["음식"] += 1;
    else if (/소매|편의|마트|슈퍼/.test(cls)) buckets["소매"] += 1;
    else if (/교육|학원|어린이/.test(cls)) buckets["교육"] += 1;
    else if (/미용|세탁|부동산|금융|서비스/.test(cls)) buckets["생활서비스"] += 1;
    else buckets["기타"] += 1;
  }

  const colors = ["#2b5cd9", "#5b88f0", "#8aaef5", "#b8ccf8", "#d4e2fb", "#e8eef8"];
  return Object.entries(buckets)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], i) => ({
      label,
      count,
      color: colors[i % colors.length],
    }));
}

export function countMedicalStores(stores: StoreItem[]): number {
  return stores.filter((s) =>
    /의료|병원|약국|보건|치과|한의|의원/.test(
      `${s.indsLclsNm || ""} ${s.indsMclsNm || ""} ${s.indsSclsNm || ""}`
    )
  ).length;
}
