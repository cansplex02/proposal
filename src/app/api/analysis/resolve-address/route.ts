import { NextResponse } from "next/server";
import { resolveAddressFromClinicName } from "@/lib/analysis/naverLocalSearch";
import { isNaverOpenSearchConfigured } from "@/lib/analysis/naverOpenSearch";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { clinicName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clinicName = body.clinicName?.trim();
  if (!clinicName) {
    return NextResponse.json({ error: "clinicName 필수" }, { status: 400 });
  }

  if (!isNaverOpenSearchConfigured()) {
    return NextResponse.json(
      { error: "NAVER_OPEN_API_CLIENT_ID·SECRET 미설정" },
      { status: 503 }
    );
  }

  try {
    const address = await resolveAddressFromClinicName(clinicName);
    return NextResponse.json({ address });
  } catch (e) {
    const message = e instanceof Error ? e.message : "주소 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
