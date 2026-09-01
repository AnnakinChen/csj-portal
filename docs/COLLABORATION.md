# 你和同事如何用 Codex + GitHub 共同维护

## 一次性准备

1. 仓库所有者在 GitHub 仓库的 `Settings → Collaborators` 邀请同事；同事接受邀请后才有推送权限。
2. 两人第一次都让 Codex 按 `docs/SETUP.md` 检查 Git、Node.js、Python、项目 Skills 和账号型连接器，并登录各自 GitHub 账号。
3. 两人都让 Codex 把同一个仓库克隆到本地，不要互相传不同 ZIP 作为长期工作副本。
4. 按 `skills/README.md` 安装仓库内项目 Skills；安装后新开一个 Codex 任务使其生效。
5. 仓库所有者在 `Settings → Pages` 将发布来源设为 `GitHub Actions`。以后合并到 `main` 会自动构建并发布。

## 同事第一次可直接对 Codex 说

> 请把 GitHub 仓库 zyp9543/csj-insight-portal 克隆到我的桌面。完整阅读 AGENTS.md、docs/PRD.md、docs/COLLABORATION.md，并按 skills/README.md 安装项目 Skills。不要修改网站模板。运行 npm test，告诉我本地项目是否与固定模板一致。

公开仓库可直接克隆；推送时必须使用已被邀请的 GitHub 账号。Codex 可以完成拉取、建分支、检查、提交和推送，但合并到 `main` 前仍应由另一人复核。

## 每周双人协作

1. 本周编辑人先拉取最新 `main`，创建 `weekly/YYYY-MM-DD-姓名` 分支。
2. Codex 只更新 `data/`，运行自动验收并生成 `dist/index.html`。
3. 编辑人推送分支并创建 Pull Request。
4. 另一人在 GitHub 查看“Files changed”和自动检查：正常周更不应出现 `template/` 变更。
5. 审核通过后合并；GitHub Pages 自动发布统一成品。
6. 两人下次开始前都先拉取最新 `main`，避免各自版本分叉。

## 为什么两台电脑能原样复刻

- 页面只来自同一个 `template/`，且校验值由 `template-lock.json` 固定。
- 两人使用同一个客户池、同一 PRD、同一数据结构和同一 Skills。
- 构建脚本无第三方网页依赖，会把模板、雷达和数据合并成同一个单文件 HTML。
- 自动检查会阻止未经授权的模板变化和明显的数据/链接错误。

GitHub 不会拖慢网站。浏览者只加载构建后的 `dist/index.html`；仓库里的 PRD、历史基线、Skills 和脚本不会被网页下载。GitHub 只影响你们提交和同步文件的时间。
