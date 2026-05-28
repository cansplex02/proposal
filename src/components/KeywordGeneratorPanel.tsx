"use client";

import { useEffect, useState } from "react";
import { buildKeywordMap, buildStrategyCards } from "@/lib/analysis/keywords";
import { topicsForSpecialty, SPECIALTY_TOPICS } from "@/lib/analysis/specialties";

type TreatmentMode = "surgery" | "nonsurgery";

type ShareStateV1 = {
  v: 1;
  specialty: string;
  location: string;
  topicsText: string;
  treatmentMode: TreatmentMode;
  resolvedAddress: string;
  editedRegions: string;
  hasGenerated: boolean;
};

export default function KeywordGeneratorPanel() {
  const [specialty, setSpecialty] = useState("");
  const [location, setLocation] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [treatmentMode, setTreatmentMode] = useState<TreatmentMode>("nonsurgery");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [resolvedAddress, setResolvedAddress] = useState("");
  const [editedRegions, setEditedRegions] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);

  const [result, setResult] = useState<ReturnType<typeof buildResult> | null>(null);

  function toShareState(): ShareStateV1 {
    return {
      v: 1,
      specialty,
      location,
      topicsText,
      treatmentMode,
      resolvedAddress,
      editedRegions,
      hasGenerated,
    };
  }

  function parseShareState(search: string): ShareStateV1 | null {
    const sp = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const v = Number(sp.get("v") || "0");
    if (v !== 1) return null;

    const mode = sp.get("mode");
    const treatmentModeParsed: TreatmentMode =
      mode === "surgery" || mode === "nonsurgery" ? mode : "nonsurgery";

    const has = sp.get("has") === "1";
    const editedRegionsRaw = sp.get("regions") || "";
    const specialtyRaw = sp.get("s") || "";

    return {
      v: 1,
      specialty: specialtyRaw,
      location: sp.get("loc") || "",
      topicsText: sp.get("topics") || "",
      treatmentMode: treatmentModeParsed,
      resolvedAddress: sp.get("addr") || "",
      editedRegions: editedRegionsRaw,
      hasGenerated: has && Boolean(specialtyRaw.trim()) && Boolean(editedRegionsRaw.trim()),
    };
  }

  function writeUrlFromState(next: ShareStateV1) {
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams();
    sp.set("v", "1");

    if (next.specialty.trim()) sp.set("s", next.specialty.trim());
    if (next.location.trim()) sp.set("loc", next.location.trim());
    if (next.topicsText.trim()) sp.set("topics", next.topicsText.trim());
    if (next.treatmentMode) sp.set("mode", next.treatmentMode);
    if (next.resolvedAddress.trim()) sp.set("addr", next.resolvedAddress.trim());
    if (next.editedRegions.trim()) sp.set("regions", next.editedRegions.trim());
    if (next.hasGenerated) sp.set("has", "1");

    const nextUrl = `${window.location.pathname}?${sp.toString()}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function buildResult(
    spec: string,
    regionsRaw: string,
    topicsRaw: string,
    mode: TreatmentMode
  ) {
    const regions = regionsRaw.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
    if (!regions.length || !spec.trim()) return null;
    const topics = topicsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const base = topics.length ? topics : topicsForSpecialty(spec);
    const topicList = applyTreatmentMode(base, spec, mode);
    const { columns, rows } = buildKeywordMap(regions, topicList);
    const strategyCards = buildStrategyCards(spec.trim(), regions, topicList);
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

    if (mode === "surgery") {
      next = [
        ...next,
        `${spec}수술`,
        "수술비용",
        "수술후기",
        "수술잘하는곳",
      ];
    } else {
      next = [...next, "비수술", "비수술치료"];
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

  // URL → state (first load)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseShareState(window.location.search);
    if (!parsed) return;

    setSpecialty(parsed.specialty);
    setLocation(parsed.location);
    setTopicsText(parsed.topicsText);
    setTreatmentMode(parsed.treatmentMode);
    setResolvedAddress(parsed.resolvedAddress);
    setEditedRegions(parsed.editedRegions);
    setHasGenerated(parsed.hasGenerated);

    if (parsed.hasGenerated) {
      setResult(
        buildResult(
          parsed.specialty,
          parsed.editedRegions,
          parsed.topicsText,
          parsed.treatmentMode
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // state → URL (after generated; also keeps URL fresh for sharing)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasGenerated) return;
    writeUrlFromState(toShareState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    specialty,
    location,
    topicsText,
    treatmentMode,
    resolvedAddress,
    editedRegions,
    hasGenerated,
  ]);

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
      const addr = data.roadAddress || location;
      setResolvedAddress(addr);
      setEditedRegions(regionsStr);
      setHasGenerated(true);

      const r = buildResult(
        specialty,
        regionsStr,
        topicsText,
        treatmentMode
      );
      setResult(r);

      writeUrlFromState({
        v: 1,
        specialty,
        location,
        topicsText,
        treatmentMode,
        resolvedAddress: addr,
        editedRegions: regionsStr,
        hasGenerated: true,
      });
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

    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.hash || ""}`
      );
    }
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

  function copyShareLink() {
    if (typeof window === "undefined") return;
    if (!hasGenerated) return;
    writeUrlFromState(toShareState());
    void navigator.clipboard.writeText(window.location.href);
    alert("공유 링크를 복사했습니다.");
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
              placeholder="비우면 진료과 기본 목록"
            />
          </label>
        </div>
        {error && <p className="keyword-generator-error">{error}</p>}
        <div className="keyword-generator-form-actions">
          <button type="submit" className="keyword-generator-btn" disabled={loading}>
            {loading ? "생성 중…" : "키워드 생성"}
          </button>
          {hasGenerated && (
            <>
              <button
                type="button"
                className="keyword-generator-copy"
                onClick={copyShareLink}
              >
                링크 복사
              </button>
              <button
                type="button"
                className="keyword-generator-back"
                onClick={handleClear}
              >
                초기화
              </button>
            </>
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
    </div>
  );
}
