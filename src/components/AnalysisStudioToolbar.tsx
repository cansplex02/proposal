"use client";

type Props = {
  slug: string | null;
  publishStatus?: "draft" | "published";
  publishedAt?: string;
};

export default function AnalysisStudioToolbar({
  slug,
  publishStatus = "draft",
  publishedAt,
}: Props) {
  const isPublished = publishStatus === "published";

  return (
    <div className="studio-toolbar studio-toolbar--analysis">
      <div className="studio-toolbar-left">
        <span className="studio-toolbar-badge">작업실 · 경쟁분석</span>
        {slug ? (
          <code className="studio-toolbar-slug">slug: {slug}</code>
        ) : (
          <span className="studio-toolbar-hint">생성 후 slug가 부여됩니다</span>
        )}
        {isPublished ? (
          <span className="studio-toolbar-pub studio-toolbar-pub--on">
            링크 생성됨 {publishedAt ? `· ${publishedAt.slice(0, 10)}` : ""}
          </span>
        ) : (
          <span className="studio-toolbar-pub">미발행 — 수정 후 개별링크 만들기</span>
        )}
      </div>
    </div>
  );
}
