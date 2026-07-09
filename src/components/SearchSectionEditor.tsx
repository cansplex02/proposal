"use client";

import { useEffect, useState } from "react";
import type { SearchSectionData } from "@/components/AnalysisSearchResults";

const CHANNEL_KEYS = [
  "homepage",
  "blog",
  "cafe",
  "news",
  "kin",
  "sns",
  "video",
] as const;

const CHANNEL_LABELS: Record<(typeof CHANNEL_KEYS)[number], string> = {
  homepage: "홈페이지",
  blog: "블로그",
  cafe: "카페",
  news: "뉴스",
  kin: "지식인",
  sns: "SNS",
  video: "영상",
};

const MARK_OPTIONS = ["O", "△", "X", "—"];

function skeletonMatrix(competitors: SearchSectionData["competitors"]) {
  return (competitors ?? []).map((c) => ({
    hospital: c.name,
    isOurs: c.isOurs,
    homepage: "—",
    blog: "—",
    cafe: "—",
    news: "—",
    kin: "—",
    sns: "—",
    video: "—",
  }));
}

type Props = {
  slug: string;
  data: SearchSectionData;
  adminSecret?: string;
  defaultOpen?: boolean;
  onSaved: (data: SearchSectionData) => void;
};

export default function SearchSectionEditor({
  slug,
  data,
  adminSecret,
  defaultOpen = false,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState(data.competitors ?? []);
  const [insights, setInsights] = useState(data.insights ?? []);
  const [matrix, setMatrix] = useState(
    data.channelMatrix?.length
      ? data.channelMatrix
      : skeletonMatrix(data.competitors ?? [])
  );

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    setCompetitors(data.competitors ?? []);
    setInsights(data.insights ?? []);
    setMatrix(
      data.channelMatrix?.length
        ? data.channelMatrix
        : skeletonMatrix(data.competitors ?? [])
    );
  }, [data]);

  function syncMatrixNames(nextCompetitors: typeof competitors) {
    setMatrix((prev) =>
      nextCompetitors.map((c, i) => ({
        ...(prev[i] ?? skeletonMatrix([c])[0]),
        hospital: c.name,
        isOurs: c.isOurs,
      }))
    );
  }

  function addCompetitor() {
    const next = [
      ...competitors,
      { name: "새 병원", volume: 0, isOurs: false },
    ];
    setCompetitors(next);
    syncMatrixNames(next);
  }

  function removeCompetitor(index: number) {
    const next = competitors.filter((_, i) => i !== index);
    setCompetitors(next);
    setMatrix((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (adminSecret) headers.Authorization = `Bearer ${adminSecret}`;

      const search: SearchSectionData = {
        competitors,
        insights,
        channelMatrix: matrix,
        meta: {
          ...data.meta,
          channelAuditNote: "작업실에서 수동 보정됨",
        },
      };

      const res = await fetch(`/api/analysis/report/${slug}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ search }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "저장 실패");
      onSaved(json.search);
      setStatus("섹션 03 저장됨");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "저장 오류");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="studio-search-edit-toggle">
        <button
          type="button"
          className="studio-btn studio-btn--ghost"
          onClick={() => setOpen(true)}
        >
          검색량·디지털 채널 수동 수정
        </button>
      </div>
    );
  }

  return (
    <div className="studio-search-editor">
      <div className="studio-search-editor-head">
        <strong>검색량 및 디지털 채널 수동 보정</strong>
        <button
          type="button"
          className="studio-btn studio-btn--ghost"
          onClick={() => setOpen(false)}
        >
          닫기
        </button>
      </div>

      <h4 className="studio-search-editor-sub">브랜드 검색량</h4>
      <div className="studio-search-editor-table-wrap">
        <table className="studio-edit-table">
          <thead>
            <tr>
              <th>병원명</th>
              <th>검색량</th>
              <th>우리</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {competitors.map((row, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={row.name}
                    onChange={(e) => {
                      const next = [...competitors];
                      next[i] = { ...next[i], name: e.target.value };
                      setCompetitors(next);
                      syncMatrixNames(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={row.volume}
                    onChange={(e) => {
                      const next = [...competitors];
                      next[i] = {
                        ...next[i],
                        volume: Number(e.target.value) || 0,
                        volumeEstimated: false,
                      };
                      setCompetitors(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(row.isOurs)}
                    onChange={(e) => {
                      const next = competitors.map((c, j) => ({
                        ...c,
                        isOurs: j === i ? e.target.checked : false,
                      }));
                      setCompetitors(next);
                      syncMatrixNames(next);
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="studio-btn studio-btn--ghost studio-btn--xs"
                    onClick={() => removeCompetitor(i)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="studio-btn studio-btn--ghost"
        onClick={addCompetitor}
      >
        경쟁병원 추가
      </button>

      <h4 className="studio-search-editor-sub">디지털 채널</h4>
      <div className="studio-search-editor-table-wrap">
        <table className="studio-edit-table studio-edit-table--channels">
          <thead>
            <tr>
              <th>병원</th>
              {CHANNEL_KEYS.map((k) => (
                <th key={k}>{CHANNEL_LABELS[k]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td>{row.hospital}</td>
                {CHANNEL_KEYS.map((k) => (
                  <td key={k}>
                    <select
                      value={row[k]}
                      onChange={(e) => {
                        const next = [...matrix];
                        next[i] = { ...next[i], [k]: e.target.value };
                        setMatrix(next);
                      }}
                    >
                      {MARK_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="studio-search-editor-sub">인사이트</h4>
      {insights.map((ins, i) => (
        <div key={i} className="studio-insight-edit">
          <input
            value={ins.title}
            placeholder="제목"
            onChange={(e) => {
              const next = [...insights];
              next[i] = { ...next[i], title: e.target.value };
              setInsights(next);
            }}
          />
          <textarea
            value={ins.body}
            rows={2}
            onChange={(e) => {
              const next = [...insights];
              next[i] = { ...next[i], body: e.target.value };
              setInsights(next);
            }}
          />
          <button
            type="button"
            className="studio-btn studio-btn--ghost studio-btn--xs"
            onClick={() => setInsights(insights.filter((_, j) => j !== i))}
          >
            삭제
          </button>
        </div>
      ))}
      <button
        type="button"
        className="studio-btn studio-btn--ghost"
        onClick={() =>
          setInsights([...insights, { title: "인사이트", body: "" }])
        }
      >
        인사이트 추가
      </button>

      <div className="studio-search-editor-actions">
        <button
          type="button"
          className="studio-btn studio-btn--primary"
          disabled={saving}
          onClick={save}
        >
          {saving ? "저장 중…" : "검색량·채널 저장"}
        </button>
        {status ? <span className="studio-status">{status}</span> : null}
      </div>
    </div>
  );
}
