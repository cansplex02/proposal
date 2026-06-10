"use client";

import { useState } from "react";
import { resolveSearchForDisplay } from "@/lib/analysis/normalizeSearchPayload";
import { SPECIALTY_OPTIONS, SPECIALTY_TOPICS } from "@/lib/analysis/specialties";
import type { SearchGeneratedPayload } from "@/lib/analysis/types";

const SPECIALTY_DATALIST = [
  ...new Set([...SPECIALTY_OPTIONS, ...Object.keys(SPECIALTY_TOPICS)]),
];

type Props = {
  /** 로컬 API 생성 시 선택 */
  showAdminSecret?: boolean;
  initialSpecialty?: string;
  initialClinicName?: string;
  initialAddress?: string;
  /** 생성 완료 시 섹션 03 결과 (React 렌더 우선) */
  onSearchGenerated?: (payload: SearchGeneratedPayload) => void;
};

export default function AnalysisSearchPanel({
  showAdminSecret = true,
  initialSpecialty = "",
  initialClinicName = "",
  initialAddress = "",
  onSearchGenerated,
}: Props) {
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [clinicName, setClinicName] = useState(initialClinicName);
  const [address, setAddress] = useState(initialAddress);
  const [mainSearchKeyword, setMainSearchKeyword] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState("");

  async function resolveAddress() {
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
        setStatus("주소를 찾았습니다. 아래에서 수정할 수 있습니다.");
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
      setStatus(
        "병원명이 없을 때는 주소를 입력해 주세요. (개원 예정 등)"
      );
      return;
    }

    setLoading(true);
    setStatus(null);

    const body = {
      ...(name ? { clinicName: name } : {}),
      specialty: specialty.trim(),
      address: addr || undefined,
      mainSearchKeyword: mainSearchKeyword.trim() || undefined,
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

      if (onSearchGenerated) {
        onSearchGenerated({
          slug: data.slug,
          search: search ?? undefined,
          searchBody: data.searchBody,
          searchKeyword: data.searchKeyword,
          rivalCount: data.rivalCount,
          warnings: data.warnings,
          competitors: search?.competitors,
          insights: search?.insights,
          channelMatrix: search?.channelMatrix,
        });
      }

      const rivalN =
        search?.competitors?.filter((c) => !c.isOurs).length ??
        data.rivalCount ??
        0;

      const meta = search?.meta ?? data.search?.meta;
      const funnel =
        meta?.mapPlaceCount != null
          ? `수집 ${meta.mapPlaceCount}건 → 진료과 ${meta.afterCategoryCount ?? "?"}건 → 반경 ${meta.afterRadiusCount ?? "?"}건 → 표시 ${rivalN}곳`
          : null;
      const categoryDrop =
        meta?.mapPlaceCount != null &&
        meta.afterCategoryCount === 0 &&
        meta.mapPlaceCount > 0
          ? "⚠ 진료과 필터에서 모두 제외됐습니다. 진료과·네이버 검색 키워드를 확인하세요."
          : null;

      const lines = [
        data.searchKeyword
          ? `지도 검색: ${data.searchKeyword}`
          : null,
        funnel,
        categoryDrop,
        rivalN > 0
          ? `경쟁병원 ${rivalN}곳 · 아래에 결과 표시`
          : search || data.searchBody
            ? "경쟁 병원을 찾지 못했습니다. 검색 키워드·주소를 바꿔 보세요."
            : "생성은 완료됐지만 경쟁사 데이터가 없습니다.",
        meta?.rivalCount === 0 && (meta?.afterCategoryCount ?? 0) > 0
          ? "반경 1.5km 안에 경쟁병원이 없습니다."
          : null,
        data.warnings?.length ? data.warnings.map((w: string) => `⚠ ${w}`).join("\n") : "",
      ].filter(Boolean);
      setStatus(lines.join("\n"));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="analysis-search">
      <form className="keyword-generator-form" onSubmit={onSubmit}>
        <div className="analysis-search-fields">
          <label>
            <span className="keyword-generator-label">진료과</span>
            <input
              list="analysis-search-specialty-list"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              required
            />
            <datalist id="analysis-search-specialty-list">
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
            />
          </label>
          <label>
            <span className="keyword-generator-label">네이버 검색 키워드</span>
            <input
              value={mainSearchKeyword}
              onChange={(e) => setMainSearchKeyword(e.target.value)}
            />
          </label>
          <p className="analysis-search-keyword-hint">
            위치 기반 가장 가까운 역 또는 동으로 입력해 주세요.
          </p>
        </div>

        <div className="analysis-search-address-row">
          <label className="analysis-search-address-label">
            <span className="keyword-generator-label">
              병원 주소{clinicName.trim() ? " (선택)" : ""}
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="keyword-generator-back"
            disabled={loading || !clinicName.trim()}
            onClick={() => void resolveAddress()}
          >
            주소 찾기
          </button>
        </div>

        {resolvedAddress && (
          <p className="keyword-generator-address">
            <span className="keyword-generator-label">확인된 주소</span>
            {resolvedAddress}
          </p>
        )}

        {status && (
          <pre className="analysis-search-status">{status}</pre>
        )}

        <div className="keyword-generator-form-actions">
          {showAdminSecret && (
            <label className="analysis-search-admin-secret">
              <span className="keyword-generator-label">Admin Secret</span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </label>
          )}
          <button type="submit" className="keyword-generator-btn" disabled={loading}>
            {loading ? "생성 중… (1~2분)" : "경쟁분석 생성"}
          </button>
        </div>
      </form>
    </div>
  );
}
