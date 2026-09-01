# 从这里开始（无需代码基础）

你和同事不需要手动改代码。把下面对应的一段话完整交给 Codex 即可。

## 第一次拿到项目

> 这是长三角金融总部行业研究综合门户项目。请先完整阅读 AGENTS.md、docs/PRD.md、docs/COLLABORATION.md、docs/SETUP.md 和 skills/README.md。检查本机是否安装项目需要的 Skills、运行环境与连接器；缺失的按 docs/SETUP.md 处理。不要修改 template。运行项目自动检查，生成 dist/index.html，并用通俗语言告诉我项目是否完整、我下一步该做什么。

## 每周更新网站

> 请按固定模板更新本周网站。先完整阅读 AGENTS.md、docs/PRD.md 和 docs/WEEKLY_UPDATE.md，并使用 portal-weekly-maintainer。严格沿用 PRD 原始取数规则，只更新 data 中的时效内容、日期、来源和链接，保持 template、样式、布局、响应式和交互原封不动。完成后自动检查并生成 dist/index.html；先把内容变更摘要和发现的问题给我确认，不要自行合并 main。

## 审核同事做的周更

> 请审核当前 Pull Request。先阅读 AGENTS.md 和 docs/PRD.md，重点确认 template 没有变化、普通周更只修改 data、企业和行业内容符合既定客户池与六行业规则、财务未调用被禁止的通联接口、来源和链接可核验。运行自动检查，按“可合并 / 需修改”给我结论，不要自行合并。

## 需要修改样式时

只有你明确决定改版时才使用：

> 这次我明确授权修改网站样式，具体要求是：……。修改前先备份当前模板并说明影响；修改后同步更新 PRD、template-lock.json 和基线说明，完成桌面端与手机端检查。除我明确提出的部分外，其余视觉和功能保持不变。

## 最重要的三条

1. 每次都从 GitHub 最新 `main` 开始，不长期使用别人发来的旧 ZIP。
2. 普通周更不改 `template/`；Codex 自动检查会守住这一点。
3. Token、Cookie 和密码不发到 GitHub，也不写进项目文件。
