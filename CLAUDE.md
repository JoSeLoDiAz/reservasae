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

## Estado actual (30 jul 2026)

**Despliegue base funcionando en producción.** Lo que existe hoy es la
infraestructura completa más una página que verifica la conexión con el backend.

- ✅ Monorepo, Docker, nginx, Cloudflare, HTTPS, CI manual por `git pull`
- ✅ `https://reservasae.com` sirviendo la app; `/api/estado` y `/health` OK
- ✅ **Modelo de datos en Prisma, migrado y sembrado** con el catálogo real de
  los dos proyectos: 15 acciones, 67 grupos, 106 ofertas, **4.797 cupos**.
- ✅ **API pública de catálogo y reservas**, probada bajo concurrencia real.
- ✅ **Formulario público** en `/[convenio]` y consulta por NIT en `/consulta`.
- ✅ **Panel de administración** en `/admin`: sesión, perfil, usuarios,
  apariencia (colores, textos y logo) y publicar u ocultar acciones.
- ✅ **Constructor de formularios**: secciones, preguntas, opciones, reglas de
  validación y preguntas condicionales, todo desde el panel. El formulario
  público se dibuja a partir de la definición, no del código.
- ✅ **Tableros**: avance por acción y por ubicación, serie por día, tabla de
  reservas con filtros y vista de cupos por organización. **Descarga en Excel**
  de los tres informes.
- ❌ La política de tratamiento de datos sigue sin redactar.
- ❌ Los grupos no tienen fechas (los proyectos no las traen).
- ❌ **Ninguna acción está publicada** (`visible = false` en las 15). Hasta que
  un admin publique, el catálogo público sale vacío y no se puede reservar.
  Es deliberado: no hay fechas que mostrar todavía.
- ❌ No hay formulario público, ni autenticación, ni panel de admin.
- ❌ La política de tratamiento de datos está sin redactar.

### Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/catalogo` | los convenios activos |
| `GET` | `/catalogo/:slug` | acciones publicadas con sus ofertas y semáforo |
| `POST` | `/reservas` | reserva N cupos; parte en confirmados + espera |
| `GET` | `/reservas?nit=` | reservas de una empresa y su total de cupos |
| `PATCH` | `/reservas/:id` | cambia la cantidad (pide el NIT en el cuerpo) |
| `POST` | `/reservas/:id/cancelar` | libera cupos y promueve la lista de espera |

Panel (sesión en cookie httpOnly, `/admin/*`): `POST|DELETE /admin/sesion`,
`GET /admin/yo`, `POST /admin/clave`, `PATCH /admin/perfil`,
`/admin/usuarios`, `/admin/marca`, `/admin/marca/logo`, `/admin/acciones`.
Públicos además: `GET /marca` y `GET /marca/logo`.

Recuerda que nginx quita el prefijo: de cara a internet son `/api/catalogo`,
`/api/reservas`, etc.

### El panel

- **`ADMIN_JWT_SECRET` es obligatoria.** `main.ts` no arranca sin ella (mínimo
  32 caracteres). Sin secreto, `@nestjs/jwt` firmaría con `undefined` y
  cualquiera podría fabricarse una sesión de administrador.
- **Contraseñas con `scrypt`** de `node:crypto`, no bcrypt ni argon2: los dos
  necesitan node-gyp y la imagen de producción es alpine.
- **Toda cuenta nace con `debeCambiarClave = true`.** El guard rechaza
  cualquier ruta salvo `/admin/yo` y `/admin/clave` hasta que la cambie.
- **El guard relee el admin de la base en cada petición**, así desactivar una
  cuenta corta la sesión al instante en lugar de esperar a que caduque.
- **El logo vive en la base** (`Marca.logoDatos`, bytea), no en disco: viaja
  con el backup y no necesita un volumen. Máximo 1 MB; SVG, PNG o WebP. La URL
  lleva `?v=<logoVersion>` para poder cachearlo para siempre.

