"use client";

import { useState } from "react";

export type RegionLoadedPayload = {
  demographicsMarketHtml: string;
  resolvedAddress: string;
  radiusKm: number;
  summary?: string;
  warnings?: string[];
};

type Props = {
  onRegionLoaded: (payload: RegionLoadedPayload) => void;
};

export default function AnalysisRegionPanel({ onRegionLoaded }: Props) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = address.trim();
    if (!q) {
      setStatusError(true);
      setStatus("주소 또는 장소명을 입력해 주세요.");
      return;
    }

    setLoading(true);
    setStatus(null);
    setStatusError(false);

    try {
      const res = await fetch("/api/analysis/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: q, radiusMeters: 1500 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");

      onRegionLoaded({
        demographicsMarketHtml: data.demographicsMarketHtml,
        resolvedAddress: data.resolvedAddress,
        radiusKm: data.radiusKm ?? 1.5,
        summary: data.summary,
        warnings: data.warnings,
      });

      const lines = [
        data.summary,
        data.warnings?.length
          ? data.warnings.map((w: string) => `⚠ ${w}`).join("\n")
          : null,
      ].filter(Boolean);
      setStatus(lines.join("\n"));
      setStatusError(Boolean(data.warnings?.length));
    } catch (err) {
      setStatusError(true);
      setStatus(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="analysis-region-wrap" id="region-search">
      <form
        className="keyword-generator-form analysis-region-form"
        onSubmit={(e) => void onSubmit(e)}
      >
        <div className="analysis-region-header">
          <span className="analysis-region-badge">인구 · 상권 자동 분석</span>
          <h3 className="analysis-region-title">분석할 지역을 검색하세요</h3>
          <p className="analysis-region-desc">
            주소 또는 장소명을 입력하면 반경 1.5km{" "}
            <strong>주거·직장 인구</strong>와 <strong>주변 상권</strong>이
            아래에 자동으로 채워집니다.
          </p>
        </div>

        <div className="analysis-region-search-row">
          <label className="analysis-region-field">
            <span className="keyword-generator-label">분석 지역</span>
            <div className="analysis-region-input-box">
              <svg
                className="analysis-region-input-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 강남역, 인천 부평구 부평동"
                disabled={loading}
                autoComplete="street-address"
              />
            </div>
          </label>
          <button
            type="submit"
            className="keyword-generator-btn analysis-region-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="analysis-region-submit-inner">
                <span className="analysis-region-spinner" aria-hidden />
                분석 중…
              </span>
            ) : (
              "인구·상권 분석"
            )}
          </button>
        </div>

        <p className="analysis-region-examples">
          서울특별시 강남구 강남대로 302-2 · 부평역 · 역삼동 등 주소·역·동 이름으로
          검색할 수 있습니다.
        </p>

        {status && (
          <div
            className={
              statusError
                ? "analysis-region-status analysis-region-status--warn"
                : "analysis-region-status"
            }
            role="status"
          >
            {status}
          </div>
        )}
      </form>
    </div>
  );
}
