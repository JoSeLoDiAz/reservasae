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

## Estado actual (14 ago 2026)

**Despliegue base funcionando en producción.** Lo que existe hoy es la
infraestructura completa más una página que verifica la conexión con el backend.

- ✅ Monorepo, Docker, nginx, Cloudflare, HTTPS, CI manual por `git pull`
- ✅ **Tres sedes replicando**: Bogotá escribe y El Socorro y el PC Dell siguen
  su base al instante, migraciones incluidas. Ver «Alta disponibilidad».
- ✅ `https://reservasae.com` sirviendo la app; `/api/estado` y `/health` OK
- ✅ **Modelo de datos en Prisma, migrado y sembrado** con el catálogo real de
  los dos proyectos: 15 acciones, 67 grupos, 106 ofertas, **4.797 cupos**.
- ✅ **API pública de catálogo y reservas**, probada bajo concurrencia real.
- ✅ **Formulario público** en `/[convenio]` y consulta por NIT en `/consulta`.
- ✅ **Panel de administración** en `/admin`: sesión, perfil, usuarios,
  apariencia (colores, textos y logos) y publicar u ocultar acciones.
- ✅ **Constructor de formularios**: secciones, preguntas, opciones, reglas de
  validación y preguntas condicionales, todo desde el panel. El formulario
  público se dibuja a partir de la definición, no del código.
- ✅ **Tableros**: avance por acción y por ubicación, serie por día, tabla de
  reservas con filtros y vista de cupos por organización. **Descarga en Excel**
  de los tres informes. **Se actualizan solos cada 30 s.**
- ✅ **Apariencia por formulario**: cada uno con sus colores, sus logos y sus
  textos, heredando de la marca general lo que no cambie.
- ✅ **Banner de hasta tres logos** por ámbito, a 80 px de alto: las entidades
  del convenio más la capacitadora.
- ✅ **Editor de color para quien no sabe de color**: quince plantillas
  comprobadas, derivación de las dos paletas desde un solo color y los 28
  tokens plegados debajo.
- ✅ **Ritmo y proyección** desde `movimientos_reserva`, y **respuestas
  agregadas** por formulario.
- ❌ La política de tratamiento de datos sigue sin redactar.
- ❌ Los grupos no tienen fechas (los proyectos no las traen).
- ❌ **Ninguna acción está publicada** (`visible = false` en las 15). Hasta que
  un admin publique, el catálogo público sale vacío y no se puede reservar.
  Es deliberado: no hay fechas que mostrar todavía.
- ✅ **El failover es automático** desde el 15 ago 2026: si el principal deja
  de atender cinco minutos y una tercera sede lo confirma, El Socorro (o
  Bogotá) se promueve sola, y la sede que vuelve se rinde sola.
- ✅ **CRM, sección de inscripciones**: tablero de etapas, ficha, brecha de
  nombres y carga masiva. Ver «El CRM».
- ⏳ Del CRM faltan acciones por lote, tareas y el seguimiento académico.

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
`/admin/usuarios`, `/admin/marca`, `/admin/logos`, `/admin/acciones`,
`GET /admin/apariencia/plantillas`, `POST /admin/apariencia/derivar`,
`POST /admin/apariencia/corregir`,
`PATCH /admin/formularios/:id/apariencia`,
`GET /admin/tableros/proyeccion`, `GET /admin/tableros/respuestas/:id`.
Públicos además: `GET /marca`, `GET /marca/formulario/:slug` y
`GET /marca/logos/:id`.

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
- **Los logos viven en la base** (tabla `logos`, columna bytea), no en disco:
  viajan con el backup y no necesitan un volumen. Máximo 1 MB cada uno; SVG,
  PNG o WebP.

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
- **Se refrescan solos cada 30 s** (`frontend/src/lib/datos-vivos.ts`), en
  pausa con la pestaña oculta y refrescando al volver si pasó el intervalo.
  La función de carga vive en una **ref**: sin eso, una función sin memoizar
  reiniciaría el temporizador en cada render y el disparo periódico usaría los
  filtros viejos. **Un fallo conserva los últimos datos buenos** — con un
  temporizador, convertir el error en pantalla completa vaciaría el tablero
  cada vez que la red parpadea. El cronómetro lleva `aria-live="off"`.
  **No** se aplica en las pantallas de edición: pisaría lo que se escribe.