### Tableros y descargas

`/admin` (tablero), `/admin/reservas`, `/admin/empresas`.

- **Hay DOS avances y los dos importan.** `avanceMeta` va contra los **3.690
  beneficiarios comprometidos** en los proyectos; `avance` va contra el tope de
  inscripción (4.797 = meta + 30 %). Llegar al 100 % del tope no es el
  objetivo — cumplir la meta sí. La cifra grande del tablero es la meta.
- **Cortes que responden preguntas de gestión**, todos en `/analisis`:
  cobertura territorial, modalidad, gremio, **tamaño de organización** (Ley 590
  — los proyectos comprometen un número de mipymes y sin este corte no hay
  forma de saber si se cumple), concentración en las diez mayores, y
  **ubicaciones sin una sola reserva**, que es la lista accionable.
- **Va todo en una sola llamada**: seis peticiones para pintar una pantalla es
  desperdiciar seis viajes.
- **Vista de una sola acción** en `/admin/acciones/:id`: su oferta por
  ubicación, los grupos comprometidos con el SENA, quién ha reservado y a qué
  ritmo. El tablero general responde «cómo va todo»; esta responde «qué pasa
  con este curso», que es lo que se pregunta cuando uno va mal.
- **«Exportar a PDF» es `window.print()`** con la hoja `@media print` de
  `globals.css`. No hay librería: el navegador ya sabe paginar, incrustar
  fuentes y guardar en PDF. Puppeteer obligaría a meter Chromium en la imagen
  alpine y jsPDF produce páginas peores. La hoja fuerza el tema claro (imprimir
  el oscuro gasta un cartucho y sale ilegible), activa `print-color-adjust`
  para que las barras no salgan en blanco, expande los contenedores con scroll
  y evita que una tarjeta se parta entre páginas.
  Clases: `.no-imprimir`, `.imprimible-bloque`, `.imprimible-salto`,
  `.caja-scroll`, `.solo-impresion`.
- **`--serie-1/2/3` NO las edita el administrador.** El orden de esos escalones
  es el mecanismo que garantiza que se distingan bajo daltonismo; están
  validados como conjunto y cambiarlos rompería la garantía.
- **Sin mapa de Colombia, y es deliberado.** El proyecto cubre 15 de 33
  departamentos, así que dos tercios saldrían vacíos; y para comparar
  ocupación una lista ordenada gana a un mapa, donde el ojo no puede ordenar
  colores. Si algún día se quiere, hace falta un SVG o GeoJSON real de
  departamentos: dibujar la geografía a mano da un mapa deforme.

- **Las agregaciones se hacen en la base, no en Node.** La serie por día es un
  `date_trunc` + `GROUP BY`; traer decenas de miles de filas para contarlas
  sería absurdo.
- **Tres informes en `.xlsx` con `exceljs`**, no un CSV renombrado: cabecera
  fija, autofiltro, anchos y números como números para que Excel los sume. Un
  CSV con extensión `.xls` rompe los acentos y deja las cifras como texto.
- **Las preguntas propias de cada formulario se vuelven columnas** en el
  informe de reservas. Se recorre todo antes de escribir para saber cuáles
  existen: añadiéndolas sobre la marcha, las filas de arriba se desalinean.
- **La descarga va por navegación, no por `fetch`**: así el navegador gestiona
  el archivo y la cookie de sesión viaja sola.
- **El semáforo lleva SIEMPRE icono y texto, no solo color.** Medido con el
  validador de paletas: rojo y ámbar quedan a ΔE 4,9 bajo deuteranopía, y
  «Completo» contra «Últimos cupos» es justo la distinción que más importa. Los
  escalones actuales pasan el suelo de visión normal (15,6 en claro, 21,2 en
  oscuro); el icono cubre el resto.
- **Cada gráfico es de una sola serie, así que no llevan leyenda.** El total
  en espera va como número aparte y no como segmento de la barra: la lista de
  espera puede superar el cupo máximo y reventaría la escala.

