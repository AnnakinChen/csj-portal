import { copyFile, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "template", "index.template.html");
const outputPath = path.join(root, "dist", "index.html");

let html = await readFile(templatePath, "utf8");

const datasets = {
  content: "PORTAL_CONTENT",
  financials: "FINANCIAL_DATA",
  reference: "REFERENCE_DATA",
  prices: "PRICE_DATA",
  "due-diligence-library": "DUE_DILIGENCE_LIBRARY"
};

for (const [name, globalName] of Object.entries(datasets)) {
  const source = await readFile(path.join(root, "data", `${name}.json`), "utf8");
  JSON.parse(source);
  const marker = `<!-- PORTAL_DATA:${name} -->`;
  if (!html.includes(marker)) throw new Error(`模板缺少数据入口：${marker}`);
  html = html.replace(marker, `<script>\nwindow.${globalName} = ${source.trim()};\n</script>`);
}

const radar = await readFile(path.join(root, "template", "radar-scan.html"), "utf8");
const escapedRadar = radar
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const radarTag = 'src="radar-scan.html"';
if (!html.includes(radarTag)) throw new Error("模板缺少雷达入口");
html = html.replace(radarTag, `srcdoc="${escapedRadar}"`);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");

const dueDiligence = JSON.parse(await readFile(path.join(root, "data", "due-diligence-library.json"), "utf8"));
for (const document of dueDiligence.documents) {
  const sourcePath = path.join(root, ...document.file.split("/"));
  const targetPath = path.join(root, "dist", ...document.file.split("/"));
  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}
console.log(outputPath);
