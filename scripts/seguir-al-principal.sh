#!/bin/bash
# deja esta replica lista en el commit que el principal verifico
set -uo pipefail

# el bloque obliga a leer el guion entero antes de
# ejecutarlo: el reset de abajo reescribe este archivo
{
cd "$(dirname "$0")/.."

# el .env manda: tras un failover apunta a otra sede
[ -f .env ] && . ./.env
PRINCIPAL=${PRINCIPAL:-sepadmin@server-bogota}

marcado=$(ssh -n -o BatchMode=yes -o ConnectTimeout=15 "$PRINCIPAL" \
  'cat /opt/sep/reservasae/.desplegado' 2>/dev/null | tr -d '\r\n')

# el principal caido no es un error aqui
case "$marcado" in
  [0-9a-f][0-9a-f]*) ;;
  *) echo "sin respuesta del principal, no cambio nada"; exit 0 ;;
esac

# se compara con lo construido, no con HEAD
if [ "$marcado" = "$(cat .construido 2>/dev/null)" ]; then
  echo "listo en ${marcado:0:7}"
  exit 0
fi

git fetch -q origin main || { echo "✗ no pude traer el repositorio"; exit 1; }
git checkout -q main
git reset -q --hard "$marcado" || { echo "✗ no encontre $marcado"; exit 1; }

# se construye, no se arranca: la base es de solo lectura
docker compose build || { echo "✗ fallo la construccion"; exit 1; }

echo "$marcado" > .construido
echo "✓ listo en ${marcado:0:7} con las imagenes construidas"
}
