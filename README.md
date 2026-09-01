# 长三角金融总部行业研究综合门户

这是周报网站的团队协作项目。页面模板已经冻结；每周只更新 `data/`，构建后得到可直接部署或发送的单文件网页 `dist/index.html`。

## 没有代码基础，请先看

[从这里开始](START_HERE.md) 提供了可直接复制给 Codex 的提示词。你们不需要手动运行命令或编辑 JSON；让 Codex 完成即可。

## 项目规则文件

1. [产品与取数规则](docs/PRD.md) — 最高优先级。
2. [每周更新手册](docs/WEEKLY_UPDATE.md) — 每周照此执行。
3. [两人协作说明](docs/COLLABORATION.md) — GitHub 与 Codex 的使用方式。
4. [新电脑一次性准备](docs/SETUP.md) — 让 Codex 自动检查环境和连接器。

## 项目结构

- `template/`：固定页面模板和雷达，普通周更禁止修改。
- `data/`：每周更新区；企业/行业/政策、财务、价格、土地和披露数据均在这里。
- `skills/`：项目相关 Codex Skills，供新电脑安装。
- `scripts/`：生成单文件网页和自动验收。
- `dist/index.html`：构建出的最新成品。
- `baseline/`：2026-08-19 已认可成品，仅供对照。
- `docs/`：PRD、周更、协作和开发规范。

## 在 Codex 中的固定说法

> 先阅读 AGENTS.md 和 docs/PRD.md。保持 template 完全不变，仅按 PRD 更新本周 data，完成后运行 npm test，生成 dist/index.html，并列出变更的数据、日期和来源。

本项目不需要安装网页框架或第三方前端依赖，只需要 Node.js 20 或更高版本。A 股取数的本机依赖单列在 `requirements-weekly.txt`，由 Codex 在需要时安装。首次检查与以后每次周更均让 Codex 运行：

```bash
npm test
```

技能文件不会被网页加载，也不会增加网站访问速度或页面体积。
