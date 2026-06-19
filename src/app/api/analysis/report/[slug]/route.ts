import { NextResponse } from "next/server";

import { buildMarketMapSlotData } from "@/lib/analysis/sbiz365MarketMap";

import { renderAnalysisHtml } from "@/lib/analysis/renderHtml";

import { splitAnalysisBody } from "@/lib/analysis/splitAnalysisBody";

import type { AnalysisReport } from "@/lib/analysis/types";

import { adminUnauthorizedResponse, isAdminAuthorized } from "@/lib/publish/auth";

import {
  loadDraftReport,
  patchDraftReport,
  publishReport,
  saveDraftReport,
} from "@/lib/publish/reportStore";

import { buildReportPatchResponse } from "@/lib/publish/patchReportResponse";



export const runtime = "nodejs";



type Props = { params: Promise<{ slug: string }> };



export async function GET(_req: Request, { params }: Props) {

  const { slug } = await params;

  const report = await loadDraftReport(slug);

  if (!report) {

    return NextResponse.json({ error: "리포트 없음" }, { status: 404 });

  }



  const html = renderAnalysisHtml(report);

  const beforeSearchHtml = splitAnalysisBody(html).beforeSearch;

  const rivalCount =

    report.search?.competitors?.filter((c) => !c.isOurs).length ?? 0;



  return NextResponse.json({

    ok: true,

    slug: report.slug,

    report,

    search: report.search ?? null,

    rivalCount,

    searchKeyword: report.search?.meta?.mapQuery ?? null,

    beforeSearchHtml,

    marketMap: buildMarketMapSlotData(report),

    publish: report.publish ?? { status: "draft" },

    keywords: report.keywords,

    keywordRegions: report.keywords.rows.map((r) => r.region),

    population: report.population,

    market: report.market,

  });

}



/** 생성 직후 draft 저장 (서버 저장 실패 시 클라이언트 백업용) */
export async function PUT(req: Request, { params }: Props) {
  if (!isAdminAuthorized(req)) return adminUnauthorizedResponse();

  const { slug } = await params;
  let body: { report?: AnalysisReport };
  try {
    body = (await req.json()) as { report?: AnalysisReport };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const report = body.report;
  if (!report || report.slug !== slug) {
    return NextResponse.json({ error: "report.slug 불일치" }, { status: 400 });
  }

  try {
    await saveDraftReport(report);
    return NextResponse.json({ ok: true, slug });
  } catch (e) {
    const message = e instanceof Error ? e.message : "draft 저장 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Props) {

  if (!isAdminAuthorized(req)) return adminUnauthorizedResponse();



  const { slug } = await params;

  let body: ReportPatch;

  try {

    body = (await req.json()) as ReportPatch;

  } catch {

    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  }



  if (!body.search && !body.population && !body.market && !body.keywords) {

    return NextResponse.json(

      { error: "search, population, market, keywords 중 하나 이상 필요" },

      { status: 400 }

    );

  }



  try {

    let report = await patchDraftReport(slug, body);

    if (report.publish?.status === "published") {

      report = await publishReport(slug);

    }

    return NextResponse.json(buildReportPatchResponse(report));

  } catch (e) {

    const message = e instanceof Error ? e.message : "저장 실패";

    return NextResponse.json({ error: message }, { status: 404 });

  }

}



type ReportPatch = {

  search?: AnalysisReport["search"];

  population?: AnalysisReport["population"];

  market?: AnalysisReport["market"];

  keywords?: AnalysisReport["keywords"];

};


