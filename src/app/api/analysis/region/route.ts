import { NextResponse } from "next/server";
import { buildRegionReport, regionReportSummary } from "@/lib/analysis/buildRegionReport";
import { renderRegionDemographicsMarketHtml } from "@/lib/analysis/renderHtml";

export const runtime = "nodejs";
export const maxDuration = 120;
export const preferredRegion = "icn1";

export async function POST(req: Request) {
  let body: { address?: string; radiusMeters?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = body.address?.trim();
  if (!address) {
    return NextResponse.json(
      { error: "address(주소·장소명) 필수" },
      { status: 400 }
    );
  }

  const radiusMeters = body.radiusMeters ?? 1500;

  try {
    const report = await buildRegionReport({ address, radiusMeters });
    const demographicsMarketHtml = renderRegionDemographicsMarketHtml(report);
    const summary = regionReportSummary(report);

    return NextResponse.json({
      ok: true,
      resolvedAddress: report.address,
      radiusKm: report.radiusKm,
      coordinates: report.coordinates,
      population: report.population,
      market: report.market,
      demographicsMarketHtml,
      summary,
      warnings: report.meta?.warnings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "인구·상권 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
