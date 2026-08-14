#!/bin/bash
# resumen de las tres sedes, desde cualquiera de ellas
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

SEDE=${SEDE:-$(hostname)}

printf '%-16s %-10s %-6s %-14s %-11s %-6s %-4s %s\n' \
  SEDE PAPEL LINEA LSN ENLACE TUNEL APP SIGUE-A
printf '%.0s─' $(seq 1 82); echo

for s in $OTRAS_SEDES; do
  if [ "$s" = "$SEDE" ]; then
    d=$(scripts/sonda.sh 2>/dev/null)
  else
    d=$(ssh -n -o BatchMode=yes -o ConnectTimeout=12 "sepadmin@$s" \
        '/opt/sep/reservasae/scripts/sonda.sh' 2>/dev/null | tr -d '\r')
  fi

  if [ -z "$d" ]; then
    printf '%-16s %s\n' "$s" "INALCANZABLE"
    continue
  fi

  IFS='|' read -r papel linea lsn enlace tunel app sigue <<< "$d"
  printf '%-16s %-10s %-6s %-14s %-11s %-6s %-4s %s\n' \
    "$s" "$papel" "$linea" "$lsn" "$enlace" "$tunel" "$app" "${sigue#*@}"
done

echo
echo "Sano: un solo PRINCIPAL, un solo TUNEL en SI, todas en la misma LINEA,"
echo "las replicas con el LSN del principal y ENLACE en streaming."
echo "ENLACE en el principal es cuantas replicas tiene enganchadas."
