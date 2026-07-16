# Docker Compose 部署说明

本说明用于在常见 Linux 服务器上通过 Docker Compose 部署本项目，宿主机不需要安装 Node.js。

部署后包含以下服务：

- `next-dashboard`：Next.js 网站和 API，容器内端口为 `3100`
- `reminder-worker`：定时调用提醒任务的独立 worker
- `dashboard-data`：持久化 SQLite 数据库的 Compose 数据卷

除特别说明外，所有命令都必须在仓库根目录执行，也就是同时包含 `docker-compose.yml` 和 `next-dashboard` 的目录。

## 1. 准备服务器

服务器需要安装：

- Docker Engine
- Docker Compose v2
- Git
- OpenSSL
- curl

通过 SSH 登录服务器后确认：

```bash
docker --version
docker compose version
git --version
openssl version
curl --version
```

Docker 镜像内已包含 Node.js 22，服务器宿主机不需要安装 Node.js，也不要使用其他来源的旧版 Node.js/npm 直接启动生产服务。

建议同时准备：

- 已解析到服务器的域名
- Nginx、Caddy、Traefik 等反向代理及可用的 HTTPS 证书
- SMTP 服务信息（仅在需要邮件提醒时配置）

## 2. 获取代码

以下示例把项目安装到 `/opt/subscription-manager`：

```bash
cd /opt
git clone https://github.com/tiwu9527/sub.git subscription-manager
cd /opt/subscription-manager
```

如果使用其他目录，请在后续命令中替换为实际路径。执行 Compose 命令前可用下面的命令确认当前位置：

```bash
pwd
test -f docker-compose.yml && echo "目录正确"
```

## 3. 创建环境配置

先从示例创建仅限管理员读取的 `.env`：

```bash
umask 077
cp .env.example .env
chmod 600 .env
```

分别生成两个独立的随机密钥：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

使用终端编辑器打开 `.env`，将两个输出分别填入 `ADMIN_SESSION_SECRET` 和 `REMINDER_CRON_SECRET`。不要重复使用同一个值，也不要把密钥粘贴到聊天、工单或公开日志中。

基础配置示例：

```dotenv
APP_PORT=3100
ADMIN_USERNAME=admin
ADMIN_PASSWORD='替换为高强度初始密码'
ADMIN_SESSION_SECRET='替换为第一个随机密钥'
ADMIN_COOKIE_SECURE=
APP_TIME_ZONE=Asia/Shanghai
DATABASE_URL=file:/app/data/subscriptions.db

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
MAIL_REPLY_TO=
SMTP_TEST_TO=

REMINDER_CRON_SECRET='替换为第二个随机密钥'
REMINDER_CHECK_INTERVAL_MINUTES=60
REMINDER_RUN_ON_START=true
REMINDER_MAX_ATTEMPTS=3
```

关键配置说明：

- `APP_PORT`：服务器上的访问端口，默认 `3100`
- `ADMIN_USERNAME`：管理员登录账号，修改后立即影响后续登录
- `ADMIN_PASSWORD`：新数据库首次登录使用的初始密码，建议至少 12 位且不与其他服务重复
- `ADMIN_SESSION_SECRET`：管理员会话签名密钥，至少 32 字节；后续必须保持不变
- `ADMIN_COOKIE_SECURE`：使用 HTTPS 域名后设为 `true`；直接通过 HTTP 测试时先留空
- `APP_TIME_ZONE`：业务时区，例如 `Asia/Shanghai`
- `DATABASE_URL`：Docker 部署应保持为 `file:/app/data/subscriptions.db`
- `REMINDER_CRON_SECRET`：网站与 worker 之间的任务密钥，至少 32 字节
- `REMINDER_CHECK_INTERVAL_MINUTES`：自动提醒检查间隔，范围为 `0`～`1440`；`0` 表示关闭自动检查
- `REMINDER_RUN_ON_START`：设为 `true` 时，worker 启动后会先执行一次检查
- `REMINDER_MAX_ATTEMPTS`：失败投递的最大累计尝试次数，范围为 `1`～`10`

`.env` 含有管理员初始密码、SMTP 密码和服务密钥，不能提交到 Git，也不要直接执行 `cat .env` 后复制完整输出。

## 4. 构建并启动

