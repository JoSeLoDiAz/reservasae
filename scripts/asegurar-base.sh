#!/bin/bash
# levanta la base si el arranque la dejo caida
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

[ "$(docker inspect -f '{{.State.Running}}' reservasae_db 2>/dev/null)" = true ] && exit 0

# docker publica el puerto en la IP de tailscale, que al
# arrancar la maquina todavia no existe: sin esperarla el
# contenedor muere con "cannot assign requested address"
if [ -n "${PG_BIND:-}" ] && ! ip -4 -o addr show 2>/dev/null | grep -qw "$PG_BIND"; then
  echo "$PG_BIND aun no esta asignada, espero"
  exit 0
fi

echo "--- la base no corre, la levanto ---"
docker compose up -d db || { echo "✗ no pude levantar la base"; exit 1; }
