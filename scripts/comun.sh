#!/bin/bash
# funciones que comparten los guiones de sede

# el .env de la sede manda sobre los valores por defecto
cargar_env() {
  [ -f .env ] && . ./.env
  return 0
}

# escribe sin pegarse a una ultima linea sin salto
poner_variable() {
  local clave=$1 valor=$2
  if [ -s .env ] && [ "$(tail -c1 .env | wc -l)" -eq 0 ]; then
    printf '\n' >> .env
  fi
  if grep -q "^$clave=" .env 2>/dev/null; then
    sed -i "s|^$clave=.*|$clave=$valor|" .env
  else
    printf '%s=%s\n' "$clave" "$valor" >> .env
  fi
  chmod 600 .env
}

quitar_variable() {
  [ -f .env ] && sed -i "/^$1=/d" .env
  return 0
}

# la raiz da 404 a proposito, se prueba /consulta
esperar_local() {
  local ruta=$1 intentos=${2:-40}
  local _
  for _ in $(seq 1 "$intentos"); do
    curl -fsS -o /dev/null "http://127.0.0.1:4600$ruta" && return 0
    sleep 3
  done
  return 1
}

# SIRVE | CAIDA | INALCANZABLE
# distinguir las dos ultimas es la diferencia entre
# "se murio" y "no la veo yo", que no es lo mismo
estado_de_sede() {
  local sede=$1
  local salida
  salida=$(ssh -n -o BatchMode=yes -o ConnectTimeout=10 "sepadmin@$sede" \
    'curl -fsS -o /dev/null http://127.0.0.1:4600/api/estado && echo SIRVE || echo CAIDA' \
    2>/dev/null | tr -d '\r')
  case "$salida" in
    SIRVE|CAIDA) echo "$salida" ;;
    *)           echo INALCANZABLE ;;
  esac
}

# la linea temporal crece con cada promocion: la sede
# con el numero mas alto es la legitima
linea_temporal_local() {
  docker compose exec -T db sh -c \
    'psql -tAU "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT timeline_id FROM pg_control_checkpoint()"' \
    2>/dev/null | tr -d '\r' | tr -cd '0-9'
}

linea_temporal_de_sede() {
  ssh -n -o BatchMode=yes -o ConnectTimeout=10 "sepadmin@$1" \
    'cd /opt/sep/reservasae && docker compose exec -T db sh -c "psql -tAU \$POSTGRES_USER -d \$POSTGRES_DB -c \"SELECT timeline_id FROM pg_control_checkpoint()\"" 2>/dev/null' \
    2>/dev/null | tr -d '\r' | tr -cd '0-9'
}

es_replica_local() {
  local r
  r=$(docker compose exec -T db sh -c \
    'psql -tAU "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_is_in_recovery()"' \
    2>/dev/null | tr -d '\r' | tr -d ' ')
  [ "$r" = "t" ]
}

# las ranuras de replicacion no admiten guiones
ranura_de() {
  printf '%s' "$1" | tr '-' '_' | tr -cd 'a-z0-9_'
}

OTRAS_SEDES=${OTRAS_SEDES:-server-bogota server-socorro server-pc-dell}