先验证 Compose 配置，再构建并启动容器：

```bash
docker compose config --quiet
docker compose up -d --build
```

首次构建需要下载基础镜像和 npm 依赖，所需时间取决于服务器网络。容器启动时会先执行 Prisma 数据库迁移，再启动网站；worker 会等待网站健康检查通过后启动。

检查状态：

```bash
docker compose ps
```

等待 `next-dashboard` 显示为 `healthy`，并确认 `reminder-worker` 为运行状态。然后检查公开接口：

```bash
curl -fsS http://127.0.0.1:3100/api/public/dashboard >/dev/null \
  && echo "health check: OK"
```

如果修改了 `APP_PORT`，请同步替换检查地址中的 `3100`。

服务正常后可访问：

```text
公开展示：http://服务器IP:3100
管理后台：http://服务器IP:3100/admin
```

生产环境建议继续配置下一节的反向代理和 HTTPS，通过域名访问，不直接暴露应用端口。

## 5. 配置反向代理和 HTTPS

使用 Nginx、Caddy、Traefik 或现有网关，把域名代理到：

```text
http://127.0.0.1:3100
```

如果 `APP_PORT` 使用其他值，代理地址也要改成对应端口。

以 Nginx 为例，可在已经配置好域名和 HTTPS 证书的 `server` 块中加入：

```nginx
location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

使用其他反向代理时，也要保留原始 `Host` 并传递：

- `X-Forwarded-Host`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

这些请求头用于安全 Cookie、同源校验和登录限流。若登录后立即失效或修改密码提示请求来源无效，应优先检查反向代理配置。

为域名启用有效的 HTTPS 证书，并将 HTTP 请求重定向到 HTTPS。确认 HTTPS 可以正常访问后，把 `.env` 修改为：

```dotenv
ADMIN_COOKIE_SECURE=true
```

应用新配置：

```bash
docker compose up -d
```

只通过反向代理提供服务时，不需要在公网防火墙中开放 `APP_PORT`。当前 Compose 端口会绑定服务器网卡，应使用云厂商安全组或服务器防火墙阻止公网直接访问该端口。

## 6. 首次登录和管理员密码

打开 `/admin`，使用 `.env` 中的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 首次登录。

首次成功登录后，管理员密码会使用带随机盐的 scrypt 哈希写入 SQLite。需要注意：

- SQLite 数据库不会保存管理员明文密码，但 `.env` 仍包含初始密码，必须妥善保护
- 数据库完成初始化后，修改 `.env` 中的 `ADMIN_PASSWORD` 不会重置当前密码
- Compose 仍要求 `ADMIN_PASSWORD` 为非空值，因此不要删除该配置项
- 后续应在管理后台的账户菜单中选择「修改账户密码」
- 在线修改的新密码要求为 8～128 个字符，不能全为空格，也不能与当前密码相同
- 修改成功后当前窗口保持登录，其他设备上的旧管理员会话立即失效
- 更换 `ADMIN_SESSION_SECRET` 会让全部现有管理员会话失效

如果忘记在线修改后的密码，不要通过删除数据卷来重置，否则会同时丢失订阅和设置数据。应优先从备份恢复，或在保留数据库副本后进行人工维护。

## 7. 配置 SMTP 和自动提醒

不需要邮件提醒时，SMTP 配置可以留空，网站其他功能仍可使用。

启用邮件提醒时可按以下示例配置，其中 `SMTP_HOST`、有效的 `SMTP_PORT` 和 `MAIL_FROM` 是必填项：

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=mailer@example.com
SMTP_PASS='SMTP 密码或授权码'
MAIL_FROM='续费管家 <mailer@example.com>'
MAIL_REPLY_TO=support@example.com
SMTP_TEST_TO=your-test@example.com
```

配置规则：

- 端口 `465` 通常使用 `SMTP_SECURE=true`
- 端口 `587` 通常使用 `SMTP_SECURE=false` 和 `SMTP_REQUIRE_TLS=true`
- `SMTP_USER` 与 `SMTP_PASS` 必须同时填写或同时留空
- `MAIL_REPLY_TO` 和 `SMTP_TEST_TO` 可选
- 部分邮箱服务必须使用授权码，不能使用网页登录密码
- `REMINDER_CHECK_INTERVAL_MINUTES=0` 只关闭 worker 自动检查，后台手动执行仍然可用
- 自动检查按 worker 启动后的间隔运行，不是固定整点 Cron