### Ritmo, proyección y respuestas

- **El ritmo sale de `movimientos_reserva`, no de `reservas.creadoEn`.**
  `SUM(confirmadosDespues - confirmadosAntes)` por día da el neto **real**:
  incluye ediciones a la baja, cancelaciones y promociones de la lista de
  espera. La serie por `creadoEn` no puede — atribuye la cantidad final al día
  en que se creó la reserva. Si no hay movimientos en la ventana pero sí
  reservas, se cae a `creadoEn` y se marca `origen: 'APROXIMADO'`.
- **Se divide entre días de calendario**, incluidos los de cero. Dividir entre
  «días con datos» inflaría el ritmo justo donde peor va.
- **Sin estado de riesgo, a propósito.** No hay ninguna fecha objetivo en el
  sistema, así que se dice «a este ritmo se llena el 3 de nov» y nada más.
  Los casos raros son estados propios: `CUMPLIDA`, `SIN_META`, `SIN_RITMO`,
  `RETROCEDE` y `MUY_LEJOS`; con menos de 7 días de historia, confianza baja.
- **`Reserva.formularioId`**: antes, saber de qué formulario venía una reserva
  exigía pasar por sus respuestas, lo que dejaba fuera a quien no contestó
  ninguna pregunta propia y hacía incalculable la tasa de respuesta.
- **Las respuestas se agrupan por el valor y se muestra la etiqueta de hoy**;
  para un valor que ya no está en el catálogo se cae a la congelada al enviar.
  Esa es la razón de ser de las dos columnas. El texto libre no se agrega:
  contar frases distintas da una lista de unos.

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

### Los logos de la cabecera

**Hasta tres, no uno**: en cada convenio concurren varias entidades más la
capacitadora (en BRITCHAM ADEE van BRITCHAM, ADEE y Grupo AE). Viven en la
tabla `logos`, con `formularioId = null` para la marca general.

- **Se muestran a 80 px de alto.** A 40 no se lee un logo con texto. Llevan
  `max-w` y `object-contain` para que tres logos anchos no desborden en móvil.
- **Cada logo se sirve por su id**: `GET /marca/logos/:id?v=<version>`, con
  caché inmutable de un año. Como el id es único, borrar uno hace que su URL
  deje de existir en vez de servir el viejo desde la caché — que es el fallo
  que había que evitar cuando el logo era uno solo por ámbito.
- **O los propios o los generales, nunca mezclados.** Un formulario sin logos
  propios muestra los de la marca general; en cuanto sube uno, deja de
  heredarlos. Mezclar las dos listas daría banners con entidades repetidas.
- **La `etiqueta` es el nombre de la entidad y es el texto alternativo.**
  Arranca con el nombre del archivo y el admin la corrige; tres logos con el
  mismo `alt` dejarían la cabecera inservible con lector de pantalla.
- **El orden importa** y se edita con flechas. Al mover o borrar se reescribe
  el `orden` de todos: no quedan huecos ni empates.
- **Mismas rutas para los dos ámbitos**: `/admin/logos?formularioId=`. Una
  sola API en vez de dos juegos de rutas casi iguales.

### Apariencia por formulario

Cada formulario puede tener **su paleta, sus logos y sus textos**, distintos de
los del otro. `/admin/formularios/:id/apariencia`.

- **Se hereda por token, no por paleta.** En `Formulario.coloresClaro` y
  `coloresOscuro` se guardan **solo las claves que el admin cambió**. Guardar
  las 28 mata la herencia en silencio: todo parece ir bien hasta que alguien
  cambia el color general y este formulario no se entera. Al aplicar una
  plantilla se guarda solo lo que difiere de la marca general.
- **Los textos ya existían**: `Formulario.titulo` y `descripcion` se editan en
  el constructor y ahora son los que se leen en la página pública.
- **Un slug desconocido devuelve la marca general con 200, nunca 404.** Un 404
  sería un oráculo de qué formularios existen.
- **Dos capas contra el destello**: `[convenio]/layout.tsx` es un Server
  Component que emite la paleta ya en el HTML (necesita `API_INTERNA`, que va
  en `docker-compose.yml`), y `SCRIPT_PALETA` repinta desde `localStorage` en
  las visitas siguientes.

### Elegir colores sin saber de color

Tres niveles en `frontend/src/components/admin/editor-colores.tsx`, que lo
usan tanto `/admin/marca` como la apariencia de cada formulario.

