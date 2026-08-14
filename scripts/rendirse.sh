#!/bin/bash
# esta sede deja de mandar y pasa a seguir a otra
set -uo pipefail

# el bloque obliga a leer el guion entero antes de
# ejecutarlo, por si el repositorio cambia debajo
{
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

NUEVO=${1:-}
case "$NUEVO" in
  ""|-h|--help) echo "uso: $0 <sede>    por ejemplo: $0 server-socorro"; exit 1 ;;
esac

# nada se destruye hasta comprobar que hay a donde ir
echo "--- comprobando $NUEVO antes de tocar nada ---"

clave=$(ssh -n -o BatchMode=yes -o ConnectTimeout=20 "sepadmin@$NUEVO" \
  'grep "^PG_REPL_PASSWORD=" /opt/sep/reservasae/.env | cut -d= -f2-' 2>/dev/null | tr -d '\r')
[ -n "$clave" ] || { echo "✗ $NUEVO no tiene PG_REPL_PASSWORD en su .env"; exit 1; }

ip=$(ssh -n -o BatchMode=yes -o ConnectTimeout=20 "sepadmin@$NUEVO" \
  'tailscale ip -4 | head -1' 2>/dev/null | tr -d '\r')
[ -n "$ip" ] || { echo "✗ no obtuve la direccion de $NUEVO"; exit 1; }

suya=$(linea_temporal_de_sede "$NUEVO")
[ -n "$suya" ] || { echo "✗ la base de $NUEVO no responde"; exit 1; }

en_recovery=$(ssh -n -o BatchMode=yes "sepadmin@$NUEVO" \
  'cd /opt/sep/reservasae && docker compose exec -T db sh -c "psql -tAU \$POSTGRES_USER -d \$POSTGRES_DB -c \"SELECT pg_is_in_recovery()\"" 2>/dev/null' \
  2>/dev/null | tr -d '\r' | tr -d ' ')
[ "$en_recovery" = "f" ] || { echo "✗ $NUEVO tampoco es principal (recovery=$en_recovery)"; exit 1; }

ranura=$(ranura_de "$(hostname)")
if ! docker run --rm -e PGPASSWORD="$clave" postgres:17-alpine \
     psql "postgresql://replicador@$ip:5433/postgres?replication=database" \
     -c "IDENTIFY_SYSTEM" >/dev/null 2>&1; then
  echo "✗ $NUEVO no acepta conexiones de replicacion en $ip:5433"
  echo "  revisa que tenga PG_BIND en su .env"
  exit 1
fi
echo "    $NUEVO es principal, linea temporal $suya, y acepta replicacion"

# soltar el trafico antes de tocar los datos
echo "--- soltando el trafico ---"
quitar_variable SEDE_ACTIVA
quitar_variable COMPOSE_PROFILES
docker compose --profile tunel rm -sf cloudflared >/dev/null 2>&1
docker compose rm -sf backend frontend nginx >/dev/null 2>&1
# la marca de despliegue es del principal, no de una replica
rm -f .desplegado

# lo que esta sede escribio de mas se pierde al
# resembrar: queda en disco por si hubo reservas
respaldo=~/rendicion-$(date +%Y%m%d-%H%M%S).sql
echo "--- guardando lo que hay aqui en $respaldo ---"
if docker compose exec -T db sh -c \
     'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$respaldo" 2>/dev/null && [ -s "$respaldo" ]; then
  echo "    $(wc -c < "$respaldo") bytes guardados"
else
  rm -f "$respaldo"
  echo "! no pude respaldar; si habia escrituras propias, se perderan"
  echo "  escribe SI para continuar de todos modos"
  read -r respuesta
  [ "$respuesta" = SI ] || { echo "cancelado"; exit 1; }
fi

echo "--- copia base desde $NUEVO ($ip), ranura $ranura ---"
ssh -n -o BatchMode=yes "sepadmin@$NUEVO" \
  "cd /opt/sep/reservasae && docker compose exec -T db psql -U reservasae -d reservasae -c \"SELECT pg_drop_replication_slot('$ranura') WHERE EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '$ranura' AND NOT active)\"" \
  >/dev/null 2>&1

vol=$(docker volume ls -q | grep pgdata | head -1)
[ -n "$vol" ] || { echo "✗ no encontre el volumen de datos"; exit 1; }

docker compose down >/dev/null 2>&1
docker volume rm "$vol" >/dev/null 2>&1
docker volume create "$vol" >/dev/null

if ! docker run --rm -e PGPASSWORD="$clave" -v "$vol":/var/lib/postgresql/data \
     postgres:17-alpine sh -c "
       pg_basebackup -h $ip -p 5433 -U replicador \
         -D /var/lib/postgresql/data/pgdata -X stream -C -S $ranura -R &&
       chown -R postgres:postgres /var/lib/postgresql/data &&
       chmod 700 /var/lib/postgresql/data/pgdata"; then
  echo "✗ fallo la copia base. Esta sede queda SIN base de datos."
  echo "  lo que habia esta en $respaldo"
  echo "  arregla la conexion con $NUEVO y vuelve a lanzar este guion"
  exit 1
fi

poner_variable PRINCIPAL "sepadmin@$NUEVO"

docker compose up -d db >/dev/null 2>&1
sleep 10
docker compose exec -T db psql -U reservasae -d reservasae \
  -c "SELECT pg_is_in_recovery() AS es_replica, (SELECT timeline_id FROM pg_control_checkpoint()) AS linea;"

echo "✓ esta sede sigue ahora a $NUEVO"
echo "  respaldo de lo anterior: $respaldo"
}
