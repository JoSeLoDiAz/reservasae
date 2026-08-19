#!/bin/bash
# vuelve a la fila si otra sede ya es la legitima
set -uo pipefail

# el bloque obliga a leer el guion entero antes de
# ejecutarlo, por si el repositorio cambia debajo
{
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

SEDE=${SEDE:-$(hostname)}

mi_linea=$(linea_temporal_local)
[ -n "$mi_linea" ] || { echo "sin base local, no toco nada"; exit 0; }

for otra in $OTRAS_SEDES; do
  [ "$otra" = "$SEDE" ] && continue

  suya=$(linea_temporal_de_sede "$otra")
  [ -n "$suya" ] || continue

  # la linea temporal crece con cada promocion: la mas
  # alta es la legitima, sea yo principal o replica
  [ "$suya" -gt "$mi_linea" ] 2>/dev/null || continue

  en_recovery=$(ssh -n -o BatchMode=yes -o ConnectTimeout=15 "sepadmin@$otra" \
    'cd /opt/sep/reservasae && docker compose exec -T db sh -c "psql -tAU \$POSTGRES_USER -d \$POSTGRES_DB -c \"SELECT pg_is_in_recovery()\"" 2>/dev/null' \
    2>/dev/null | tr -d '\r' | tr -d ' ')
  [ "$en_recovery" = "f" ] || continue

  echo "--- $otra va por la linea $suya y esta sede por $mi_linea ---"
  # sin stdin: rendirse.sh cancela si no logra respaldar
  exec scripts/rendirse.sh "$otra" < /dev/null
done

echo "linea $mi_linea, nadie va por delante"
}