### El constructor de formularios

`/admin/formularios`. La ruta pública **es el slug del formulario**: el
formulario `britcham-adee` se sirve en `/britcham-adee`. Un convenio puede
tener varios.

- **`backend/src/formularios/campos-nucleo.ts` define los campos que el
  sistema necesita** para poder crear una reserva (NIT, curso, oferta, cupos,
  aceptaciones…). El catálogo viaja al panel, igual que el de colores. Sobre
  esas preguntas hay tres candados: **no se archivan**, **no se les cambia el
  tipo** y **no se piden dos veces**. Sin ellos, un administrador podría dejar
  un formulario publicado incapaz de crear una reserva.
- **Un formulario no se publica si le falta algún campo obligatorio** o si una
  pregunta de opciones se quedó sin opciones. El panel enseña la lista de lo
  que falta mientras se construye, no solo al pulsar publicar.
- **Nada se borra cuando ya se usó.** Una pregunta con respuestas no puede
  cambiar de tipo (archívela y cree otra); una opción ya elegida se archiva en
  vez de borrarse; un formulario con respuestas se despublica, no se borra.
- **Las respuestas congelan la etiqueta** de la pregunta y de las opciones
  elegidas. Si mañana alguien reescribe la pregunta, la exportación sigue
  diciendo lo que la persona leyó.
- **Preguntas condicionales**: `dependeDePreguntaId` + `dependeDeValor`. Es lo
  que hace el «Otro → ¿cuál?» sin escribirlo en el código. Si una pregunta
  estaba oculta, su respuesta se descarta en el servidor: guardarla sería
  registrar algo que la persona nunca vio.
- **La validación se repite en el servidor.** La del navegador es comodidad;
  la del servidor es lo que impide que llegue cualquier cosa a la base.
- **Borrar una sección no borra sus preguntas**: quedan al final del
  formulario, bajo «Otros datos».

```bash
# Recrear los dos formularios iniciales (no pisa los que ya existan).
pnpm --filter backend db:sembrar-formularios
```

### Apariencia y modo claro / oscuro

El administrador personaliza la interfaz entera. **Ningún componente escribe
un color suelto**: todo sale de variables CSS, así que cambiar la paleta cambia
la app completa, panel incluido.

- **El catálogo de colores lo define `backend/src/admin/temas.ts`** y viaja al
  navegador dentro de `GET /marca`. El panel dibuja sus formularios a partir de
  esa lista. **Añadir un color es tocar solo ese archivo**: no hay migración
  (los valores están en una columna JSON) ni hay que acordarse del frontend.
  Hoy son 28 tokens en 7 grupos: marca, superficies, texto, encabezado, tablas,
  campos y estados.
- **Dos paletas completas, `CLARO` y `OSCURO`**, en la tabla `temas`. El oscuro
  no es el claro invertido: la marca baja de saturación (un azul intenso sobre
  fondo oscuro deslumbra y hace vibrar los bordes del texto) y los estados se
  aclaran, porque el verde y el rojo del claro no llegan al contraste mínimo.
- **Las dos paletas viajan juntas al navegador**, así el conmutador cambia de
  modo sin pedir nada al servidor.
- **`SCRIPT_SIN_PARPADEO` va en el `<head>`** y fija `data-tema` antes de
  pintar. Sin él, quien tiene modo oscuro recibe un fogonazo blanco mientras
  React se hidrata. Por eso el `<html>` lleva `suppressHydrationWarning`.
- **El modo por defecto del admin solo manda si el visitante no ha elegido.**
  Quien ya escogió no debe ver cómo se le cambia solo.
- **Los colores se validan clave por clave**: la clave tiene que existir en el
  catálogo y el valor ser `#rrggbb`. Es imprescindible — acaban dentro de una
  etiqueta `<style>`, así que aceptar texto libre sería dejar que un
  administrador inyectara CSS arbitrario. El frontend vuelve a filtrar al
  escribirlos, como segunda barrera.
