# Cloudflare Workers 版本

这个目录是给当前项目准备的 Cloudflare Workers 版本。它保留原前端使用的 `/api/...` 接口，后端改为 Workers + D1，前端静态文件由 Workers Static Assets 托管。

## 包含内容

- `src/worker.js`：Worker API、静态资源入口、Cron 到期提醒。
- `migrations/0001_init.sql`：D1 数据库表结构。
- `wrangler.toml`：Workers、D1、静态资源和 Cron 配置模板。
- `scripts/build-frontend.mjs`：构建现有 `../frontend`，并把 API 地址固定为 `/api`。

## 部署步骤

1. 安装依赖：

```bash
cd cloudflare-worker
npm install
```

2. 创建 D1 数据库：

```bash
npm run d1:create
```

把命令输出里的 `database_id` 填到 `wrangler.toml` 的 `database_id`。

3. 初始化远程 D1：

```bash
npm run d1:migrate
```

本地调试可先执行：

```bash
npm run d1:migrate:local
```

4. 配置生产密钥：

```bash
wrangler secret put ADMIN_PASSWORD
wrangler secret put AUTH_TOKEN_SECRET
```

邮件提醒建议使用 HTTP 邮件服务，而不是 SMTP。支持 Resend 或 SendGrid：

```bash
wrangler secret put RESEND_API_KEY
```

然后在 `wrangler.toml` 里配置：

```toml
EMAIL_PROVIDER = "resend"
EMAIL_FROM = "noreply@example.com"
EMAIL_TEST_TO = "you@example.com"
```

SendGrid 则使用：

```bash
wrangler secret put SENDGRID_API_KEY
```

并设置：

```toml
EMAIL_PROVIDER = "sendgrid"
EMAIL_FROM = "noreply@example.com"
EMAIL_TEST_TO = "you@example.com"
```

5. 本地运行：

```bash
npm run build:frontend
npm run dev
```

默认访问：

```text
http://localhost:8787
http://localhost:8787/admin
```

6. 发布：

```bash
npm run deploy
```

## 和原 Node 版本的区别

- 不再使用 Express、Prisma、SQLite 文件数据库。
- 数据存储改为 Cloudflare D1。
- 定时提醒改为 Workers Cron Triggers，默认每小时执行一次。
- 邮件发送改为 Resend / SendGrid HTTP API；未配置邮件服务时，提醒任务会跳过真实发送。

## 注意

`wrangler.toml` 里现在为了本地调试保留了默认账号密码。生产环境应使用 `wrangler secret put ADMIN_PASSWORD` 和 `wrangler secret put AUTH_TOKEN_SECRET` 覆盖默认值。
