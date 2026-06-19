import { NextResponse } from "next/server";
import type { AnalysisReport } from "@/lib/analysis/types";
import { adminUnauthorizedResponse, isAdminAuthorized } from "@/lib/publish/auth";
import { publicProposalPath } from "@/lib/publish/paths";
import { publishReport } from "@/lib/publish/reportStore";

export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Props) {
  if (!isAdminAuthorized(req)) return adminUnauthorizedResponse();

  const { slug } = await params;
  let inlineReport: AnalysisReport | undefined;
  try {
    const text = await req.text();
    if (text.trim()) {
      const body = JSON.parse(text) as { report?: AnalysisReport };
      if (body.report?.slug === slug) inlineReport = body.report;
    }
  } catch {
    /* body 없음 — 저장된 draft만 사용 */
  }

  try {
    const report = await publishReport(slug, inlineReport);
    return NextResponse.json({
      ok: true,
      slug: report.slug,
      publicPath: publicProposalPath(slug),
      publishedAt: report.publish?.publishedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "발행 실패";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
