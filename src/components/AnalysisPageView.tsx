"use client";

import { useCallback, useMemo, useState } from "react";
import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import AnalysisUnifiedForm from "@/components/AnalysisUnifiedForm";
import AnalysisSearchResults, {
  type SearchSectionData,
} from "@/components/AnalysisSearchResults";
import KeywordResults from "@/components/KeywordResults";
import MarketMapSlot from "@/components/MarketMapSlot";
import {
  patchHeroSub,
  splitNavHeroAndDemographics,
} from "@/lib/analysis/splitAnalysisBody";
import type { TreatmentMode } from "@/lib/analysis/treatmentMode";
import type { AnalysisReport, SearchGeneratedPayload } from "@/lib/analysis/types";

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
  showReportAdminSecret?: boolean;
  showInitialSearchResults?: boolean;
};

type KeywordFormContext = {
  specialty: string;
  focusTopics: string;
  treatmentMode: TreatmentMode;
};

export default function AnalysisPageView({
  beforeSearch,
  searchIntro,
  searchBody: initialSearchBody,
  keywordsIntro,
  htmlAfter,
  initialSearchData,
  searchDefaults,
  showReportAdminSecret = false,
  showInitialSearchResults = false,
}: Props) {
  const { navHero: initialNavHero, demographicsMarket: initialDemographics } =
    useMemo(() => splitNavHeroAndDemographics(beforeSearch), [beforeSearch]);

  const [liveNavHero, setLiveNavHero] = useState(initialNavHero);
  const [liveDemographics, setLiveDemographics] = useState(
    showInitialSearchResults ? initialDemographics : ""
  );
  const [searchData, setSearchData] = useState<SearchSectionData | null>(
    showInitialSearchResults && initialSearchData ? initialSearchData : null
  );
  const [liveSearchBody, setLiveSearchBody] = useState(
    showInitialSearchResults && !initialSearchData ? initialSearchBody : ""
  );
  const [mapQuery, setMapQuery] = useState<string | null>(
    initialSearchData?.meta?.mapQuery ?? null
  );
  const [keywordData, setKeywordData] = useState<
    AnalysisReport["keywords"] | null
  >(null);
  const [keywordRegions, setKeywordRegions] = useState<string[]>([]);
  const [keywordFormCtx, setKeywordFormCtx] = useState<KeywordFormContext | null>(
    null
  );
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [hasGenerated, setHasGenerated] = useState(showInitialSearchResults);
  const [demographicsFlash, setDemographicsFlash] = useState(false);

  const applyDemographicsHtml = useCallback((html: string) => {
    if (!html.trim()) return;
    const { navHero, demographicsMarket } = splitNavHeroAndDemographics(html);
    if (navHero.trim()) setLiveNavHero(navHero);
    if (demographicsMarket.trim()) setLiveDemographics(demographicsMarket);
    setDemographicsFlash(true);
    window.setTimeout(() => setDemographicsFlash(false), 2400);
  }, []);

  const onGenerated = useCallback((payload: SearchGeneratedPayload) => {
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

    if (payload.beforeSearchHtml?.trim()) {
      applyDemographicsHtml(payload.beforeSearchHtml);
      if (payload.resolvedAddress) {
        setResolvedAddress(payload.resolvedAddress);
        setLiveNavHero((prev) =>
          patchHeroSub(prev, payload.resolvedAddress!, 1.5)
        );
      }
    }

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

    if (payload.keywords) {
      setKeywordData(payload.keywords);
      setKeywordRegions(payload.keywordRegions ?? []);
    }
    if (payload.formContext) {
      setKeywordFormCtx(payload.formContext);
    }

    setHasGenerated(true);

    requestAnimationFrame(() => {
      document
        .getElementById("analysis-demographics")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [applyDemographicsHtml]);

  return (
    <div className="analysis-page">
      {liveNavHero ? <LegacyHtmlPage html={liveNavHero} /> : null}

      <AnalysisUnifiedForm
        showAdminSecret={showReportAdminSecret}
        initialSpecialty={searchDefaults?.specialty}
        initialClinicName={searchDefaults?.clinicName}
        initialAddress={searchDefaults?.address}
        onGenerated={onGenerated}
      />

      {hasGenerated ? (
        <>
          <div
            id="analysis-demographics"
            className={
              demographicsFlash
                ? "analysis-demographics-live analysis-demographics-live--flash"
                : "analysis-demographics-live"
            }
          >
            {liveDemographics ? (
              <LegacyHtmlPage html={liveDemographics} />
            ) : null}
            <MarketMapSlot refreshKey={liveDemographics} />
          </div>

          <section className="section" id="search">
            {searchIntro ? <LegacyHtmlPage html={searchIntro} /> : null}
            <div
              id="analysis-search-results"
              className="analysis-search-results analysis-search-results--live"
            >
              {searchData ? (
                <AnalysisSearchResults data={searchData} mapQuery={mapQuery} />
              ) : liveSearchBody ? (
                <LegacyHtmlPage html={liveSearchBody} />
              ) : (
                <p className="analysis-search-warn">
                  검색량·채널 결과를 불러오지 못했습니다. 상태 메시지의
                  오류·경고를 확인하세요.
                </p>
              )}
            </div>
          </section>

          <section className="section alt" id="keywords">
            {keywordsIntro ? <LegacyHtmlPage html={keywordsIntro} /> : null}
            <div className="keyword-tool-inner">
              {keywordData && keywordFormCtx ? (
                <KeywordResults
                  initialKeywords={keywordData}
                  initialRegions={keywordRegions}
                  specialty={keywordFormCtx.specialty}
                  focusTopics={keywordFormCtx.focusTopics}
                  treatmentMode={keywordFormCtx.treatmentMode}
                  resolvedAddress={resolvedAddress}
                />
              ) : (
                <p className="analysis-search-warn">
                  키워드 결과를 불러오지 못했습니다.
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}

      <LegacyHtmlPage html={htmlAfter} />
    </div>
  );
}
