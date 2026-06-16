import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import { loadPublishedGallery } from "@/lib/publish/galleryStore";
import "@/styles/gallery.css";
import "@/styles/responsive.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = loadPublishedGallery(slug);
  return {
    title: doc
      ? `CANSPLEX · ${doc.clinicName} 디자인`
      : "CANSPLEX · 디자인 갤러리",
    description: doc?.title ?? "캔즈플렉스 디자인 갤러리",
  };
}

export default async function PublicGalleryPage({ params }: Props) {
  const { slug } = await params;
  const doc = loadPublishedGallery(slug);
  if (!doc) notFound();

  return (
    <LegacyHtmlPage html={doc.html} className="gallery-page gallery-page--public" />
  );
}
