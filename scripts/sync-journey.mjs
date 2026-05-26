import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const parent = path.join(root, "CANSPLEX_GEO_Proposal_full.html");
const body = path.join(root, "proposal/src/content/proposal-body.html");

const b = fs.readFileSync(body, "utf8");
const startMark = '<div class="method-step-visual method-step-visual--journey">';
const endMark = "    </div>\n  </div>\n</section>\n\n<!-- ============ METHOD STEP 04";

const i0 = b.indexOf(startMark);
const i1 = b.indexOf(endMark, i0);
if (i0 < 0 || i1 < 0) throw new Error("markers not found in proposal-body");

const newBlock = b.slice(i0, i1 + "    </div>".length);

let p = fs.readFileSync(parent, "utf8");
const m03 = p.indexOf('id="method-03"');
const visStart = p.indexOf('    <div class="method-step-visual">', m03);
const visEnd = p.indexOf(endMark, visStart);
if (visStart < 0 || visEnd < 0) throw new Error("visual block not found in parent");

p = p.slice(0, visStart) + newBlock + p.slice(visEnd + "    </div>".length);
fs.writeFileSync(parent, p);
console.log("Synced journey block to CANSPLEX_GEO_Proposal_full.html");