- **Quince plantillas** en `backend/src/admin/plantillas-tema.ts`. Una plantilla
  es un color principal que pasa por la misma derivación que el editor, no una
  lista de 56 hex: así la galería y «elegir un color» no pueden discrepar. La
  primera se declara con `TEMAS_POR_DEFECTO` para que coincida con
  «restablecer». Añadir una es una línea; el test la valida sola.
- **La derivación va en OKLCH**, no en HSL: en HSL «L 50 %» en amarillo y en
  azul se ven muy distintos de claros, así que fijar L no garantiza contraste.
  `backend/src/admin/oklch.ts` convierte sRGB↔OKLCH sin dependencias y recorta
  al gamut bajando croma.
- **Los estados no se derivan.** Sus escalones están medidos contra
  deuteranopía; sacarlos de un tono cualquiera tiraría esa garantía.
- **Va en el servidor** porque es el único lado con jest. El test recorre 24
  tonos de la rueda × 2 opciones de encabezado × 2 esquemas × 14 pares: 1.344
  comprobaciones. Si alguien añade una plantilla ilegible, falla el build.
- El coste es un viaje de red por cambio de color: se mitiga con 200 ms de
  espera y un guardia de secuencia. Sin él, una respuesta lenta pisa a una
  posterior y el color parece ir hacia atrás.
- **Un amarillo puro sale como un olivo oscuro y es correcto**: `marca` se usa
  como texto de enlace sobre fondo claro y tiene que llegar a 4,5:1. El editor
  lo dice en vez de hacerlo callando.

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

`API_INTERNA` sí va en `docker-compose.yml` (que está en git): es la dirección
del backend para el SSR del frontend, que no pasa por nginx. En local, si no
está, cae a `http://127.0.0.1:4100`.

**Las migraciones corren solas** al arrancar el contenedor: el `CMD` del
Dockerfile ejecuta `prisma migrate deploy` antes de `node dist/main.js`.

> Ojo con el entorno local: `backend/.env` apunta, vía túnel SSH, **a la base
> del servidor**. No hay base local. Cualquier migración o seed que se corra
> desde el portátil va directo a producción.

---

## El CRM (14 ago 2026)

Tres secciones encadenadas. La primera ya existía; la segunda está construida y
usable; la tercera espera una decisión del cliente.

```
1. RESERVA DE CUPOS   la empresa aparta N sillas
2. INSCRIPCIONES      el asesor convierte cupos en gente      ✅
3. ACADÉMICO          el LMS dice cómo van                    ⬜ falta elegir LMS
```

`/admin/participantes` (tablero y lista), `/nuevo`, `/:id` (ficha),
`/brecha` y `/carga`.

### Las decisiones que lo sostienen

- **`Persona` no tiene convenio.** Única por `(tipoDocumento, numeroDocumento)`
  normalizado. La misma cédula en los dos convenios es **una persona con dos
  participaciones**. Así se responde «cuánta gente distinta hemos formado», que
  no es la suma de los dos convenios, y **el duplicado por documento pasa a ser
  imposible de crear** — por eso no existe pantalla de fusionar duplicados.
- **`Participante.reservaId` es nullable, y es deliberado.** El CRM también
  gestiona a quien llega por su cuenta (redes, referido, feria), no solo a quien
  una empresa nominó. Por eso `convenioId` va explícito y no heredado.
- **Nueve etapas en una sola escalera**: `NUEVO → CONTACTADO → DATOS_COMPLETOS →
  MATRICULADO → EN_FORMACION → CERTIFICADO`, con salidas `PERDIDO`, `RETIRADO` y
  `NO_APROBO`. Las tres primeras son el trabajo comercial del prototipo del
  cliente; las tres siguientes son lo que paga el SENA y donde el prototipo ya
  no llegaba. Se descartaron «En negociación» y «Pago realizado»: no significan
  nada en formación gratuita.
- **Salir por una etapa de salida exige motivo.** El prototipo lo pedía
  opcional, que es lo mismo que no pedirlo.
- **Nominar nunca toca `Oferta.cuposOcupados`.** El sobrecupo se cuenta contra
  participantes vivos. Los tres candados contra la sobreventa están diseñados
  para un único camino de escritura.
- **El sobrecupo se permite y deja firma.** Motivo obligatorio y quién lo
  autorizó, con un CHECK que impide guardar uno sin el otro.
