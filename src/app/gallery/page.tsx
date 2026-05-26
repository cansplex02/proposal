import type { Metadata } from "next";
import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import { loadHtmlFile } from "@/lib/loadContent";
import "@/styles/gallery.css";
import "@/styles/responsive.css";

export const metadata: Metadata = {
  title: "CANSPLEX · 디자인 갤러리",
  description: "캔즈플렉스 디자인 갤러리",
};

export default function GalleryPage() {
  const html = loadHtmlFile("gallery-body.html");
  return <LegacyHtmlPage html={html} className="gallery-page" />;
}
