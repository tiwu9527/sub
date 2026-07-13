# 1Panel 一键部署说明

本项目推荐使用脚本一键部署。脚本会自动生成 `.env`，写入访问端口、管理员账号和管理员密码，并通过 Docker Compose 构建和启动服务。

## 前置要求

服务器需要已经安装：

- 1Panel
- Docker
- Docker Compose
- Git

如果服务器通过 1Panel 安装 Docker，一般已经满足 Docker 和 Docker Compose 要求。

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
http://服务器IP:3100
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
export SMTP_USER='mailer@example.com'
export SMTP_PASS='your-smtp-password'
export MAIL_FROM='续费管家 <mailer@example.com>'
export MAIL_REPLY_TO='support@example.com'
export APP_TIME_ZONE='Asia/Shanghai'
./scripts/deploy.sh --port 3100 --admin-user admin --admin-password 'your-password'
```

- 端口 `465` 通常设置 `SMTP_SECURE=true`；端口 `587` 通常设置为 `false`。
- SMTP 密码只能配置在服务端环境变量中，不要使用 `NEXT_PUBLIC_` 前缀。
- 每次发送前都会要求管理员登录确认，并逐位成员单独投递，成员之间不会看到彼此邮箱。
- 使用 HTTPS 域名反向代理时，将 `ADMIN_COOKIE_SECURE=true`；直接通过 HTTP/IP 访问时保持为 `false`。
- `ADMIN_SESSION_SECRET` 未提供时部署脚本会自动生成随机值。

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
```

停止服务：

```bash
docker compose down
```

查看当前配置：

```bash
cat .env
```
