import path from "path";

const root = process.cwd();

export const publishPaths = {
  reportsDraft: path.join(root, "data", "reports"),
  reportsPublished: path.join(root, "data", "published", "reports"),
  reportsIndex: path.join(root, "data", "reports-index.json"),
  galleriesDraft: path.join(root, "data", "galleries"),
  galleriesPublished: path.join(root, "data", "published", "galleries"),
  galleriesIndex: path.join(root, "data", "galleries-index.json"),
  generatedHtml: path.join(root, "src", "content", "generated"),
};

/** 고객 공유 링크 — 제안서 메인 진입 */
export function publicProposalPath(slug: string): string {
  return `/p/${slug}`;
}

/** 제안서 CTA 「결과 확인」→ 경쟁분석 결과 */
export function publicAnalysisPath(slug: string): string {
  return `/r/${slug}`;
}

/** @deprecated publicProposalPath 사용 */
export function publicReportPath(slug: string): string {
  return publicProposalPath(slug);
}

export function publicGalleryPath(slug: string): string {
  return `/g/${slug}`;
}
