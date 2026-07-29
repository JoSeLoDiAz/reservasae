# Convoca — reservasae

Contexto del proyecto para retomar el trabajo en cualquier sesión.

## Qué es

Sistema centralizado donde las personas interesadas en **acciones de formación
continua especializada** se inscriben o manifiestan interés. La formación es
**gratuita** y se oferta bajo **dos convenios** distintos; el sistema unifica el
registro de ambos.

- **Nombre visible en la interfaz:** Convoca
- **Dominio:** <https://reservasae.com>
- **Repositorio:** `git@github.com:JoSeLoDiAz/reservasae.git` (privado)
- **Ruta en el servidor:** `/opt/sep/reservasae`

> Decisión de producto: en el sitio público **no se menciona al SENA ni el tipo
> de formación** de forma directa. Ten cuidado con los textos de la interfaz.
>
> Ojo también con la palabra "reserva": si más adelante hay proceso de
> selección o los cupos son limitados por convenio, prometer un cupo garantizado
> genera expectativas que no siempre se podrán cumplir. "Preinscripción" o
> "registro de interés" es más seguro en los textos de cara al usuario.

## Estado actual (29 jul 2026)

**Despliegue base funcionando en producción.** Lo que existe hoy es la
infraestructura completa más una página que verifica la conexión con el backend.

- ✅ Monorepo, Docker, nginx, Cloudflare, HTTPS, CI manual por `git pull`
- ✅ `https://reservasae.com` sirviendo la app; `/api/estado` y `/health` OK
- ❌ **No hay modelo de datos todavía.** Postgres está levantado y vacío.
- ❌ No hay formulario de inscripción, ni autenticación, ni panel de admin.

Falta un paso manual en el panel de Cloudflare: activar **Always Use HTTPS**
(hoy `http://reservasae.com` responde 200 en vez de redirigir).

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS 11 (TypeScript) |
| Frontend | Next.js (App Router, `src/`, Tailwind, TypeScript) |
| Base de datos | PostgreSQL 17 — **vacía** |
| Monorepo | pnpm **10.33.0** (fijado, ver más abajo) |
| Despliegue | Docker Compose + nginx + Cloudflare Tunnel |

## Arquitectura

```
https://reservasae.com
   │
   ▼
Cloudflare Tunnel (cloudflared, servicio del sistema, /etc/cloudflared/config.yml)
   │
   ▼
127.0.0.1:4600  ──►  reservasae_nginx
                        ├── /       ──►  reservasae_frontend  (Next.js, :3000)
                        ├── /api/   ──►  reservasae_backend   (NestJS,  :4000)
                        └── /health ──►  respuesta directa de nginx
                                              │
                                              ▼
                                     reservasae_db (PostgreSQL 17, :5433 solo localhost)
```

**nginx quita el prefijo `/api`**: `/api/estado` llega al backend como
`/estado`. En local no hay nginx, así que `frontend/next.config.ts` tiene un
rewrite que replica exactamente ese salto. Por eso el código del frontend es
idéntico en local y en producción: siempre usa rutas relativas `/api/...`.

Nada se expone a internet directamente. El único puerto publicado es
`127.0.0.1:4600` y solo cloudflared llega ahí.

## Estructura

```
reservasae/
├── backend/              NestJS
│   ├── src/
│   ├── .env              ← NO se sube a git
│   ├── .env.example
│   └── Dockerfile
├── frontend/             Next.js
│   ├── src/app/page.tsx  ← página de verificación actual
│   └── Dockerfile
├── docker/nginx/default.conf
├── docs/
│   ├── cloudflare.md            guía completa del dominio y HTTPS
│   └── cloudflared-config.yml   copia de referencia del ingress del túnel
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

La estructura imita a propósito la del proyecto hermano `SEPLocal` (mismo
servidor, `/opt/sep/SEPLocal`) para que ambos se desplieguen igual.

## Trabajar en local

```bash
pnpm install
cp backend/.env.example backend/.env

pnpm dev:backend    # :4000
pnpm dev:frontend   # :3000
```

No necesitas Docker ni Postgres para el frontend/backend. Si necesitas la BD:
`docker compose up -d db` y apunta `DATABASE_URL` a `localhost:5433`.

## Desplegar

```bash
ssh sepadmin@<servidor>
cd /opt/sep/reservasae
git pull
docker compose up -d --build
```

Verificar: `curl -s http://127.0.0.1:4600/api/estado`

