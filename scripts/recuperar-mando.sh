#!/bin/bash
# la sede preferida recupera el mando cuando ya esta sana
set -uo pipefail

# el bloque obliga a leer el guion entero antes de
# ejecutarlo, por si el repositorio cambia debajo
{
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

SEDE=${SEDE:-$(hostname)}
PREFERIDA=${SEDE_PREFERIDA:-}
# cuanto tiene que llevar sana antes de reclamar
ESPERA=${ESPERA_RECUPERAR:-600}
MARCA=.sana-desde

# sin sede preferida no hay nada que recuperar: el
# failover se queda donde lo dejo autopromover
[ -n "$PREFERIDA" ] || exit 0
[ "$SEDE" = "$PREFERIDA" ] || exit 0

# si ya manda, no hay nada que hacer
if ! es_replica_local; then
  rm -f "$MARCA"
  exit 0
fi

# quien manda ahora, y que responda de verdad: si esta
# caido esto no es asunto de este guion sino de
# autopromover, que espera su propia cuenta. Sale de
# PRINCIPAL, que es lo que usa el resto del sistema;
# .sigue-a no siempre existe y aqui se salia en silencio
principal=$(printf '%s' "${PRINCIPAL#*@}" | tr -d '\r' | tr -d ' ')
[ -n "$principal" ] && [ "$principal" != "$SEDE" ] || { rm -f "$MARCA"; exit 0; }

en_recovery=$(ssh -n -o BatchMode=yes -o ConnectTimeout=15 "sepadmin@$principal" \
  'cd /opt/sep/reservasae && docker compose exec -T db sh -c "psql -tAU \$POSTGRES_USER -d \$POSTGRES_DB -c \"SELECT pg_is_in_recovery()\"" 2>/dev/null' \
  2>/dev/null | tr -d '\r' | tr -d ' ')
if [ "$en_recovery" != "f" ]; then
  echo "$principal no responde como principal; eso lo mira autopromover"
  rm -f "$MARCA"
  exit 0
fi

# al dia de verdad: recibiendo WAL y sin retraso. Tomar
# el mando con bytes sin aplicar seria perderlos
estado=$(docker compose exec -T db sh -c \
  'psql -tAU "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT status FROM pg_stat_wal_receiver"' \
  2>/dev/null | tr -d '\r' | tr -d ' ')
if [ "$estado" != "streaming" ]; then
  echo "la replica local no esta en streaming ($estado): no reclamo nada"
  rm -f "$MARCA"
  exit 0
fi

atraso=$(docker compose exec -T db sh -c \
  'psql -tAU "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COALESCE(pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn()), 0)::bigint"' \
  2>/dev/null | tr -d '\r' | tr -d ' ')
if [ -z "$atraso" ] || [ "$atraso" -gt 0 ] 2>/dev/null; then
  echo "quedan $atraso bytes por aplicar: espero"
  rm -f "$MARCA"
  exit 0
fi

# la cuenta empieza cuando se cumple todo lo anterior, no
# cuando arranca la maquina: asi una red que va y viene
# reinicia el reloj en vez de acumular tiempo
ahora=$(date +%s)
[ -f "$MARCA" ] || echo "$ahora" > "$MARCA"
desde=$(cat "$MARCA" 2>/dev/null | tr -cd '0-9')
[ -n "$desde" ] || desde=$ahora
llevo=$((ahora - desde))

if [ "$llevo" -lt "$ESPERA" ]; then
  echo "sana desde hace ${llevo}s, reclamo el mando a los ${ESPERA}s"
  exit 0
fi

echo "--- ${SEDE} lleva ${llevo}s sana y al dia: recupera el mando ---"
rm -f "$MARCA"
# el principal responde, asi que promover exige FORZAR;
# aqui esta justificado: se acaba de comprobar que esta
# sede no tiene un solo byte sin aplicar
FORZAR=si exec scripts/promover.sh < /dev/null
}
