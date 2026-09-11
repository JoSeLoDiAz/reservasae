#!/bin/bash
# Impide que un agente de revision escriba en la base.
#
# Se engancha como hook PreToolUse sobre Bash en `security-reviewer`.
# Claude Code le pasa por stdin el JSON de la llamada; este guion saca
# `tool_input.command` y sale con 2 si ve una operacion de escritura.
# Un exit 2 cancela la herramienta y le devuelve a Claude lo que este
# guion imprima en stderr, de modo que el agente se entera de POR QUE
# se le nego y puede rehacer la consulta.
#
# Por que existe: un revisor que puede modificar lo que revisa deja de
# ser un revisor. Y el fallo no seria malicioso -- seria un `UPDATE`
# escrito para "comprobar" algo, contra la base equivocada.

set -uo pipefail

entrada=$(cat)

# El JSON se lee con un analizador de VERDAD, no con grep.
#
# Aqui habia un `grep -o '"command"..."[^"]*"'` de reserva y estaba
# ROTO de una forma que no se veia: se cortaba en la primera comilla
# escapada, asi que de
#     psql -c \"DELETE FROM oportunidades\"
# extraia solo `psql -c \` y no encontraba el DELETE. El hook dejaba
# pasar TODAS las escrituras y salia con 0, o sea que parecia estar
# funcionando. Un candado que se abre solo y sin ruido es peor que no
# tenerlo, porque nadie vuelve a comprobarlo.
#
# `jq` no esta instalado en este equipo y no se puede instalar sin
# permisos de administrador. `node` si esta -- lo trae el propio
# proyecto -- y sabe leer JSON de verdad.
if command -v jq >/dev/null 2>&1; then
  orden=$(printf '%s' "$entrada" | jq -r '.tool_input.command // empty')
elif command -v node >/dev/null 2>&1; then
  orden=$(printf '%s' "$entrada" | node -e '
    let d = "";
    process.stdin.on("data", (c) => (d += c)).on("end", () => {
      try {
        const j = JSON.parse(d);
        process.stdout.write((j.tool_input && j.tool_input.command) || "");
      } catch {
        // JSON ilegible: se devuelve la entrada cruda para que las
        // reglas de abajo la miren igual. Ante la duda, se revisa.
        process.stdout.write(d);
      }
    });
  ')
else
  # Sin jq y sin node no hay forma fiable de leerlo. Se bloquea: este
  # guion existe para negar, y si no puede decidir, niega.
  echo "BLOQUEADO: no hay jq ni node para leer la orden, y sin leerla no se puede autorizar." >&2
  exit 2
fi

[ -z "$orden" ] && exit 0

# En minusculas para comparar, y los saltos de linea a espacios: sin
# esto, un `insert` pegado a un salto esquivaria el patron.
plano=$(printf '%s' "$orden" | tr 'A-Z' 'a-z' | tr '\n\t\r' '   ')

# Las que escriben. Con delimitadores de palabra para no saltar sobre
# una tabla llamada `updates` ni sobre `--drop-cache`.
ESCRITURAS='(^|[^a-z_])(insert[[:space:]]+into|update[[:space:]]|delete[[:space:]]+from|drop[[:space:]]+(table|database|schema|index|view|column)|alter[[:space:]]+(table|database|schema)|truncate([[:space:]]|$)|create[[:space:]]+(table|database|schema)|grant[[:space:]]|revoke[[:space:]])'

if printf '%s' "$plano" | grep -qE "$ESCRITURAS"; then
  cual=$(printf '%s' "$plano" | grep -oE "$ESCRITURAS" | head -1 | sed 's/^[^a-z]*//')
  {
    echo "BLOQUEADO: esta orden escribe en la base («${cual}»), y este agente revisa en solo lectura."
    echo ""
    echo "Un revisor que puede modificar lo que revisa deja de ser un revisor."
    echo ""
    echo "Si necesita ese dato, lealo: SELECT, EXPLAIN, \\d, o el MCP de Supabase."
    echo "Si el cambio hace falta de verdad, propongalo en el informe y que lo aplique"
    echo "backend-dev o db-schema, que si pueden escribir y dejan rastro de ello."
  } >&2
  exit 2
fi

# `prisma migrate`, `prisma db push` y `db:sembrar-*` tambien escriben,
# aunque no lleven SQL a la vista.
#
# `migrate status` y `migrate diff` NO: solo miran, y son justo lo que
# un revisor necesita para comparar el esquema con lo aplicado.
# Bloquearlas era dejarlo ciego en lo unico que venia a revisar.
MIRAN='prisma[[:space:]]+migrate[[:space:]]+(status|diff|resolve[[:space:]]+--help)'
if ! printf '%s' "$plano" | grep -qE "$MIRAN"; then
  MIGRACIONES='(prisma[[:space:]]+(migrate|db[[:space:]]+push|db[[:space:]]+seed)|db:sembrar|db:reiniciar|db:borrar|db:crear-admin|db:publicar)'
  if printf '%s' "$plano" | grep -qE "$MIGRACIONES"; then
    {
      echo "BLOQUEADO: eso cambia la base (migracion o siembra), y este agente revisa en solo lectura."
      echo ""
      echo "Para VER el estado sin tocarlo: 'prisma migrate status' o 'prisma migrate diff'."
    } >&2
    exit 2
  fi
fi

exit 0