---

## Lo siguiente: el modelo de datos

Diseño ya discutido, **pendiente de implementar con Prisma**. Entidades:

- **Convenio** — los dos convenios bajo los que se oferta.
- **AccionFormacion** — cada oferta concreta. Pertenece a un convenio. Campos
  clave: `cuposTotales`, `cuposOcupados`, `modalidad`, `horas`, `municipio`,
  ventana de inscripciones (`inicioInscripciones` / `cierreInscripciones`).
- **Interesado** — la persona. Un documento = una persona, sin importar a
  cuántas acciones se inscriba.
- **Inscripcion** — la reserva. Estados: `CONFIRMADA`, `LISTA_ESPERA`,
  `CANCELADA`.

### Restricciones que NO son opcionales

El requisito real del sistema es **varias personas inscribiéndose al mismo
tiempo**. Estas tres cosas son la diferencia entre funcionar y sobrevender
cupos:

1. `@@unique([tipoDocumento, numeroDocumento])` en `Interesado`.
2. `@@unique([interesadoId, accionFormacionId])` en `Inscripcion` — es la
   defensa real contra el doble-click y contra los reintentos de Cloudflare.
   La base rechaza el duplicado aunque lleguen dos peticiones en el mismo
   milisegundo.
3. **`cuposOcupados` se mueve con un UPDATE condicional atómico**, nunca
   leyendo-y-luego-escribiendo desde Node:

   ```sql
   UPDATE acciones_formacion
      SET cupos_ocupados = cupos_ocupados + 1
    WHERE id = $1 AND cupos_ocupados < cupos_totales
   RETURNING *;
   ```

   Si devuelve 0 filas, no había cupo. Un `SELECT` seguido de `UPDATE` desde la
   aplicación sobrevende bajo concurrencia.

### Nota sobre Prisma

Al añadirlo, genera el cliente **fuera de `node_modules`** para que el build de
Docker lo copie con ruta predecible:

```prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../generated/prisma"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]  // los contenedores son alpine
}
```

Como `src/` y `dist/` cuelgan ambos de `backend/`, el import relativo
`../generated/prisma` resuelve igual antes y después de compilar. Y `prisma`
debe ir en `dependencies` (no `devDependencies`) para que
`prisma migrate deploy` funcione en la imagen de producción.

---

## Reglas del entorno (aprendidas a golpes)

- **pnpm está fijado en 10.33.0** en `package.json` y en los dos Dockerfiles.
  No lo cambies a `pnpm@latest`: pnpm 11 aplica la política `minimumReleaseAge`
  y el build falla cuando el lockfile trae paquetes publicados en las últimas
  24 h.
- **La IP real del usuario llega en `CF-Connecting-IP`**, no en el socket.
  Detrás del túnel todas las peticiones parecen venir de la red de Docker; un
  rate limit basado en la IP del socket contaría a todo el mundo como uno solo.
  `docker/nginx/default.conf` ya traduce esa cabecera.
- **Cloudflare corta a los ~100 s.** Correos, SMS y reportes **no deben ir
  dentro del request**: responde primero y encola el envío. Si no, el usuario ve
  un error, reintenta, y genera registros duplicados.
- **Al verificar desde el propio servidor, cuidado con la caché DNS.**
  `systemd-resolved` puede tener guardadas IPs viejas y hacer que `curl` vaya a
  otro sitio. La pista: si la respuesta **no** trae `cf-ray`, no pasó por
  Cloudflare. Para saltarse la caché:
  `curl -sI --resolve reservasae.com:443:104.21.30.174 https://reservasae.com`
- **`backend/.env` nunca se sube.** Si agregas una variable, documéntala en
  `backend/.env.example`.
- **El volumen `reservasae-pgdata` sobrevive a `docker compose down`.**
  Solo `down -v` lo borra.

## Convenciones

- Comentarios y mensajes de commit **en español**, explicando el *porqué*
  cuando la decisión no sea obvia.
- Los nombres de modelos, campos y rutas van en español (`Interesado`,
  `AccionFormacion`, `cuposTotales`) — es el vocabulario del negocio.
- Los contenedores se llaman `reservasae_<servicio>`, igual que en SEPLocal.
