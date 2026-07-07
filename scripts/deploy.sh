#!/usr/bin/env sh
set -eu

APP_PORT="${APP_PORT:-3100}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy.sh [options]

Options:
  -p, --port <port>               Public HTTP port, default: 3100
  -u, --admin-user <username>     Admin username, default: admin
  -w, --admin-password <password> Admin password
  -h, --help                      Show help

Environment variables are also supported:
  APP_PORT=8080 ADMIN_USERNAME=admin ADMIN_PASSWORD='secret' ./scripts/deploy.sh
EOF
}

quote_env_value() {
  printf "%s" "$1" | sed "s/'/\\\\'/g"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -p|--port)
      APP_PORT="${2:-}"
      shift 2
      ;;
    -u|--admin-user)
      ADMIN_USERNAME="${2:-}"
      shift 2
      ;;
    -w|--admin-password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "$APP_PORT" in
  ''|*[!0-9]*)
    echo "APP_PORT must be a number." >&2
    exit 1
    ;;
esac

if [ "$APP_PORT" -lt 1 ] || [ "$APP_PORT" -gt 65535 ]; then
  echo "APP_PORT must be between 1 and 65535." >&2
  exit 1
fi

if [ -z "$ADMIN_USERNAME" ]; then
  echo "ADMIN_USERNAME cannot be empty." >&2
  exit 1
fi

if [ -z "$ADMIN_PASSWORD" ]; then
  if [ ! -t 0 ]; then
    echo "ADMIN_PASSWORD is required in non-interactive mode." >&2
    exit 1
  fi

  printf "Admin password: "
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  printf "\n"
fi

if [ -z "$ADMIN_PASSWORD" ]; then
  echo "ADMIN_PASSWORD cannot be empty." >&2
  exit 1
fi

umask 077

cat > .env <<EOF
APP_PORT='$APP_PORT'
ADMIN_USERNAME='$(quote_env_value "$ADMIN_USERNAME")'
ADMIN_PASSWORD='$(quote_env_value "$ADMIN_PASSWORD")'
EOF

if docker compose version >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" up -d --build
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose -f "$COMPOSE_FILE" up -d --build
else
  echo "Docker Compose is not installed." >&2
  exit 1
fi

echo "Deployment complete: http://127.0.0.1:$APP_PORT"
