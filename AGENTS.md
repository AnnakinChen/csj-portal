# Codex 项目规则

1. 先完整阅读 `docs/PRD.md`；它是本项目最高优先级文件。
2. 普通周更只允许修改 `data/` 中的时效性内容，不得修改 `template/`、页面样式、布局、响应式或交互。
3. 仅当用户明确要求修改样式时，才可调整模板；调整后必须同步更新 PRD、模板锁与基线说明。
4. 企业动态使用项目内 `skills/gsdt`；行业热点使用 `skills/hyrd`；微信公众号正文使用 `skills/rn-wechat-extract`。
5. 财务报表和财务指标使用 `skills/a-stock-data`。不得调用通联数据 `fdmt_indi_rtn`、`dmt_indi_lqd`、`fdmt_bs_new_lt`、`fdmt_is_new_lt`。
6. 价格和指数可使用 `skills/datayes-macro`，凭据只读环境变量，不得写入仓库、网页、日志或文档。
7. 每次修改后执行 `npm test`；只有模板锁、数据结构、链接和单文件构建均通过，才可提交。
8. 不修改 `baseline/`；它只用于对照当前已认可成品。
9. 不在未获用户授权时推送、合并、发布或删除 GitHub 内容。
