#!/bin/bash
# levanta la base, y la recrea si no replica
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

sin_retorno() { tr -d '\r' | tr -d ' '; }

if [ "$(docker inspect -f '{{.State.Running}}' reservasae_db 2>/dev/null)" = true ]; then
  # corre, pero puede correr sin replicar: si arranco
  # antes de que tailscale levantara el enlace, se quedo
  # sin ruta a la red privada, y REINICIARLO NO LA
  # RENUEVA. Paso el 19 ago 2026 al actualizar el nucleo
  es_replica_local || exit 0

  enlace=$(docker compose exec -T db sh -c \
    'psql -tAU "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT status FROM pg_stat_wal_receiver"' \
    2>/dev/null | sin_retorno)
  [ -n "$enlace" ] && exit 0

  # sin receptor. Si el principal esta caido, recrear no
  # arregla nada: solo se recrea si de verdad responde
  principal=$(cat .sigue-a 2>/dev/null | sin_retorno)
  [ -z "$principal" ] && exit 0

  ip_principal=$(getent hosts "$principal" 2>/dev/null | awk '{print $1}' | head -1)
  [ -z "$ip_principal" ] && exit 0
  timeout 5 bash -c "cat < /dev/null > /dev/tcp/$ip_principal/5433" 2>/dev/null || exit 0

  echo "--- corre sin replicar y $principal responde: la recreo ---"
  docker compose up -d --force-recreate db || echo "✗ no pude recrearla"
  exit 0
fi

# docker publica el puerto en la IP de tailscale, que al
# arrancar la maquina todavia no existe: sin esperarla el
# contenedor muere con "cannot assign requested address"
if [ -n "${PG_BIND:-}" ] && ! ip -4 -o addr show 2>/dev/null | grep -qw "$PG_BIND"; then
  echo "$PG_BIND aun no esta asignada, espero"
  exit 0
fi

echo "--- la base no corre, la levanto ---"
docker compose up -d db || { echo "✗ no pude levantar la base"; exit 1; }
