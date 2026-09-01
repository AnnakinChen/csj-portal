---
name: portal-weekly-maintainer
description: 维护长三角金融总部行业研究综合门户的每周内容；严格锁定既有页面模板，仅更新仓库 data，按 PRD 调用 gsdt、hyrd、a-stock-data、rn-wechat-extract、datayes-macro 等项目技能，并生成可发布的单文件 HTML。
---

# 门户周更总控

用于本仓库的常规每周更新。它不授权修改网站样式，也不授权自动推送、合并或发布。

## 先决规则

1. 从仓库根目录完整读取 `AGENTS.md`、`docs/PRD.md` 和 `docs/WEEKLY_UPDATE.md`。PRD 优先级最高。
2. 普通周更只修改 `data/`。`template/`、`template-lock.json`、`baseline/` 和页面视觉交互均保持不变。
3. 开始前和完成后均运行 `npm test`；模板锁失败时停止，不自动更新校验值。

## 数据路由

- 企业动态：使用 `$gsdt`，客户边界为 `data/customer-universe.json`。
- 行业热点：使用 `$hyrd`；研报正文只能使用其规定接口，最终保留合规公开原文。
- 微信公众号：先使用 `$rn-wechat-extract` 读取全文。
- 财务报表与指标：使用 `$a-stock-data`；严禁调用 `fdmt_indi_rtn`、`dmt_indi_lqd`、`fdmt_bs_new_lt`、`fdmt_is_new_lt`。
- 价格指数：按 PRD 使用 `$datayes-macro` 或项目既定脚本；凭据只从环境变量读取。
- Excel：使用 `$spreadsheets` 读取披露时间表和土地附件。
- 公开政策、新闻和官方原文核验：使用 `$agent-reach`，遵守 PRD 来源优先级。

## 完成条件

- 只更新了本周时效数据、日期、来源和链接；没有新增未授权指标或栏目。
- `npm test` 通过并生成 `dist/index.html`。
- 核对手机端、雷达、图表悬停、筛选、土地全名提示和原文链接。
- 向用户列出各数据文件的修改范围、报告期和来源。只有用户明确要求时才提交、推送或发布。