- **El aro de foco tiene su propio color** (`campoFoco`) en vez de heredar el
  de marca: si alguien elige una marca casi del color del fondo, el foco
  desaparecería con ella, y es lo que guía a quien navega con el teclado.
- **El panel avisa del contraste** (WCAG, 4,5:1 normal y 3:1 títulos) en 14
  pares antes de guardar. Avisa, no bloquea.
- **Se respeta `prefers-reduced-motion`**: quien pide menos animación en su
  sistema no recibe transiciones.

```bash
# Primer usuario, o recuperar el acceso si nadie puede entrar.
pnpm --filter backend db:crear-admin correo@ejemplo.com "Nombre" [--rol GESTOR]
```

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
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   ├── seed/
│   │   │   ├── index.ts       carga el catálogo, idempotente
│   │   │   └── catalogo.json  generado, NO editar a mano
│   │   └── verificar-invariantes.ts
│   ├── generated/prisma/  ← cliente generado, fuera de git
│   ├── src/
│   ├── .env              ← NO se sube a git
│   ├── .env.example
│   └── Dockerfile
├── frontend/             Next.js
│   ├── src/app/page.tsx  ← página de verificación actual
│   └── Dockerfile
├── scripts/
│   ├── extraer-catalogo.py   proyectos .xlsx → catalogo.json
│   └── tunel-bd.ps1          abre el túnel SSH a la base del servidor
├── docker/nginx/default.conf
├── docs/
│   ├── proyectos/               los dos proyectos oficiales (fuente de verdad)
│   ├── dahsboardexcel/          dashboard derivado, etiquetas poco fiables
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
ssh sep-vm
cd /opt/sep/reservasae
git pull
docker compose up -d --build
./reload-nginx.sh          # ← NO se puede saltar, ver abajo
```

Verificar:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4600/          # frontend
curl -s http://127.0.0.1:4600/api/estado                                  # backend
```

> **Recargar nginx es obligatorio y es lo que más se olvida.** `docker compose
> up` recrea los contenedores de backend y frontend, que salen con una IP nueva
> en la red de Docker. nginx **resuelve el upstream una sola vez al arrancar** y
> él no se recrea, así que se queda apuntando a las IPs viejas: el resultado es
> un **502 solo en el frontend** mientras `/api/` sigue respondiendo 200 — lo
> que despista, porque parece que la app está bien. Pasó en el despliegue del
> 30 jul 2026.

**Variables nuevas en `backend/.env` del servidor.** No se sube a git, así que
al añadir una variable hay que ponerla también allí a mano. Si falta
`ADMIN_JWT_SECRET`, el backend **no arranca** (es deliberado).

**Las migraciones corren solas** al arrancar el contenedor: el `CMD` del
Dockerfile ejecuta `prisma migrate deploy` antes de `node dist/main.js`.

> Ojo con el entorno local: `backend/.env` apunta, vía túnel SSH, **a la base
> del servidor**. No hay base local. Cualquier migración o seed que se corra
> desde el portátil va directo a producción.

---

## El modelo de datos (ya implementado)

`backend/prisma/schema.prisma`. Prisma está fijado en **v6**: la v7 quitó `url`
del `datasource` y exige `prisma.config.ts` con driver adapter. Migrar es un
cambio aparte y deliberado, no algo que deba pasar por un `pnpm update`.

### Quién reserva y qué

**No hay inscripción individual.** El formulario se envía a las empresas
afiliadas a los gremios; alguien de la empresa lo diligencia **en nombre de la
empresa** y reserva **N cupos de golpe**. Quien reserva no es necesariamente
quien asiste, y los asistentes **no se nombran**: solo se guarda la cantidad.

