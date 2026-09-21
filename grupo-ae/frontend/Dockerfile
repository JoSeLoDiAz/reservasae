# ─────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# el contexto es la RAIZ del repo: el lockfile y el
# workspace estan alli, no en grupo-ae/
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY grupo-ae/frontend/package.json ./grupo-ae/frontend/
COPY grupo-ae/backend/package.json  ./grupo-ae/backend/
# por NOMBRE de paquete: `frontend` seria el de Convoca
RUN pnpm install --frozen-lockfile --filter grupoae-frontend --ignore-scripts

# Copiar fuentes y compilar
COPY grupo-ae/frontend/ ./grupo-ae/frontend/

WORKDIR /app/grupo-ae/frontend
ENV NEXT_TELEMETRY_DISABLED=1
# la franja de pruebas se decide tambien al compilar:
# las paginas estaticas se hornean aqui
ARG ENTORNO=""
ENV ENTORNO=$ENTORNO
RUN pnpm run build

# ─────────────────────────────────────────
# Stage 2: Runtime (standalone)
# ─────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# y en ejecucion, para lo que se pinta por peticion
ARG ENTORNO=""
ENV ENTORNO=$ENTORNO

# Crear usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copiar output standalone (contiene server.js + node_modules minimos).
# `outputFileTracingRoot` es ../.. desde grupo-ae/frontend, o sea /app:
# por eso el server.js queda un nivel mas adentro que en Convoca.
COPY --from=build --chown=nextjs:nodejs /app/grupo-ae/frontend/.next/standalone ./
# Copiar assets estaticos generados
COPY --from=build --chown=nextjs:nodejs /app/grupo-ae/frontend/.next/static ./grupo-ae/frontend/.next/static
# Copiar public
COPY --from=build --chown=nextjs:nodejs /app/grupo-ae/frontend/public ./grupo-ae/frontend/public

USER nextjs
EXPOSE 3000

CMD ["node", "grupo-ae/frontend/server.js"]
