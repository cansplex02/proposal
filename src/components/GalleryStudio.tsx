"use client";

import { useState } from "react";

type Props = {
  initialSlug?: string;
  showAdminSecret?: boolean;
};

export default function GalleryStudio({
  initialSlug = "",
  showAdminSecret = false,
}: Props) {
  const [slug, setSlug] = useState(initialSlug);
  const [clinicName, setClinicName] = useState("");
  const [title, setTitle] = useState("캔즈플렉스 디자인");
  const [html, setHtml] = useState("");
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"draft" | "published">(
    "draft"
  );

  async function loadTemplate() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/gallery/template");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "템플릿 로드 실패");
      setHtml(data.html ?? "");
      setStatus("기본 갤러리 HTML을 불러왔습니다.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "템플릿 오류");
    } finally {
      setLoading(false);
    }
  }

  async function loadDraft() {
    if (!slug.trim()) {
      setStatus("slug를 입력하세요.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/gallery/${slug.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "불러오기 실패");
      setClinicName(data.gallery.clinicName ?? "");
      setTitle(data.gallery.title ?? "");
      setHtml(data.gallery.html ?? "");
      setPublishStatus(data.gallery.publish?.status ?? "draft");
      setStatus("draft를 불러왔습니다.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "불러오기 오류");
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!slug.trim() || !html.trim()) {
      setStatus("slug와 HTML이 필요합니다.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (secret) headers.Authorization = `Bearer ${secret}`;

      const res = await fetch(`/api/gallery/${slug.trim()}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ clinicName, title, html }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setStatus("draft 저장됨");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "저장 오류");
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!slug.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const headers: Record<string, string> = {};
      if (secret) headers.Authorization = `Bearer ${secret}`;

      const res = await fetch(`/api/gallery/publish/${slug.trim()}`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발행 실패");
      setPublishStatus("published");
      setStatus(`발행 완료 — ${data.publicPath}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "발행 오류");
    } finally {
      setLoading(false);
    }
  }

  const publicPath = slug.trim() ? `/g/${slug.trim()}` : null;

  return (
    <div className="studio-gallery">
      <div className="studio-toolbar studio-toolbar--gallery">
        <div className="studio-toolbar-left">
          <span className="studio-toolbar-badge">작업실 · 디자인 갤러리</span>
          {publishStatus === "published" ? (
            <span className="studio-toolbar-pub studio-toolbar-pub--on">
              발행됨
            </span>
          ) : (
            <span className="studio-toolbar-pub">미발행</span>
          )}
        </div>
        <div className="studio-toolbar-right">
          {publicPath ? (
            <a
              className="studio-btn studio-btn--ghost"
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              공개 뷰 미리보기
            </a>
          ) : null}
          <button
            type="button"
            className="studio-btn studio-btn--primary"
            disabled={loading || !slug.trim()}
            onClick={publish}
          >
            공개 발행
          </button>
        </div>
      </div>

      <div className="studio-gallery-form">
        <div className="studio-gallery-row">
          <label>
            slug
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="bupyeong-green"
            />
          </label>
          <label>
            병원명
            <input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </label>
          <label>
            제목
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        {showAdminSecret ? (
          <label>
            Admin Secret
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
        ) : null}
        <div className="studio-gallery-actions">
          <button
            type="button"
            className="studio-btn studio-btn--ghost"
            disabled={loading}
            onClick={loadTemplate}
          >
            기본 HTML 불러오기
          </button>
          <button
            type="button"
            className="studio-btn studio-btn--ghost"
            disabled={loading}
            onClick={loadDraft}
          >
            draft 불러오기
          </button>
          <button
            type="button"
            className="studio-btn studio-btn--primary"
            disabled={loading}
            onClick={saveDraft}
          >
            draft 저장
          </button>
        </div>
        <label className="studio-gallery-html-label">
          갤러리 HTML
          <textarea
            className="studio-gallery-html"
            rows={16}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
          />
        </label>
        {status ? <p className="studio-status">{status}</p> : null}
      </div>
    </div>
  );
}
