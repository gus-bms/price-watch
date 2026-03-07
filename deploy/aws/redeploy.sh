#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"
MIGRATION_FILE="$SCRIPT_DIR/001-add-user-auth.sql"
BACKEND_ARCHIVE="$SCRIPT_DIR/price-watch-backend-aws-main.tar.gz"
FRONTEND_ARCHIVE="$SCRIPT_DIR/price-watch-frontend-aws-main.tar.gz"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

wait_for_health() {
  local container="$1"
  local status=""

  for _ in $(seq 1 60); do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      return 0
    fi
    sleep 2
  done

  echo "Container $container did not become healthy. Last status: ${status:-unknown}" >&2
  docker logs "$container" --tail 100 >&2 || true
  return 1
}

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$SCRIPT_DIR/certbot/www"

for archive in "$BACKEND_ARCHIVE" "$FRONTEND_ARCHIVE"; do
  if [ -f "$archive" ]; then
    gunzip -c "$archive" | docker load >/dev/null
  fi
done

compose up -d mysql
wait_for_health pw-mysql

set -a
. "$ENV_FILE"
set +a

if [ -f "$MIGRATION_FILE" ]; then
  docker exec -e MYSQL_PWD="$DB_PASSWORD" -i pw-mysql \
    mysql -u"$DB_USER" "$DB_NAME" < "$MIGRATION_FILE"
fi

compose up -d --force-recreate backend worker frontend
wait_for_health pw-backend
wait_for_health pw-worker
wait_for_health pw-frontend
compose ps
