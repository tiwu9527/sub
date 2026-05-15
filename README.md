# sub

一个前后端分离的个人订阅管理 Dashboard。后端使用 Node.js、Express、Prisma 和 SQLite，前端使用 Vue 3、Vite、Tailwind CSS 和 Axios。

## 功能概览

- 新增、查看、编辑、删除会员订阅记录
- 支持月付和年付两种计费周期
- 每个订阅项目可维护多位使用人员及邮箱
- 支持订阅到期邮件提醒，可配置是否启用和提前提醒天数
- 自动统计预估月度支出和年度支出
- 支持管理账号密码登录，登录后才能访问订阅管理 API
- 后端提供 REST API、健康检查接口和手动执行提醒接口
- 前端默认通过同域 `/api` 访问后端，便于 Docker 反向代理部署

## 技术栈

后端：

- Node.js 18+
- Express
- Prisma
- SQLite
- Nodemailer
- dotenv
- cors

前端：

- Vue 3
- Vite
- Tailwind CSS
- Axios

## 项目结构

```text
.
|-- backend
|   |-- prisma
|   |   |-- migrations
|   |   `-- schema.prisma
|   |-- Dockerfile
|   |-- docker-entrypoint.sh
|   |-- .env.example
|   |-- package.json
|   `-- server.js
|-- frontend
|   |-- src
|   |   |-- api.js
|   |   |-- App.vue
|   |   |-- main.js
|   |   `-- style.css
|   |-- .env.example
|   |-- index.html
|   |-- package.json
|   |-- postcss.config.js
|   |-- tailwind.config.js
|   |-- Dockerfile
|   |-- nginx.conf
|   `-- vite.config.js
|-- .env.example
|-- docker-compose.yml
|-- .gitignore
`-- README.md
```

## 环境要求

- Docker
- Docker Compose v2
- Git


## 部署方案

生产部署推荐使用 Docker Compose。Compose 会启动两个容器：

- `api`: Node.js + Express + Prisma，容器启动时自动执行 `prisma migrate deploy`。
- `web`: Nginx 托管前端静态文件，并把 `/api` 和 `/health` 反向代理到 `api`。

SQLite 数据库文件默认保存在 Docker volume `backend-data` 中。重新构建镜像或重启容器不会删除数据，只有执行 `docker compose down -v` 才会删除该数据卷。

### 1. 准备服务器

服务器需要安装 Git、Docker 和 Docker Compose v2：

```bash
git --version
docker --version
docker compose version
```

拉取源码：

```bash
git clone https://github.com/tiwu9527/sub.git
cd sub
```

### 2. 配置部署变量

复制根目录示例配置：

```bash
cp .env.example .env
```

默认配置如下：

```env
WEB_PORT=9527
FRONTEND_ORIGIN=http://localhost:9527
DATABASE_URL=file:/app/data/prod.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123456
AUTH_TOKEN_SECRET=change_this_to_a_long_random_secret
AUTH_TOKEN_TTL_HOURS=24
REMINDER_CHECK_INTERVAL_MINUTES=60
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

管理登录说明：

- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：管理页面登录账号和密码，首次部署后请立即改成自己的账号密码。
- `AUTH_TOKEN_SECRET`：登录 token 签名密钥，生产环境请改成足够长的随机字符串。
- `AUTH_TOKEN_TTL_HOURS`：登录有效期，单位小时，默认 24 小时。
- 默认登录账号为 `admin`，默认密码为 `admin123456`。

邮件提醒说明：

