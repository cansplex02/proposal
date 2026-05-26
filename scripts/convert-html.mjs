/**
 * Converts legacy CANSPLEX HTML files into Next.js-ready assets.
 * Run from proposal: node scripts/convert-html.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "..");

const PAGES = [
  {
    id: "proposal",
    source: "CANSPLEX_GEO_Proposal_full.html",
    styleOut: "src/styles/proposal.css",
    bodyOut: "src/content/proposal-body.html",
    scriptOut: "src/content/proposal-script.js",
    headScript: true,
  },
  {
    id: "gallery",
    source: "CANSPLEX_Design_Gallery.html",
    styleOut: "src/styles/gallery.css",
    bodyOut: "src/content/gallery-body.html",
  },
  {
    id: "analysis",
    source: "CANSPLEX_Analysis_Sample.html",
    styleOut: "src/styles/analysis.css",
    bodyOut: "src/content/analysis-body.html",
  },
];

function readHtml(filename) {
  return fs.readFileSync(path.join(SOURCE, filename), "utf8");
}

function extractStyle(html) {
  const match = html.match(/<style>([\s\S]*?)<\/style>/i);
  return match ? match[1].trim() : "";
}

function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) throw new Error("No <body> found");
  let body = match[1];
  body = body.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
  return body;
}

function extractScripts(html) {
  const scripts = [];
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const content = m[1].trim();
    if (content) scripts.push(content);
  }
  return scripts;
}

function extractHeadScript(html) {
  const match = html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/i);
  return match ? match[1].trim() : "";
}

function transformHtml(html) {
  return (
    html
      .replace(/\.\/CANSPLEX_GEO_Proposal_full\.html/g, "/")
      .replace(/\.\/CANSPLEX_Design_Gallery\.html/g, "/gallery")
      .replace(/\.\/CANSPLEX_Analysis_Sample\.html/g, "/analysis")
      .replace(/\.\/gallery_images\//g, "/gallery/")
      .replace(/target="_blank"/g, "")
  );
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyGalleryImages() {
  const destDir = path.join(ROOT, "public", "gallery");
  fs.mkdirSync(destDir, { recursive: true });
  for (let i = 1; i <= 6; i++) {
    const num = String(i).padStart(2, "0");
    const src = path.join(SOURCE, `gallery_${num}.jpg`);
    const dest = path.join(destDir, `gallery_${num}.jpg`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  copied gallery_${num}.jpg`);
    }
  }
}

console.log("Converting HTML → Next.js assets...\n");

for (const page of PAGES) {
  console.log(`→ ${page.id}`);
  const html = readHtml(page.source);
  const style = extractStyle(html);
  const body = transformHtml(extractBody(html));

  ensureDir(path.join(ROOT, page.styleOut));
  fs.writeFileSync(path.join(ROOT, page.styleOut), style, "utf8");
  ensureDir(path.join(ROOT, page.bodyOut));
  fs.writeFileSync(path.join(ROOT, page.bodyOut), body, "utf8");

  if (page.scriptOut) {
    const scripts = extractScripts(html);
    const headScript = page.headScript ? extractHeadScript(html) : "";
    const combined = [headScript, ...scripts].filter(Boolean).join("\n\n");
    ensureDir(path.join(ROOT, page.scriptOut));
    fs.writeFileSync(path.join(ROOT, page.scriptOut), combined, "utf8");
  }

  console.log(`  ${page.styleOut}`);
  console.log(`  ${page.bodyOut}`);
}

console.log("\n→ gallery images");
copyGalleryImages();
console.log("\nDone.");
