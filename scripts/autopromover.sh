#!/bin/bash
# promueve esta sede sola, si el principal murio de verdad
set -uo pipefail
cd "$(dirname "$0")/.."
. scripts/comun.sh
cargar_env

SEDE=${SEDE:-$(hostname)}
PRINCIPAL=${PRINCIPAL:-sepadmin@server-bogota}
sede_principal=${PRINCIPAL#*@}
ESPERA=${ESPERA_PROMOCION:-300}
MARCA=.sin-principal

# el orden decide quien releva cuando hay dos candidatas
PREFERENCIA=${PREFERENCIA_PROMOCION:-server-bogota server-socorro}

olvidar() { rm -f "$MARCA"; }

# el PC Dell nunca: es inestable y al despertar de una
# caida larga no veria a nadie y se creeria sola
[ "${AUTOPROMOVER:-}" = si ] || { echo "$SEDE no se autopromueve"; exit 0; }

es_replica_local || { olvidar; echo "esta sede ya es principal"; exit 0; }

estado=$(estado_de_sede "$sede_principal")
if [ "$estado" = SIRVE ]; then
  olvidar
  echo "$sede_principal atiende"
  exit 0
fi

# una caida se confirma con el reloj, no con un fallo
ahora=$(date +%s)
desde=$(tr -cd '0-9' < "$MARCA" 2>/dev/null)
if [ -z "$desde" ] || [ "$desde" -gt "$ahora" ] 2>/dev/null; then
  echo "$ahora" > "$MARCA"
  echo "$sede_principal esta $estado; arranca la cuenta de ${ESPERA}s"
  exit 0
fi

transcurrido=$((ahora - desde))
if [ "$transcurrido" -lt "$ESPERA" ]; then
  echo "$sede_principal lleva ${transcurrido}s $estado, espero a ${ESPERA}s"
  exit 0
fi

# no ver al principal es indistinguible de haberme
# quedado sin red yo: hace falta una tercera opinion
if [ "$estado" = INALCANZABLE ]; then
  testigos=0
  for otra in $OTRAS_SEDES; do
    [ "$otra" = "$SEDE" ] && continue
    [ "$otra" = "$sede_principal" ] && continue

    # NO_LO_VE distingue "no lo alcanza" de "no me responde"
    suya=$(ssh -n -o BatchMode=yes -o ConnectTimeout=12 "sepadmin@$otra" \
      "ssh -n -o BatchMode=yes -o ConnectTimeout=10 sepadmin@$sede_principal 'curl -fsS -o /dev/null --max-time 8 http://127.0.0.1:4600/api/estado && echo SIRVE || echo CAIDA' 2>/dev/null || echo NO_LO_VE" \
      2>/dev/null | tr -d '\r' | tail -1)

    case "$suya" in
      SIRVE)
        olvidar
        echo "$otra lo ve vivo: la aislada soy yo, no promuevo"
        exit 0 ;;
      CAIDA|NO_LO_VE)
        testigos=$((testigos + 1))
        echo "    $otra confirma: $suya" ;;
      *)
        echo "    $otra no me responde" ;;
    esac
  done

  if [ "$testigos" -lt 1 ]; then
    echo "nadie me responde: la aislada puedo ser yo, no promuevo"
    exit 0
  fi
fi

# con dos candidatas, la que va antes en la lista releva
for antes in $PREFERENCIA; do
  [ "$antes" = "$SEDE" ] && break
  [ "$antes" = "$sede_principal" ] && continue
  if [ "$(estado_de_sede "$antes")" != INALCANZABLE ]; then
    echo "$antes me precede y sigue viva: le toca a ella"
    exit 0
  fi
done

# si alguien ya promovio, esta sede llega tarde
mi_linea=$(linea_temporal_local)
for otra in $OTRAS_SEDES; do
  [ "$otra" = "$SEDE" ] && continue
  suya=$(linea_temporal_de_sede "$otra")
  if [ -n "$suya" ] && [ -n "$mi_linea" ] && [ "$suya" -gt "$mi_linea" ] 2>/dev/null; then
    olvidar
    echo "$otra ya va por la linea $suya: me rindo en vez de promover"
    exit 0
  fi
done

echo "--- $sede_principal lleva ${transcurrido}s sin atender: promuevo $SEDE ---"

# para ensayar los guardias sin tocar la base
if [ "${SIMULAR:-}" = si ]; then
  echo "(simulacion) aqui promoveria $SEDE"
  exit 0
fi

if scripts/promover.sh < /dev/null; then
  olvidar
  echo "✓ $SEDE promovida automaticamente"
else
  echo "✗ fallo la promocion; reintento en el proximo ciclo"
  exit 1
fi
