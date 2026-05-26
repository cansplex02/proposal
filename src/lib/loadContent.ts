import fs from "fs";
import path from "path";

const contentDir = path.join(process.cwd(), "src", "content");

export function loadHtmlFile(filename: string): string {
  return fs.readFileSync(path.join(contentDir, filename), "utf8");
}

export function loadScriptFile(filename: string): string {
  const filePath = path.join(contentDir, filename);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}