- **Empresa** — identificada por el NIT. `@@unique([nit])`.
- **Reserva** — `(empresa, oferta)` con `cuposSolicitados`,
  `cuposConfirmados` y `cuposEnEspera`. Los tres van en la misma fila porque
  una reserva puede quedar partida: si pide 10 y solo caben 6, se confirman 6
  y 4 quedan en espera.
- La empresa **vuelve con solo su NIT** para editar la cantidad. Fue una
  decisión explícita del cliente pese a que el NIT es información pública;
  las defensas son el rate limit por `CF-Connecting-IP` y `MovimientoReserva`,
  que registra cada cambio con IP y user-agent.

### Dónde viven los cupos

`Oferta` = **(acción de formación × ubicación)**. Es lo único con contador, para
que no haya dos números que puedan desincronizarse.

`Grupo` y `GrupoCobertura` reflejan la estructura del proyecto tal cual (qué
grupo aporta cuántos beneficiarios en qué ubicación) y sirven para reportar al
SENA, pero **no llevan contador**. Los grupos aún **no tienen fechas**: no
vienen en los proyectos y las cargan los admins antes de publicar.

`cuposMaximos` **ya incluye el 30 % de sobrecupo** por deserción, redondeado
hacia arriba y aplicado celda a celda. Es el tope duro de confirmadas. Ver más
abajo.

### Restricciones que NO son opcionales

Varias empresas reservando al mismo tiempo es el requisito real.

1. `@@unique([nit])` en `Empresa`.
2. `@@unique([empresaId, ofertaId])` en `Reserva` — la defensa real contra el
   doble clic y los reintentos de Cloudflare. Un segundo envío no crea otra
   fila: edita la que ya existe.
3. **El contador se mueve con un UPDATE condicional atómico**, y ahora es
   `±N`, no `+1`, porque al editar se aplica la *diferencia*:

   ```sql
   UPDATE ofertas
      SET "cuposOcupados" = "cuposOcupados" + $delta
    WHERE id = $1
      AND "cuposOcupados" + $delta BETWEEN 0 AND "cuposMaximos"
   RETURNING *;
   ```

   0 filas = no cabía. Bajar de 8 a 3 libera 5 en el mismo movimiento.

   Para el reparto parcial (pide 10, caben 6) hace falta saber cuántos se
   otorgaron, y Postgres 17 no puede devolver el valor anterior en `RETURNING`.
   Ahí sí se lee antes, pero **con `SELECT ... FOR UPDATE` dentro de la
   transacción**. Un `SELECT` sin lock sobrevende.

4. **CHECK en la base**, en la migración inicial. Prisma no los expresa en el
   schema, así que van a mano en el SQL. Son la última línea de defensa:
   `cuposOcupados` entre 0 y `cuposMaximos`, el reparto de una reserva nunca
   mayor que lo solicitado, y **una reserva cancelada no retiene cupos** —
   justo el fallo que tiene hoy el Excel, donde cancelar no libera la silla.

### Comprobarlo

Tres scripts, todos contra la base real y todos limpian lo que crean:

```bash
pnpm --filter backend db:estado        # qué hay cargado; avisa si un contador se descuadró
pnpm --filter backend db:verificar     # las 6 restricciones, en transacciones que se revierten
pnpm --filter backend db:prueba-carga  # 20 empresas reservando a la vez (necesita el backend arriba)
```

`db:prueba-carga` es el que de verdad importa: publica temporalmente la oferta
más pequeña, lanza 20 peticiones simultáneas contra 13 cupos y comprueba que
salen exactamente 13 confirmadas y 7 en espera, que cancelar promueve al
primero de la cola, y que un NIT ajeno no puede editar. Al terminar restaura el
contador y el `visible`.

Ojo al probar en local: **el fetch de Node resuelve `localhost` a `::1`** y Nest
escucha en `0.0.0.0` (solo IPv4). Hay que usar `127.0.0.1` o la conexión se
corta sin explicación.

### Catálogo y seed

El catálogo sale de los proyectos oficiales, no del dashboard:

