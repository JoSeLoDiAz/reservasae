#!/bin/bash
# una linea con el estado de esta sede, para estado.sh
set -uo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env

sql="SELECT CASE WHEN pg_is_in_recovery() THEN 'replica' ELSE 'PRINCIPAL' END
  || '|' || (SELECT timeline_id FROM pg_control_checkpoint())
  || '|' || CASE WHEN pg_is_in_recovery()
                 THEN COALESCE(pg_last_wal_replay_lsn()::text, '-')
                 ELSE pg_current_wal_lsn()::text END
  || '|' || CASE WHEN pg_is_in_recovery()
                 THEN COALESCE((SELECT status FROM pg_stat_wal_receiver LIMIT 1), 'SIN-ENLACE')
                 ELSE (SELECT COUNT(*)::text FROM pg_stat_replication) END"

base=$(docker compose exec -T db sh -c "psql -tAX -U \$POSTGRES_USER -d \$POSTGRES_DB -c \"$sql\"" 2>/dev/null \
       | tr -d '\r' | grep '|' | head -1)
[ -n "$base" ] || base='sin-base|-|-|-'

tunel=no
[ "$(docker inspect -f '{{.State.Running}}' reservasae_cloudflared 2>/dev/null)" = true ] && tunel=SI

app=no
curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:4600/api/estado 2>/dev/null && app=si

printf '%s|%s|%s|%s\n' "$base" "$tunel" "$app" "${PRINCIPAL:-}"
