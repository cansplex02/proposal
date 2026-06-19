import { sbizFetch } from "./sbizFetch";
import { formatNumber } from "./utils";
import type { FacilityCount } from "./types";

/**
 * 소상공인365 — 업소현황(storSttus) 공식 오픈 API
 *
 * bigdata.sbiz.or.kr 의 `#/openApi/storSttus` 콘솔과 동일한 데이터.
 * 발급 인증키를 쿠키 `XTLOGINID` 로 보내면 별도 capture/세션 없이 바로 조회된다.
 *
 * 제공 데이터: 지역(시도·시군구·행정동) 또는 주요상권 단위의 **업종별 업소수**
 * (직전 반기 bSum, 최근 반기 aSum, 증감률 updownPer).
 */

const BASE = "https://bigdata.sbiz.or.kr";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function getStoreStatusKey(): string {
  return (
    process.env.SBIZ365_STORE_KEY ||
    process.env.SBIZ365_FACILITY_KEY ||
    ""
  ).trim();
}

export function isStoreStatusReady(): boolean {
  return Boolean(getStoreStatusKey());
}

function storeHeaders(): Record<string, string> {
  return {
    "User-Agent": UA,
    Cookie: `XTLOGINID=${getStoreStatusKey()}`,
    Accept: "application/json, text/plain, */*",
    Referer: `${BASE}/`,
  };
}

async function getJson<T>(
  path: string,
  params?: Record<string, string>,
  label?: string
): Promise<T> {
  const url = new URL(BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await sbizFetch(
    url,
    { headers: storeHeaders(), redirect: "follow" },
    label
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `[업소현황${label ? " " + label : ""}] 실패 (${res.status}): ${text.slice(0, 160)}`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `[업소현황${label ? " " + label : ""}] JSON 파싱 실패: ${text.slice(0, 160)}`
    );
  }
}

export type StoreProvince = { megaCd: string; megaNm: string };
export type StoreSigungu = { ctyCd: string; ctyNm: string };
export type StorePrimaryArea = {
  mjrBzznno: string;
  mjrBizonNm: string;
  [k: string]: unknown;
};
export type StoreUpjong1 = {
  upjong1Cd: string;
  upjong1Nm: string;
  upjong1Fnm?: string;
  dispOrd?: number;
};
export type StoreUpjong2 = {
  upjong2Cd: string;
  upjong2Nm: string;
  [k: string]: unknown;
};

/** areaGb: 11=시도, 12=시군구, 13=행정동 */
export type StoreStatusRow = {
  ord: string;
  areaGb: string;
  areaCd: string;
  areaNm: string;
  /** 최근 반기 업소수 */
  aSum: number;
  /** 직전 반기 업소수 */
  bSum: number;
  /** 증감률(%) */
  updownPer: number;
};

export type StoreStatusResult = {
  upsoList: StoreStatusRow[];
  yymm: {
    /** 직전 반기 라벨 (예: "2025년 하반기") */
    yymmPrevAvgText: string;
    /** 최근 반기 접미사 (예: "년 하반기") */
    yymmAvgText?: string;
    yymmPrev?: string;
    yymmPrevText?: string;
  };
  dataSourceList: {
    source: string;
    basicDate: string;
    dbname?: string;
    tbNm?: string;
  }[];
  kind: "area" | "sg";
};

/** 시도 목록 */
export function listStoreProvinces(): Promise<StoreProvince[]> {
  return getJson<StoreProvince[]>(
    "/sbiz/api/com/megaListNoAll.json",
    undefined,
    "시도"
  );
}

/** 시군구 목록 */
export function listStoreSigungu(megaCd: string): Promise<StoreSigungu[]> {
  return getJson<StoreSigungu[]>(
    "/sbiz/api/com/ctyList.json",
    { mtpctdCd: megaCd, thrd: "no" },
    "시군구"
  );
}

/** 주요상권 목록 (시군구 코드 기준) */
export function listStorePrimaryAreas(
  sggCd: string
): Promise<StorePrimaryArea[]> {
  return getJson<StorePrimaryArea[]>(
    "/sbiz/api/com/primaryAreaList.json",
    { sggCd, sprType: "majorSg2021" },
    "주요상권"
  );
}

/** 업종 대분류 */
export function listStoreUpjong1(): Promise<StoreUpjong1[]> {
  return getJson<StoreUpjong1[]>(
    "/sbiz/api/com/upjong1SelList.json",
    undefined,
    "업종 대분류"
  );
}

