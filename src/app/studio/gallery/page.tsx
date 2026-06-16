import type { Metadata } from "next";
import GalleryStudio from "@/components/GalleryStudio";
import "@/styles/gallery.css";
import "@/styles/studio.css";
import "@/styles/responsive.css";

export const metadata: Metadata = {
  title: "CANSPLEX · 디자인 갤러리 작업실",
  description: "디자인 갤러리 편집·발행",
};

type Props = { searchParams: Promise<{ admin?: string; slug?: string }> };

export default async function GalleryStudioPage({ searchParams }: Props) {
  const { admin, slug } = await searchParams;
  return (
    <div className="gallery-page gallery-page--studio">
      <GalleryStudio
        initialSlug={slug ?? ""}
        showAdminSecret={admin === "1"}
      />
    </div>
  );
}