- **Matricular bloquea solo por dos cosas**: autorización del titular y oferta
  asignada. El grupo y sus fechas **avisan, no bloquean** — las pone el SENA
  cuando puede, y bloquear la captura por algo que no depende de aquí es hacer
  el sistema más rígido que el proceso, que es como se abandonan los sistemas.
- **La autorización no es un booleano.** `AutorizacionDatos` apunta a la versión
  exacta del texto vigente, con el canal por el que se dio y dónde quedó la
  prueba. Es lo que hay que poder demostrar.
- **Las notas congelan el nombre del autor**, como `Respuesta` congela la
  etiqueta de la pregunta. No se borran: una corrección es otra nota.

### La brecha de nombres

`cuposConfirmados − participantes vivos`. Es la cifra que abre el CRM y mide el
riesgo número uno: acabar con 4.797 cupos reservados y 800 personas
identificadas. La lista se ordena por cuántos nombres debe cada empresa y, a
igualdad, por cuánto lleva esperando: **no es un informe, es a quién llamar hoy**.

### La carga masiva

Va por **pegado**, no por subida de archivo: es lo que el asesor hace de verdad
y evita parsear `.xlsx` ajenos. Dos pasos siempre, previsualizar y confirmar.

- **Las filas se crean una a una, no en transacción.** En un pegado de 40, que
  la 17 traiga un documento inválido no puede tumbar las otras 39.
- **`esEncabezado` mira la primera y la segunda celda.** Mirando solo la primera,
  una fila cuyo tipo venía escrito como «Cedula» se tomaba por título y **la
  persona desaparecía en silencio**. Lo encontró `carga.spec.ts`; queda como
  prueba de regresión.

### Roles: la tabla existe, todavía no filtra

`AdminConvenio(adminId, convenioId, rol)` es una **concesión explícita**: sin
fila, no hay acceso. Sustituye a la columna `convenioId` con «nulo = ve los dos»
que proponía el plan, porque la instrucción del cliente fue que trabajar en los
dos convenios exige permisos en ambos, nunca por omisión. Y como la misma
persona puede llevar áreas distintas en cada convenio, **el rol va en la fila y
no en la cuenta**.

Los roles previstos son de dos ejes, área × nivel: gestión y liderazgo de
inscripciones, de académico y de sistemas. **Falta aplicar el ámbito en cada
consulta**, que es trabajo pendiente y toca `tableros.service.ts` entero.

### Lo que falta

Acciones por lote · tareas con fecha · seguimiento académico con adaptador de
LMS (carga de archivo primero, API cuando se decida) · aplicar el ámbito por
convenio · fechas de los 67 grupos, ahora solo para el seguimiento académico.

> **Solo lectura del LMS**, decidido: alguien matricula allá y aquí se lee el
> avance. Y «al instante» se resuelve guardando una foto con su fecha y
> enseñando «actualizado hace N minutos»; consultar el LMS en cada carga de
> pantalla haría que un LMS lento sea una pantalla lenta.

---

## Alta disponibilidad: tres sedes

Desde el 14 ago 2026 el sistema vive en tres máquinas, cada una con su Hyper-V
sobre Windows 11 y su Ubuntu 24.04 dentro:

| Sede | Nombre | Papel |
|---|---|---|
| Bogotá | `server-bogota` | **principal**: es la única que escribe |
| El Socorro (Santander) | `server-socorro` | primera réplica |
| PC Dell (remoto) | `server-pc-dell` | segunda réplica |

**Solo se replica reservasae.** SEP, FormularioInscripcionGGPC y Oracle se
quedan únicamente en Bogotá; fue decisión explícita. Las dos sedes nuevas se
instalaron limpias en vez de clonar el disco de Bogotá: el VHDX pesaba 193 GB
(con un checkpoint automático de 65 GB colgando desde mayo y 121 GB de caché de
compilación de Docker) contra 9,5 MB de base real. Copiar 193 GB por internet
para mover 9,5 MB no tenía sentido.

### La red privada

Las tres se hablan por **Tailscale**, y los anfitriones Windows también.

- **Las IP de Hyper-V cambian solas.** El conmutador por defecto reparte
  direcciones con arriendo corto: un reinicio de la VM de El Socorro la movió de
  `172.30.249.163` a `172.30.255.107`. Cualquier cosa apuntada a esa IP se
  rompe. Las de Tailscale (`100.x`) no cambian, y con MagicDNS se llega por
  nombre: `ssh sepadmin@server-socorro`.