/** 업종 중분류 */
export function listStoreUpjong2(upjong1Cd: string): Promise<StoreUpjong2[]> {
  return getJson<StoreUpjong2[]>(
    "/sbiz/api/com/upjong2SelList.json",
    { tpbizLclcd: upjong1Cd },
    "업종 중분류"
  );
}

export type StoreStatusQuery = {
  /** 지역코드: kind=area 면 megaCd/ctyCd, kind=sg 면 주요상권번호(mjrBzznno) */
  areaCd: string;
  /** 업종코드: 대분류(2자리)·중분류(3자리+) 또는 전체("") */
  upjongCd?: string;
  /** area=행정구역, sg=주요상권 */
  kind?: "area" | "sg";
};

/** 업소현황 조회 — 지역·업종별 업소수 */
export function fetchStoreStatus(
  query: StoreStatusQuery
): Promise<StoreStatusResult> {
  const upjongCd = (query.upjongCd ?? "").trim();
  const upjongGb = upjongCd.length < 3 ? "1" : "2";
  return getJson<StoreStatusResult>(
    "/sbiz/api/bizonSttus/storSttus/search.json",
    {
      sprTypeNo: "1",
      areaCd: query.areaCd,
      upjongGb,
      upjongCd,
      kind: query.kind ?? "area",
    },
    "조회"
  );
}

/** 보건의료업 대분류 코드 (의원·병원 등) */
export const STORE_MEDICAL_UPJONG1 = "Q1";

export type StoreAreaResolution = {
  province: StoreProvince;
  sigungu: StoreSigungu;
};

/**
 * 도로명 주소(예: "서울특별시 중구 …") → 시도·시군구 코드.
 * 시도명으로 매칭 후, 나머지 주소에서 가장 긴 시군구명을 선택.
 * (경기도처럼 시 단위만 제공되는 경우 시 코드로 매칭됨)
 */
export async function resolveStoreArea(
  roadAddress: string
): Promise<StoreAreaResolution | null> {
  const addr = (roadAddress || "").trim();
  if (!addr) return null;

  const provinces = await listStoreProvinces();
  const province =
    provinces.find((p) => addr.startsWith(p.megaNm)) ??
    provinces.find((p) => addr.includes(p.megaNm));
  if (!province) return null;

  const list = await listStoreSigungu(province.megaCd);
  const idx = addr.indexOf(province.megaNm);
  const rest = addr.slice(idx + province.megaNm.length).trim();
  const sigungu = list
    .filter(
      (c) => c.ctyNm && (rest.startsWith(c.ctyNm) || rest.includes(c.ctyNm))
    )
    .sort((a, b) => b.ctyNm.length - a.ctyNm.length)[0];
  if (!sigungu) return null;

  return { province, sigungu };
}

export type AreaIndustryRow = {
  upjong1Cd: string;
  label: string;
  fullName?: string;
  /** 최근 반기 업소수 */
  aSum: number;
  /** 직전 반기 업소수 */
  bSum: number;
  /** 증감률(%) */
  updownPer: number;
};

export type AreaIndustryStatus = {
  province: StoreProvince;
  sigungu: StoreSigungu;
  /** "서울특별시 중구" */
  areaNm: string;
  /** 최근 반기 라벨 (예: "2025년 하반기") */
  currentLabel: string;
  /** 직전 반기 라벨 (예: "2025년 상반기") */
  prevLabel: string;
  /** 기준일자 (예: "2026년 03월") */
  basicDate?: string;
  source?: string;
  /** 업소수 내림차순 정렬 */
  industries: AreaIndustryRow[];
};

function halfYearLabels(yymm: StoreStatusResult["yymm"]): {
  currentLabel: string;
  prevLabel: string;
} {
  const ym = yymm.yymmPrev || "";
  const yr = Number(ym.slice(0, 4));
  const mo = Number(ym.slice(4, 6));
  if (!yr || !mo) {
    return {
      currentLabel: yymm.yymmPrevAvgText || "",
      prevLabel: "",
    };
  }
  const curHalf = mo >= 7 ? "하반기" : "상반기";
  if (curHalf === "하반기") {
    return { currentLabel: `${yr}년 하반기`, prevLabel: `${yr}년 상반기` };
  }
  return { currentLabel: `${yr}년 상반기`, prevLabel: `${yr - 1}년 하반기` };
}

/**
 * 시군구의 업종 대분류별 업소수 (반기 비교).
 * 업종 대분류마다 1회씩 병렬 조회 후, 해당 시군구(areaGb=12) 행을 추출.
 */
