import { NextResponse } from "next/server";
import { adminUnauthorizedResponse, isAdminAuthorized } from "@/lib/publish/auth";
import { loadDraftGallery, saveDraftGallery } from "@/lib/publish/galleryStore";
import type { GalleryDocument } from "@/lib/publish/types";

export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params;
  const doc = loadDraftGallery(slug);
  if (!doc) {
    return NextResponse.json({ error: "갤러리 없음" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, gallery: doc });
}

export async function PUT(req: Request, { params }: Props) {
  if (!isAdminAuthorized(req)) return adminUnauthorizedResponse();

  const { slug } = await params;
  let body: Partial<GalleryDocument>;
  try {
    body = (await req.json()) as Partial<GalleryDocument>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = loadDraftGallery(slug);
  const doc: GalleryDocument = {
    slug,
    clinicName: body.clinicName?.trim() || existing?.clinicName || slug,
    title: body.title?.trim() || existing?.title || "디자인 갤러리",
    html: body.html ?? existing?.html ?? "",
    publish: existing?.publish ?? { status: "draft" },
  };

  if (!doc.html.trim()) {
    return NextResponse.json({ error: "html 필수" }, { status: 400 });
  }

  const saved = saveDraftGallery(doc);
  return NextResponse.json({ ok: true, gallery: saved });
}
