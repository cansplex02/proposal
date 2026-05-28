import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import "@/styles/analysis.css";
import "@/styles/responsive.css";

type Props = { params: Promise<{ slug: string }> };

function loadGeneratedBody(slug: string): string | null {
  const p = path.join(
    process.cwd(),
    "src",
    "content",
    "generated",
    `${slug}-body.html`
  );
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

export async function generateStaticParams() {
  const reportsDir = path.join(process.cwd(), "data", "reports");
  if (!fs.existsSync(reportsDir)) return [];
  return fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ slug: f.replace(/\.json$/, "") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const jsonPath = path.join(process.cwd(), "data", "reports", `${slug}.json`);
  if (!fs.existsSync(jsonPath)) {
    return { title: "CANSPLEX · 경쟁분석 결과" };
  }
  const report = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
    clinicName?: string;
  };
  return {
    title: `${report.clinicName || slug} · 경쟁분석 | CANSPLEX`,
    description: "캔즈플렉스 경쟁분석 리포트",
  };
}

export default async function AnalysisClientPage({ params }: Props) {
  const { slug } = await params;
  const html = loadGeneratedBody(slug);
  if (!html) notFound();

  return <LegacyHtmlPage html={html} className="analysis-page" />;
}