- **El enlace va por relevo DERP en Miami, a 125–130 ms**, sin conexión directa:
  las tres VM están detrás del NAT del conmutador por defecto de Hyper-V, que es
  doble NAT. Para 9,5 MB de base da igual, pero es el dato que descarta la
  replicación síncrona.
- Cada réplica tiene su llave y entra a Bogotá sin contraseña. Lo necesita para
  leer `PG_REPL_PASSWORD` y lo necesitará el despliegue automático.

### La replicación

Física, por streaming, **asíncrona**, con ranura por sede (`socorro`, `dell`).

- **Asíncrona por decisión, no por comodidad.** Síncrona costaría unos 250 ms
  por reserva y, peor, dejaría a Bogotá **sin poder escribir** si las réplicas
  quedan incomunicadas. Como las dos pasan por el mismo relevo de Miami, un
  fallo allí bloquearía el formulario público. Se prefiere perder, en el peor
  caso imaginable, el último segundo de escrituras.
- **Las migraciones se propagan solas.** Al ser replicación física, el WAL lleva
  también el DDL: `prisma migrate deploy` en Bogotá llega a las tres sin que
  nadie toque las réplicas. Comprobado creando y borrando una tabla.
- **En las réplicas corre solo el contenedor `db`.** El `CMD` del Dockerfile
  ejecuta `prisma migrate deploy` antes de arrancar, y contra una base de solo
  lectura eso falla; con `restart: unless-stopped` el backend entraría en un
  ciclo de reinicios eterno. El resto de la pila se levanta al promover.
- **La base de Bogotá escucha solo en su IP de Tailscale**, nunca en `0.0.0.0`.
  Como el `docker-compose.yml` tiene que ser idéntico en las tres sedes, la
  dirección sale de `PG_BIND`, que cada máquina define en un `.env` propio en la
  raíz del proyecto (fuera de git). Sin la variable se comporta como siempre:
  solo `127.0.0.1`.
- **No se puede restringir por IP en `pg_hba.conf`.** Docker reescribe la
  dirección de origen a la puerta de enlace de su red (`172.22.0.1`) antes de
  entregar la conexión, así que Postgres nunca ve la IP real de Tailscale.
  Arreglarlo exigiría desactivar el proxy de usuario de Docker y reiniciar el
  demonio en Bogotá, donde viven los otros proyectos. La barrera real es doble:
  la base solo es alcanzable desde la red privada, y exige contraseña SCRAM.
- **Si una réplica se cae mucho tiempo**, Bogotá le retiene WAL hasta
  `max_slot_wal_keep_size = 8GB` y después invalida la ranura; esa sede
  necesitaría una copia base nueva. Con este volumen de escritura, 8 GB son
  meses.

### El PC Dell es inestable, y se asume

Se cayó tres veces durante el montaje. **Es aceptado a propósito**: está en otro
lugar físico precisamente para que sobreviva a lo que se lleve por delante a
Bogotá y a El Socorro. Su papel no es responder rápido, es **existir cuando ya
no quede nada más** y poder levantar el servicio desde allí.

No se le exige disponibilidad, pero sí que no se duerma el Windows anfitrión
(`powercfg /change standby-timeout-ac 0`) y que la VM arranque sola
(`Set-VM -AutomaticStartAction Start`). Si esa sede pasa meses caída, hay que
rehacerle la copia base.

### Los ocho guiones

Todos en `scripts/`, todos idempotentes, todos con el mismo criterio: **antes de
destruir algo, comprobar que hay a dónde ir**.

| Guión | Dónde | Qué hace |
|---|---|---|
| `desplegar.sh` | principal | construye, comprueba y **solo entonces** marca el commit |
| `seguir-al-principal.sh` | réplicas | temporizador cada 2 min: se pone en el commit marcado y construye |
| `arrancar-tunel.sh` | todas | temporizador cada 1 min: levanta el túnel **solo si le toca** |
| `autopromover.sh` | Bogotá y Socorro | temporizador cada 1 min: promueve sola si el principal murió |
| `autorendirse.sh` | todas | temporizador cada 2 min: se rinde sola ante una línea temporal mayor |
| `promover.sh` | una réplica | la convierte en principal |
| `rendirse.sh` | la sede relevada | suelta el tráfico y vuelve a ser réplica de otra |
| `estado.sh` | cualquiera | las tres sedes de un vistazo |

