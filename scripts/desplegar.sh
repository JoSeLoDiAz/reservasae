#!/bin/bash
# despliega en el principal y marca el commit
set -euo pipefail
cd "$(dirname "$0")/.."

# la raiz da 404 a proposito, probamos /consulta
esperar() {
  for _ in $(seq 1 40); do
    curl -fsS -o /dev/null "http://127.0.0.1:4600$1" && return 0
    sleep 3
  done
  return 1
}

git pull --ff-only
docker compose up -d --build
docker compose exec -T nginx nginx -s reload

esperar /api/estado || { echo "✗ el backend no respondio, no marco nada"; exit 1; }
esperar /consulta   || { echo "✗ el frontend no respondio, no marco nada"; exit 1; }

git rev-parse HEAD > .desplegado
echo "✓ desplegado y marcado $(git rev-parse --short HEAD)"
