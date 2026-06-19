import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { buildAnalysisReport } from "@/lib/analysis/buildReport";
import { buildMarketMapSlotData } from "@/lib/analysis/sbiz365MarketMap";
import { resolveAddressFromClinicName } from "@/lib/analysis/naverLocalSearch";
import {
  renderAnalysisHtml,
  renderSearchResultsHtml,
  writeAnalysisOutputs,
} from "@/lib/analysis/renderHtml";
import { splitAnalysisBody } from "@/lib/analysis/splitAnalysisBody";
import {
  suggestSlugFromAddressSpecialty,
  suggestSlugFromClinicName,
} from "@/lib/analysis/suggestSlug";
import { publicProposalPath } from "@/lib/publish/paths";
import { saveDraftReport } from "@/lib/publish/reportStore";
import type { AnalysisInput } from "@/lib/analysis/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "icn1";

export async function POST(req: Request) {
  const secret = process.env.ANALYSIS_ADMIN_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const dev = process.env.NODE_ENV === "development";
    if (auth !== `Bearer ${secret}` && !(dev && !auth)) {
      return NextResponse.json(
        {
          error: dev
            ? "Unauthorized — Admin Secret을 입력하거나 .env의 ANALYSIS_ADMIN_SECRET을 비우세요."
            : "Unauthorized",
        },
        { status: 401 }
      );
    }
  }

  let input: AnalysisInput;
  try {
    input = (await req.json()) as AnalysisInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clinicName = input.clinicName?.trim() ?? "";
  input.clinicName = clinicName;

  if (!input.specialty?.trim()) {
    return NextResponse.json({ error: "진료과는 필수입니다." }, { status: 400 });
  }

  if (!input.address?.trim() && clinicName) {
    try {
      const resolved = await resolveAddressFromClinicName(clinicName);
      if (resolved) input.address = resolved;
    } catch {
      /* 주소 자동 조회 실패 */
    }
  }

  if (!input.address?.trim()) {
    return NextResponse.json(
      {
        error: clinicName
          ? "주소가 필요합니다.「주소 찾기」로 채우거나 주소를 직접 입력한 뒤 다시 시도하세요."
          : "병원명이 없을 때는 주소를 입력해 주세요. (개원 예정 등)",
      },
      { status: 400 }
    );
  }

  if (!input.slug?.trim()) {
    input.slug = clinicName
      ? suggestSlugFromClinicName(clinicName)
      : suggestSlugFromAddressSpecialty(
          input.address.trim(),
          input.specialty.trim()
        );
  }

  try {
    const report = await buildAnalysisReport(input);
    const html = renderAnalysisHtml(report);
    const searchBody = renderSearchResultsHtml(report);
    const beforeSearchHtml = splitAnalysisBody(html).beforeSearch;
    const rivalCount =
      report.search?.competitors?.filter((c) => !c.isOurs).length ?? 0;
    const searchKeyword = report.search?.meta?.mapQuery ?? null;

    let paths: { jsonPath: string; htmlPath: string } | undefined;
    let saveError: string | undefined;
    let draftSaved = false;
    const publicPath = publicProposalPath(report.slug);
    try {
      await saveDraftReport(report);
      draftSaved = true;
      if (!process.env.VERCEL) {
        paths = writeAnalysisOutputs(report, html);
        const inputDir = path.join(process.cwd(), "data", "analysis-inputs");
        fs.mkdirSync(inputDir, { recursive: true });
        fs.writeFileSync(
          path.join(inputDir, `${report.slug}.json`),
          JSON.stringify(input, null, 2),
          "utf8"
        );
      }
    } catch (e) {
      saveError =
        e instanceof Error ? e.message : "파일 저장 실패 (화면 결과는 표시됨)";
      console.error("[analysis/generate] save failed:", e);
    }

    const warnings = [
      ...(report.meta?.warnings ?? []),
      ...(saveError ? [saveError] : []),
    ];

    const populationSummary = report.population.residential.total
      ? `↑ 섹션 01·02 갱신 — 주거 ${report.population.residential.total.toLocaleString("ko-KR")}명 · 직장 ${report.population.workplace.total.toLocaleString("ko-KR")}명`
      : undefined;

    return NextResponse.json({
      ok: true,
      slug: report.slug,
      report,
      draftSaved,
      publicPath,
      publishStatus: "draft" as const,
      search: report.search ?? null,
      competitors: report.search?.competitors ?? [],
      insights: report.search?.insights ?? [],
      channelMatrix: report.search?.channelMatrix ?? [],
      searchBody,
      beforeSearchHtml,
      marketMap: buildMarketMapSlotData(report),
      populationSummary,
      resolvedAddress: report.address,
      population: report.population,
      market: report.market,
      keywords: report.keywords,
      keywordRegions: report.keywords.rows.map((r) => r.region),
      rivalCount,
      searchKeyword,
      warnings: warnings.length ? warnings : undefined,
      paths,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