`comun.sh` tiene lo compartido y `sonda.sh` es el informador de una sola sede.

- **Bogotá marca un commit; las réplicas siguen la marca, no `origin/main`.** Un
  commit que rompa el arranque nunca llega a propagarse, porque `desplegar.sh`
  solo escribe `.desplegado` si el sitio responde después de construir.
- **Si el commit no está en GitHub, la réplica lo trae del principal por ssh**
  (`git fetch sepadmin@sede:/opt/sep/reservasae main`), y `desplegar.sh` ya no
  aborta cuando no alcanza a `origin`. Descubierto el 15 ago 2026 al promover El
  Socorro: su llave de despliegue es de **solo lectura**, así que la sede activa
  no podía publicar y las réplicas se habrían quedado sin poder recibir nada.
  El código de un sistema que existe para sobrevivir a la caída de una sede no
  puede depender de un permiso en un servicio de terceros. Las tres sedes ya se
  hablan por ssh sobre Tailscale, así que git no necesita intermediario.
- **Las réplicas comparan contra `.construido`, no contra `HEAD`.** Comparar con
  `HEAD` daba por bueno el estado cuando alguien había hecho `git pull` a mano:
  coincidía el commit y se saltaba la construcción, que es lo único que hace
  falta para que la réplica sirva de algo al promoverla.
- **Las réplicas construyen las imágenes pero no arrancan la aplicación.** Es lo
  que convierte el failover en segundos en vez de en los cuatro minutos que
  tarda un build.
- **`seguir-al-principal.sh` y `rendirse.sh` van envueltos en un bloque `{ }`.**
  Hacen `git reset --hard`, que sustituye el propio archivo mientras bash lo
  ejecuta; bash lee el guión por posición en el fichero y continuaría dentro del
  archivo nuevo con un desplazamiento calculado sobre el viejo. El bloque obliga
  a parsearlo entero antes de ejecutar la primera línea. Pasó de verdad: El
  Socorro construyó bien pero imprimió el mensaje de la versión anterior.

### El túnel del dominio

`reservasae.com` tiene **su propio túnel** (`convoca`), separado del compartido
de Bogotá que lleva SEP, Oracle y `ggpcsena.com`. Levantar el compartido en otra
sede haría que Cloudflare repartiera peticiones entre las dos y las de SEP
acabaran en una máquina que no tiene SEP.

- **Va como contenedor bajo el perfil `tunel`**, no como servicio del sistema: en
  las réplicas `sudo` pide contraseña, y en Bogotá ya existe un servicio
  `cloudflared` con el que chocaría.
- **El destino es `nginx:80`, no `localhost:4600`.** El contenedor está en la red
  interna; `localhost` sería él mismo.
- **`restart: "no"`, y es deliberado.** Los perfiles solo los entiende el CLI de
  compose: el demonio de Docker no sabe nada de ellos y revivía el túnel de una
  sede ya relevada en cuanto volvía la corriente. Cloudflare veía dos conectores
  del mismo túnel y partía el tráfico entre dos bases divergidas. Ahora lo
  gobierna `arrancar-tunel.sh`, y nadie más.
- **La marca es `SEDE_ACTIVA=si`, no `COMPOSE_PROFILES=tunel`.** Con la segunda,
  cualquier `docker compose up -d` levantaba el túnel saltándose todos los
  controles — incluido el que hace `desplegar.sh`. El guardia era irrelevante
  porque había una puerta lateral abierta. `SEDE_ACTIVA` compose no la entiende,
  y el perfil solo se pasa por línea de órdenes desde el guión.
- **Para empezar a atender exige certeza; para seguir atendiendo, no.** Es
  asimétrico a propósito. Al arrancar, no ver a las otras sedes **no es permiso**:
  es justo lo que le pasa a la sede aislada, y sería como se levanta el segundo
  conector. Pero si el túnel ya está arriba no se baja por no ver a nadie, porque
  eso tiraría el sitio en cada parpadeo de red. Solo se baja ante prueba positiva
  de haber sido relevada: otra sede atendiendo, otra con línea temporal mayor, o
  esta convertida en réplica.
