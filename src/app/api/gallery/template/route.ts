import { NextResponse } from "next/server";
import { loadHtmlFile } from "@/lib/loadContent";

export const runtime = "nodejs";

export async function GET() {
  const html = loadHtmlFile("gallery-body.html");
  return NextResponse.json({ ok: true, html });
}