修改 `.env` 后执行 `docker compose up -d`，再登录管理后台，在「工作区设置 → 邮件投递服务」中检测连接并发送测试邮件。

## 8. 数据和备份

数据库文件位于容器内的 `/app/data/subscriptions.db`，由 Compose 逻辑卷 `dashboard-data` 持久化。Docker 中显示的实际卷名通常带有 Compose 项目前缀。

不要执行：

```bash
docker compose down -v
```

其中 `-v` 会删除数据库卷。

升级、迁移或修改重要配置前，先停止写入，并把数据库和环境配置备份到仓库目录之外：

```bash
BACKUP_DIR=/opt/subscription-manager-backups
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
docker compose stop reminder-worker next-dashboard
docker compose cp next-dashboard:/app/data/subscriptions.db \
  "$BACKUP_DIR/subscriptions-$(date +%F-%H%M%S).db"
cp .env "$BACKUP_DIR/env-$(date +%F-%H%M%S).backup"
chmod 600 "$BACKUP_DIR"/*
docker compose start next-dashboard reminder-worker
```

备份文件包含业务数据或密钥，不要放在 Git 仓库内，也不要上传到 GitHub。还应将备份加密保存到另一台服务器或其他可靠存储，并定期验证恢复流程。

## 9. 更新版本

更新前先按上一节备份数据库，然后在仓库根目录执行：

```bash
cd /opt/subscription-manager
git status --short
git pull --ff-only
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

`.env` 不受 `git pull` 影响，现有端口、SMTP 配置和密钥会继续保留。不要删除 `.env`，也不要重新生成 `ADMIN_SESSION_SECRET` 或 `REMINDER_CRON_SECRET`。

如果 `git status --short` 显示已修改的受版本控制文件，先确认改动来源并妥善保存，不要直接覆盖。更新后再次检查健康接口和容器日志。

## 10. 常用运维命令

以下命令均在仓库根目录执行。

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f next-dashboard
docker compose logs -f reminder-worker
```

查看最近日志：

```bash
docker compose logs --tail=200 next-dashboard reminder-worker
```

使用现有配置重启：

```bash
docker compose restart
```

修改 `.env` 后重新创建容器：

```bash
docker compose up -d
```

停止和重新启动：

```bash
docker compose down
docker compose up -d
```

不带 `-v` 的 `docker compose down` 不会删除数据库卷。

只查看 `.env` 中的配置项名称，不输出值：

```bash
sed -n 's/=.*//p' .env
```

## 11. 常见问题排查

### Web 容器不健康

```bash
docker compose ps
docker compose logs --tail=200 next-dashboard
```

重点检查 `.env` 是否存在、两个密钥是否至少 32 字节，以及数据库卷是否可写。

### worker 没有启动或不断重启

```bash
docker compose logs --tail=200 reminder-worker
```

确认 `REMINDER_CRON_SECRET` 已配置且长度足够。Web 与 worker 会从同一份 `.env` 读取该值。

### 端口被占用

```bash
ss -ltnp | grep ':3100'
```

停止占用端口的服务，或修改 `.env` 中的 `APP_PORT`，然后执行 `docker compose up -d`。

### 登录成功后立即退出

检查：

- `ADMIN_SESSION_SECRET` 是否稳定且至少 32 字节
- HTTPS 站点是否设置了 `ADMIN_COOKIE_SECURE=true`
- 反向代理是否正确传递 `Host` 和 `X-Forwarded-Proto`
- 浏览器是否仍在通过普通 HTTP 地址访问

### 修改密码或发送测试邮件时提示来源无效

检查反向代理传递的 `Host`、`X-Forwarded-Host` 和 `X-Forwarded-Proto`，并确保浏览器访问的域名与请求来源一致。

### 配置修改后没有生效

`docker compose restart` 不会重新读取已变化的环境配置。修改 `.env` 后应执行：

```bash
docker compose up -d
```

不要运行不带 `--quiet` 的 `docker compose config` 并把输出发送给他人，因为完整输出可能包含密码和密钥。
