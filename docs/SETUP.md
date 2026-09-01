# 新电脑一次性准备（交给 Codex 完成）

你和同事不需要自己安装或配置代码环境。第一次拿到仓库时，把下面这段话交给 Codex：

> 请先阅读 AGENTS.md、START_HERE.md、docs/PRD.md 和 skills/README.md。检查 Node.js 20+、Python 3、Git、项目 Skills、requirements-weekly.txt 中的 A 股取数依赖，以及 gsdt/hyrd 所需连接器是否可用。只做检查和本地安装，不修改 template，不读取或提交任何密码、Token、Cookie。网页构建运行 npm test；缺少账号型连接器时告诉我需要在 Codex 中连接什么，不要绕过。全部完成后生成一份“已就绪 / 仍需我操作”的中文清单。

## Codex 应检查的内容

- Git：用于从 GitHub 拉取和推送项目。
- Node.js 20+：只用于把模板与 JSON 合并成单文件网页；网页没有第三方前端依赖。
- Python 3：用于 `rn-wechat-extract`、`datayes-macro` 和部分数据处理。
- `requirements-weekly.txt`：`a-stock-data` 所需的本机 Python 包；建议由 Codex 建立项目专用虚拟环境后安装，不要提交该环境目录。
- 项目 Skills：见 `skills/README.md`。
- 财汇/企业动态能力：`gsdt` 需要相应连接器；账号和授权需由每位使用者在自己的 Codex 中完成。
- 通联研报/行业热点能力：`hyrd` 需要相应连接器和合法 Token；Token 只能在本机或连接器中配置。
- GitHub 推送权限：仓库所有者须先邀请同事为 Collaborator。

## 不能放进 GitHub 的内容

Token、Cookie、账号密码、浏览器登录态、个人邮箱授权和本机 `.env` 文件都不能随项目打包。它们不是项目缺失文件，而是每台电脑单独完成的一次性授权。
