# Job Application Assistant Guide

本目录是可独立发布的本地优先 Web 应用，不依赖 AI World Creator extensions。

修改前阅读 `agent_docs/ARCHITECTURE.md` 和 `agent_docs/SECURITY.md`。浏览器代码不得导入 Node 模块；SMTP、文件、SQLite 和远程岗位源只能由 `src/server` 访问。运行 `npm run typecheck && npm test && npm run build` 完成最小验证。
