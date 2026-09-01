import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "pdf");
const outputPath = path.join(root, "data", "due-diligence-library.json");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const dateIndex = args.indexOf("--date");
const dateArg = dateIndex >= 0 ? args[dateIndex + 1] : null;
const DOCUMENT_TYPES = ["尽调清单", "营销话术"];
const INDUSTRIES = ["人工智能", "高端制造", "集成电路", "生物医药", "新能源", "化工新材料", "其他行业"];

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function classifyDocument(title) {
  const type = /营销话术|营销拜访指南/.test(title) ? "营销话术" : "尽调清单";
  let industry = "其他行业";
  if (/智能制造/.test(title)) industry = "高端制造";
  else if (/具身智能|人工智能/.test(title)) industry = "人工智能";
  else if (/集成电路|半导体|芯片/.test(title)) industry = "集成电路";
  else if (/创新药|核药|耗材|生物|医养|制药|CXO/.test(title)) industry = "生物医药";
  else if (/新能源|储能|光伏|锂电|风电|氢能/.test(title)) industry = "新能源";
  else if (/化工|新材料/.test(title)) industry = "化工新材料";
  if (!DOCUMENT_TYPES.includes(type) || !INDUSTRIES.includes(industry)) throw new Error(`无法归类尽调文档：${title}`);
  return { type, industry };
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf") files.push(fullPath);
  }
  return files;
}

async function inventory() {
  const files = await walk(sourceDir);
  const documents = await Promise.all(files.map(async filePath => {
    const bytes = await readFile(filePath);
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error(`不是有效 PDF：${path.relative(root, filePath)}`);
    const details = await stat(filePath);
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const title = path.basename(filePath, path.extname(filePath));
    return {
      title,
      file: relativePath,
      ...classifyDocument(title),
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      modifiedAt: details.mtime.toISOString()
    };
  }));
  return documents.sort((a, b) => a.file.localeCompare(b.file, "zh-CN"));
}

const documents = await inventory();
const syncDate = dateArg || formatDate(new Date());
if (!/^\d{4}\.\d{2}\.\d{2}$/.test(syncDate)) throw new Error("更新日期必须为 YYYY.MM.DD");
const next = { syncedAt: syncDate, documentCount: documents.length, documents };

if (checkOnly) {
  const current = JSON.parse(await readFile(outputPath, "utf8"));
  const comparable = { documentCount: current.documentCount, documents: current.documents };
  const expected = { documentCount: next.documentCount, documents: next.documents };
  if (JSON.stringify(comparable) !== JSON.stringify(expected)) throw new Error("/pdf 目录已变化，请运行 npm run due-diligence:sync 更新尽调百宝箱清单");
  console.log(`尽调百宝箱已是最新：${documents.length} 个 PDF`);
} else {
  await writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`已同步尽调百宝箱：${documents.length} 个 PDF`);
}
