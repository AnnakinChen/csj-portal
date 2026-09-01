# 项目 Skills

## 必需技能

- `portal-weekly-maintainer`：本项目周更总控，先读取 PRD并锁定模板。
- `gsdt`：企业动态。
- `hyrd`：六行业热点。
- `a-stock-data`：A 股财务、公告和行情数据。
- `rn-wechat-extract`：微信公众号正文。
- `agent-reach`：公开互联网检索和原文核验。
- `datayes-macro`：价格与行业时间序列；仅从环境变量读取 Token。
- `spreadsheets`：半年度披露和土地 Excel 的读取与核验。

## 让 Codex 安装

同事可在 Codex 中直接说：

> 使用 skill-installer，从 GitHub 仓库 zyp9543/csj-insight-portal 的 skills 目录安装 portal-weekly-maintainer、gsdt、hyrd、a-stock-data、rn-wechat-extract、agent-reach、datayes-macro 和 spreadsheets。不要覆盖我电脑里已有的同名技能；如有冲突先报告。安装完成后提醒我新开任务。

也可以克隆仓库后，把每个技能文件夹复制到 `~/.codex/skills/`。Skills 不包含任何 Token、Cookie 或账号密码；凭据必须由每位使用者在自己的电脑上配置。

注意：Skill 是工作说明和脚本，不会代替账号型连接器。`gsdt`、`hyrd` 如依赖财汇或通联能力，同事仍需在自己的 Codex 中获得相应连接权限；具体让 Codex 按 `docs/SETUP.md` 检查。
