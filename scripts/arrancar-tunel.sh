#!/bin/bash
# levanta el tunel solo si esta sede debe atender
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

SEDE=${SEDE:-$(hostname)}

[ -n "${TUNEL_TOKEN:-}" ] || exit 0
case "${COMPOSE_PROFILES:-}" in *tunel*) ;; *) exit 0 ;; esac

# ya esta arriba: no hay nada que hacer
if [ "$(docker inspect -f '{{.State.Running}}' reservasae_cloudflared 2>/dev/null)" = true ]; then
  exit 0
fi

# una replica jamas debe atender el dominio
if es_replica_local; then
  echo "esta sede es replica: el tunel no se levanta"
  exit 0
fi

mi_linea=$(linea_temporal_local)

# si otra sede ya atiende, o va por delante, esta se
# quedo atras tras un failover y no debe competir
for otra in $OTRAS_SEDES; do
  [ "$otra" = "$SEDE" ] && continue

  if [ "$(estado_de_sede "$otra")" = SIRVE ]; then
    echo "$otra ya esta atendiendo: no levanto el tunel"
    exit 0
  fi

  suya=$(linea_temporal_de_sede "$otra")
  if [ -n "$suya" ] && [ -n "$mi_linea" ] && [ "$suya" -gt "$mi_linea" ] 2>/dev/null; then
    echo "$otra va por la linea $suya y esta sede por $mi_linea: no levanto el tunel"
    echo "esta sede quedo atras; deberia rendirse: scripts/rendirse.sh $otra"
    exit 0
  fi
done

docker compose --profile tunel up -d cloudflared
echo "✓ tunel levantado en $SEDE"
