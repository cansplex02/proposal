import { head, put } from "@vercel/blob";
import type { AnalysisReport } from "@/lib/analysis/types";

const DRAFT_PREFIX = "publish/reports/draft";
const PUBLISHED_PREFIX = "publish/reports/published";

export function isReportBlobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN 없음 — Vercel Storage → Blob 연결을 확인하세요."
    );
  }
  return token;
}

function draftKey(slug: string): string {
  return `${DRAFT_PREFIX}/${slug}.json`;
}

function publishedKey(slug: string): string {
  return `${PUBLISHED_PREFIX}/${slug}.json`;
}

async function readJson(pathname: string): Promise<string | null> {
  try {
    const token = blobToken();
    const meta = await head(pathname, { token });
    // Blob URL은 고정(addRandomSuffix:false)이라 CDN이 옛 내용을 캐싱한다.
    // 고유 쿼리로 캐시를 무력화해 덮어쓴 최신본을 항상 읽는다.
    const sep = meta.url.includes("?") ? "&" : "?";
    const res = await fetch(`${meta.url}${sep}cb=${Date.now()}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function writeJson(pathname: string, data: unknown): Promise<void> {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    token: blobToken(),
  });
}

export async function blobLoadDraft(slug: string): Promise<AnalysisReport | null> {
  const text = await readJson(draftKey(slug));
  return text ? (JSON.parse(text) as AnalysisReport) : null;
}

export async function blobLoadPublished(
  slug: string
): Promise<AnalysisReport | null> {
  const text = await readJson(publishedKey(slug));
  return text ? (JSON.parse(text) as AnalysisReport) : null;
}

export async function blobSaveDraft(report: AnalysisReport): Promise<void> {
  await writeJson(draftKey(report.slug), report);
}

export async function blobSavePublished(report: AnalysisReport): Promise<void> {
  await writeJson(publishedKey(report.slug), report);
}
