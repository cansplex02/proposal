"use client";

import { useEffect, useState } from "react";

type Props = {
  slug: string;
  publishStatus?: "draft" | "published";
  /** 경로 prefix — 기본 `/r/` (경쟁분석 공개) */
  pathPrefix?: string;
  title?: string;
};

export default function PublicLinkCopy({
  slug,
  publishStatus = "draft",
  pathPrefix = "/p/",
  title = "제안서 공유 링크",
}: Props) {
  const [copied, setCopied] = useState(false);
  const [fullUrl, setFullUrl] = useState(`${pathPrefix}${slug}`);

  useEffect(() => {
    setFullUrl(`${window.location.origin}${pathPrefix}${slug}`);
  }, [slug, pathPrefix]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const input = document.getElementById(
        `studio-link-${slug}`
      ) as HTMLInputElement | null;
      input?.select();
      document.execCommand("copy");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  }

  const publicPath = `${pathPrefix}${slug}`;

  return (
    <div className="studio-link-copy">
      <div className="studio-link-copy-head">
        <span className="studio-link-copy-title">{title}</span>
        {publishStatus === "published" ? (
          <span className="studio-link-copy-badge studio-link-copy-badge--on">
            발행됨 · 제안서 진입 후 「결과 확인」→ 분석
          </span>
        ) : (
          <span className="studio-link-copy-badge">
            미발행 · 발행 후 링크 활성화
          </span>
        )}
      </div>
      <div className="studio-link-copy-row">
        <input
          id={`studio-link-${slug}`}
          className="studio-link-copy-input"
          readOnly
          value={fullUrl}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="studio-link-copy-btn"
          onClick={copy}
        >
          {copied ? "복사됨" : "링크 복사"}
        </button>
        <a
          className="studio-link-copy-open"
          href={publicPath}
          target="_blank"
          rel="noopener noreferrer"
        >
          열기
        </a>
      </div>
    </div>
  );
}
