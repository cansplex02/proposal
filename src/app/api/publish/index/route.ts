import { NextResponse } from "next/server";
import { loadGalleriesIndex } from "@/lib/publish/galleryStore";
import { loadReportsIndex } from "@/lib/publish/reportStore";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    reports: loadReportsIndex(),
    galleries: loadGalleriesIndex(),
  });
}
