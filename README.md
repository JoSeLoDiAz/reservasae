# reservasae — Convoca

Sistema de reserva de cupos para acciones de formación ofertadas bajo convenio.

Estado actual: **despliegue base funcionando**. El modelo de datos, el formulario
de inscripción y la autenticación llegan en la siguiente etapa.

- **Producción:** <https://reservasae.com> — pendiente de publicar; los pasos
  están en [docs/cloudflare.md](docs/cloudflare.md).
- **Ruta en el servidor:** `/opt/sep/reservasae`

### Por qué está hecho así

Dos documentos para quien vaya a tocar estas partes. No cuentan lo
que hace el código —eso se lee en el código— sino las decisiones que
costaron un fallo en producción y que conviene no deshacer sin saber:

- [docs/campanas-mailing.md](docs/campanas-mailing.md) — el módulo de
  correo masivo. Los topes, el worker, y qué combinación de datos hace
  que salgan correos de verdad.
- [docs/decisiones-formularios.md](docs/decisiones-formularios.md) —
  el orden de las pantallas, el habeas data, y el enlace que se
  cerraba sin haber recogido nada.
- [docs/webhook-meta.md](docs/webhook-meta.md) — los leads pagados de
  Facebook e Instagram. **Empieza con una migración sin aplicar**, y
  sigue con las tres cosas que si se tocan sin saber dejan de llegar
  los leads que se están pagando.
- [docs/estilo-del-panel.md](docs/estilo-del-panel.md) — las cinco
  reglas visuales del panel, cada una puesta en **un solo sitio** para
  no tener que acordarse de ellas. Si algo «se ve raro», la corrección
  casi siempre va en el token, no en el componente.

---

## Arquitectura

```
https://reservasae.com
   │
   ▼
Cloudflare Tunnel (cloudflared, servicio del sistema)
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

Nada se expone directamente a internet: el único puerto publicado es
`127.0.0.1:4600`, y solo cloudflared llega hasta ahí. Postgres se publica en
`127.0.0.1:5433` únicamente para poder conectarse con un cliente desde el
propio servidor (o por túnel SSH).

**nginx quita el prefijo `/api`**: una petición a `/api/estado` llega al backend
como `/estado`. En desarrollo local `next.config.ts` replica exactamente ese
salto, así que el código del frontend es idéntico en local y en producción.

## Estructura

```
reservasae/
├── backend/              NestJS
│   ├── src/
│   ├── .env              ← NO se sube a git (credenciales)
│   ├── .env.example      ← plantilla que sí se sube
│   └── Dockerfile
├── frontend/             Next.js (App Router + Tailwind)
│   ├── src/app/
│   └── Dockerfile
├── docker/nginx/default.conf
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## 1. Trabajar en local

Necesitas Node 22+, pnpm 10 y git.

```bash
# Clonar
git clone git@github.com:JoSeLoDiAz/reservasae.git
cd reservasae

# Instalar todo el workspace de una vez
pnpm install

# Crear tu archivo de entorno local
cp backend/.env.example backend/.env
```

Para desarrollo **no necesitas Docker ni Postgres todavía** (aún no hay modelo
de datos). Abre dos terminales:

```bash
# Terminal 1 — backend en http://localhost:4000
pnpm dev:backend

# Terminal 2 — frontend en http://localhost:3000
pnpm dev:frontend
```

Abre <http://localhost:3000>. Debe mostrar la tarjeta "Conexión con el backend"
en verde. Si sale en rojo, el backend no está arriba.

### Si necesitas la base de datos en local

```bash
docker compose up -d db
```

Y en `backend/.env` apunta al puerto publicado:

```
DATABASE_URL=postgresql://reservasae:TU_CLAVE@localhost:5433/reservasae?schema=public
```

---

## 2. Subir cambios

```bash
git add .
git commit -m "descripción del cambio"
git push
```

Nunca subas `backend/.env`; ya está en `.gitignore`. Si agregas una variable
nueva, añádela también a `backend/.env.example` para que quede documentada.

---

## 3. Desplegar en el servidor

Entra por SSH y actualiza:

```bash
ssh sepadmin@<servidor>
cd /opt/sep/reservasae
git pull
docker compose up -d --build
```

Eso es todo. `--build` reconstruye solo lo que cambió; si tocaste únicamente el
frontend, puedes acotarlo:

```bash
docker compose up -d --build frontend
```

### Verificar que quedó bien

```bash
docker compose ps                       # los 4 contenedores en Up
curl -s http://127.0.0.1:4600/health    # -> OK
curl -s http://127.0.0.1:4600/api/estado
```

### Si algo falla

```bash
docker compose logs -f backend      # o frontend, nginx, db
docker compose logs --tail=100 backend
docker compose restart backend
```

---

## Comandos útiles

| Qué | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Logs en vivo | `docker compose logs -f` |
| Reconstruir todo | `docker compose up -d --build` |
| Bajar (conserva datos) | `docker compose down` |
| Bajar y **borrar la BD** | `docker compose down -v` ⚠️ |
| Recargar nginx | `./reload-nginx.sh` |
| Consola de Postgres | `docker compose exec db psql -U reservasae -d reservasae` |
| Respaldo de la BD | `docker compose exec db pg_dump -U reservasae reservasae > backup.sql` |

---

## Notas de infraestructura

- **pnpm está fijado en 10.33.0** (`packageManager` en `package.json` y en los
  dos Dockerfiles). No lo cambies a `pnpm@latest`: pnpm 11 aplica la política
  `minimumReleaseAge`, que rechaza el build cuando el lockfile trae paquetes
  publicados en las últimas 24 h.
- **La IP real del usuario** llega en la cabecera `CF-Connecting-IP`, no en el
  socket — detrás del túnel todas las peticiones parecen venir de la red de
  Docker. `docker/nginx/default.conf` ya traduce esa cabecera; cualquier rate
  limit debe basarse en ella.
- **Cloudflare corta a los ~100 s.** Los procesos lentos (correos, SMS,
  reportes) no deben ir dentro del request: responde primero y encola el envío.
  Si no, el usuario ve un error, reintenta y genera registros duplicados.
- **El volumen `reservasae-pgdata` sobrevive** a `docker compose down`. Solo
  `down -v` lo borra.
