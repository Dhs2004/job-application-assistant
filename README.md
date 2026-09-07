# 投递舱 / Job Application Assistant

一个本地优先、可解释且安全可控的求职申请助手。上传简历并设置目标岗位后，它会导入合规岗位源、计算匹配分数、生成邮件草稿，并在你明确开启自动投递后通过自己的 SMTP 发送申请。

## 功能

- 解析 PDF、DOCX、TXT 简历，允许校正文本和技能。
- 按必备技能、相关能力、经验、地点、岗位和薪资计算可解释分数。
- 支持内置演示数据和自定义 HTTPS JSON Feed。
- 生成中文或英文申请邮件，附带原始简历。
- SMTP 测试、显式总开关、最低分数、每日上限、去重和暂停控制。
- SQLite 本地存储、CSV 投递记录导出、一键删除本地数据。

## 快速开始

要求 Node.js 22.13 或更高版本。

```bash
npm install
cp .env.example .env
npm run dev
```

浏览器打开 `http://localhost:4316`。前端开发服务会把 `/api` 转发到 `http://127.0.0.1:4317`。

## SMTP 配置

编辑 `.env`：

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@example.com
SMTP_PASS=your-app-password
SMTP_FROM="Your Name <you@example.com>"
```

优先使用邮箱服务商提供的应用专用密码或 SMTP token，不要使用主账号密码。应用不会把密钥写入浏览器、SQLite 或日志。配置完成后，先在左侧向自己的邮箱发送测试邮件，再确认模板并开启自动投递。

## 岗位 Feed

Feed 必须通过公开 HTTPS URL 提供，格式参考 [`examples/jobs-feed.json`](examples/jobs-feed.json)。根节点可以是岗位数组，也可以是包含 `jobs` 数组的对象。每个岗位必须包含 `title`、`company`、`description` 和 `url`；只有提供公开 `applyEmail` 的岗位才可能自动投递。

系统拒绝 HTTP、本机、私有网段和链路本地地址，限制响应大小、超时和重定向次数。它不会绕过招聘网站登录、验证码、访问控制或反自动化措施。请只接入你有权使用的官方 API、公开 Feed 或自有数据源。

## 自动投递规则

自动投递默认关闭。开启前必须：

1. 上传并检查简历解析结果；
2. 成功发送 SMTP 测试邮件；
3. 预览并确认邮件模板；
4. 设置最低匹配分和每日上限；
5. 手动打开自动投递总开关。

服务每 15 分钟检查一次新岗位。每封邮件发送前都会重新验证岗位状态、公开邮箱、分数、每日额度和去重键。系统不会编造简历经历，也不保证获得面试。

## 隐私

运行数据保存在 `.data/`，其中包括简历受控副本、解析文本、岗位和投递记录。`.data/` 与 `.env` 已加入 `.gitignore`。不要把真实简历、邮箱密钥或投递数据库提交到代码仓库。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

生产构建后，服务从 `dist/` 提供页面并监听 `http://127.0.0.1:4317`。

## License

[MIT](LICENSE)
