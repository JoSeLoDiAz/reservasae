#!/bin/sh
# Arranque del backend dentro del contenedor.
#
# Antes esto era un `sh -c` de una linea en el Dockerfile. Se
# saco a un archivo porque ahora hay que decidir una cosa mas:
# si hace falta levantar una pantalla virtual.
set -e

# Una pantalla donde dibujar, solo si se pide.
#
# El buscador rechaza los navegadores ocultos —contesta
# «tráfico inusual»— y un servidor no tiene pantalla. Xvfb
# inventa una: asi el navegador corre CON ventana aunque nadie
# la vea. Cuesta memoria, asi que no se levanta salvo que
# alguien encienda WEB_CON_CABEZA=1.
if [ "$WEB_CON_CABEZA" = "1" ]; then
  if command -v Xvfb >/dev/null 2>&1; then
    echo "Levantando pantalla virtual en :99 (WEB_CON_CABEZA=1)"
    Xvfb :99 -screen 0 1400x1000x24 -nolisten tcp >/dev/null 2>&1 &
    export DISPLAY=:99
    # que alcance a abrir antes de que algo la busque
    sleep 1
  else
    echo "WEB_CON_CABEZA=1 pero no hay Xvfb en la imagen: sigue sin pantalla."
  fi
fi

# Las migraciones antes de arrancar, como siempre.
pnpm exec prisma migrate deploy

exec node dist/main.js
