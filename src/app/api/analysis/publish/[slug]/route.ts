import { NextResponse } from "next/server";
import { adminUnauthorizedResponse, isAdminAuthorized } from "@/lib/publish/auth";
import { publicProposalPath } from "@/lib/publish/paths";
import { publishReport } from "@/lib/publish/reportStore";

export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Props) {
  if (!isAdminAuthorized(req)) return adminUnauthorizedResponse();

  const { slug } = await params;
  try {
    const report = publishReport(slug);
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
