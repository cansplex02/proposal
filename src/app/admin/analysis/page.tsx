"use client";

import { useState } from "react";

export default function AdminAnalysisPage() {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const fd = new FormData(e.currentTarget);
    const regions = String(fd.get("regions") || "")
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const topics = String(fd.get("topics") || "")
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const body = {
      slug: fd.get("slug"),
      clinicName: fd.get("clinicName"),
      address: fd.get("address"),
      specialty: fd.get("specialty"),
      regions: regions.length ? regions : undefined,
      keywordTopics: topics.length ? topics : undefined,
      radiusMeters: Number(fd.get("radius") || 1500),
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

      setStatus(`완료: ${data.url}${data.warnings?.length ? "\n⚠ " + data.warnings.join("\n⚠ ") : ""}`);
      if (data.url) window.open(data.url, "_blank");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "48px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>경쟁분석 생성</h1>
      <p style={{ color: "#555", marginBottom: 24, lineHeight: 1.6 }}>
        주소·진료과를 입력하면 상권 API + 키워드 지도를 생성합니다. 로컬에서는{" "}
        <code>.env.local</code> API 키가 필요합니다.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Admin Secret (선택)
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={{ width: "100%", padding: 8 }}
            placeholder="ANALYSIS_ADMIN_SECRET"
          />
        </label>
        <label>
          Slug (URL)
          <input name="slug" required placeholder="gangnam-skin" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          병원명
          <input name="clinicName" required placeholder="○○피부과" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          주소
          <input
            name="address"
            required
            placeholder="서울 서초구 서초대로 365"
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          진료과
          <input name="specialty" required placeholder="피부과" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          지역 키워드 (쉼표)
          <input
            name="regions"
            placeholder="강남,서초동,양재역 (비우면 주소에서 추출)"
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          공략 키워드 주제 (쉼표)
          <input
            name="topics"
            placeholder="비우면 진료과 템플릿 사용"
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          반경 (m)
          <input name="radius" type="number" defaultValue={1500} style={{ width: "100%", padding: 8 }} />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 16px",
            background: "#2b5cd9",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "생성 중…" : "분석 페이지 생성"}
        </button>
      </form>

      {status && (
        <pre
          style={{
            marginTop: 24,
            padding: 16,
            background: "#f4f6fa",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            fontSize: 13,
          }}
        >
          {status}
        </pre>
      )}
    </main>
  );
}