- `REMINDER_CHECK_INTERVAL_MINUTES`：后端定时扫描提醒任务的间隔，单位分钟，设为 `0` 可关闭自动扫描。
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE`：SMTP 服务地址、端口和是否启用 SSL。
- `SMTP_USER` / `SMTP_PASS`：SMTP 认证账号密码，可按邮件服务商要求填写授权码。
- `SMTP_FROM`：发件人邮箱，例如 `noreply@example.com`。
- 未配置 SMTP 时，系统仍可保存提醒规则，也可手动执行提醒检查，但会跳过真实邮件发送。
- Gmail 示例：`SMTP_HOST=smtp.gmail.com`、`SMTP_PORT=465`、`SMTP_SECURE=true`，`SMTP_USER` 和 `SMTP_FROM` 通常填写同一个 Gmail 地址，`SMTP_PASS` 需要填写 Google 账号的应用专用密码，不是网页登录密码。

如果直接通过服务器 IP 访问，把 `FRONTEND_ORIGIN` 改成实际访问地址：

```env
WEB_PORT=9527
FRONTEND_ORIGIN=http://your_server_ip:9527
DATABASE_URL=file:/app/data/prod.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_a_strong_password
AUTH_TOKEN_SECRET=replace_with_a_long_random_secret
```

如果使用域名和 HTTPS，并由服务器上的 Nginx/Caddy 反向代理到 Docker 服务：

```env
WEB_PORT=9527
FRONTEND_ORIGIN=https://example.com
DATABASE_URL=file:/app/data/prod.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_a_strong_password
AUTH_TOKEN_SECRET=replace_with_a_long_random_secret
REMINDER_CHECK_INTERVAL_MINUTES=60
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mailer@example.com
SMTP_PASS=your_password
SMTP_FROM=mailer@example.com
```

### 3. 启动服务

```bash
docker compose up -d --build
```

默认访问地址：

```text
http://localhost:9527
```

健康检查：

```bash
curl http://localhost:9527/health
```

手动执行到期提醒：

```bash
curl -X POST http://localhost:9527/api/reminders/run
```

查看容器状态和日志：

```bash
docker compose ps
docker compose logs -f
```

### 4. 域名反向代理

如果服务器已有 Nginx，可以让 Docker 服务继续监听本机 `9527` 端口，再由宿主机 Nginx 负责 HTTPS 和域名入口。

示例 Nginx 配置：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:9527;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用 HTTPS 后，`.env` 中的 `FRONTEND_ORIGIN` 应改为 `https://example.com`，然后重启容器：

```bash
docker compose up -d
```

### 5. 更新发布

服务器上拉取最新代码并重新构建：

```bash
git pull
docker compose up -d --build
```

`api` 容器启动时会自动执行数据库迁移，不需要手动运行 Prisma 命令。

### 6. 数据备份与恢复

备份 SQLite 数据库：

```bash
docker compose cp api:/app/data/prod.db ./prod.db.bak
```

恢复数据库时先停止服务，再创建后端容器并复制备份文件：

```bash
docker compose down
docker compose create api
docker compose cp ./prod.db.bak api:/app/data/prod.db
docker compose up -d
```

### 7. 停止服务

停止服务并保留数据：

```bash
docker compose down
```

停止服务并删除 SQLite 数据卷：

```bash
docker compose down -v
```

## 常见问题

### 访问端口被占用

修改根目录 `.env` 的 `WEB_PORT`，例如：

```env
WEB_PORT=8081
FRONTEND_ORIGIN=http://your_server_ip:8081
```

修改后执行：

```bash
docker compose up -d
```

### 前端请求 API 失败

Docker 部署下前端默认请求同域 `/api`，不需要单独暴露后端 `3001` 端口。先检查健康接口：

```bash
curl http://localhost:9527/health
```

如果健康检查失败，查看后端日志：

```bash
docker compose logs api
```

### 前端提示跨域错误

检查根目录 `.env` 中的 `FRONTEND_ORIGIN`。它必须和浏览器实际访问地址的协议、域名/IP、端口完全一致。

示例：

```env
FRONTEND_ORIGIN=https://example.com
```

修改后重启服务：

```bash
docker compose up -d
```

### Prisma 提示数据库或表不存在

Docker 部署下 `api` 启动时会自动执行迁移。可以查看迁移日志：

```bash
docker compose logs api
```

如果需要手动执行迁移：

```bash
docker compose exec api npm run prisma:deploy
```

### 查看服务日志

查看全部日志：

```bash
docker compose logs -f
```

只看后端日志：

```bash
docker compose logs -f api
```

只看前端 Nginx 日志：

```bash
docker compose logs -f web
```
