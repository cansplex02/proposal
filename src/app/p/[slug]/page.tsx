import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import { loadHtmlFile, loadScriptFile } from "@/lib/loadContent";
import { buildClientProposalHtml } from "@/lib/publish/buildProposalHtml";
import {
  loadDraftReport,
  loadPublishedReport,
} from "@/lib/publish/reportStore";
import "@/styles/proposal.css";
import "@/styles/responsive.css";
import "@/styles/responsive-proposal-sections.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const report = loadPublishedReport(slug) ?? loadDraftReport(slug);
  return {
    title: report
      ? `CANSPLEX · ${report.clinicName || slug} 제안서`
      : "CANSPLEX · GEO 제안서",
    description: "캔즈플렉스 GEO 제안서",
  };
}

export default async function ClientProposalPage({ params }: Props) {
  const { slug } = await params;
  const report = loadPublishedReport(slug) ?? loadDraftReport(slug);
  if (!report) notFound();

  const baseHtml = loadHtmlFile("proposal-body.html");
  const html = buildClientProposalHtml(baseHtml, {
    slug,
    clinicName: report.clinicName,
  });
  const script = loadScriptFile("proposal-script.js");

  return (
    <LegacyHtmlPage html={html} script={script} className="proposal-page" />
  );
}
