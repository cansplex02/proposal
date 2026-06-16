import fs from "fs";
import path from "path";
import type { AnalysisReport } from "@/lib/analysis/types";
import {
  publishPaths,
  publicAnalysisPath,
  publicProposalPath,
} from "@/lib/publish/paths";
import type { ReportIndexEntry } from "@/lib/publish/types";

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

export function draftReportPath(slug: string): string {
  return path.join(publishPaths.reportsDraft, `${slug}.json`);
}

export function publishedReportPath(slug: string): string {
  return path.join(publishPaths.reportsPublished, `${slug}.json`);
}

export function loadDraftReport(slug: string): AnalysisReport | null {
  return readJson<AnalysisReport>(draftReportPath(slug));
}

export function loadPublishedReport(slug: string): AnalysisReport | null {
  return readJson<AnalysisReport>(publishedReportPath(slug));
}

export function saveDraftReport(report: AnalysisReport): void {
  if (process.env.VERCEL) {
    throw new Error("Vercel에서는 로컬 파일 저장이 불가합니다.");
  }
  const next: AnalysisReport = {
    ...report,
    publish: {
      status: report.publish?.status ?? "draft",
      publishedAt: report.publish?.publishedAt,
      publicPath: publicProposalPath(report.slug),
      analysisPath: publicAnalysisPath(report.slug),
    },
  };
  writeJson(draftReportPath(report.slug), next);
}

export function loadReportsIndex(): ReportIndexEntry[] {
  return readJson<ReportIndexEntry[]>(publishPaths.reportsIndex) ?? [];
}

function upsertReportIndex(entry: ReportIndexEntry) {
  const list = loadReportsIndex();
  const i = list.findIndex((e) => e.slug === entry.slug);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  list.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  writeJson(publishPaths.reportsIndex, list);
}

export function publishReport(slug: string): AnalysisReport {
  const draft = loadDraftReport(slug);
  if (!draft) {
    throw new Error(`draft 리포트 없음: ${slug}`);
  }
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
  writeJson(publishedReportPath(slug), published);
  saveDraftReport(published);

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

export function patchDraftReport(slug: string, patch: ReportPatch): AnalysisReport {
  const draft = loadDraftReport(slug);
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

  saveDraftReport(updated);
  return updated;
}

/** @deprecated patchDraftReport 사용 */
export function patchDraftSearch(
  slug: string,
  search: NonNullable<AnalysisReport["search"]>
): AnalysisReport {
  return patchDraftReport(slug, { search });
}
