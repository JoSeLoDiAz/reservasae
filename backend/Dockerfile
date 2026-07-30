FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter backend
COPY backend/ ./backend/
WORKDIR /app/backend
# El cliente se genera ANTES de compilar: src/ lo importa desde
# ../generated/prisma y sin el no hay tipos contra los que compilar.
RUN pnpm exec prisma generate
RUN pnpm run build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter backend --prod
COPY --from=build /app/backend/dist ./backend/dist
# El cliente generado viaja a la imagen final porque dist/ lo importa en
# tiempo de ejecucion; el schema y las migraciones porque las necesita
# `prisma migrate deploy` al arrancar. `prisma` esta en dependencies (no en
# devDependencies) justamente para que exista aqui despues del install --prod.
COPY --from=build /app/backend/generated ./backend/generated
COPY backend/prisma ./backend/prisma
WORKDIR /app/backend
EXPOSE 4000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
