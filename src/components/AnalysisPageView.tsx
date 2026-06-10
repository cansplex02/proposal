"use client";

import { useCallback, useState } from "react";
import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import AnalysisSearchPanel from "@/components/AnalysisSearchPanel";
import AnalysisSearchResults, {
  type SearchSectionData,
} from "@/components/AnalysisSearchResults";
import KeywordGeneratorPanel from "@/components/KeywordGeneratorPanel";
import type { SearchGeneratedPayload } from "@/lib/analysis/types";

type Props = {
  beforeSearch: string;
  searchIntro: string;
  searchBody: string;
  keywordsIntro: string;
  htmlAfter: string;
  initialSearchData?: SearchSectionData;
  searchDefaults?: {
    specialty?: string;
    clinicName?: string;
    address?: string;
  };
  keywordDefaults?: {
    specialty?: string;
    location?: string;
    regions?: string;
  };
  showReportAdminSecret?: boolean;
  showInitialSearchResults?: boolean;
};

export default function AnalysisPageView({
  beforeSearch,
  searchIntro,
  searchBody: initialSearchBody,
  keywordsIntro,
  htmlAfter,
  initialSearchData,
  searchDefaults,
  keywordDefaults,
  showReportAdminSecret = false,
  showInitialSearchResults = false,
}: Props) {
  const [searchData, setSearchData] = useState<SearchSectionData | null>(
    showInitialSearchResults && initialSearchData ? initialSearchData : null
  );
  const [liveSearchBody, setLiveSearchBody] = useState(
    showInitialSearchResults && !initialSearchData ? initialSearchBody : ""
  );
  const [mapQuery, setMapQuery] = useState<string | null>(
    initialSearchData?.meta?.mapQuery ?? null
  );
  const [hasGenerated, setHasGenerated] = useState(showInitialSearchResults);

  const onSearchGenerated = useCallback((payload: SearchGeneratedPayload) => {
    const resolved =
      payload.search ??
      (payload.competitors?.length
        ? {
            competitors: payload.competitors,
            insights: payload.insights ?? [],
            channelMatrix: payload.channelMatrix,
            meta: { mapQuery: payload.searchKeyword ?? undefined },
          }
        : null);

    if (resolved?.competitors?.length) {
      setSearchData(resolved);
      setLiveSearchBody("");
      setMapQuery(
        payload.searchKeyword ?? resolved.meta?.mapQuery ?? null
      );
    } else if (payload.searchBody?.trim()) {
      setSearchData(null);
      setLiveSearchBody(payload.searchBody);
      setMapQuery(payload.searchKeyword ?? null);
    } else {
      setSearchData(null);
      setLiveSearchBody("");
      setMapQuery(payload.searchKeyword ?? null);
    }
    setHasGenerated(true);
    requestAnimationFrame(() => {
      document
        .getElementById("analysis-search-results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const showEmpty = !hasGenerated;

  return (
    <div className="analysis-page">
      {beforeSearch ? <LegacyHtmlPage html={beforeSearch} /> : null}
      <section className="section" id="search">
        {searchIntro ? <LegacyHtmlPage html={searchIntro} /> : null}
        <div className="analysis-search-tool-inner">
          <AnalysisSearchPanel
            showAdminSecret={showReportAdminSecret}
            initialSpecialty={searchDefaults?.specialty}
            initialClinicName={searchDefaults?.clinicName}
            initialAddress={searchDefaults?.address}
            onSearchGenerated={onSearchGenerated}
          />
        </div>
        <div
          id="analysis-search-results"
          className={
            hasGenerated
              ? "analysis-search-results analysis-search-results--live"
              : "analysis-search-results"
          }
        >
          {searchData ? (
            <AnalysisSearchResults data={searchData} mapQuery={mapQuery} />
          ) : liveSearchBody ? (
            <LegacyHtmlPage html={liveSearchBody} />
          ) : showEmpty ? (
            <p className="analysis-search-empty">
              진료과·병원명을 입력하고「경쟁분석 생성」을 누르면 브랜드 검색량과 채널
              비교가 여기에 표시됩니다.
            </p>
          ) : (
            <p className="analysis-search-warn">
              결과를 불러오지 못했습니다. 상태 메시지의 오류·경고를 확인하세요.
            </p>
          )}
        </div>
      </section>
      <section className="section alt" id="keywords">
        {keywordsIntro ? (
          <LegacyHtmlPage html={keywordsIntro} />
        ) : null}
        <div className="keyword-tool-inner">
          <KeywordGeneratorPanel
            initialSpecialty={keywordDefaults?.specialty}
            initialLocation={keywordDefaults?.location}
            initialRegions={keywordDefaults?.regions}
          />
        </div>
      </section>
      <LegacyHtmlPage html={htmlAfter} />
    </div>
  );
}
