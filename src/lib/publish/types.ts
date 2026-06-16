/** 메인 제안서·버튼 연결용 공개 인덱스 */

export type PublishStatus = "draft" | "published";

export type ReportIndexEntry = {
  slug: string;
  clinicName: string;
  address?: string;
  specialty?: string;
  label: string;
  /** 고객 공유 — 제안서 메인 `/p/{slug}` */
  publicPath: string;
  /** CTA 「결과 확인」— `/r/{slug}` */
  analysisPath?: string;
  status: PublishStatus;
  publishedAt?: string;
  updatedAt?: string;
};

export type GalleryIndexEntry = {
  slug: string;
  clinicName: string;
  label: string;
  publicPath: string;
  status: PublishStatus;
  publishedAt?: string;
  updatedAt?: string;
};

export type GalleryDocument = {
  slug: string;
  clinicName: string;
  title: string;
  /** 갤러리 본문 HTML (nav·hero·grid) */
  html: string;
  publish?: {
    status: PublishStatus;
    publishedAt?: string;
  };
  updatedAt?: string;
};