- **Basta con que UNA de las otras dos responda** para arrancar. Exigir las dos
  dejaría el dominio caído cada vez que el PC Dell esté apagado, que es la mitad
  del tiempo.
- **El precio**: tras reiniciar el principal, el dominio tarda hasta un minuto de
  más en volver, porque espera al temporizador. Compensa.

### Failover automático

El 15 ago 2026 Bogotá se quedó sin internet y el dominio estuvo **dos horas**
en error 1033 con las dos réplicas al día y listas, esperando a que un humano
apretara el botón. Por eso ahora se promueve solo.

**Lo que no cambió es el riesgo**: dos bases aceptando reservas dan dos
verdades que no se pueden fusionar, porque la replicación es física. Toda la
automatización consiste en **cuatro guardias antes de promover**, y cada uno
existe para un modo de fallo concreto:

- **El reloj.** No se promueve al primer fallo, sino tras `ESPERA_PROMOCION`
  segundos seguidos sin atender (300 por defecto), contados en `.sin-principal`.
  Un reinicio del principal, o el minuto largo que tarda `arrancar-tunel.sh` en
  devolver el dominio, no son una caída.
- **La tercera opinión.** Si el principal está `INALCANZABLE`, se pregunta a la
  otra sede por él. Si ella lo ve vivo, es una partición **mía** y no se
  promueve. Y si **nadie responde**, tampoco se promueve: no ver a nadie es
  exactamente lo que le pasa a la sede aislada, así que el silencio es la señal
  más sospechosa de todas, no un permiso. `CAIDA` sí basta sin testigo — llegar
  por ssh al principal y ver su app muerta es prueba de que la red es mía.
- **La preferencia.** `PREFERENCIA_PROMOCION` ordena a las candidatas
  (`server-bogota server-socorro`) y una sede no promueve si otra que la precede
  sigue viva. Sin esto, con el PC Dell como principal caído, Bogotá y El Socorro
  se promoverían a la vez.
- **La línea temporal.** Si otra sede ya va por una línea mayor, esta llega
  tarde: se rinde en vez de promover.

**El PC Dell nunca se autopromueve**, y es la decisión más importante de todas:
es la máquina inestable, y al despertar de una caída larga no vería a nadie —
justo el estado en el que un promotor ingenuo se cree el último superviviente.
Se promueve a mano si algún día es la única que queda.

`autorendirse.sh` cierra el ciclo en las tres: la sede que vuelve detecta una
línea temporal mayor y corre `rendirse.sh` sola. **Es reemplazo, no fusión**: se
copia entera la base de la nueva principal con `pg_basebackup`. Lo que la sede
caída hubiera escrito por su cuenta queda en un `pg_dump` en `~` y **no se
mezcla** — con replicación física el WAL son bloques de disco, no filas. En la
práctica no hay nada que perder, porque una sede sin túnel no recibe tráfico.

Se enciende con **`AUTOPROMOVER=si`** en el `.env` de la sede, además del
temporizador: sin la variable el guión se abstiene, así que instalar la unidad
en el PC Dell por descuido no lo convierte en candidato.

`SIMULAR=si scripts/autopromover.sh` recorre todos los guardias y se detiene
justo antes de promover. Es la única forma de ensayar esto sin tumbar el sitio.

### Failover a mano: el runbook

Sigue siendo válido, y es lo que hay que hacer si se promueve el PC Dell o si
se quiere relevar una sede que aún atiende.

1. **Comprobar** que de verdad cayó: `scripts/estado.sh`.
2. **Promover** en la sede elegida: `scripts/promover.sh`. Se niega si el
   principal responde; si no lo ve, **pide una segunda opinión a la tercera
   sede** antes de decidir, porque no verlo no significa que esté muerto. También
   se niega si otra sede ya va por una línea temporal más alta.
3. **Rendir las otras dos**, y no es opcional: `scripts/rendirse.sh <nueva sede>`
   en cada una. La sede caída seguiría escribiendo en su propia base, y la otra
   réplica se congela en silencio — su ranura ya no existe en el nuevo principal,
   pero `pg_is_in_recovery()` sigue devolviendo `t` y nada lo delata. Por eso
   `estado.sh` tiene la columna ENLACE.
4. **Verificar** con `estado.sh`: un solo PRINCIPAL, un solo TUNEL en SI, todas
   en la misma LINEA.

