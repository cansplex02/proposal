"use client";

import { useEffect, useState } from "react";
import {
  buildKeywordMap,
  buildStrategyCards,
  KEYWORD_PROPOSAL_NOTICE,
} from "@/lib/analysis/keywords";
import { buildCustomFocusTopicList } from "@/lib/analysis/focusTopicExpansion";
import {
  topicsForSpecialty,
  SPECIALTY_TOPICS,
  withCompanionTopics,
} from "@/lib/analysis/specialties";

type TreatmentMode = "surgery" | "nonsurgery";

type Props = {
  /** slug 리포트에서 미리 채울 값 (패널은 그대로 인터랙티브) */
  initialSpecialty?: string;
  initialLocation?: string;
  initialRegions?: string;
};

export default function KeywordGeneratorPanel({
  initialSpecialty = "",
  initialLocation = "",
  initialRegions = "",
}: Props) {
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [location, setLocation] = useState(initialLocation);
  const [topicsText, setTopicsText] = useState("");
  const [treatmentMode, setTreatmentMode] = useState<TreatmentMode>("nonsurgery");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [resolvedAddress, setResolvedAddress] = useState("");
  const [editedRegions, setEditedRegions] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);

  const [result, setResult] = useState<ReturnType<typeof buildResult> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search) return;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.hash || ""}`
    );
  }, []);

  function buildResult(
    spec: string,
    regionsRaw: string,
    topicsRaw: string,
    mode: TreatmentMode
  ) {
    const regions = regionsRaw.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
    if (!regions.length || !spec.trim()) return null;
    const customTopics = topicsRaw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const topicList = (
      customTopics.length
        ? buildCustomFocusTopicList(spec, customTopics)
        : withCompanionTopics(
            spec,
            applyTreatmentMode(topicsForSpecialty(spec), spec, mode)
          )
    ).slice(0, 12);
    const { columns, rows } = buildKeywordMap(regions, topicList);
    const strategyCards = buildStrategyCards(spec.trim(), regions, topicList, {
      focusTopics: customTopics.length ? customTopics : undefined,
    });
    return { columns, rows, strategyCards, topicList, regions };
  }

  function applyTreatmentMode(
    topics: string[],
    spec: string,
    mode: TreatmentMode
  ): string[] {
    const cleaned = topics.map((t) => t.trim()).filter(Boolean);

    const surgeryRx =
      /(수술|절제|시술|라식|라섹|스마일|백내장|임플란트|맘모톰|교정수술|수술후기|수술비용)/;

    let next =
      mode === "nonsurgery"
        ? cleaned.filter((t) => !surgeryRx.test(t))
        : cleaned.filter(Boolean);

    if (mode === "nonsurgery") {
      const specTrim = spec.trim();
      if (specTrim === "피부과" || specTrim.includes("피부과")) {
        next = next.filter((t) => t !== "쁘띠" && t !== "쁘띠시술");
        next.push("내성발톱");
      } else if (
        specTrim === "비뇨의학과" ||
        specTrim === "비뇨기과" ||
        specTrim.includes("비뇨의학과") ||
        specTrim.includes("비뇨기과")
      ) {
        next = next.filter((t) => t !== "정관수술" && t !== "포경수술");
        for (const k of ["전립선염", "발기부전"]) {
          if (!next.includes(k)) next.push(k);
        }
      }
    } else if (
      spec.trim() === "정형외과" ||
      spec.trim().includes("정형외과")
    ) {
      const extras = [
        "관절내시경술",
        "척추내시경술",
        "허리수술",
        "무릎수술",
        "어깨수술",
        "회전근개봉합술",
      ];
      const main = spec.trim();
      const rest = next.filter((t) => t !== main && !extras.includes(t));
      next = [main, ...extras, ...rest];
    } else if (
      spec.trim() === "신경외과" ||
      spec.trim().includes("신경외과")
    ) {
      const extras = ["척추내시경술", "허리수술", "디스크수술", "협착증수술"];
      const main = spec.trim();
      const rest = next.filter((t) => t !== main && !extras.includes(t));
      next = [main, ...extras, ...rest];
    } else if (
      spec.trim() === "성형외과" ||
      spec.trim().includes("성형외과")
    ) {
      next = [...next, "안면거상"];
    } else if (
      spec.trim() === "화상외과" ||
      spec.trim().includes("화상외과")
    ) {
      next = [...next, "화상수술"];
    } else if (
      spec.trim() === "산부인과" ||
      spec.trim().includes("산부인과")
    ) {
      next = [...next, "임신중절수술", "낙태수술"];
    } else if (
      spec.trim() === "비뇨의학과" ||
      spec.trim() === "비뇨기과" ||
      spec.trim().includes("비뇨의학과") ||
      spec.trim().includes("비뇨기과")
    ) {
      next = next.filter((t) => t !== "전립선염" && t !== "발기부전");
      next = [...next, "정관수술", "포경수술"];
    }

    const specTrim = spec.trim();
    if (
      specTrim === "신경과" ||
      specTrim === "신경외과" ||
      specTrim === "피부과" ||
      specTrim.includes("신경과") ||
      specTrim.includes("신경외과") ||
      specTrim.includes("피부과")
    ) {
      const rest = next.filter((t) => t !== specTrim && t !== "대상포진");
      next = [specTrim, "대상포진", ...rest];
    }

    return [...new Set(next)].filter(Boolean).slice(0, 12);
  }

  function refreshTable() {
    if (!hasGenerated || !editedRegions.trim() || !specialty.trim()) return;
    setResult(buildResult(specialty, editedRegions, topicsText, treatmentMode));
  }

  useEffect(() => {
    refreshTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialty, editedRegions, topicsText, treatmentMode, hasGenerated]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!specialty.trim() || !location.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/geocode-regions?location=${encodeURIComponent(location)}`
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "위치를 찾을 수 없습니다.");
        return;
      }

      const regionsStr = (data.regions || []).join(", ");
      setResolvedAddress(data.roadAddress || location);
      setEditedRegions(regionsStr);
      setHasGenerated(true);

      setResult(
        buildResult(specialty, regionsStr, topicsText, treatmentMode)
      );
    } catch {
      setError("키워드 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSpecialty("");
    setLocation("");
    setTopicsText("");
    setTreatmentMode("nonsurgery");
    setResolvedAddress("");
    setEditedRegions("");
    setHasGenerated(false);
    setResult(null);
    setError("");
  }

  function copyTsv() {
    if (!result) return;
    const cols = result.columns.filter((c) => c.id !== "region");
    const header = ["지역", ...cols.map((c) => c.label)].join("\t");
    const lines = result.rows.map((r) =>
      [r.region, ...cols.map((c) => r.keywords[c.id] || "")].join("\t")
    );
    void navigator.clipboard.writeText([header, ...lines].join("\n"));
    alert("클립보드에 복사했습니다.");
  }

  const topicCols = result?.columns.filter((c) => c.id !== "region") ?? [];

  return (
    <div className="keyword-generator">
      <form className="keyword-generator-form" onSubmit={handleGenerate}>
        <div className="keyword-generator-fields">
          <label>
            <span className="keyword-generator-label">진료과</span>
            <input
              list="analysis-specialty-list"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="예: 유방외과"
              required
            />
            <datalist id="analysis-specialty-list">
              {Object.keys(SPECIALTY_TOPICS).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            <span className="keyword-generator-label">위치</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 강남역, 서초구 ○○로 123"
              required
            />
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
              >
                비수술
              </button>
              <button
                type="button"
                className={
                  treatmentMode === "surgery" ? "seg-btn seg-active" : "seg-btn"
                }
                onClick={() => setTreatmentMode("surgery")}
              >
                수술
              </button>
            </div>
          </label>
          <label>
            <span className="keyword-generator-label">공략 키워드 (선택)</span>
            <input
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
              placeholder="예: 허리디스크 (연관 키워드 자동 확장)"
            />
          </label>
        </div>
        {error && <p className="keyword-generator-error">{error}</p>}
        <div className="keyword-generator-form-actions">
          <button type="submit" className="keyword-generator-btn" disabled={loading}>
            {loading ? "생성 중…" : "키워드 생성"}
          </button>
          {hasGenerated && (
            <button
              type="button"
              className="keyword-generator-back"
              onClick={handleClear}
            >
              초기화
            </button>
          )}
        </div>
      </form>

      {hasGenerated && (
        <div className="keyword-generator-form keyword-generator-regions-panel">
          <p className="keyword-generator-address">
            <span className="keyword-generator-label">확인된 주소</span>
            {resolvedAddress}
          </p>
          <label>
            <span className="keyword-generator-label">
              지역 키워드 (쉼표 구분 · 수정 시 표가 자동 갱신)
            </span>
            <input
              className="keyword-generator-regions-edit"
              value={editedRegions}
              onChange={(e) => setEditedRegions(e.target.value)}
            />
          </label>
          <p className="keyword-generator-hint">
            역·동·구를 추가·삭제하면 아래 표가 바로 반영됩니다.
          </p>
        </div>
      )}

      {result && (
        <>
          <div className="keyword-generator-actions">
            <span>
              {result.regions.length}개 지역 × {result.topicList.length}개 주제
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
        </>
      )}

      <p className="keyword-disclaimer">{KEYWORD_PROPOSAL_NOTICE}</p>
    </div>
  );
}