export async function fetchAreaIndustryStatus(
  area: StoreAreaResolution
): Promise<AreaIndustryStatus> {
  const ctyCd = String(area.sigungu.ctyCd);
  const upjongList = (await listStoreUpjong1()).filter((u) => u.upjong1Cd);

  let currentLabel = "";
  let prevLabel = "";
  let basicDate: string | undefined;
  let source: string | undefined;

  const industries: AreaIndustryRow[] = [];
  await Promise.all(
    upjongList.map(async (u) => {
      const result = await fetchStoreStatus({
        areaCd: ctyCd,
        upjongCd: u.upjong1Cd,
        kind: "area",
      }).catch(() => null);
      if (!result) return;

      const row =
        result.upsoList.find(
          (x) => x.areaGb === "12" && String(x.areaCd) === ctyCd
        ) ?? result.upsoList.find((x) => x.areaGb === "12");
      if (!row) return;

      if (!currentLabel && result.yymm) {
        const labels = halfYearLabels(result.yymm);
        currentLabel = labels.currentLabel;
        prevLabel = labels.prevLabel;
      }
      if (!basicDate && result.dataSourceList?.[0]) {
        basicDate = result.dataSourceList[0].basicDate;
        source = result.dataSourceList[0].source;
      }

      industries.push({
        upjong1Cd: u.upjong1Cd,
        label: u.upjong1Nm,
        fullName: u.upjong1Fnm,
        aSum: Number(row.aSum) || 0,
        bSum: Number(row.bSum) || 0,
        updownPer: Number(row.updownPer) || 0,
      });
    })
  );

  industries.sort((a, b) => b.aSum - a.aSum);

  return {
    province: area.province,
    sigungu: area.sigungu,
    areaNm: `${area.province.megaNm} ${area.sigungu.ctyNm}`,
    currentLabel,
    prevLabel,
    basicDate,
    source,
    industries,
  };
}

/** 업소현황 업종별 차트 색상 */
const STORE_INDUSTRY_COLORS = [
  "#2b5cd9",
  "#0395ff",
  "#00b3bf",
  "#4ade80",
  "#facc15",
  "#fb923c",
  "#ff5672",
  "#c084fc",
];

export type StoreStatusMarket = {
  /** 업종별 업소수 차트 (deltaPercent = 직전 반기 대비 증감률) */
  facilities: FacilityCount[];
  caption: { title: string; sub: string };
  /** 시군구 보건의료 업소수 (있을 때) */
  medicalCount?: number;
  /** 보건의료 업소 직전 반기 대비 증감률(%) */
  medicalUpdownPer?: number;
  /** 시군구명 (예: "부천시") */
  sigunguName?: string;
  /** 미니카드 제목 (예: "부천시 보건의료 업소") */
  medicalCardTitle?: string;
  /** 요약 불릿 HTML (보건의료 업소수·증감률) */
  medicalBullet?: string;
};

/**
 * 도로명 주소 → 업소현황 기반 상권 차트·지표.
 * 인증키 미설정·지역 미해석·데이터 없음이면 null (호출부는 기존 방식으로 폴백).
 */
export async function buildStoreStatusMarket(
  roadAddress: string
): Promise<StoreStatusMarket | null> {
  if (!isStoreStatusReady()) return null;
  const area = await resolveStoreArea(roadAddress);
  if (!area) return null;
  const status = await fetchAreaIndustryStatus(area);
  if (!status.industries.length) return null;

  const facilities: FacilityCount[] = status.industries
    .slice(0, 8)
    .map((ind, i) => ({
      label: ind.label,
      count: ind.aSum,
      color: STORE_INDUSTRY_COLORS[i % STORE_INDUSTRY_COLORS.length],
      deltaPercent: ind.updownPer,
    }));

  const srcText = status.source ? ` · 출처 ${status.source}` : "";
  const caption = {
    title: `${status.areaNm} 업종별 업소수`,
    sub: `${status.currentLabel} 기준 · 막대 위 수치는 직전 반기(${status.prevLabel}) 대비 증감률${srcText}.`,
  };

  const result: StoreStatusMarket = { facilities, caption };

  const med = status.industries.find(
    (x) => x.upjong1Cd === STORE_MEDICAL_UPJONG1
  );
  if (med) {
    const arrow = med.updownPer > 0 ? "▲" : med.updownPer < 0 ? "▼" : "−";
    result.medicalCount = med.aSum;
    result.medicalUpdownPer = med.updownPer;
    result.sigunguName = status.sigungu.ctyNm;
    result.medicalCardTitle = `${status.sigungu.ctyNm} 보건의료 업소`;
    result.medicalBullet = `<strong>${status.areaNm} 보건의료 업소:</strong> ${formatNumber(med.aSum)}개 · 직전 반기 대비 ${arrow} ${Math.abs(med.updownPer)}%`;
  }

  return result;
}
