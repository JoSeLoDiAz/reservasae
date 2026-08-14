#!/bin/bash
# despliega en el principal y marca el commit
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
docker compose up -d --build
docker compose exec -T nginx nginx -s reload

# no se marca nada hasta que responda
bueno=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:4600/api/estado; then bueno=1; break; fi
  sleep 2
done

if [ "$bueno" != 1 ]; then
  echo "✗ el backend no respondio; no marco este commit"
  exit 1
fi

if ! curl -fsS -o /dev/null http://127.0.0.1:4600/; then
  echo "✗ el frontend no respondio; no marco este commit"
  exit 1
fi

git rev-parse HEAD > .desplegado
echo "✓ desplegado y marcado $(git rev-parse --short HEAD)"
