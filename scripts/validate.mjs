import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPANY_UPDATE_MAX_COMPANIES,
  COMPANY_UPDATE_MAX,
  FALLBACK_CATEGORIES,
  FALLBACK_EXCLUDED_SUBCATEGORIES,
  isFallbackCompanyUpdate,
  isImportantCompanyUpdate,
  sortCompanyUpdates,
} from "./company_update_selection.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "template-lock.json"), "utf8"));

for (const [relativePath, expected] of Object.entries(manifest.files)) {
  const bytes = await readFile(path.join(root, relativePath));
  const actual = createHash("sha256").update(bytes).digest("hex");
  assert.equal(actual, expected, `固定模板发生变化：${relativePath}`);
}

const data = {};
for (const filename of ["content.json", "financials.json", "reference.json", "prices.json"]) {
  const source = await readFile(path.join(root, "data", filename), "utf8");
  assert.doesNotMatch(source, /a261845b|DATAYES_TOKEN\s*=|Authorization\s*:/i, `${filename} 可能包含凭据`);
  data[filename.replace(".json", "")] = JSON.parse(source);
}

const content = data.content;
const dueDiligence = JSON.parse(await readFile(path.join(root, "data", "due-diligence-library.json"), "utf8"));
assert.match(dueDiligence.syncedAt || "", /^\d{4}\.\d{2}\.\d{2}$/, "尽调百宝箱同步日期错误");
assert.equal(dueDiligence.documentCount, dueDiligence.documents?.length, "尽调百宝箱文件数量错误");
assert.ok(dueDiligence.documentCount > 0, "尽调百宝箱缺少 PDF 文件");
const dueDocumentTypes = ["尽调清单", "营销话术"];
const dueIndustries = ["人工智能", "高端制造", "集成电路", "生物医药", "新能源", "化工新材料", "其他行业"];
for (const document of dueDiligence.documents) {
  assert.ok(document.title && document.size > 0, "尽调百宝箱文件信息不完整");
  assert.match(document.file, /^pdf\/.+\.pdf$/i, `尽调百宝箱文件路径无效：${document.title}`);
  assert.ok(dueDocumentTypes.includes(document.type), `尽调百宝箱文档类型错误：${document.title}`);
  assert.ok(dueIndustries.includes(document.industry), `尽调百宝箱行业类型错误：${document.title}`);
  assert.match(document.sha256, /^[a-f0-9]{64}$/i, `尽调百宝箱哈希无效：${document.title}`);
}
assert.ok(content && Array.isArray(content.companyUpdates), "content.js 缺少企业动态");
const customerUniverse = JSON.parse(await readFile(path.join(root, "data", "customer-universe.json"), "utf8"));
const customerCompanies = new Set(customerUniverse.map(item => item.company));
const companyCounts = new Map();
const importantCompanyUpdateCount = content.companyUpdates.filter(isImportantCompanyUpdate).length;
let previousCompanyTier = -1;
let previousCompanyDate = Infinity;
const [reportYear, reportMonth, reportDay] = content.meta.companyUpdatedAt.split(".").map(Number);
const reportTime = Date.UTC(reportYear, reportMonth - 1, reportDay);
for (const item of content.companyUpdates) {
  assert.ok(customerCompanies.has(item.company), `企业动态超出客户池：${item.company}`);
  assert.ok(["重要", "一般"].includes(item.importance), `企业动态重要性无效：${item.company}`);
  const companyTier = isImportantCompanyUpdate(item) ? 0 : 1;
  assert.ok(companyTier >= previousCompanyTier, `企业动态重要记录必须排在一般记录前：${item.company}`);
  if (companyTier !== previousCompanyTier) previousCompanyDate = Infinity;
  previousCompanyTier = companyTier;
  assert.match(item.date, /^\d{2}\.\d{2}$/, `企业动态日期格式错误：${item.company}`);
  const dateValue = Number(item.date.replace(".", ""));
  assert.ok(dateValue <= previousCompanyDate, `企业动态未按日期由近到远排序：${item.company}`);
  previousCompanyDate = dateValue;
  const [month, day] = item.date.split(".").map(Number);
  const itemTime = Date.UTC(reportYear, month - 1, day);
  const daysBeforeReport = (reportTime - itemTime) / 86_400_000;
  assert.ok(daysBeforeReport >= 0 && daysBeforeReport < 7, `企业动态超出滚动近一周窗口：${item.company}`);
  if (isFallbackCompanyUpdate(item)) {
    assert.ok(importantCompanyUpdateCount < 8, "重要企业动态达到8条后不得混入一般兜底记录");
    assert.ok(FALLBACK_CATEGORIES.has(item.newsCategory), `一般兜底一级分类无效：${item.company}`);
    assert.ok(!FALLBACK_EXCLUDED_SUBCATEGORIES.has(item.newsSubcategory), `一般兜底命中排除子分类：${item.company}`);
  } else {
    assert.ok(isImportantCompanyUpdate(item), `一般企业动态未通过兜底规则：${item.company}`);
  }
  companyCounts.set(item.company, (companyCounts.get(item.company) || 0) + 1);
}
assert.ok(content.companyUpdates.length <= COMPANY_UPDATE_MAX, "企业动态超过10条上限");
assert.ok(companyCounts.size <= COMPANY_UPDATE_MAX_COMPANIES, "企业动态企业数超过8家上限");
for (const [company, count] of companyCounts) assert.ok(count <= 2, `同一企业动态超过2条：${company}`);
assert.deepEqual(content.companyUpdates, sortCompanyUpdates(content.companyUpdates), "企业动态未按重要性和日期排序");
assert.ok(Array.isArray(content.industryUpdates), "content.js 缺少行业热点");
assert.ok(Array.isArray(content.policies), "content.js 缺少政策内容");
assert.ok(Array.isArray(content.liveCenter), "content.js 缺少直播中心内容");
assert.equal(content.meta.policyRetention, "长期保留，周报新增", "政策保留规则错误");
for (const item of [...content.companyUpdates, ...content.industryUpdates, ...content.policies]) {
  assert.ok(item.title && item.url, "资讯或政策条目缺少标题/原文链接");
  assert.match(item.url, /^https?:\/\//, `原文链接无效：${item.title}`);
}
const liveCategories = ["人工智能", "高端制造", "集成电路", "生物医药", "新能源", "化工新材料"];
assert.match(content.meta.liveCenterUpdatedAt || "", /^\d{4}\.\d{2}\.\d{2}$/, "直播中心更新日期错误");
assert.deepEqual([...new Set(content.liveCenter.map(item => item.industry))].sort(), [...liveCategories].sort(), "直播中心行业覆盖错误");
assert.equal(new Set(content.liveCenter.map(item => item.url)).size, content.liveCenter.length, "直播中心视频地址重复");
let previousLivePeriod = Infinity;
for (const item of content.liveCenter) {
  assert.ok(item.title && liveCategories.includes(item.industry), "直播中心条目缺少标题或行业错误");
  assert.ok(Number.isInteger(item.period) && item.period > 0, `直播中心期数无效：${item.title}`);
  assert.ok(item.period <= previousLivePeriod, `直播中心未按期数由大到小排序：${item.title}`);
  previousLivePeriod = item.period;
  assert.match(item.url, /^https:\/\/.*\.mp4(?:[?#].*)?$/i, `直播中心视频地址无效：${item.title}`);
}

const reference = data.reference;
assert.ok(reference && Array.isArray(reference.halfYear) && Array.isArray(reference.land), "reference.js 结构错误");
assert.ok(reference.investmentProjectsMeta && Array.isArray(reference.investmentProjects), "reference.js 缺少长三角项目审批动态");
assert.equal(reference.investmentProjectsMeta.total, reference.investmentProjects.length, "项目审批动态数量与元数据不一致");
assert.deepEqual(reference.investmentProjectsMeta.establishTypes, ["审批类", "备案类", "核准类"], "项目立项类型口径错误");
assert.equal(reference.investmentProjectsMeta.projectStage, "不限", "项目阶段不应受限");
const [projectBegin, projectEnd] = reference.investmentProjectsMeta.period.split("—").map(x => x.replaceAll(".", "-"));
assert.equal(reference.investmentProjectsMeta.retention, "滚动近两周", "项目滚动窗口错误");
for (const item of reference.investmentProjects) {
  assert.ok(item["备案日期"] && item["地区"] && item["项目名称"] && item["最新项目阶段"], "项目审批动态缺少必要字段");
  assert.ok(item["备案日期"] >= projectBegin && item["备案日期"] <= projectEnd, `项目超出最近一周窗口：${item["项目名称"]}`);
  assert.ok(["上海市", "江苏省", "浙江省", "安徽省"].some(x => item["地区"].startsWith(x)), `项目超出江浙沪皖范围：${item["项目名称"]}`);
  assert.ok(["审批类", "备案类", "核准类"].includes(item["立项类型"]), `项目立项类型错误：${item["项目名称"]}`);
  assert.ok(Number(item["项目总投资(万元)"]) > 5000, `项目金额未严格超过5000万元：${item["项目名称"]}`);
  assert.ok(Array.isArray(item["项目主体"]), `项目主体结构错误：${item["项目名称"]}`);
  assert.ok(!Object.hasOwn(item, "官方项目代码"), `项目数据不应保留项目代码：${item["项目名称"]}`);
}
const [landBegin, landEnd] = content.meta.landWindow.split("—").map(x => x.replaceAll(".", "-"));
for (const item of reference.land) assert.ok(item["成交日期"] >= landBegin && item["成交日期"] <= landEnd, `土地记录超出滚动近1个月窗口：${item["地块名称"]}`);
const financials = data.financials;
assert.ok(financials && financials.groups, "financials.js 结构错误");
const prices = data.prices;
assert.ok(prices && Array.isArray(prices.series), "prices.js 结构错误");

const output = await readFile(path.join(root, "dist", "index.html"), "utf8");
const baseline = await readFile(path.join(root, "baseline", "2026-08-19-final.html"), "utf8");
const outputStyle = output.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const baselineStyle = baseline.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.equal(outputStyle, baselineStyle, "门户主页面样式与已认可基线不一致");
const typographyContract = [
  [/--type-button-delta:3px/, "按钮字号增量变量缺失"],
  [/--type-paragraph-delta:2px/, "正文字号增量变量缺失"],
  [/--type-card-foot-delta:1px/, "卡片底部字号增量变量缺失"],
  [/\.nav button\{font-size:calc\(13px \+ var\(--type-button-delta\)\)\}/, "导航按钮字号规则缺失"],
  [/\.filters button\{font-size:calc\(11px \+ var\(--type-button-delta\)\)\}/, "筛选按钮字号规则缺失"],
  [/\.metric-tabs button\{font-size:calc\(10px \+ var\(--type-button-delta\)\)\}/, "指标按钮字号规则缺失"],
  [/\.pagination button\{font-size:calc\(10px \+ var\(--type-button-delta\)\)\}/, "分页按钮字号规则缺失"],
  [/\.hero p\{font-size:calc\(16px \+ var\(--type-paragraph-delta\)\)\}/, "首屏正文字号规则缺失"],
  [/\.card p\{font-size:calc\(12px \+ var\(--type-paragraph-delta\)\)\}/, "卡片正文字号规则缺失"],
  [/\.portal-card p\{font-size:calc\(13px \+ var\(--type-paragraph-delta\)\)\}/, "总览卡片正文字号规则缺失"],
  [/\.news-card p\{font-size:calc\(12px \+ var\(--type-paragraph-delta\)\)\}/, "资讯正文字号规则缺失"],
  [/\.card-foot\{font-size:calc\(10px \+ var\(--type-card-foot-delta\)\)\}/, "卡片底部字号规则缺失"],
  [/@media\(max-width:650px\)\{\.hero p\{font-size:calc\(14px \+ var\(--type-paragraph-delta\)\)\}\}/, "移动端首屏正文字号规则缺失"],
];
for (const [pattern, message] of typographyContract) assert.match(outputStyle || "", pattern, message);

const baselineRadarEncoded = baseline.match(/srcdoc="([\s\S]*?)"><\/iframe>/)?.[1];
assert.ok(baselineRadarEncoded, "基线中缺少雷达组件");
const baselineRadar = baselineRadarEncoded
  .replaceAll("&quot;", '"')
  .replaceAll("&#x27;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&amp;", "&");
const currentRadar = await readFile(path.join(root, "template", "radar-scan.html"), "utf8");
const normalizeCss = (value) => value.match(/<style>([\s\S]*?)<\/style>/)?.[1].replace(/\s+/g, " ").trim();
assert.equal(normalizeCss(currentRadar), normalizeCss(baselineRadar), "雷达样式与已认可基线不一致");
assert.match(currentRadar, /\{ x: 18, y: 22, w: 275, h: 82 \}/, "雷达状态区避让规则发生变化");

assert.match(output, /长三角金融总部行业研究小组✖️长三角金融总部行业研究综合门户/);
assert.match(output, /srcdoc="&lt;!DOCTYPE html&gt;/);
assert.match(output, /长三角项目审批动态/);
assert.match(output, /id="projectTable"/);
assert.match(output, /<th>备案日期<\/th><th>地区<\/th><th>项目名称<\/th><th>总投资\(万元\)<\/th><th>项目主体<\/th><th>国标行业一级<\/th><th>最新项目阶段<\/th>/);
assert.doesNotMatch(output, /项目名称 \/ 代码/);
for (const id of ["projectInvestment", "projectIndustry", "projectStage"]) assert.match(output, new RegExp(`id="${id}"`), `项目筛选器缺失：${id}`);
for (const label of ["5000万元—1亿元", "1亿元—5亿元", "5亿元以上"]) assert.match(output, new RegExp(label), `投资金额区间缺失：${label}`);
for (const id of ["policyPagination", "projectPagination", "landPagination"]) assert.match(output, new RegExp(`id="${id}"`), `分页容器缺失：${id}`);
assert.match(output, /POLICY_PAGE_SIZE=6,TABLE_PAGE_SIZE=30/, "分页条数配置错误");
assert.match(output, /<td>\$\{x\['国标行业一级'\]\|\|''\}<\/td>/, "国标行业缺失值应显示为空白");
assert.match(output, /data-pager="next"/, "分页按钮缺少独立标识");
assert.match(output, /querySelectorAll\('\.nav \[data-page\]'\)/, "一级页面导航监听范围过宽");
assert.match(output, /<button data-page="live">直播中心<\/button>/, "直播中心一级导航缺失");
assert.match(output, /<section id="live" class="page">/, "直播中心独立页面缺失");
assert.match(output, /<article class="card portal-card" data-go="live"/, "总览直播中心入口缺失");
for (const id of ["liveFilters", "liveVideoGrid"]) assert.match(output, new RegExp(`id="${id}"`), `直播中心容器缺失：${id}`);
assert.match(output, /第\$\{item\.period\}期/, "直播中心未显示视频期数");
assert.match(output, /\.sort\(\(a,b\)=>b\.period-a\.period\)/, "直播中心未按期数倒序展示");
assert.match(output, /policyDateValue\(b\.meta\)-policyDateValue\(a\.meta\)/, "政策解读未按日期倒序展示");
assert.match(output, /\[\.\.\.\(x\.data\|\|\[\]\)\]\.sort\(\(a,b\)=>String\(a\.date\)\.localeCompare\(String\(b\.date\)\)\)/, "价格图表未按日期正序绘制");
for (const id of ["dueDiligenceGrid", "dueDiligenceZip", "dueDiligenceAllZip", "dueDiligenceUpdatedAt", "dueDiligenceTypeFilters", "dueDiligenceIndustryFilters", "dueDiligenceClearAll"]) assert.match(output, new RegExp(`id="${id}"`), `尽调百宝箱容器缺失：${id}`);
assert.match(output, /id="dueDiligenceGate"/, "尽调百宝箱登录入口缺失");
assert.match(output, /id="dueDiligenceSection" hidden/, "尽调百宝箱初始状态必须隐藏");
assert.match(output, /id="dueDiligenceLoginButton"/, "尽调百宝箱登录按钮缺失");
assert.match(output, /dueDiligenceGate\.hidden=Boolean\(user\);dueDiligenceSection\.hidden=!user/, "尽调百宝箱未按登录状态切换显示");
assert.match(output, /session\.authenticated\?\{username:session\.username,role:session\.role\}:null/, "登录状态未对接认证服务");
for (const label of [...dueDocumentTypes, ...dueIndustries]) assert.match(output, new RegExp(label), `尽调百宝箱筛选项缺失：${label}`);
assert.match(output, /selectedDueTypes=new Set\(DUE_DOCUMENT_TYPES\)/, "尽调百宝箱文档类型筛选未默认全选");
assert.match(output, /selectedDueIndustries=new Set\(DUE_INDUSTRIES\)/, "尽调百宝箱行业类型筛选未默认全选");
assert.match(output, /selectedDueTypes\.has\(document\.type\)&&selectedDueIndustries\.has\(document\.industry\)/, "尽调百宝箱未同时应用两层筛选");
assert.match(output, /一键取消全选/, "尽调百宝箱缺少一键取消全选入口");
assert.match(output, /selectedDueTypes\.clear\(\);selectedDueIndustries\.clear\(\)/, "尽调百宝箱一键取消全选未同时清空两层筛选");
assert.match(output, /一键全部打包下载/, "尽调百宝箱缺少一键全部打包下载入口");
assert.match(output, /尽调百宝箱/, "尽调百宝箱标题缺失");
assert.match(output, /打包下载/, "尽调百宝箱批量下载缺失");
assert.match(output, /下载 PDF/, "尽调百宝箱单文件下载缺失");
assert.doesNotMatch(output, /<button type="button" data-page="(?:prev|next)"/, "分页按钮不得复用一级导航标识");
assert.doesNotMatch(output, /PORTAL_DATA:/);
assert.doesNotMatch(output, /src="radar-scan\.html"/);
console.log("模板锁定、数据结构、链接、凭据和单文件构建检查通过");