```
docs/proyectos/*.xlsx
   │  scripts/extraer-catalogo.py   (a mano, cuando cambien los proyectos)
   ▼
backend/prisma/seed/catalogo.json
   │  pnpm --filter backend prisma db seed
   ▼
base de datos
```

El seed lee el JSON y **nunca** el Excel: en producción no hay Python, y el
XLSX se corrompe con solo abrirlo y guardarlo. Es idempotente y se puede correr
en cada despliegue; lo único que jamás toca es `cuposOcupados` ni el `visible`
de una acción que un admin haya ocultado.

### Nota sobre Prisma

El cliente se genera **fuera de `node_modules`**:

```prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../generated/prisma"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]  // los contenedores son alpine
}
```

Como `src/` y `dist/` cuelgan ambos de `backend/`, el import relativo
`../generated/prisma` resuelve igual antes y después de compilar. `prisma` va
en `dependencies` (no `devDependencies`) para que `prisma migrate deploy`
exista en la imagen de producción; el `CMD` del Dockerfile lo ejecuta antes de
arrancar el servidor.

---

## Lo que hay que saber de los datos

Verificado contra `docs/proyectos/*.xlsx`, que es la fuente oficial. El
`docs/dahsboardexcel/Base Cursos.xlsx` es un derivado con etiquetas erróneas.

- **El 30 % se calcula sobre el total de CADA GRUPO y luego se reparte** entre
  sus ubicaciones, no celda por celda. En la tabla oficial del proyecto la
  columna «BENEF. X GRUPO» siempre es redonda: 50 → **65**, 250 → **325**.
  Totales: **2717** en BRITCHAM y **2080** en ADECOPRIA, **4797** en total.

  Redondear cada celda por su cuenta da un número equivocado en los dos
  sentidos. El grupo 2 de la AF08 tiene cuatro celdas en `,5` (Santander 45,5
  y tres de 32,5): truncando todas salen 323 y subiendo todas 327, cuando el
  grupo son 325 exactos. Por eso `repartir_sobrecupo` usa el método del mayor
  resto — trunca y reparte lo que falte.

  > **El dashboard del cliente da 2714** porque trunca cada celda. Ese número
  > es el que está mal. La tabla oficial del proyecto dice 2717.

  > **En AF08 hay cuatro departamentos que difieren en ±1** de la tabla
  > oficial (Casanare y Santander +1; Córdoba y N. Santander −1). El reparto
  > de esas cuatro celdas empatadas en `,5` se hizo a mano en el Excel y no
  > sigue ninguna regla deducible. Los totales por grupo y por acción sí
  > coinciden exactamente.
- **La unidad real del proyecto es el GRUPO**, no la acción. `Base Cursos.xlsx`
  los aplastó: AF1 Bogotá 130 son en realidad dos grupos de 50.
- **La columna "Departamento" del dashboard mezcla dos cosas distintas**: la
  sede presencial y el alcance territorial. En la AF8, `ANTIOQUIA` es
  **MEDELLÍN** (sede presencial), no el departamento; y en las AF1–AF3
  `BOGOTÁ` es `BOGOTÁ D.C` (departamento, cobertura virtual). Por eso las
  ubicaciones tienen `tipo` (CIUDAD / DEPARTAMENTO) y no son texto libre.
- **La modalidad es de la celda, no del curso.** La AF8 figura como
  presencial, pero cada uno de sus dos grupos junta 60 asistentes en sede y
  190 conectados desde seis departamentos.
- **Un departamento puede repetirse en varios grupos de la misma acción**
  (ADECOPRIA AF2: Antioquia aparece en los grupos 2, 3 y 4). La oferta suma;
  el reparto en grupos lo decide después el equipo.
- **Discrepancia sin resolver:** el NIT de ADECOPRIA es `890.982.432-0` según
  su proyecto, pero el aviso de privacidad que entregaron dice
  `890.901.432-0`. Hay que confirmarlo antes de publicar el texto legal.

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
