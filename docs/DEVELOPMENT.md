# 开发规范与优先级

## 优先级

出现冲突时依次服从：

1. `docs/PRD.md`
2. `AGENTS.md`
3. `docs/WEEKLY_UPDATE.md`
4. `docs/DATA_SCHEMA.md`
5. `data/`
6. `template/` 与 `scripts/`

## 固定模板

- `template/index.template.html` 与 `template/radar-scan.html` 组成唯一页面模板。
- `template-lock.json` 保存模板校验值；普通周更一旦改动模板，`npm test` 必须失败。
- `baseline/2026-08-19-final.html` 是用户认可的旧成品对照，不参与构建，不得修改。
- 普通周更不得重新设计、重构页面或替换渲染方式。

## 数据与成品

- 时效内容全部位于 `data/`，字段说明见 `docs/DATA_SCHEMA.md`。
- `npm run build` 将模板、雷达和数据内嵌为 `dist/index.html`。
- `npm test` 同时检查模板锁、数据结构、原文链接、敏感凭据和单文件构建结果。

## 凭据

- Token、Cookie、账号密码只放在本机环境变量或 Codex 连接器中。
- 禁止提交 `.env`、截图中的 Token、浏览器 Cookie 或含凭据的日志。
- 项目文件和 Skills 均不得包含用户的 Datayes Token。

## 尽调百宝箱认证

- 页面未登录时只显示登录入口，成功登录后再渲染文件清单。
- `../reusable-auth` 是本门户的 Cloudflare Worker 认证服务；其静态资源目录指向本项目的 `dist/`，并保护 `/pdf/` 下的文件。
- 部署前先在本项目运行 `npm run build`，再按 `../reusable-auth/README.md` 配置 D1、账户和 `AUTH_ENCRYPTION_KEY`。私密账号配置与生成的 SQL 均不可提交。

## Git 提交

- 普通周更分支命名：`weekly/YYYY-MM-DD-姓名或缩写`。
- 提交信息示例：`周更: 2026-08-26 企业动态、行业热点及价格数据`。
- 一次提交不要混入模板修改；样式调整必须由用户明确提出并单独提交。
