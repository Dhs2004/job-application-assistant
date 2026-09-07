# 投递舱 / Job Application Assistant

一个本地优先的 AI 求职助手。它使用你选择的 AI Provider 分析简历、搜索有来源的岗位、核验公开招聘邮箱并生成申请邮件。每封邮件都需要用户单独确认。

## 主要功能

- 支持 OpenAI、阿里云百炼 / Qwen、字节 Azure Responses 和具备联网搜索能力的 OpenAI-compatible Provider。
- 解析 PDF、DOCX 和 TXT 简历，在明示同意后调用 AI 提取候选人档案。
- 展示岗位页、邮箱来源、搜索时间、匹配理由、能力缺口和置信度。
- 只允许向来源可验证的公开招聘邮箱发送。
- 支持 Gmail、Outlook、QQ 邮箱、163 邮箱和自定义 SMTP。
- 使用与收件人、主题、正文和附件绑定的一次性确认 token，并阻止重复投递。
- 支持导出投递记录和清除全部本地数据。

## 快速开始

要求 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:4316`。前端开发服务会将 `/api` 转发到 `http://127.0.0.1:4317`。

首次使用流程：

1. 选择 AI Provider，输入 API Key 和模型。
2. 上传简历，阅读隐私提示后同意 AI 分析。
3. 在工作台中连接发件邮箱，使用邮箱服务商生成的应用专用密码或 SMTP token。
4. 搜索岗位，核对岗位和邮箱来源，编辑草稿后单独确认投递。

## Provider 配置

- OpenAI 使用 Responses API 的 `web_search` 工具。
- Qwen 使用百炼 OpenAI-compatible Chat Completions 接口的联网搜索功能。
- 字节 Azure Responses 预设支持 `gpt-5.6-terra`、`gpt-5.6-sol` 和 `gpt-5.5-2026-04-24`。应用使用 `2025-04-01-preview` API，并为同一服务会话复用 `session_id`。页面通过本地密码解锁 `.env` 中的 Key 池。
- 自定义 Provider 必须使用公开 HTTPS Base URL，并在能力探测中返回联网搜索证据。纯文本模型不能用于岗位发现。

AI 输出始终被视为不可信输入。服务端会校验字段长度、HTTPS URL、邮箱、来源关系和返回数量，并丢弃无来源或格式错误的岗位。

AI 请求使用分级超时：连接探测 2 分钟、简历分析 3 分钟、联网搜岗 10 分钟。超时后当前请求会停止，页面会显示具体阶段和限制时间。

字节预设可以使用本机 `.env` 中的 Key 池，页面只需输入本地访问密码：

```dotenv
APP_ACCESS_PASSWORD=choose-a-local-password
BYTEDANCE_GPT_5_6_TERRA_KEYS=key-one
BYTEDANCE_GPT_5_6_SOL_KEYS=key-one,key-two
BYTEDANCE_GPT_5_5_KEYS=key-one,key-two
```

服务端会按模型轮询 Key。`.env` 已被 Git 忽略，不得提交。该密码只是绑定 `127.0.0.1` 的本地访问门禁，不能作为公网身份认证方案。

## 隐私与安全

- 通过页面输入的 AI API Key 和 SMTP 应用专用密码只保存在 Node 进程内存中，不写入 SQLite、日志或浏览器存储。字节预设的 Key 池只从被 Git 忽略的本机 `.env` 读取。
- 简历、岗位和投递记录保存在 `.data/`。该目录已被 Git 忽略。
- 简历正文会在用户同意后发送给已选 AI Provider，但不会发送给岗位网站。
- 应用不猜测私人邮箱，不绕过登录、验证码、访问控制或站点反自动化措施。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm start
```

生产构建后，服务从 `dist/` 提供页面，默认监听 `http://127.0.0.1:4317`。

## License

[MIT](LICENSE)