`rendirse.sh` guarda un `pg_dump` de lo que había antes de resembrar. Siendo la
replicación asíncrona, la sede que se rinde es precisamente la que puede tener
escrituras que nadie más llegó a ver.

> Probado de verdad el 14 ago 2026: se paró Bogotá, El Socorro se promovió (línea
> temporal 1 → 2, que es la firma de una promoción real), sirvió la aplicación
> entera, y volvió a réplica sin descuadrar un byte.
>
> Y en serio el 15 ago 2026: Bogotá se quedó sin internet de verdad. El Socorro
> se promovió (línea 1 → 2) y el PC Dell se rindió contra ella. Las dos réplicas
> estaban en el LSN idéntico, así que no se perdió una sola reserva. Lo único que
> falló fue que nadie estaba mirando durante dos horas — de ahí `autopromover.sh`.

### Comprobarlo

```bash
# las tres sedes de un vistazo, desde cualquiera
./scripts/estado.sh
```

Sano es: un solo `PRINCIPAL`, un solo `TUNEL` en `SI`, las tres en la misma
`LINEA`, las réplicas con el `LSN` del principal y `ENLACE` en `streaming`.

Una réplica sana rechaza cualquier escritura con `cannot execute INSERT in a
read-only transaction`. Si acepta una, algo se promovió por error y hay dos
verdades circulando.

Cada guión se niega fuera de su sitio: `desplegar.sh` en una réplica (arrancaría
la aplicación contra una base de solo lectura), `seguir-al-principal.sh` en un
principal (haría `reset --hard` siguiendo a la sede que acaba de relevar), y
`arrancar-tunel.sh` donde no le toca.

> Los guiones pasaron dos revisiones adversariales. La primera confirmó 14
> defectos de 54 candidatos: el guardia anti doble-principal interrogaba a la
> sede equivocada, y `rendirse.sh` borraba el volumen antes de tener con qué
> reemplazarlo. La segunda, 8 de 43, y la mejor fue una crítica al arreglo de la
> primera: el guardia nuevo fallaba en abierto y, sobre todo, `COMPOSE_PROFILES`
> en el `.env` dejaba una puerta lateral que lo hacía irrelevante.
>
> La lección para la próxima vez que se toque esto: **los arreglos traen sus
> propios defectos, y los más caros son los que dejan el control en pie pero
> vacío de efecto.** Merece la pena repetir la revisión.

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
- **`kill -HUP` a cloudflared no recarga: lo mata.** En la versión 2026.3.0 la
  señal apaga el proceso en vez de releer el `config.yml`. Se probó el 14 ago
  2026 buscando aplicar un cambio de ingress sin cortar SEP, y dejó
  `sep.ggpcsena.com` y `ggpcsena.com` en 502 hasta que alguien hizo
  `systemctl start`. Para cambiar el ingress del túnel compartido: validar con
  `cloudflared tunnel ingress validate` y luego `systemctl restart`. Corta unos
  segundos, que es infinitamente menos que hasta que un humano lo note.
- **`backend/.env` nunca se sube.** Si agregas una variable, documéntala en
  `backend/.env.example`.
- **El volumen `reservasae-pgdata` sobrevive a `docker compose down`.**
  Solo `down -v` lo borra.

## Convenciones

- **Los comentarios del código son cortos**: una línea y **nunca más de 50
  caracteres de texto**, diciendo qué hace y ya (`// conexión a Prisma`,
  `// validar persona`). El *porqué* de las decisiones no obvias va aquí, en
  `CLAUDE.md`, no repartido por el código. Aplica también a `.env`,
  `docker-compose.yml`, `nginx` y el SQL de las migraciones.
- **Nada de banners de sección.** Una línea en minúscula y ya:

  ```ts
  // sesión          ← así
  ```

  No así:

  ```ts
  // ---------------------------------------------------------------
  // Sesión
  // ---------------------------------------------------------------
  ```

- **Los docblocks también son de una línea**: `/** Qué es esto. */`. Si hace
  falta explicar más, se explica aquí.
- Se dejan intactas las directivas: `"use client"`, `// eslint-disable-...`,
  `// @ts-expect-error`.
- Mensajes de commit **en español**, explicando el porqué.
- Los nombres de modelos, campos y rutas van en español (`Interesado`,
  `AccionFormacion`, `cuposTotales`) — es el vocabulario del negocio.
- Los contenedores se llaman `reservasae_<servicio>`, igual que en SEPLocal.
