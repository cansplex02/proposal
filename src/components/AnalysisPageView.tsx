"use client";

import { useCallback, useMemo, useState } from "react";
import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import AnalysisUnifiedForm from "@/components/AnalysisUnifiedForm";
import AnalysisSearchResults, {
  type SearchSectionData,
} from "@/components/AnalysisSearchResults";
import AnalysisStudioToolbar from "@/components/AnalysisStudioToolbar";
import SearchSectionEditor from "@/components/SearchSectionEditor";
import ProposalLinkPanel from "@/components/ProposalLinkPanel";
import KeywordResults from "@/components/KeywordResults";
import MarketMapSlot from "@/components/MarketMapSlot";
import {
  patchHeroSub,
  splitNavHeroAndDemographics,
} from "@/lib/analysis/splitAnalysisBody";
import type { TreatmentMode } from "@/lib/analysis/treatmentMode";
import type {
  AnalysisReport,
  MarketMapSlotData,
  SearchGeneratedPayload,
} from "@/lib/analysis/types";

type Props = {
  beforeSearch: string;
  searchIntro: string;
  searchBody: string;
  keywordsIntro: string;
  htmlAfter: string;
  mode?: "studio" | "public";
  initialSearchData?: SearchSectionData | null;
  initialMarketMap?: MarketMapSlotData | null;
  initialKeywords?: AnalysisReport["keywords"] | null;
  initialKeywordRegions?: string[];
  initialKeywordFormCtx?: {
    specialty: string;
    focusTopics: string;
    treatmentMode: TreatmentMode;
  } | null;
  initialResolvedAddress?: string;
  initialSlug?: string | null;
  initialPublishStatus?: "draft" | "published";
  initialPublishedAt?: string;
  searchDefaults?: {
    specialty?: string;
    clinicName?: string;
    address?: string;
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
  mode = "studio",
  initialSearchData = null,
  initialMarketMap = null,
  initialKeywords = null,
  initialKeywordRegions = [],
  initialKeywordFormCtx = null,
  initialResolvedAddress = "",
  initialSlug = null,
  initialPublishStatus = "draft",
  initialPublishedAt,
  searchDefaults,
  showReportAdminSecret = false,
  showInitialSearchResults = false,
}: Props) {
  const isPublic = mode === "public";
  const isStudio = mode === "studio";

  const { navHero: initialNavHero, demographicsMarket: initialDemographics } =
    useMemo(() => splitNavHeroAndDemographics(beforeSearch), [beforeSearch]);

  const [liveNavHero, setLiveNavHero] = useState(initialNavHero);
  const [liveDemographics, setLiveDemographics] = useState(
    showInitialSearchResults || isPublic ? initialDemographics : ""
  );
  const [searchData, setSearchData] = useState<SearchSectionData | null>(
    showInitialSearchResults || isPublic ? initialSearchData : null
  );
  const [liveSearchBody, setLiveSearchBody] = useState(
    showInitialSearchResults && !initialSearchData ? initialSearchBody : ""
  );
  const [mapQuery, setMapQuery] = useState<string | null>(
    initialSearchData?.meta?.mapQuery ?? null
  );
  const [keywordData, setKeywordData] = useState<
    AnalysisReport["keywords"] | null
  >(isPublic || showInitialSearchResults ? initialKeywords : null);
  const [keywordRegions, setKeywordRegions] = useState<string[]>(
    initialKeywordRegions
  );
  const [keywordFormCtx, setKeywordFormCtx] = useState(
    initialKeywordFormCtx ?? null
  );
  const [resolvedAddress, setResolvedAddress] = useState(initialResolvedAddress);
  const [hasGenerated, setHasGenerated] = useState(
    showInitialSearchResults || isPublic
  );
  const [demographicsFlash, setDemographicsFlash] = useState(false);
  const [marketMap, setMarketMap] = useState<MarketMapSlotData | null>(
    initialMarketMap
  );
  const [currentSlug, setCurrentSlug] = useState<string | null>(initialSlug);
  const [draftReport, setDraftReport] = useState<AnalysisReport | null>(null);
  const [publishStatus, setPublishStatus] = useState(initialPublishStatus);
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [adminSecret, setAdminSecret] = useState("");

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

    if (payload.slug) {
      setCurrentSlug(payload.slug);
      setPublishStatus("draft");
      setPublishedAt(undefined);
    }

    if (payload.report) {
      setDraftReport(payload.report);
    }

    if (payload.beforeSearchHtml?.trim()) {
      applyDemographicsHtml(payload.beforeSearchHtml);
      setMarketMap(payload.marketMap ?? null);
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

    if (isStudio) {
      requestAnimationFrame(() => {
        document
          .getElementById("analysis-demographics")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [applyDemographicsHtml, isStudio]);

  return (
    <div className={`analysis-page ${isPublic ? "analysis-page--public" : ""}`}>
      {isStudio ? (
        <AnalysisStudioToolbar
          slug={currentSlug}
          publishStatus={publishStatus}
          publishedAt={publishedAt}
        />
      ) : null}

      {liveNavHero ? <LegacyHtmlPage html={liveNavHero} /> : null}

      {isStudio ? (
        <>
          {showReportAdminSecret ? (
            <div className="studio-admin-secret">
              <label>
                Admin Secret
                <input
                  type="password"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  placeholder="발행·수동저장용"
                />
              </label>
            </div>
          ) : null}
          <AnalysisUnifiedForm
            showAdminSecret={showReportAdminSecret}
            initialSpecialty={searchDefaults?.specialty}
            initialClinicName={searchDefaults?.clinicName}
            initialAddress={searchDefaults?.address}
            onGenerated={onGenerated}
          />
        </>
      ) : null}

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
            <MarketMapSlot
              refreshKey={liveDemographics}
              marketMap={marketMap}
            />
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
                  검색량·채널 결과를 불러오지 못했습니다.
                </p>
              )}
            </div>
            {isStudio && searchData && currentSlug ? (
              <>
                <div className="studio-edit-hint studio-edit-hint--inline">
                  <strong>검색량 및 디지털 채널</strong>만 아래에서 수동 수정할 수
                  있습니다. 저장이 끝나면 맨 아래{" "}
                  <strong>「개별링크 만들기」</strong>로 고객 공유 링크를
                  만드세요.
                </div>
                <div className="studio-section-edit-wrap">
                  <SearchSectionEditor
                    slug={currentSlug}
                    data={searchData}
                    adminSecret={adminSecret}
                    defaultOpen={hasGenerated}
                    onSaved={(next) => setSearchData(next)}
                  />
                </div>
              </>
            ) : null}
            {isStudio && !searchData && liveSearchBody && currentSlug ? (
              <p className="studio-edit-hint studio-edit-hint--inline">
                검색량 데이터가 없습니다. 전체 분석을 다시 생성하거나 slug
                리포트를 확인하세요.
              </p>
            ) : null}
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
                  readOnly={isPublic}
                />
              ) : (
                <p className="analysis-search-warn">
                  키워드 결과를 불러오지 못했습니다.
                </p>
              )}
            </div>
          </section>

          {isStudio && currentSlug ? (
            <div id="proposal-link-panel" className="studio-link-publish-bottom">
              <ProposalLinkPanel
                slug={currentSlug}
                publishStatus={publishStatus}
                publishedAt={publishedAt}
                adminSecret={adminSecret}
                draftReport={draftReport}
                onPublished={() => {
                  setPublishStatus("published");
                  setPublishedAt(new Date().toISOString());
                }}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <LegacyHtmlPage html={htmlAfter} />
    </div>
  );
}
