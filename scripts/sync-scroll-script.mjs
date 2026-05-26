import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const parent = path.join(root, "CANSPLEX_GEO_Proposal_full.html");
const scriptPath = path.join(root, "proposal/src/content/proposal-script.js");

const script = fs.readFileSync(scriptPath, "utf8");
const start = script.indexOf("  // ===== 휠 1회");
const end = script.indexOf("  })();", start) + "  })();".length;
const scrollBlock = script.slice(start, end);

let html = fs.readFileSync(parent, "utf8");
const htmlStart = html.indexOf("  // ===== 휠 1회");
const htmlEnd = html.indexOf("  })();", htmlStart) + "  })();".length;
if (htmlStart < 0 || htmlEnd < htmlStart) throw new Error("scroll block not found in parent");

html = html.slice(0, htmlStart) + scrollBlock + html.slice(htmlEnd);
fs.writeFileSync(parent, html);
console.log("Synced scroll script to parent HTML");
