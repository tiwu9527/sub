#!/usr/bin/env sh
set -eu

APP_PORT="${APP_PORT:-3100}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
ADMIN_SESSION_SECRET="${ADMIN_SESSION_SECRET:-}"
ADMIN_COOKIE_SECURE="${ADMIN_COOKIE_SECURE:-}"
APP_TIME_ZONE="${APP_TIME_ZONE:-Asia/Shanghai}"
DATABASE_URL="${DATABASE_URL:-file:/app/data/subscriptions.db}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURE="${SMTP_SECURE:-false}"
SMTP_REQUIRE_TLS="${SMTP_REQUIRE_TLS:-true}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
MAIL_FROM="${MAIL_FROM:-}"
MAIL_REPLY_TO="${MAIL_REPLY_TO:-}"
SMTP_TEST_TO="${SMTP_TEST_TO:-}"
REMINDER_CRON_SECRET="${REMINDER_CRON_SECRET:-}"
REMINDER_CHECK_INTERVAL_MINUTES="${REMINDER_CHECK_INTERVAL_MINUTES:-60}"
REMINDER_RUN_ON_START="${REMINDER_RUN_ON_START:-true}"
REMINDER_MAX_ATTEMPTS="${REMINDER_MAX_ATTEMPTS:-3}"
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

Email reminders additionally use:
  SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_REQUIRE_TLS SMTP_USER SMTP_PASS
  MAIL_FROM MAIL_REPLY_TO SMTP_TEST_TO
  REMINDER_CHECK_INTERVAL_MINUTES REMINDER_RUN_ON_START REMINDER_MAX_ATTEMPTS
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

if [ -z "$ADMIN_SESSION_SECRET" ]; then
  if command -v openssl >/dev/null 2>&1; then
    ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"
  elif [ -r /dev/urandom ] && command -v od >/dev/null 2>&1; then
    ADMIN_SESSION_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  else
    echo "Unable to generate ADMIN_SESSION_SECRET. Set it manually." >&2
    exit 1
  fi
fi

if [ -z "$REMINDER_CRON_SECRET" ]; then
  if command -v openssl >/dev/null 2>&1; then
    REMINDER_CRON_SECRET="$(openssl rand -hex 32)"
  elif [ -r /dev/urandom ] && command -v od >/dev/null 2>&1; then
    REMINDER_CRON_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  else
    echo "Unable to generate REMINDER_CRON_SECRET. Set it manually." >&2
    exit 1
  fi
fi

if [ "${#REMINDER_CRON_SECRET}" -lt 32 ]; then
  echo "REMINDER_CRON_SECRET must contain at least 32 characters." >&2
  exit 1
fi

case "$REMINDER_CHECK_INTERVAL_MINUTES" in
  ''|*[!0-9]*)
    echo "REMINDER_CHECK_INTERVAL_MINUTES must be a number." >&2
    exit 1
    ;;
esac

if [ "$REMINDER_CHECK_INTERVAL_MINUTES" -gt 1440 ]; then
  echo "REMINDER_CHECK_INTERVAL_MINUTES must be between 0 and 1440." >&2
  exit 1
fi

case "$REMINDER_MAX_ATTEMPTS" in
  ''|*[!0-9]*)
    echo "REMINDER_MAX_ATTEMPTS must be a number." >&2
    exit 1
    ;;
esac

if [ "$REMINDER_MAX_ATTEMPTS" -lt 1 ] || [ "$REMINDER_MAX_ATTEMPTS" -gt 10 ]; then
  echo "REMINDER_MAX_ATTEMPTS must be between 1 and 10." >&2
  exit 1
fi

case "$SMTP_PORT" in
  ''|*[!0-9]*)
    echo "SMTP_PORT must be a number." >&2
    exit 1
    ;;
esac

if [ -z "$ADMIN_PASSWORD" ]; then
  echo "ADMIN_PASSWORD cannot be empty." >&2
  exit 1
fi

umask 077

cat > .env <<EOF
APP_PORT='$APP_PORT'
ADMIN_USERNAME='$(quote_env_value "$ADMIN_USERNAME")'
ADMIN_PASSWORD='$(quote_env_value "$ADMIN_PASSWORD")'
ADMIN_SESSION_SECRET='$(quote_env_value "$ADMIN_SESSION_SECRET")'
ADMIN_COOKIE_SECURE='$(quote_env_value "$ADMIN_COOKIE_SECURE")'
APP_TIME_ZONE='$(quote_env_value "$APP_TIME_ZONE")'
DATABASE_URL='$(quote_env_value "$DATABASE_URL")'
SMTP_HOST='$(quote_env_value "$SMTP_HOST")'
SMTP_PORT='$(quote_env_value "$SMTP_PORT")'
SMTP_SECURE='$(quote_env_value "$SMTP_SECURE")'
SMTP_REQUIRE_TLS='$(quote_env_value "$SMTP_REQUIRE_TLS")'
SMTP_USER='$(quote_env_value "$SMTP_USER")'
SMTP_PASS='$(quote_env_value "$SMTP_PASS")'
MAIL_FROM='$(quote_env_value "$MAIL_FROM")'
MAIL_REPLY_TO='$(quote_env_value "$MAIL_REPLY_TO")'
SMTP_TEST_TO='$(quote_env_value "$SMTP_TEST_TO")'
REMINDER_CRON_SECRET='$(quote_env_value "$REMINDER_CRON_SECRET")'
REMINDER_CHECK_INTERVAL_MINUTES='$(quote_env_value "$REMINDER_CHECK_INTERVAL_MINUTES")'
REMINDER_RUN_ON_START='$(quote_env_value "$REMINDER_RUN_ON_START")'
REMINDER_MAX_ATTEMPTS='$(quote_env_value "$REMINDER_MAX_ATTEMPTS")'
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
