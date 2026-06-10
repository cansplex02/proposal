import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { AnalysisReport } from "@/lib/analysis/types";

export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params;
  const p = path.join(process.cwd(), "data", "reports", `${slug}.json`);
  if (!fs.existsSync(p)) {
    return NextResponse.json({ error: "리포트 없음" }, { status: 404 });
  }

  const report = JSON.parse(fs.readFileSync(p, "utf8")) as AnalysisReport;
  const rivalCount =
    report.search?.competitors?.filter((c) => !c.isOurs).length ?? 0;

  return NextResponse.json({
    ok: true,
    slug: report.slug,
    search: report.search ?? null,
    rivalCount,
    searchKeyword: report.search?.meta?.mapQuery ?? null,
  });
}
