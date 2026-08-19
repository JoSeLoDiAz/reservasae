#!/bin/bash
# convierte esta replica en el principal
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh

cargar_env
SEDE=${SEDE:-$(hostname)}
PRINCIPAL=${PRINCIPAL:-sepadmin@server-bogota}
sede_principal=${PRINCIPAL#*@}

# dos bases escribiendo es peor que la caida
estado=$(estado_de_sede "$sede_principal")
echo "--- el principal ($sede_principal) esta: $estado ---"

if [ "$estado" = INALCANZABLE ]; then
  # no verlo yo no significa que este muerto
  for otra in $OTRAS_SEDES; do
    [ "$otra" = "$SEDE" ] && continue
    [ "$otra" = "$sede_principal" ] && continue
    segunda=$(ssh -n -o BatchMode=yes -o ConnectTimeout=12 "sepadmin@$otra" \
      "ssh -n -o BatchMode=yes -o ConnectTimeout=10 sepadmin@$sede_principal 'curl -fsS -o /dev/null http://127.0.0.1:4600/api/estado && echo SIRVE || echo CAIDA'" \
      2>/dev/null | tr -d '\r')
    if [ "$segunda" = SIRVE ]; then
      echo "    pero $otra si lo ve vivo: es una particion de red, no una caida"
      estado=SIRVE
      break
    fi
    [ -n "$segunda" ] && echo "    $otra tambien lo ve: $segunda"
  done
fi

if [ "$estado" = SIRVE ]; then
  echo "✗ el principal sigue atendiendo"
  echo "  promover ahora dejaria dos bases aceptando escrituras"
  echo "  si de verdad quieres: FORZAR=si $0"
  [ "${FORZAR:-}" = si ] || exit 1
  echo "  forzado por peticion expresa"
fi

es_replica_local || { echo "✗ esta base no es una replica; nada que promover"; exit 1; }

# si otra sede ya promovio, esta llega tarde
mi_linea=$(linea_temporal_local)
for otra in $OTRAS_SEDES; do
  [ "$otra" = "$SEDE" ] && continue
  suya=$(linea_temporal_de_sede "$otra")
  if [ -n "$suya" ] && [ -n "$mi_linea" ] && [ "$suya" -gt "$mi_linea" ] 2>/dev/null; then
    echo "✗ $otra ya va por la linea temporal $suya y esta sede por $mi_linea"
    echo "  alguien promovio antes; sigue a esa sede: scripts/rendirse.sh $otra"
    [ "${FORZAR:-}" = si ] || exit 1
  fi
done

echo "--- promoviendo la base ---"
docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_promote(wait => true)"' || {
    echo "✗ fallo la promocion"; exit 1; }

# sin esto la base solo escucha en 127.0.0.1
if [ -z "${PG_BIND:-}" ]; then
  ip=$(tailscale ip -4 2>/dev/null | head -1)
  if [ -n "$ip" ]; then
    poner_variable PG_BIND "$ip"
    echo "--- la base pasa a escuchar en $ip ---"
  else
    echo "! sin tailscale: nadie podra replicar desde aqui"
  fi
fi

echo "--- levantando la aplicacion ---"
docker compose up -d --build
docker compose exec -T nginx nginx -s reload

esperar_local /api/estado || { echo "✗ el backend no respondio"; exit 1; }
esperar_local /consulta   || { echo "✗ el frontend no respondio"; exit 1; }

# sin esta marca las replicas se quedan sin nada que
# seguir: rendirse.sh la borro al degradar esta sede
git rev-parse HEAD > .desplegado

# esta sede ya no sigue a nadie
poner_variable PRINCIPAL "sepadmin@$SEDE"

# el tunel lo enciende su guion, que comprueba antes
# que ninguna otra sede lo tenga levantado
if [ -n "${TUNEL_TOKEN:-}" ]; then
  poner_variable SEDE_ACTIVA si
  scripts/arrancar-tunel.sh
else
  echo "! sin TUNEL_TOKEN en .env: el dominio no apunta aqui"
fi

echo
echo "✓ $SEDE es ahora el principal"
echo
echo "  PENDIENTE en las otras dos sedes, y no es opcional:"
for otra in $OTRAS_SEDES; do
  [ "$otra" = "$SEDE" ] && continue
  echo "    ssh $otra → cd /opt/sep/reservasae && ./scripts/rendirse.sh $SEDE"
done
echo "  la sede caida seguira escribiendo en su propia base hasta que se rinda,"
echo "  y la otra replica se congela sin avisar: su ranura ya no existe aqui"
