import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const parent = path.join(root, "CANSPLEX_GEO_Proposal_full.html");
const body = path.join(root, "proposal/src/content/proposal-body.html");
const script = path.join(root, "proposal/src/content/proposal-script.js");

let parentHtml = fs.readFileSync(parent, "utf8");
const bodyHtml = fs.readFileSync(body, "utf8");
const scriptJs = fs.readFileSync(script, "utf8");

const heroStartInBody = bodyHtml.indexOf("<!-- ============ HERO");
if (heroStartInBody < 0) throw new Error("hero not found in proposal-body");

const heroStartInParent = parentHtml.indexOf("<!-- ============ HERO");
const scriptStartInParent = parentHtml.indexOf("<script>", heroStartInParent);
if (heroStartInParent < 0 || scriptStartInParent < 0) {
  throw new Error("hero or script block not found in parent HTML");
}

parentHtml =
  parentHtml.slice(0, heroStartInParent) +
  bodyHtml.slice(heroStartInBody) +
  "\n\n" +
  parentHtml.slice(scriptStartInParent);

const scrollStart = scriptJs.indexOf("  // ===== 휠 1회");
const scrollEnd = scriptJs.lastIndexOf("  })();") + "  })();".length;
if (scrollStart < 0) throw new Error("scroll block not found in proposal-script");
const scrollBlock = scriptJs.slice(scrollStart, scrollEnd);

const inlineScriptStart = parentHtml.indexOf("<script>", heroStartInParent);
const inlineScriptEnd = parentHtml.indexOf("</script>", inlineScriptStart);
const inlineScript = parentHtml.slice(inlineScriptStart, inlineScriptEnd);
const pScrollStart = inlineScript.indexOf("  // ===== 휠 1회");
const pScrollEnd = inlineScript.lastIndexOf("  })();") + "  })();".length;
if (pScrollStart < 0) throw new Error("scroll block not found in parent script");

parentHtml =
  parentHtml.slice(0, inlineScriptStart) +
  inlineScript.slice(0, pScrollStart) +
  scrollBlock +
  inlineScript.slice(pScrollEnd) +
  parentHtml.slice(inlineScriptEnd);

fs.writeFileSync(parent, parentHtml);
console.log("Synced proposal-body + wheel script to parent HTML");
