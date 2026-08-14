#!/bin/bash
# el tunel solo corre en la sede que legitimamente atiende
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

SEDE=${SEDE:-$(hostname)}

corriendo=no
[ "$(docker inspect -f '{{.State.Running}}' reservasae_cloudflared 2>/dev/null)" = true ] && corriendo=si

# ante prueba de que esta sede no manda, se baja
bajar() {
  echo "$1"
  if [ "$corriendo" = si ]; then
    docker compose --profile tunel rm -sf cloudflared >/dev/null 2>&1
    echo "  tunel bajado en $SEDE"
  fi
  exit 0
}

[ -n "${TUNEL_TOKEN:-}" ]     || bajar "sin TUNEL_TOKEN"
[ "${SEDE_ACTIVA:-}" = si ]   || bajar "esta sede no esta marcada como activa"
es_replica_local              && bajar "esta sede es replica"

mi_linea=$(linea_temporal_local)
concluyentes=0

for otra in $OTRAS_SEDES; do
  [ "$otra" = "$SEDE" ] && continue

  est=$(estado_de_sede "$otra")
  [ "$est" = SIRVE ] && bajar "$otra ya esta atendiendo"

  suya=$(linea_temporal_de_sede "$otra")
  if [ -n "$suya" ] && [ -n "$mi_linea" ] && [ "$suya" -gt "$mi_linea" ] 2>/dev/null; then
    bajar "$otra va por la linea $suya y esta sede por $mi_linea: rindete con scripts/rendirse.sh $otra"
  fi

  [ "$est" = CAIDA ] && [ -n "$suya" ] && concluyentes=$((concluyentes + 1))
done

# ya atiende y nadie ha probado lo contrario: no se toca.
# Bajarlo por un parpadeo de red seria tirar el sitio.
[ "$corriendo" = si ] && exit 0

# para EMPEZAR a atender si se exige certeza: no ver a
# las otras no es permiso, es justo lo que pasa cuando
# esta sede es la aislada. Basta con que una responda,
# o el PC Dell apagado dejaria el dominio caido.
if [ "$concluyentes" -lt 1 ]; then
  echo "ninguna otra sede respondio: no levanto el tunel todavia"
  exit 0
fi

docker compose --profile tunel up -d cloudflared
echo "✓ tunel levantado en $SEDE"
