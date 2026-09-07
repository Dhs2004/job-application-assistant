# Architecture

- `src/shared`：浏览器与服务端共享的可序列化类型。
- `src/core`：无环境依赖的匹配、去重和邮件模板逻辑。
- `src/server`：HTTP API、简历解析、SQLite、岗位源、SMTP 和调度器。
- `src/web`：React 页面与 API client，不得访问文件系统或环境变量。

依赖方向为 `web/server -> shared/core`。`core` 不依赖 React、Express、SQLite 或 SMTP。
