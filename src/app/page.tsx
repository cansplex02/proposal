import LegacyHtmlPage from "@/components/LegacyHtmlPage";
import { loadHtmlFile, loadScriptFile } from "@/lib/loadContent";
import "@/styles/proposal.css";
import "@/styles/responsive.css";
import "@/styles/responsive-proposal-sections.css";

export default function ProposalPage() {
  const html = loadHtmlFile("proposal-body.html");
  const script = loadScriptFile("proposal-script.js");

  return (
    <LegacyHtmlPage html={html} script={script} className="proposal-page" />
  );
}
