/** 경쟁분석 리포트 JSON 스키마 (제안서별 1파일) */

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
  volume: number;
  isOurs?: boolean;
};

export type AnalysisInput = {
  slug: string;
  clinicName: string;
  address: string;
  specialty: string;
  /** 키워드 지역 열 (예: 강남, 서초동, 양재역) */
  regions?: string[];
  /** 키워드 주제 열 (예: 유방외과, 유방초음파) — 미입력 시 진료과 템플릿 사용 */
  keywordTopics?: string[];
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
    summaryBullets: string[];
    miniCards: { title: string; sub: string }[];
    mapNote?: string;
  };
  search?: {
    competitors: SearchVolumeRow[];
    insights: string[];
    channelMatrix?: {
      hospital: string;
      isOurs?: boolean;
      homepage: string;
      blog: string;
      cafe: string;
      news: string;
      kin: string;
      ads: string;
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
};
