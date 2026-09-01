export const COMPANY_UPDATE_TARGET = 8;
export const COMPANY_UPDATE_MAX = 10;
export const COMPANY_UPDATE_MAX_COMPANIES = 8;

export const FALLBACK_CATEGORIES = new Set(["公司经营", "资本运作"]);
export const FALLBACK_EXCLUDED_SUBCATEGORIES = new Set([
  "A级纳税人",
  "工商变更",
  "授信情况",
  "关联交易",
  "投资理财",
  "利润分配",
  "知识产权",
  "政府补贴",
  "应收账款大幅增加",
  "公司授信额度变化",
  "担保",
  "股权质押",
  "解除质押",
]);

const dateValue = (value) => {
  const match = String(value || "").match(/^(?:\d{4}[.-])?(\d{2})[.-](\d{2})$/);
  return match ? Number(`${match[1]}${match[2]}`) : 0;
};

export function isImportantCompanyUpdate(item) {
  return item?.importance === "重要";
}

export function isFallbackCompanyUpdate(item) {
  return item?.importance === "一般"
    && FALLBACK_CATEGORIES.has(item.newsCategory)
    && !FALLBACK_EXCLUDED_SUBCATEGORIES.has(item.newsSubcategory)
    && /^https?:\/\//i.test(item.url || "");
}

export function compareCompanyUpdates(a, b) {
  const tierA = isImportantCompanyUpdate(a) ? 0 : 1;
  const tierB = isImportantCompanyUpdate(b) ? 0 : 1;
  return tierA - tierB || dateValue(b.date) - dateValue(a.date);
}

export function sortCompanyUpdates(items) {
  return [...items].sort(compareCompanyUpdates);
}

export function shuffleCustomers(customers, random = Math.random) {
  const shuffled = [...customers];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const candidate = Number(random());
    const position = Math.min(index, Math.max(0, Math.floor(candidate * (index + 1))));
    [shuffled[index], shuffled[position]] = [shuffled[position], shuffled[index]];
  }
  return shuffled;
}

export function buildFallbackQueryOrder(customers, importantItems, random = Math.random) {
  const importantCompanies = new Set(importantItems.map(item => item.company));
  return shuffleCustomers(
    customers.filter(customer => !importantCompanies.has(customer.company)),
    random,
  );
}

export function buildCompanyNewsQuery(customer, {
  publishDate,
  importance,
  limit = 50,
  offset = 0,
} = {}) {
  return {
    target_company: [customer.code || customer.company],
    publish_date: publishDate,
    importance: [importance],
    limit,
    offset,
  };
}

export function selectCompanyUpdates({
  importantItems = [],
  generalItems = [],
  target = COMPANY_UPDATE_TARGET,
  max = COMPANY_UPDATE_MAX,
  random = Math.random,
} = {}) {
  const selected = [];
  const selectedUrls = new Set();
  const companyCounts = new Map();
  const add = (item) => {
    if (selected.length >= max || !item?.company || !item?.title || !item?.url) return;
    if (selectedUrls.has(item.url)) return;
    const count = companyCounts.get(item.company) || 0;
    if (count >= 2) return;
    selected.push(item);
    selectedUrls.add(item.url);
    companyCounts.set(item.company, count + 1);
  };

  for (const item of sortCompanyUpdates(importantItems.filter(isImportantCompanyUpdate))) add(item);
  if (selected.length >= target) return sortCompanyUpdates(selected).slice(0, max);

  for (const item of shuffleCustomers(generalItems.filter(isFallbackCompanyUpdate), random)) {
    if (new Set(selected.map(entry => entry.company)).size >= COMPANY_UPDATE_MAX_COMPANIES) break;
    add(item);
    if (selected.length >= target) break;
  }
  return sortCompanyUpdates(selected).slice(0, max);
}
