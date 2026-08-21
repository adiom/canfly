#!/bin/bash
# Синхронизация удалённой БД (Neon) в локальную базу canfly_copy.
# Использование: scripts/canfly-sync.sh
# Расписание (раз в 12 часов) можно повесить на launchd/cron.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.local"
LOCAL_URL="${CANFLY_LOCAL_DB_URL:-postgresql://localhost:5432/canfly_copy}"
PG_BIN="/Applications/Postgres.app/Contents/Versions/latest/bin"

[ -f "$ENV_FILE" ] || { echo "Нет $ENV_FILE" >&2; exit 1; }

# Достаём значение переменной из .env.local без source:
# значения там не закавычены и содержат '&'/'?', которые ломают source.
read_env_var() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-
}

# Копируем с прод-сервера (Neon)
REMOTE_URL="$(read_env_var PRODUCTION_DATABASE_URL || true)"
[ -n "$REMOTE_URL" ] || REMOTE_URL="$(read_env_var DATABASE_URL)"
[ -n "$REMOTE_URL" ] || { echo "Не найден PRODUCTION_DATABASE_URL/DATABASE_URL в $ENV_FILE" >&2; exit 1; }

echo ">> Пересоздаю схему public в $LOCAL_URL"
"$PG_BIN/psql" "$LOCAL_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

echo ">> Дамп с удалённого сервера и восстановление в локальную базу"
"$PG_BIN/pg_dump" --no-owner --no-privileges -Fc "$REMOTE_URL" \
  | "$PG_BIN/pg_restore" --no-owner --no-privileges -d "$LOCAL_URL" --exit-on-error

echo ">> Готово: $(date '+%Y-%m-%d %H:%M:%S')"
