#!/bin/bash
# resumen de las tres sedes, desde cualquiera de ellas
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

SEDE=${SEDE:-$(hostname)}
printf '%-16s %-6s %-7s %-6s %-13s %-6s %s\n' \
  SEDE PAPEL LINEA TUNEL LSN APP SIGUE-A

for s in $OTRAS_SEDES; do
  if [ "$s" = "$SEDE" ]; then
    datos=$(bash -c '
      cd /opt/sep/reservasae
      [ -f .env ] && . ./.env
      r=$(docker compose exec -T db sh -c "psql -tAU \$POSTGRES_USER -d \$POSTGRES_DB -c \"SELECT CASE WHEN pg_is_in_recovery() THEN chr(114) ELSE chr(112) END || chr(124) || (SELECT timeline_id FROM pg_control_checkpoint()) || chr(124) || CASE WHEN pg_is_in_recovery() THEN pg_last_wal_replay_lsn()::text ELSE pg_current_wal_lsn()::text END\"" 2>/dev/null | tr -d "\r")
      t=$(docker inspect -f "{{.State.Running}}" reservasae_cloudflared 2>/dev/null || echo no)
      a=$(curl -fsS -o /dev/null http://127.0.0.1:4600/api/estado && echo si || echo no)
      echo "$r|$t|$a|${PRINCIPAL:-}"')
  else
    datos=$(ssh -n -o BatchMode=yes -o ConnectTimeout=10 "sepadmin@$s" '
      cd /opt/sep/reservasae
      [ -f .env ] && . ./.env
      r=$(docker compose exec -T db sh -c "psql -tAU \$POSTGRES_USER -d \$POSTGRES_DB -c \"SELECT CASE WHEN pg_is_in_recovery() THEN chr(114) ELSE chr(112) END || chr(124) || (SELECT timeline_id FROM pg_control_checkpoint()) || chr(124) || CASE WHEN pg_is_in_recovery() THEN pg_last_wal_replay_lsn()::text ELSE pg_current_wal_lsn()::text END\"" 2>/dev/null | tr -d "\r")
      t=$(docker inspect -f "{{.State.Running}}" reservasae_cloudflared 2>/dev/null || echo no)
      a=$(curl -fsS -o /dev/null http://127.0.0.1:4600/api/estado && echo si || echo no)
      echo "$r|$t|$a|${PRINCIPAL:-}"' 2>/dev/null)
  fi

  if [ -z "$datos" ]; then
    printf '%-16s %s\n' "$s" "INALCANZABLE"
    continue
  fi

  papel=$(echo "$datos" | cut -d'|' -f1)
  linea=$(echo "$datos" | cut -d'|' -f2)
  lsn=$(echo   "$datos" | cut -d'|' -f3)
  tunel=$(echo "$datos" | cut -d'|' -f4)
  app=$(echo   "$datos" | cut -d'|' -f5)
  sigue=$(echo "$datos" | cut -d'|' -f6)

  case "$papel" in p) papel=PRINCI ;; r) papel=replica ;; *) papel="?" ;; esac
  case "$tunel" in true) tunel=SI ;; *) tunel=no ;; esac

  printf '%-16s %-6s %-7s %-6s %-13s %-6s %s\n' \
    "$s" "$papel" "$linea" "$tunel" "$lsn" "$app" "${sigue#*@}"
done

echo
echo "Sano: un solo PRINCI, un solo TUNEL en SI, todas en la misma LINEA,"
echo "y las replicas con el mismo LSN que el principal."
