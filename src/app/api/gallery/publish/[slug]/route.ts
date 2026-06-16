import { NextResponse } from "next/server";
import { adminUnauthorizedResponse, isAdminAuthorized } from "@/lib/publish/auth";
import { publicGalleryPath } from "@/lib/publish/paths";
import { publishGallery } from "@/lib/publish/galleryStore";

export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Props) {
  if (!isAdminAuthorized(req)) return adminUnauthorizedResponse();

  const { slug } = await params;
  try {
    const gallery = publishGallery(slug);
    return NextResponse.json({
      ok: true,
      slug: gallery.slug,
      publicPath: publicGalleryPath(slug),
      publishedAt: gallery.publish?.publishedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "발행 실패";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
