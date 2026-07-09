import fs from "fs";
import path from "path";
import type { AnalysisReport } from "@/lib/analysis/types";
import {
  publishPaths,
  publicAnalysisPath,
  publicProposalPath,
} from "@/lib/publish/paths";
import type { ReportIndexEntry } from "@/lib/publish/types";
import {
  blobLoadDraft,
  blobLoadPublished,
  blobSaveDraft,
  blobSavePublished,
  isReportBlobEnabled,
} from "@/lib/publish/reportBlob";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function shouldUseBlobStorage(): boolean {
  return Boolean(process.env.VERCEL && isReportBlobEnabled());
}

function withPublishPaths(report: AnalysisReport): AnalysisReport {
  return {
    ...report,
    publish: {
      status: report.publish?.status ?? "draft",
      publishedAt: report.publish?.publishedAt,
      publicPath: publicProposalPath(report.slug),
      analysisPath: publicAnalysisPath(report.slug),
    },
  };
}

export function draftReportPath(slug: string): string {
  return path.join(publishPaths.reportsDraft, `${slug}.json`);
}

export function publishedReportPath(slug: string): string {
  return path.join(publishPaths.reportsPublished, `${slug}.json`);
}

export async function loadDraftReport(
  slug: string
): Promise<AnalysisReport | null> {
  if (shouldUseBlobStorage()) {
    const fromBlob = await blobLoadDraft(slug);
    if (fromBlob) return fromBlob;
  }
  return readJson<AnalysisReport>(draftReportPath(slug));
}

export async function loadPublishedReport(
  slug: string
): Promise<AnalysisReport | null> {
  if (shouldUseBlobStorage()) {
    const fromBlob = await blobLoadPublished(slug);
    if (fromBlob) return fromBlob;
  }
  return readJson<AnalysisReport>(publishedReportPath(slug));
}

export async function saveDraftReport(report: AnalysisReport): Promise<void> {
  const next = withPublishPaths(report);
  if (shouldUseBlobStorage()) {
    await blobSaveDraft(next);
    return;
  }
  if (process.env.VERCEL) {
    throw new Error(
      "Vercel Blob이 연결되지 않았습니다. Vercel 대시보드 → Storage → Blob을 생성하세요."
    );
  }
  writeJson(draftReportPath(next.slug), next);
}

export function loadReportsIndex(): ReportIndexEntry[] {
  return readJson<ReportIndexEntry[]>(publishPaths.reportsIndex) ?? [];
}

function upsertReportIndex(entry: ReportIndexEntry) {
  if (process.env.VERCEL) return;
  const list = loadReportsIndex();
  const i = list.findIndex((e) => e.slug === entry.slug);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  list.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  writeJson(publishPaths.reportsIndex, list);
}

/** 생성 직후 저장 누락 시 발행 전 복구 */
export async function ensureDraftReport(
  slug: string,
  inline?: AnalysisReport | null
): Promise<AnalysisReport> {
  const existing = await loadDraftReport(slug);
  if (existing) return existing;
  if (inline?.slug === slug) {
    await saveDraftReport(inline);
    return inline;
  }
  throw new Error(`draft 리포트 없음: ${slug}`);
}

export async function publishReport(
  slug: string,
  inline?: AnalysisReport | null
): Promise<AnalysisReport> {
  // inline이 주어지면 메모리의 최신본을 그대로 발행한다.
  // Blob 재조회는 쓰기 직후 전파 지연으로 옛 버전을 읽어
  // 방금 저장한 수정 내용을 되돌릴 수 있으므로 피한다.
  const draft =
    inline && inline.slug === slug
      ? inline
      : await ensureDraftReport(slug, inline);
  const publishedAt = new Date().toISOString();
  const published: AnalysisReport = {
    ...draft,
    publish: {
      status: "published",
      publishedAt,
      publicPath: publicProposalPath(slug),
      analysisPath: publicAnalysisPath(slug),
    },
  };

  if (shouldUseBlobStorage()) {
    await blobSavePublished(published);
    await blobSaveDraft(published);
  } else if (process.env.VERCEL) {
    throw new Error(
      "Vercel Blob이 연결되지 않았습니다. Vercel 대시보드 → Storage → Blob을 생성하세요."
    );
  } else {
    writeJson(publishedReportPath(slug), published);
    writeJson(draftReportPath(slug), published);
  }

  upsertReportIndex({
    slug,
    clinicName: published.clinicName || slug,
    address: published.address,
    specialty: published.specialty,
    label: published.clinicName || slug,
    publicPath: publicProposalPath(slug),
    analysisPath: publicAnalysisPath(slug),
    status: "published",
    publishedAt,
    updatedAt: publishedAt,
  });

  return published;
}

export type ReportPatch = {
  search?: NonNullable<AnalysisReport["search"]>;
  population?: AnalysisReport["population"];
  market?: AnalysisReport["market"];
  keywords?: AnalysisReport["keywords"];
};

export async function patchDraftReport(
  slug: string,
  patch: ReportPatch
): Promise<AnalysisReport> {
  const draft = await loadDraftReport(slug);
  if (!draft) throw new Error(`draft 리포트 없음: ${slug}`);

  const updated: AnalysisReport = { ...draft };

  if (patch.population) {
    updated.population = {
      ...draft.population,
      ...patch.population,
      residential: {
        ...draft.population.residential,
        ...patch.population.residential,
        ages: {
          ...draft.population.residential.ages,
          ...patch.population.residential?.ages,
        },
      },
      workplace: {
        ...draft.population.workplace,
        ...patch.population.workplace,
        ages: {
          ...draft.population.workplace.ages,
          ...patch.population.workplace?.ages,
        },
      },
    };
  }

  if (patch.market) {
    updated.market = {
      ...draft.market,
      ...patch.market,
      facilities: patch.market.facilities ?? draft.market.facilities,
      summaryBullets: patch.market.summaryBullets ?? draft.market.summaryBullets,
      miniCards: patch.market.miniCards ?? draft.market.miniCards,
    };
  }

  if (patch.search) {
    updated.search = {
      ...draft.search,
      ...patch.search,
      meta: {
        ...draft.search?.meta,
        ...patch.search.meta,
        channelAuditNote:
          patch.search.meta?.channelAuditNote ?? "작업실에서 수동 보정됨",
      },
    };
  }

  if (patch.keywords) {
    updated.keywords = patch.keywords;
  }

  await saveDraftReport(updated);
  return updated;
}

/** @deprecated patchDraftReport 사용 */
export async function patchDraftSearch(
  slug: string,
  search: NonNullable<AnalysisReport["search"]>
): Promise<AnalysisReport> {
  return patchDraftReport(slug, { search });
}
