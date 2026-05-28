import { NextResponse } from "next/server";
import { buildAnalysisReport } from "@/lib/analysis/buildReport";
import { renderAnalysisHtml, writeAnalysisOutputs } from "@/lib/analysis/renderHtml";
import type { AnalysisInput } from "@/lib/analysis/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.ANALYSIS_ADMIN_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let input: AnalysisInput;
  try {
    input = (await req.json()) as AnalysisInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!input.slug || !input.clinicName || !input.address || !input.specialty) {
    return NextResponse.json(
      { error: "slug, clinicName, address, specialty 필수" },
      { status: 400 }
    );
  }

  try {
    const report = await buildAnalysisReport(input);
    const html = renderAnalysisHtml(report);
    const paths = writeAnalysisOutputs(report, html);

    return NextResponse.json({
      ok: true,
      slug: report.slug,
      url: `/analysis/${report.slug}`,
      warnings: report.meta?.warnings,
      paths,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "생성 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
