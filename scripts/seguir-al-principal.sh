#!/bin/bash
# pone esta replica en el commit que el principal verifico
set -uo pipefail
cd "$(dirname "$0")/.."

PRINCIPAL=${PRINCIPAL:-sepadmin@server-bogota}

marcado=$(ssh -n -o BatchMode=yes -o ConnectTimeout=15 "$PRINCIPAL" \
  'cat /opt/sep/reservasae/.desplegado' 2>/dev/null | tr -d '\r\n')

# el principal caido no es un error aqui
case "$marcado" in
  [0-9a-f][0-9a-f]*) ;;
  *) echo "sin respuesta del principal, no cambio nada"; exit 0 ;;
esac

if [ "$marcado" = "$(git rev-parse HEAD)" ]; then
  echo "al dia en ${marcado:0:7}"
  exit 0
fi

git fetch -q origin main || { echo "✗ no pude traer el repositorio"; exit 1; }
git checkout -q main
git reset -q --hard "$marcado" || { echo "✗ no encontre $marcado"; exit 1; }

# se construye, no se arranca: la base es de solo lectura
docker compose build
echo "✓ en ${marcado:0:7} con las imagenes listas"
