/** 경쟁분석 리포트 JSON 스키마 (제안서별 1파일) */

export type MarketMapSlotData = {
  lat: number;
  lng: number;
  address: string;
  radiusKm: number;
  mapNote?: string;
  embedUrl?: string;
  externalUrl?: string;
};

export type AgeBand = {
  under10: number;
  teens: number;
  twentiesThirties: number;
  fortiesFifties: number;
  sixtiesPlus: number;
};

export type PopulationRow = {
  total: number;
  male: number;
  female: number;
  ages: AgeBand;
};

export type FacilityCount = {
  label: string;
  count: number;
  color?: string;
  /** 직전 반기 대비 증감률(%) — 업소현황(storeStatus) 차트용 */
  deltaPercent?: number;
};

export type KeywordColumn = {
  id: string;
  label: string;
};

export type KeywordRow = {
  region: string;
  keywords: Record<string, string>;
};

export type SearchVolumeRow = {
  name: string;
  /** 상호 전체 키워드(의원·병원 포함) PC+모바일 월간 합계 */
  volume: number;
  /** 검색광고 API 미매칭 시 순위용 가짜 값 (구버전·미사용) */
  volumeEstimated?: boolean;
  volumePc?: number;
  volumeMobile?: number;
  /** 접미사 제거 브랜드 키워드 (예: 부평그린마취통증의학과) */
  shortKeyword?: string;
  shortVolume?: number;
  shortVolumePc?: number;
  shortVolumeMobile?: number;
  isOurs?: boolean;
};

export type SearchInsight = {
  title: string;
  body: string;
};

export type AnalysisInput = {
  slug: string;
  /** 미입력 가능 (개원 예정). 이 경우 address 필수 */
  clinicName?: string;
  address: string;
  specialty: string;
  /**
   * 섹션 03 자동화 — 네이버 지도 1페이지 경쟁사·인사이트
   * 미입력 시 regions[0] + specialty 로 추론 (예: 부평 + 정형외과)
   */
  mainSearchKeyword?: string;
  /** 브랜드 검색량 API용 (미입력 시 clinicName) */
  brandSearchKeyword?: string;
  /** false면 지도 '광고' 업체도 포함 (기본: 제외) */
  includeMapAds?: boolean;
  /** 키워드 지역 열 (예: 강남, 서초동, 양재역) */
  regions?: string[];
  /** 키워드 주제 열 (예: 유방외과, 유방초음파) — 미입력 시 진료과 템플릿 사용 */
  keywordTopics?: string[];
  /** 키워드 주제 필터 — 기본 비수술 */
  treatmentMode?: "surgery" | "nonsurgery";
  radiusMeters?: number;
  /** sbiz365/수동 입력으로 덮어쓸 섹션 */
  overrides?: Partial<AnalysisReport>;
};

export type AnalysisReport = {
  slug: string;
  clinicName: string;
  address: string;
  specialty: string;
  radiusKm: number;
  generatedAt: string;
  coordinates: { lat: number; lng: number };
  population: {
    residential: PopulationRow;
    workplace: PopulationRow;
    floating?: PopulationRow;
    insight: string;
  };
  market: {
    facilities: FacilityCount[];
    /** 주요시설 차트 데이터 출처 */
    facilitySource?: "sbiz365" | "kakao" | "store" | "storeStatus" | "none";
    /** 차트 제목·설명 커스텀 (업소현황 등) */
    facilityCaption?: { title: string; sub: string };
    summaryBullets: string[];
    miniCards: {
      title: string;
      sub: string;
      /** 강조용 큰 수치 (예: "1,250개") */
      value?: string;
      /** 카드 액센트 색상 */
      accent?: "blue" | "green" | "violet";
      /** 아이콘 종류 */
      icon?: "medical" | "store" | "people";
      /** 증감 배지 */
      trend?: { text: string; dir: "up" | "down" | "flat" };
    }[];
    mapNote?: string;
  };
  search?: {
    competitors: SearchVolumeRow[];
    insights: SearchInsight[];
    meta?: {
      mapQuery?: string;
      rivalCount?: number;
      radiusFallback?: boolean;
      radiusMetersUsed?: number;
      radiusExpanded?: boolean;
      mapPlaceCount?: number;
      afterCategoryCount?: number;
      afterRadiusCount?: number;
      volumeMatchedCount?: number;
      volumeFetchError?: string;
      searchAdConfigured?: boolean;
      channelAuditNote?: string;
    };
    channelMatrix?: {
      hospital: string;
      isOurs?: boolean;
      homepage: string;
      blog: string;
      cafe: string;
      news: string;
      kin: string;
      sns: string;
      video: string;
    }[];
  };
  keywords: {
    subtitle: string;
    columns: KeywordColumn[];
    rows: KeywordRow[];
    strategyCards: { label: string; body: string }[];
  };
  meta?: {
    dataSources: string[];
    warnings?: string[];
  };
  /** 작업실 draft / 공개 publish */
  publish?: {
    status: "draft" | "published";
    publishedAt?: string;
    /** 제안서 메인 `/p/{slug}` */
    publicPath?: string;
    /** 경쟁분석 `/r/{slug}` */
    analysisPath?: string;
  };
};

/** 경쟁분석 생성 API → 클라이언트 섹션 03 */
export type SearchGeneratedPayload = {
  slug?: string;
  publicPath?: string;
  publishStatus?: "draft" | "published";
  publishedAt?: string;
  search?: NonNullable<AnalysisReport["search"]> | null;
  /** 전체 리포트 JSON — draft 백업 저장·발행 복구용 */
  report?: AnalysisReport;
  draftSaved?: boolean;
  searchBody?: string;
  searchKeyword?: string | null;
  rivalCount?: number;
  warnings?: string[];
  /** API 평탄화 필드 (search 누락 대비) */
  competitors?: NonNullable<AnalysisReport["search"]>["competitors"];
  insights?: NonNullable<AnalysisReport["search"]>["insights"];
  channelMatrix?: NonNullable<AnalysisReport["search"]>["channelMatrix"];
  /** 섹션 01·02 (인구·상권) — 생성 시 갱신 */
  beforeSearchHtml?: string;
  /** 섹션 02 상권지도 (React 슬롯용) */
  marketMap?: MarketMapSlotData;
  /** 인구 갱신 요약 (상태 메시지용) */
  populationSummary?: string;
  resolvedAddress?: string;
  /** 섹션 01·02 원본 (수동 수정용) */
  population?: AnalysisReport["population"];
  market?: AnalysisReport["market"];
  /** 섹션 04 키워드 */
  keywords?: AnalysisReport["keywords"];
  keywordRegions?: string[];
  /** 섹션 04 재계산용 */
  formContext?: {
    specialty: string;
    focusTopics: string;
    treatmentMode: "surgery" | "nonsurgery";
  };
};
