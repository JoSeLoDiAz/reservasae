#!/bin/bash
# convierte esta replica en el principal
set -uo pipefail
cd "$(dirname "$0")/.."

PRINCIPAL=${PRINCIPAL:-sepadmin@server-bogota}
TUNEL=${TUNEL:-cloudflared-convoca}

# dos bases escribiendo es peor que la caida
if ssh -n -o BatchMode=yes -o ConnectTimeout=10 "$PRINCIPAL" \
     'curl -fsS -o /dev/null http://127.0.0.1:4600/api/estado' 2>/dev/null; then
  echo "✗ el principal sigue respondiendo"
  echo "  promover ahora dejaria dos bases aceptando escrituras"
  echo "  si de verdad quieres: FORZAR=si $0"
  [ "${FORZAR:-}" = si ] || exit 1
  echo "  forzado por peticion expresa"
fi

esta_replica=$(docker compose exec -T db sh -c \
  'psql -tAU "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_is_in_recovery()"' \
  2>/dev/null | tr -d '\r')

if [ "$esta_replica" != "t" ]; then
  echo "✗ esta base no es una replica; no hay nada que promover"
  exit 1
fi

echo "--- promoviendo la base ---"
docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_promote(wait => true)"'

echo "--- levantando la aplicacion ---"
docker compose up -d --build
docker compose exec -T nginx nginx -s reload

# la raiz da 404 a proposito, probamos /consulta
esperar() {
  for _ in $(seq 1 40); do
    curl -fsS -o /dev/null "http://127.0.0.1:4600$1" && return 0
    sleep 3
  done
  return 1
}

esperar /api/estado || { echo "✗ el backend no respondio"; exit 1; }
esperar /consulta   || { echo "✗ el frontend no respondio"; exit 1; }

# el tunel solo debe correr en la sede activa
if systemctl list-unit-files "$TUNEL.service" >/dev/null 2>&1; then
  sudo systemctl enable --now "$TUNEL"
  echo "✓ tunel $TUNEL arriba"
else
  echo "! falta el servicio $TUNEL: el dominio sigue sin apuntar aqui"
fi

echo "✓ esta sede es ahora el principal"
echo "  la otra replica sigue siguiendo a la sede caida; hay que reapuntarla"
