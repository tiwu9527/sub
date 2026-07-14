# 1Panel 一键部署说明

本项目推荐使用脚本一键部署。脚本会自动生成 `.env`，写入访问端口、管理员账号和管理员密码，并通过 Docker Compose 构建 Web 服务、SQLite 数据卷和提醒 worker。

## 前置要求

服务器需要已经安装：

- 1Panel
- Docker
- Docker Compose
- Git

如果服务器通过 1Panel 安装 Docker，一般已经满足 Docker 和 Docker Compose 要求。

本地开发时进入 `next-dashboard` 后执行 `npm install && npm run dev`；`predev` 会自动在 `.local-data/subscriptions.db` 创建或升级开发数据库。

## 一键部署

在服务器上执行：

```bash
git clone https://github.com/tiwu9527/sub.git
cd sub
chmod +x scripts/deploy.sh
./scripts/deploy.sh --port 3100 --admin-user admin --admin-password 'your-password'
```

参数说明：

- `--port`：外部访问端口，例如 `3100`、`8080`
- `--admin-user`：管理员账号
- `--admin-password`：管理员密码

部署完成后访问：

```text
公开展示：http://服务器IP:3100
管理后台：http://服务器IP:3100/admin
```

如果你把 `--port` 改成了其他端口，访问地址也要同步改成对应端口。

## 使用环境变量部署

也可以不写命令参数，改用环境变量：

```bash
APP_PORT=8080 ADMIN_USERNAME=admin ADMIN_PASSWORD='your-password' ./scripts/deploy.sh
```

## 配置邮件提醒

邮件提醒通过 SMTP 服务发送。部署前设置以下变量：

```bash
export SMTP_HOST='smtp.example.com'
export SMTP_PORT='587'
export SMTP_SECURE='false'
export SMTP_REQUIRE_TLS='true'
export SMTP_USER='mailer@example.com'
export SMTP_PASS='your-smtp-password'
export MAIL_FROM='续费管家 <mailer@example.com>'
export MAIL_REPLY_TO='support@example.com'
export SMTP_TEST_TO='your-test@example.com'
export APP_TIME_ZONE='Asia/Shanghai'
export REMINDER_CHECK_INTERVAL_MINUTES='60'
export REMINDER_RUN_ON_START='true'
export REMINDER_MAX_ATTEMPTS='3'
./scripts/deploy.sh --port 3100 --admin-user admin --admin-password 'your-password'
```

- 端口 `465` 通常设置 `SMTP_SECURE=true`；端口 `587` 通常设置为 `false`，并保持 `SMTP_REQUIRE_TLS=true`。
- SMTP 密码只能配置在服务端环境变量中，不要使用 `NEXT_PUBLIC_` 前缀。
- 管理员可在「工作区设置 → 邮件投递服务」检测 SMTP 连接，并向填写的邮箱或 `SMTP_TEST_TO` 发送测试邮件。
- 独立的 `reminder-worker` 默认每 60 分钟检查一次，也可以在「工作区设置 → 自动提醒任务」手动执行。
- `REMINDER_CHECK_INTERVAL_MINUTES=0` 可停用自动检查；`REMINDER_MAX_ATTEMPTS` 控制失败邮件的最大尝试次数。
- 每位成员单独投递，成员之间不会看到彼此邮箱；数据库会按“订阅 + 账期 + 收件邮箱”持久化去重。
- `ADMIN_COOKIE_SECURE` 留空时会根据请求协议自动判断；也可在只使用 HTTPS 时显式设置为 `true`。
- `ADMIN_SESSION_SECRET` 和 worker 使用的 `REMINDER_CRON_SECRET` 未提供时，部署脚本会分别自动生成随机值。

## 服务端数据库

- 数据默认保存在 Docker 命名卷 `dashboard-data` 的 `/app/data/subscriptions.db`。
- 容器启动时会先自动执行 Prisma 数据库迁移，再启动网站。
- 第一次部署后，管理员首次登录会把当前浏览器里的旧 `localStorage` 订阅和设置一次性导入数据库；服务器已有数据时不会覆盖。
- 后台保存采用版本号冲突检测，多个页面同时编辑时不会静默覆盖较新的服务器数据。
- 公开展示接口不会返回成员邮箱；邮件任务只从管理员数据库读取真实收件人。

不要执行 `docker compose down -v`，其中 `-v` 会删除数据库卷。

升级或迁移前可这样备份 SQLite：

```bash
docker compose stop reminder-worker next-dashboard
docker compose cp next-dashboard:/app/data/subscriptions.db ./subscriptions-$(date +%F-%H%M%S).db
docker compose start next-dashboard reminder-worker
```

## 更新部署

进入项目目录后执行：

```bash
git pull
./scripts/deploy.sh --port 3100 --admin-user admin --admin-password 'your-password'
```

脚本会重新构建镜像并重启容器。

## 1Panel 反向代理

如果要绑定域名，在 1Panel「网站」中创建反向代理，目标地址填写：

```text
http://127.0.0.1:3100
```

如果部署时使用了其他端口，例如 `--port 8080`，这里填写：

```text
http://127.0.0.1:8080
```

## 常用命令

查看日志：

```bash
docker compose logs -f next-dashboard
docker compose logs -f reminder-worker
```

停止服务：

```bash
docker compose down
```

该命令不会删除 `dashboard-data`；只有显式追加 `-v` 才会删除数据库卷。

查看当前配置：

```bash
cat .env
```
