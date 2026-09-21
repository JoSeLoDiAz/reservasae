FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
# el contexto es la RAIZ del repo: aqui viven el lockfile y
# el workspace, y grupo-ae no tiene los suyos
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY grupo-ae/backend/package.json ./grupo-ae/backend/
COPY grupo-ae/frontend/package.json ./grupo-ae/frontend/
# Playwright NO publica binarios para Alpine: si intenta bajarselos, la
# construccion se cae o se lleva 150 MB para nada. El navegador lo pone
# la imagen final, con el `chromium` del sistema.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# el filtro es el NOMBRE del paquete, no la carpeta: con
# `backend` se construiria Convoca sin que nada fallara
RUN pnpm install --frozen-lockfile --filter grupoae-backend
COPY grupo-ae/backend/ ./grupo-ae/backend/
WORKDIR /app/grupo-ae/backend
# El cliente se genera ANTES de compilar: src/ lo importa desde
# ../generated/prisma y sin el no hay tipos contra los que compilar.
RUN pnpm exec prisma generate
RUN pnpm run build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# El navegador, que dos cosas necesitan: la consulta al RUI —que abre
# el portal del DNP— y la validacion de empresas por buscador. Sin esto
# las dos fallan en produccion aunque funcionen en el portatil.
#
#   chromium         el navegador
#   nss ... freetype lo que necesita para dibujar
#   ttf-freefont     sin fuentes, las paginas salen en cuadritos
#   font-noto        tildes y enes, que aqui hacen falta
#   xvfb             una pantalla virtual, para cuando haga falta
#                    un navegador CON ventana en una maquina sin
#                    pantalla. Se enciende con WEB_CON_CABEZA=1.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      freetype-dev \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto \
      xvfb \
      dbus

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    CHROMIUM_RUTA=/usr/bin/chromium-browser

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY grupo-ae/backend/package.json ./grupo-ae/backend/
COPY grupo-ae/frontend/package.json ./grupo-ae/frontend/
RUN pnpm install --frozen-lockfile --filter grupoae-backend --prod
COPY --from=build /app/grupo-ae/backend/dist ./grupo-ae/backend/dist
# El cliente generado viaja a la imagen final porque dist/ lo importa en
# tiempo de ejecucion; el schema y las migraciones porque las necesita
# `prisma migrate deploy` al arrancar. `prisma` esta en dependencies (no en
# devDependencies) justamente para que exista aqui despues del install --prod.
COPY --from=build /app/grupo-ae/backend/generated ./grupo-ae/backend/generated
COPY grupo-ae/backend/prisma ./grupo-ae/backend/prisma
COPY grupo-ae/backend/arrancar.sh /usr/local/bin/arrancar
RUN chmod +x /usr/local/bin/arrancar
WORKDIR /app/grupo-ae/backend
EXPOSE 4000
CMD ["arrancar"]
