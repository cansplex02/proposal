"use client";

import { useEffect, useState } from "react";
import type { AnalysisReport } from "@/lib/analysis/types";

type Props = {
  slug: string;
  publishStatus?: "draft" | "published";
  publishedAt?: string;
  adminSecret?: string;
  draftReport?: AnalysisReport | null;
  onPublished?: () => void;
};

export default function ProposalLinkPanel({
  slug,
  publishStatus = "draft",
  publishedAt,
  adminSecret,
  draftReport = null,
  onPublished,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(`/p/${slug}`);
  const isPublished = publishStatus === "published";
  const proposalPath = `/p/${slug}`;
  const analysisPath = `/r/${slug}`;

  useEffect(() => {
    setShareUrl(`${window.location.origin}/p/${slug}`);
  }, [slug]);

  async function persistDraft(): Promise<boolean> {
    if (!draftReport) {
      setStatus("분석 데이터가 없습니다. 주소·진료과 입력 후 다시 생성해 주세요.");
      return false;
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (adminSecret) headers.Authorization = `Bearer ${adminSecret}`;
    try {
      const res = await fetch(`/api/analysis/report/${slug}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ report: draftReport }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "draft 저장 실패"
        );
      }
      return true;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "draft 저장 오류");
      return false;
    }
  }

  async function createLink() {
    setLoading(true);
    setStatus(null);
    try {
      if (!(await persistDraft())) return;

      const headers: Record<string, string> = {};
      if (adminSecret) headers.Authorization = `Bearer ${adminSecret}`;
      if (draftReport) headers["Content-Type"] = "application/json";

      const res = await fetch(`/api/analysis/publish/${slug}`, {
        method: "POST",
        headers,
        body: draftReport
          ? JSON.stringify({ report: draftReport })
          : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "링크 생성 실패");
      setStatus("개별 링크가 생성되었습니다. 아래 링크를 복사해 공유하세요.");
      onPublished?.();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "링크 생성 오류");
    } finally {
      setLoading(false);
    }
  }

  async function openPreview(path: string) {
    setStatus(null);
    setLoading(true);
    try {
      if (!(await persistDraft())) return;
      const previewUrl = `${path}${path.includes("?") ? "&" : "?"}preview=1`;
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const input = document.getElementById(
        `studio-share-url-${slug}`
      ) as HTMLInputElement | null;
      input?.select();
      document.execCommand("copy");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  }

  return (
    <div className="studio-link-panel studio-section-edit-wrap">
      <div className="studio-link-panel__card studio-link-panel__card--preview">
        <div className="studio-link-panel__head">
          <h4 className="studio-link-panel__title">미리보기</h4>
          <p className="studio-link-panel__desc">
            링크 생성 전에도 고객이 보는 화면을 확인할 수 있습니다.
          </p>
        </div>
        <div className="studio-link-panel__actions">
          <button
            type="button"
            className="studio-link-panel__btn studio-link-panel__btn--outline"
            disabled={loading}
            onClick={() => openPreview(proposalPath)}
          >
            제안서 미리보기
          </button>
          <button
            type="button"
            className="studio-link-panel__btn studio-link-panel__btn--outline"
            disabled={loading}
            onClick={() => openPreview(analysisPath)}
          >
            분석 결과 미리보기
          </button>
        </div>
      </div>

      <div className="studio-link-panel__card studio-link-panel__card--share">
        <div className="studio-link-panel__head">
          <h4 className="studio-link-panel__title">고객 공유 링크</h4>
          {isPublished ? (
            <span className="studio-link-panel__badge studio-link-panel__badge--on">
              생성됨 {publishedAt ? `· ${publishedAt.slice(0, 10)}` : ""}
            </span>
          ) : null}
          <p className="studio-link-panel__desc">
            {isPublished
              ? "고객은 제안서 링크로 들어온 뒤 「결과 확인」으로 경쟁분석을 봅니다."
              : "검색량·채널 수정이 끝나면 링크를 만들어 고객에게 공유하세요."}
          </p>
        </div>

        {isPublished ? (
          <div className="studio-link-panel__url-row">
            <input
              id={`studio-share-url-${slug}`}
              className="studio-link-panel__input"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="studio-link-panel__btn studio-link-panel__btn--primary"
              onClick={copyLink}
            >
              {copied ? "복사됨" : "링크 복사"}
            </button>
            <a
              className="studio-link-panel__btn studio-link-panel__btn--outline"
              href={proposalPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              열기
            </a>
          </div>
        ) : (
          <div className="studio-link-panel__actions">
            <button
              type="button"
              className="studio-link-panel__btn studio-link-panel__btn--primary"
              disabled={loading}
              onClick={createLink}
            >
              {loading ? "링크 생성 중…" : "개별링크 만들기"}
            </button>
          </div>
        )}
      </div>

      {status ? <p className="studio-link-panel__status">{status}</p> : null}
    </div>
  );
}
