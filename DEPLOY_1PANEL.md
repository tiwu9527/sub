# 1Panel 部署说明

本项目推荐使用 1Panel 的「容器 > 编排」部署，根目录已经提供 `docker-compose.yml`，镜像构建文件位于 `next-dashboard/Dockerfile`。

## 部署步骤

1. 将整个仓库上传到服务器，例如 `/opt/subscription-manager-dashboard`。
2. 进入 1Panel 后台，打开「容器 > 编排」，创建新的编排。
3. 选择项目根目录中的 `docker-compose.yml`。
4. 如需修改外部访问端口，在编排环境变量中设置 `APP_PORT`，默认是 `3100`。
5. 设置管理员账号和密码：`ADMIN_USERNAME`、`ADMIN_PASSWORD`。
6. 启动编排后，访问 `http://服务器IP:3100`。

## 反向代理

如果要绑定域名，在 1Panel「网站」中创建反向代理，目标地址填写：

```text
http://127.0.0.1:3100
```

如修改了 `APP_PORT`，这里也要同步改成对应端口。

## 本地验证命令

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f next-dashboard
```

停止服务：

```bash
docker compose down
```

## 脚本部署

在服务器项目根目录运行：

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh --port 8080 --admin-user admin --admin-password 'your-password'
```

也可以使用环境变量：

```bash
APP_PORT=8080 ADMIN_USERNAME=admin ADMIN_PASSWORD='your-password' ./scripts/deploy.sh
```
