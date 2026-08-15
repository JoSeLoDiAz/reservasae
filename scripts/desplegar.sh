#!/bin/bash
# despliega en el principal y marca el commit
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

# en una replica esto arrancaria la aplicacion contra
# una base de solo lectura: migrate deploy falla y el
# backend entra en ciclo de reinicios
if es_replica_local; then
  echo "✗ esta sede es una replica; el despliegue va en el principal"
  echo "  para ponerla al dia: scripts/seguir-al-principal.sh"
  exit 1
fi

# sin GitHub tambien se despliega: se construye HEAD y
# las replicas lo traen de aqui por ssh
git pull --ff-only || echo "! no pude traer de origin, sigo con lo local"

docker compose up -d --build
docker compose exec -T nginx nginx -s reload

esperar_local /api/estado || { echo "✗ el backend no respondio, no marco nada"; exit 1; }
esperar_local /consulta   || { echo "✗ el frontend no respondio, no marco nada"; exit 1; }

git rev-parse HEAD > .desplegado
echo "✓ desplegado y marcado $(git rev-parse --short HEAD)"

# el tunel lo gobierna su guion, nunca "compose up"
scripts/arrancar-tunel.sh
