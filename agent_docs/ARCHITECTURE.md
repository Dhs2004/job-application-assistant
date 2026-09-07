# Architecture

- `src/shared`：浏览器与服务端共享的可序列化类型。
- `src/core`：无环境依赖的文本规范化和投递去重逻辑。
- `src/server`：HTTP API、简历解析、SQLite、AI Provider、会话密钥、SMTP 和一次性确认 token。
- `src/web`：React 页面与 API client，不得访问文件系统或环境变量。

依赖方向为 `web/server -> shared/core`。`core` 不依赖 React、Express、SQLite 或 SMTP。

AI API Key、SMTP 应用专用密码和确认 token 由 `SessionVault` 保存在 Node 进程内存中。SQLite 只保存候选人档案、已校验岗位和投递记录。
