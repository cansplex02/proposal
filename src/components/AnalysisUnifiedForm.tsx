"use client";

import { useState } from "react";
import { resolveSearchForDisplay } from "@/lib/analysis/normalizeSearchPayload";
import { SPECIALTY_OPTIONS, SPECIALTY_TOPICS } from "@/lib/analysis/specialties";
import type { TreatmentMode } from "@/lib/analysis/treatmentMode";
import type { SearchGeneratedPayload } from "@/lib/analysis/types";

const SPECIALTY_DATALIST = [
  ...new Set([...SPECIALTY_OPTIONS, ...Object.keys(SPECIALTY_TOPICS)]),
];

type Props = {
  showAdminSecret?: boolean;
  initialSpecialty?: string;
  initialClinicName?: string;
  initialAddress?: string;
  onGenerated: (payload: SearchGeneratedPayload) => void;
};

export default function AnalysisUnifiedForm({
  showAdminSecret = false,
  initialSpecialty = "",
  initialClinicName = "",
  initialAddress = "",
  onGenerated,
}: Props) {
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [clinicName, setClinicName] = useState(initialClinicName);
  const [address, setAddress] = useState(initialAddress);
  const [mainSearchKeyword, setMainSearchKeyword] = useState("");
  const [treatmentMode, setTreatmentMode] = useState<TreatmentMode>("nonsurgery");
  const [focusTopics, setFocusTopics] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState("");

  async function resolveAddressFromName() {
    if (!clinicName.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/analysis/resolve-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicName: clinicName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "주소 조회 실패");
      if (data.address) {
        setAddress(data.address);
        setResolvedAddress(data.address);
        setStatus("주소를 찾았습니다.");
      } else {
        setStatus("주소를 자동으로 찾지 못했습니다. 직접 입력해 주세요.");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "주소 조회 오류");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = clinicName.trim();
    const addr = address.trim();
    if (!specialty.trim()) {
      setStatus("진료과를 입력해 주세요.");
      return;
    }
    if (!name && !addr) {
      setStatus("병원명이 없을 때는 주소를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setStatus("01·02 인구·상권 → 03 경쟁분석 → 04 키워드 순으로 생성합니다…");

    const body = {
      ...(name ? { clinicName: name } : {}),
      specialty: specialty.trim(),
      address: addr || undefined,
      mainSearchKeyword: mainSearchKeyword.trim() || undefined,
      keywordTopics: focusTopics
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      treatmentMode,
      radiusMeters: 1500,
      includeMapAds: true,
    };

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (secret) headers.Authorization = `Bearer ${secret}`;

      const res = await fetch("/api/analysis/generate", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");

      const search = await resolveSearchForDisplay({
        slug: data.slug,
        search: data.search,
        competitors: data.competitors,
        insights: data.insights,
        channelMatrix: data.channelMatrix,
        searchKeyword: data.searchKeyword,
        rivalCount: data.rivalCount,
      });

      onGenerated({
        slug: data.slug,
        search: search ?? undefined,
        searchBody: data.searchBody,
        beforeSearchHtml: data.beforeSearchHtml,
        populationSummary: data.populationSummary,
        resolvedAddress: data.resolvedAddress,
        searchKeyword: data.searchKeyword,
        rivalCount: data.rivalCount,
        warnings: data.warnings,
        competitors: search?.competitors,
        insights: search?.insights,
        channelMatrix: search?.channelMatrix,
        keywords: data.keywords,
        keywordRegions: data.keywordRegions,
        formContext: {
          specialty: specialty.trim(),
          focusTopics: focusTopics.trim(),
          treatmentMode,
        },
      });

      const rivalN =
        search?.competitors?.filter((c) => !c.isOurs).length ??
        data.rivalCount ??
        0;
      const meta = search?.meta ?? data.search?.meta;

      const lines = [
        "✓ 전체 분석 완료",
        data.populationSummary,
        data.keywordRegions?.length
          ? `04 키워드 — ${data.keywordRegions.length}개 지역`
          : null,
        data.searchKeyword ? `03 지도 검색: ${data.searchKeyword}` : null,
        rivalN > 0
          ? `03 경쟁병원 ${rivalN}곳`
          : "03 경쟁병원 없음 — 키워드·주소 확인",
        meta?.mapPlaceCount != null
          ? `수집 ${meta.mapPlaceCount}건 → 진료과 ${meta.afterCategoryCount ?? "?"}건 → 반경 ${meta.afterRadiusCount ?? "?"}건`
          : null,
        data.warnings?.length
          ? data.warnings.map((w: string) => `⚠ ${w}`).join("\n")
          : null,
      ].filter(Boolean);
      setStatus(lines.join("\n"));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="analysis-region-wrap" id="analysis-unified-form">
      <form
        className="keyword-generator-form analysis-region-form analysis-unified-form"
        onSubmit={(e) => void onSubmit(e)}
      >
        <div className="analysis-region-header">
          <span className="analysis-region-badge">통합 분석</span>
          <h3 className="analysis-region-title">경쟁분석 입력</h3>
          <p className="analysis-region-desc">
            한 번 입력하면 <strong>인구·상권</strong>,{" "}
            <strong>검색량·채널</strong>, <strong>공략 키워드</strong>가 한꺼번에
            채워집니다.
          </p>
        </div>

        <div className="analysis-unified-grid">
          <label>
            <span className="keyword-generator-label">진료과</span>
            <input
              list="analysis-unified-specialty-list"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              required
              disabled={loading}
            />
            <datalist id="analysis-unified-specialty-list">
              {SPECIALTY_DATALIST.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            <span className="keyword-generator-label">병원명 (선택)</span>
            <input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              disabled={loading}
            />
          </label>
          <label>
            <span className="keyword-generator-label">네이버 검색 키워드</span>
            <input
              value={mainSearchKeyword}
              onChange={(e) => setMainSearchKeyword(e.target.value)}
              disabled={loading}
            />
          </label>
          <label className="analysis-unified-span-2">
            <span className="keyword-generator-label">
              병원 주소{clinicName.trim() ? " (선택)" : ""}
            </span>
            <div className="analysis-unified-address-row">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="keyword-generator-back analysis-unified-find-btn"
                disabled={loading || !clinicName.trim()}
                onClick={() => void resolveAddressFromName()}
              >
                주소 찾기
              </button>
            </div>
          </label>
          <label>
            <span className="keyword-generator-label">수술/비수술</span>
            <div className="keyword-generator-seg">
              <button
                type="button"
                className={
                  treatmentMode === "nonsurgery" ? "seg-btn seg-active" : "seg-btn"
                }
                onClick={() => setTreatmentMode("nonsurgery")}
                disabled={loading}
              >
                비수술
              </button>
              <button
                type="button"
                className={
                  treatmentMode === "surgery" ? "seg-btn seg-active" : "seg-btn"
                }
                onClick={() => setTreatmentMode("surgery")}
                disabled={loading}
              >
                수술
              </button>
            </div>
          </label>
          <label>
            <span className="keyword-generator-label">공략 키워드 (선택)</span>
            <input
              value={focusTopics}
              onChange={(e) => setFocusTopics(e.target.value)}
              placeholder="예: 허리디스크"
              disabled={loading}
            />
          </label>
        </div>

        <p className="analysis-region-examples">
          네이버 검색 키워드는 가장 가까운 역·동 기준으로 입력하세요. 비우면 주소
          지역 + 진료과로 자동 추론합니다.
        </p>

        {resolvedAddress && !status?.includes("완료") ? (
          <p className="keyword-generator-address">
            <span className="keyword-generator-label">확인된 주소</span>
            {resolvedAddress}
          </p>
        ) : null}

        {status && (
          <div className="analysis-region-status" role="status">
            {status}
          </div>
        )}

        <div className="keyword-generator-form-actions analysis-unified-actions">
          {showAdminSecret && (
            <label className="analysis-search-admin-secret">
              <span className="keyword-generator-label">Admin Secret</span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                disabled={loading}
              />
            </label>
          )}
          <button
            type="submit"
            className="keyword-generator-btn analysis-region-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="analysis-region-submit-inner">
                <span className="analysis-region-spinner" aria-hidden />
                전체 분석 중… (1~2분)
              </span>
            ) : (
              "전체 분석 생성"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
