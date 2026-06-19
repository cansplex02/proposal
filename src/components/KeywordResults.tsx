"use client";

import { useEffect, useState } from "react";
import { buildKeywordSection } from "@/lib/analysis/buildKeywordSection";
import { KEYWORD_PROPOSAL_NOTICE } from "@/lib/analysis/keywords";
import type { TreatmentMode } from "@/lib/analysis/treatmentMode";
import type { AnalysisReport } from "@/lib/analysis/types";

type Props = {
  initialKeywords: AnalysisReport["keywords"];
  initialRegions: string[];
  specialty: string;
  focusTopics: string;
  treatmentMode: TreatmentMode;
  resolvedAddress?: string;
  /** 고객 공유 페이지 — 저장된 표 그대로 표시, 재계산 안 함 */
  readOnly?: boolean;
};

export default function KeywordResults({
  initialKeywords,
  initialRegions,
  specialty,
  focusTopics,
  treatmentMode,
  resolvedAddress,
  readOnly = false,
}: Props) {
  const [editedRegions, setEditedRegions] = useState(initialRegions.join(", "));
  const [result, setResult] = useState(initialKeywords);

  useEffect(() => {
    setEditedRegions(initialRegions.join(", "));
    setResult(initialKeywords);
  }, [initialKeywords, initialRegions]);

  useEffect(() => {
    if (readOnly) return;
    const regions = editedRegions
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!regions.length || !specialty.trim()) return;
    const focus = focusTopics
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setResult(
      buildKeywordSection(specialty, regions, focus, treatmentMode)
    );
  }, [editedRegions, specialty, focusTopics, treatmentMode, readOnly]);

  const topicCols = result.columns.filter((c) => c.id !== "region");

  function copyTsv() {
    const header = ["지역", ...topicCols.map((c) => c.label)].join("\t");
    const lines = result.rows.map((r) =>
      [r.region, ...topicCols.map((c) => r.keywords[c.id] || "")].join("\t")
    );
    void navigator.clipboard.writeText([header, ...lines].join("\n"));
    alert("클립보드에 복사했습니다.");
  }

  return (
    <div className="keyword-results">
      {resolvedAddress ? (
        <p className="keyword-generator-address">
          <span className="keyword-generator-label">확인된 주소</span>
          {resolvedAddress}
        </p>
      ) : null}

      <div className="keyword-generator-form keyword-generator-regions-panel">
        <label>
          <span className="keyword-generator-label">
            {readOnly ? "지역 키워드" : "지역 키워드 (쉼표 구분 · 수정 시 표가 자동 갱신)"}
          </span>
          {readOnly ? (
            <p className="keyword-generator-regions-readonly">{editedRegions}</p>
          ) : (
            <input
              className="keyword-generator-regions-edit"
              value={editedRegions}
              onChange={(e) => setEditedRegions(e.target.value)}
            />
          )}
        </label>
        {!readOnly ? (
          <p className="keyword-generator-hint">
            역·동·구를 추가·삭제하면 아래 표가 바로 반영됩니다.
          </p>
        ) : null}
      </div>

      <div className="keyword-generator-actions">
        <span>
          {result.rows.length}개 지역 × {topicCols.length}개 주제
        </span>
        <button type="button" className="keyword-generator-copy" onClick={copyTsv}>
          엑셀용 복사
        </button>
      </div>

      <div className="keyword-table-wrap">
        <table className="keyword-table">
          <thead>
            <tr>
              <th>지역</th>
              {topicCols.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.region}>
                <td className="region">{row.region}</td>
                {topicCols.map((c) => (
                  <td key={c.id}>{row.keywords[c.id]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="strategy-cards">
        {result.strategyCards.map((card) => (
          <div key={card.label} className="strategy-card">
            <div className="strategy-card-label">{card.label}</div>
            <div
              className="strategy-card-body"
              dangerouslySetInnerHTML={{ __html: card.body }}
            />
          </div>
        ))}
      </div>

      <p className="keyword-disclaimer">{KEYWORD_PROPOSAL_NOTICE}</p>
    </div>
  );
}
