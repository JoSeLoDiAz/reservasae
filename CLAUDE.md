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
- ⏳ **El failover todavía es manual.** Falta el guión de promoción, el
  despliegue automático a las réplicas y el desvío del tráfico del dominio.
- ✅ **CRM, sección de inscripciones**: tablero de etapas, ficha, brecha de
  nombres, carga masiva y **seguimiento académico**. Ver «El CRM».
- ⏳ Del CRM faltan acciones por lote, tareas y el adaptador del LMS.
- ✅ **Entorno de pruebas** en `https://prueba.reservasae.com`, con datos
  inventados y franja de aviso. Ver «El entorno de pruebas».

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
`GET /admin/tableros/proyeccion`, `GET /admin/tableros/respuestas/:id`,
`GET /admin/participantes/academico`, `GET /admin/participantes/catalogos`
(las listas del SEP que dibujan los desplegables, como el de colores).
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

- **La ruta pública no puede ser una ruta del sitio.**
  `backend/src/formularios/rutas-reservadas.ts` aparta `admin`, `api`,
  `consulta`, `health`, `marca` y `preinscripcion`. Un formulario llamado
  `admin` nacía inaccesible: el panel gana. El frontend repite la lista porque
  la necesita dentro de un script en línea, pero la que manda es la del
  servidor.
- **La preinscripción pública cuelga del slug: dos puertas, no una.**
  `/adecopria/preinscripcion` y `/britcham-adee/preinscripcion`. Cada gremio
  reparte su enlace y el enlace decide el convenio — la persona nunca elige uno.
  Se descartó una página única que listara los 15 cursos y enrutara: cubriría a
  quien llega sin enlace, pero ninguna acción de formación se repite entre los
  dos convenios, así que el catálogo tampoco se solapa y no hay forma de quedar
  contado en el convenio equivocado. Decisión del cliente, 18 ago 2026.
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

> Los formularios nacen **en borrador**: hay que publicarlos desde el panel
> para que su ruta pública responda.

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

- **Dieciséis plantillas** en `backend/src/admin/plantillas-tema.ts`. Una plantilla
  es un color principal que pasa por la misma derivación que el editor, no una
  lista de 56 hex: así la galería y «elegir un color» no pueden discrepar. La
  primera se declara con `TEMAS_POR_DEFECTO` para que coincida con
  «restablecer». Añadir una es una línea; el test la valida sola.
- **«Papel» es la excepción y lleva `ajustes`**: la derivación saca superficies
  casi blancas y el fondo hueso es justo lo que le da el carácter. Los ajustes
  se aplican **antes** de corregir el contraste, así que no se saltan la
  comprobación. Es la paleta de la maqueta del cliente
  (`docs/crm base/crm-inscripciones.html`).
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
  Hoy son 37 tokens en 8 grupos: marca, superficies, texto, encabezado, tablas,
  campos, estados y **las nueve etapas del CRM**.
- **Las etapas no se derivan del color de marca**, igual que los estados: nueve
  colores salidos de un solo tono serían nueve variantes del mismo y dejarían
  de distinguirse. Se copian de los valores de fábrica y `corregirContraste`
  los empuja si alguna plantilla los deja ilegibles.
- **La píldora de etapa tiñe la superficie con su propio color**
  (`color-mix`, clase `.pildora-etapa`), así que el par que se mide es el color
  contra `superficie`. **La etiqueta se lee siempre**: el color acompaña, nunca
  es lo único que distingue una etapa.
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
- **El panel avisa del contraste** (WCAG, 4,5:1 normal y 3:1 títulos) en 23
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
│   ├── generar-catalogos-sep.py  docs/sep/*.csv → catálogos en código
│   └── tunel-bd.ps1          abre el túnel SSH a la base del servidor
├── docker/nginx/default.conf
├── docs/
│   ├── proyectos/               los dos proyectos oficiales (fuente de verdad)
│   ├── sep/                     catálogos del SEP (.csv sí, .xlsx NO: PII)
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
3. ACADÉMICO          quién va al día y quién no              ◐ falta el LMS
```

La tercera **ya tiene pantalla y lee de `actividades` y `avances_actividad`**;
lo que falta es de dónde salen esos datos, que es elegir el LMS y escribir su
adaptador. Hasta entonces se llenan a mano o por siembra.

`/admin/participantes` (tablero, lista y métricas), `/nuevo`, `/:id` (ficha),
`/brecha`, `/carga` y `/academico`.

### El panel va por el proceso, no por una barra de enlaces

`frontend/src/components/admin/navegacion.ts` define los módulos en el orden en
que pasan las cosas: **1 Pre-reserva de cupos · 2 Inscripciones · 3 Inscritos ·
4 Seguimiento académico**, y Configuración aparte.

- La barra es lateral, **pegada** (la página baja y ella no), con scroll propio
  y plegable a 64 px, recordando la elección. **Plegada muestra una entrada por
  módulo, no una por enlace**: cuatro números iguales en fila no distinguen
  nada. En móvil no cabe, así que va una tira horizontal.
- **La cabecera y la barra cuelgan de `--franja-alto`**, que vale 0 salvo que
  exista la franja de pruebas. Sin eso las dos se pegan a `top: 0` y la franja
  tapa la cabecera.
- El botón de accesibilidad hace cosas comprobables: escala del texto, quitar
  animaciones aunque el sistema no lo pida y subrayar todos los enlaces. Se fija
  antes de pintar, y **`SCRIPT_ACCESIBILIDAD` vive en `lib/`, no en el
  componente**: desde un módulo `"use client"` el layout recibiría una
  referencia y no el texto, y se emitiría vacío sin avisar.

### El seguimiento académico

`/admin/participantes/academico`, desde `GET /admin/participantes/academico`, `GET /admin/participantes/catalogos`
(las listas del SEP que dibujan los desplegables, como el de colores).
Solo aparece quien ya pisó el aula.

- **«Atrasado» se mide contra el calendario del grupo**, no contra un número
  inventado: lo hecho frente a lo que tocaría según cuánto lleva corrido el
  grupo. Sin fechas no se juzga, se dice que faltan; y un grupo que aún no
  arranca es `SIN_EMPEZAR`, no «al día».
- **El denominador son solo las actividades obligatorias.** Contando también
  las opcionales salían avances de 10/9.
- **«Parado» es no entrar al aula en 14 días**, y nunca puede ser anterior al
  arranque del grupo.
- La barra lleva **una marca de dónde debería ir hoy**: el número sin la
  referencia no dice si va bien.

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
- **Matricular bloquea por tres cosas**: autorización del titular, oferta
  asignada y **alguna forma de contactarla** (correo o celular; basta con uno).
  El grupo y sus fechas **avisan, no bloquean** — las pone el SENA
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

### Los datos que pide el SENA (15 ago 2026)

El cliente entregó las tablas de su sistema (el **SEP**) y los dos formatos de
reporte. Están en `docs/sep/`. Eso cerró el riesgo nº 6 del plan: el formato ya
no hay que adivinarlo.

- **Los catálogos se generan, no se escriben**:
  `python scripts/generar-catalogos-sep.py` lee `docs/sep/*.csv` y escribe
  `backend/src/crm/catalogos-sep.generado.ts`. Lo derivado (validación, alias,
  reglas) vive en `catalogos-sep.ts`, que sí se edita a mano.
- **Los ids del SEP para departamento y ciudad SON los códigos DANE**
  (5 = Antioquia, 5001 = Medellín), así que no hay tabla de equivalencia ni hay
  que casar nombres. Con tres centinelas suyos que no son municipios:
  `1 NINGUNA`, `68000 TODOS LOS MUNICIPIOS` y `100 NACIONAL`.
- **`Persona.tipoDocumentoSepId` sustituyó al enum `TipoDocumento`.** Es el
  número que viaja al cargue; tener un enum propio al lado eran dos verdades que
  podían discrepar. La clave única de la persona va por ese id. Se hizo cuando
  producción tenía **cero personas**: más tarde habría sido una migración con
  cédulas dentro.
- **Los `.xlsx` de `docs/sep/` NO se versionan** (`.gitignore`). Los que entregó
  el cliente traían 814 y 155 filas de personas reales — cédula, fecha de
  nacimiento, celular, correo y dirección. Entraron una vez por un `git add -A`
  y hubo que sacarlos del historial y del servidor. Los `.csv` de catálogo sí se
  versionan: no son datos personales.

Decisiones del cliente, ya cerradas:

| | |
|---|---|
| Responsable del tratamiento | **el SENA** — por eso vale la política del Acuerdo 009 que ya siembra el sistema |
| Menores de edad | **no ingresan**. Tarjeta de identidad fuera del desplegable |
| Registro civil | no existe en el catálogo del SEP: se quitó |
| Estrato | de 1 a 6, con `CHECK` en la base |
| Tamaño de empresa | **Decreto 957 de 2019**: por ingresos y sector, no por empleados |
| Perfil de transferencia | siempre `4 = NO APLICA` |
| Se ha beneficiado antes | booleano declarado |
| Departamento y ciudad | el **domicilio** de la persona, no la sede del curso |

> **El corte de «tamaño de organización» de `/analisis` está calculado con el
> criterio viejo.** `clasificarTamano()` usa número de empleados (Ley 590
> original); el SEP usa ingresos y sector. Una empresa de 8 empleados y $30.000
> millones nos sale «Microempresa» y para ellos es «Grande». Hay que pedirle a
> la empresa su sector y su rango de ingresos.

- **La ficha captura y nada bloquea guardar.** Solo son obligatorios en el
  backend el tipo y número de documento, el nombre y el primer apellido; el
  resto lo completa el asesor en la llamada, y la ficha enseña qué falta para
  entrar en el reporte. Lo que **sí** se rechaza es lo que produciría un cargue
  falso: un id fuera del catálogo, un municipio que no es de su departamento y
  un menor de edad.
- **La caracterización de población está diseñada y apagada.** Sus 68 valores
  incluyen etnia, discapacidad, condición de víctima y diversidad sexual: es el
  núcleo del art. 5 de la Ley 1581. Vive en `caracterizaciones_persona`, colgada
  de la autorización exacta que la ampara. No se enciende hasta que el texto del
  SENA diga que se recogen datos sensibles y que **no** hay obligación de
  autorizarlos, como exige el Decreto 1377 art. 6. Y falta lo de fondo:
  **`revocadaEn` se lee en tres sitios y no se escribe en ninguno**, así que hoy
  no existe forma de revocar una autorización.

### Los dos reportes

`/admin/sep`. **Reporte de control** (27 columnas, el legible) y **Reporte al
SEP** (54, el que se sube). Código en `backend/src/crm/sep/`.

- **Las cabeceras son el contrato**: literales, con sus tildes y con el espacio
  final de `"Estrato socio-económico "`. `formatos.spec.ts` las fija como
  cadenas: si alguien reordena una columna o «corrige» una tilde, falla el
  build. Mismo criterio que el test de paletas.
- **Antes de descargar se ve el alistamiento**: cuántos entran, cuántos no y por
  qué motivo. Ver el número después de generar el archivo es enterarse tarde.
- **Las filas incompletas se omiten, nunca salen con huecos**, y van en una
  segunda hoja del mismo libro con su motivo. El cliente arma sus `INSERT`
  concatenando el texto de las celdas: un hueco produce un INSERT roto o, peor,
  uno que carga. La lista aparte que nadie abre es una lista que nadie mira.
- **La regla de completitud vive en `completitud.ts`** y el panel pinta lo que
  devuelve el backend. Había tres reglas distintas y la ficha podía decir
  «completa» mientras la persona desaparecía del archivo.
- **`construirLibro` distingue cuatro formatos** (`texto`, `entero`, `miles`,
  `fecha`). Antes ponía separador de miles a todo número: una cédula salía
  `1.019.456.782`. En la columna de documento **manda el tipo del valor**:
  número para una cédula, texto para un pasaporte con letras. Y las fechas van
  a **medianoche UTC**, porque exceljs convierte con `getTime()` sin desplazar
  por zona y sale el día cambiado.
- **`PERSONA ID` y `EMPRESA ID` van vacíos**: los pone el cliente a mano después
  de cargar. Decisión suya.
- **`TOTAL DE HORAS EVENTO` son las horas de la acción** (2, 8, 16 o 40).
  El archivo de muestra del cliente trae `1` en sus 814 filas; él confirmó que
  lo correcto son las horas.
- **`CERTIFICA` va en `NO` y las horas de cierre en 0**: el cierre es un segundo
  cargue. Certificar aquí daría una fila con 0 horas y 0 % que se contradice.
- **La caracterización va vacía, nunca `35 = NINGUNA`.** Mandar 35 es declarar
  por la persona que no pertenece a ninguna población, y eso no consta.

> **La siembra de pruebas pone los ids del SEP en NEGATIVO.** Los primeros los
> copié del archivo de muestra —`2959`, `9087`, `17689`, que son reales— y un
> Excel salido del entorno de pruebas habría apuntado a un proyecto de verdad.
> Un id negativo el SEP no lo tiene.

### Quién ve qué: el convenio y el área

`AdminConvenio(adminId, convenioId, rol)` es una **concesión explícita**: sin
fila, no hay acceso. Sustituye a la columna `convenioId` con «nulo = ve los dos»
que proponía el plan, porque la instrucción del cliente fue que trabajar en los
dos convenios exige permisos en ambos, nunca por omisión. Y como la misma
persona puede llevar áreas distintas en cada convenio, **el rol va en la fila y
no en la cuenta**.

Son dos cerraduras distintas y las dos hacen falta: el **convenio** dice de
quién son los datos, el **área** qué se puede hacer con ellos.

- **El convenio** se aplica con los fragmentos de `tableros/ambito.ts`, escritos
  una vez porque cada tabla llega al convenio por un camino distinto: la reserva
  por la oferta, la oferta por la acción, la empresa por tener alguna reserva
  dentro. Los cuatro bloques de SQL crudo llevan un `EXISTS`; con ámbito vacío
  el fragmento es `FALSE`, no un `IN ()` inválido.
- **El área** se aplica con la matriz de `admin/permisos.ts` y el decorador
  `@Requiere(area, nivel)`.

Las seis áreas son `reserva`, `inscripciones`, `inscritos`, `reportes`,
`academico` y `configuracion`, con tres niveles: `NADA`, `VER`, `ESCRIBIR`.

|  | Gestor insc. | Líder insc. | Gestor acad. | Líder acad. | Líder sist. | Consulta |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| reserva | ver | ver | ver | ver | ver | ver |
| inscripciones | **escribe** | **escribe** | ver | ver | **escribe** | ver |
| inscritos | ver | ver | ver | ver | ver | ver |
| reportes | ver | **escribe** | — | — | **escribe** | — |
| academico | ver | ver | **escribe** | **escribe** | **escribe** | ver |
| configuracion | — | — | — | — | **escribe** | — |

- **`reportes` es un área aparte de `inscritos`** por lo que lleva dentro: el
  archivo del SEP son 800 cédulas con fecha de nacimiento y celular. Ver el
  alistamiento (cuántos entran y por qué no los demás) es `VER`; descargar el
  archivo es `ESCRIBIR`. Por eso el gestor sabe qué le falta a cada persona sin
  tener el archivo en su carpeta de descargas.
- **`@Requiere` no solo niega el paso: recorta el ámbito.** El guard deja en
  `ambito.convenios` solo aquellos donde el rol alcanza el nivel pedido, así que
  **el servicio recibe la lista ya buena y no tiene que acordarse**. Sin eso,
  quien lleva académico en un convenio e inscripciones en el otro podría
  escribir inscripciones en el primero llamando a la API, aunque el menú no se
  lo enseñe. Es la misma lección de `ambito.ts`: lo que hay que recordar en cada
  consulta se olvida en alguna.
- **Certificar es lo único que separa al líder académico del gestor**, y se
  comprueba **por convenio**: se puede liderar en uno y solo digitar en el otro.
  `CERTIFICADO` y `NO_APROBO` son lo que paga el SENA y no lo firma quien
  digita; el resto de etapas las mueve cualquiera de las dos áreas.
- **El menú corto no es la cerradura.** `/admin/yo` devuelve el mayor nivel por
  área entre sus convenios y `navegacion.ts` esconde lo que no aplica, pero eso
  es comodidad: quien manda es el guard. Mientras los permisos no han llegado no
  se esconde nada, o el menú parpadearía en cada carga.
- **`permisos.spec.ts` fija la matriz** como el test de paletas fija los
  contrastes: si alguien da configuración a un gestor o deja que académico
  descargue las cédulas, falla el build. También comprueba que todo rol del enum
  tenga fila — sin ella `nivelDe` devolvería `NADA` en silencio.

> **`RolAdmin` y `RolConvenio` conviven y son dos verdades que pueden
> discrepar.** `RolAdmin` debería quedarse solo en «es superadmin o no» y todo
> lo demás salir de la concesión, pero los controladores aún llevan
> `@Roles(SUPERADMIN, GESTOR)`, así que una cuenta con `RolAdmin.CONSULTA` no
> entra al CRM aunque su concesión diga otra cosa. Hoy no hace daño porque la
> siembra da `GESTOR` a todos; limpiarlo es trabajo aparte.

Lo que el cliente pidió, y que ya está:

- Un admin con fila en los dos convenios ve los dos; cada pantalla filtrada.
- Un asesor de ADECOPRIA **no entra** a BRITCHAM: ni por URL, ni cambiando un id
  en la barra, ni llamando a la API. El filtro va en la consulta, en el
  servidor, no en el menú.
- **`Empresa` se comparte y se ve desde los dos.** Si el mismo NIT reservó en
  los dos convenios, el asesor de uno ve que la empresa existe; lo que se filtra
  son sus reservas y sus totales. Decisión explícita del cliente. Por eso las
  empresas de un convenio más las del otro suman **más** que el total: 15 + 23
  contra 24, y es correcto.

> **El subdominio no separa nada, y hay que repetirlo.** `adecopria.reservasae.com`
> y `britcham.reservasae.com` sirven la misma base con la misma sesión: sin el
> ámbito aplicado, el asesor de un convenio escribe la otra dirección y lo ve
> todo. **El subdominio es la puerta con el letrero; el ámbito es la cerradura**,
> y poner el letrero sin la cerradura es peor que no poner nada, porque todos
> creerán que está cerrado. Una vez aplicado el ámbito, el subdominio sí sirve:
> decide con qué convenio llegas puesto, con su logo y sus colores.

### Lo que falta

Acciones por lote · tareas con fecha · seguimiento académico con adaptador de
LMS (carga de archivo primero, API cuando se decida) · aplicar el ámbito por
convenio · fechas de los 67 grupos, ahora solo para el seguimiento académico.

> **Solo lectura del LMS**, decidido: alguien matricula allá y aquí se lee el
> avance. Y «al instante» se resuelve guardando una foto con su fecha y
> enseñando «actualizado hace N minutos»; consultar el LMS en cada carga de
> pantalla haría que un LMS lento sea una pantalla lenta.

---

## El entorno de pruebas (15 ago 2026)

`https://prueba.reservasae.com` — **montaje paralelo en Bogotá**, con datos
inventados, para enseñar y probar sin tocar nada real.

```
/opt/sep/reservasae         produccion  ·  rama main
/opt/sep/reservasae-prueba  pruebas     ·  rama entorno-pruebas
```

**Son dos clones distintos a propósito.** Así el árbol de trabajo de producción
no cambia por preparar una demostración, y nadie despliega en real sin quererlo.

```bash
ssh sep-vm
cd /opt/sep/reservasae-prueba
docker compose -f docker-compose.prueba.yml --profile tunel up -d --build
docker compose -f docker-compose.prueba.yml exec nginx-prueba nginx -s reload
```

> **Recargar nginx-prueba es igual de obligatorio que en producción**, y por el
> mismo motivo: `up -d --build` recrea backend y frontend con IP nueva y nginx
> no se recrea. Pasó en el primer despliegue del 15 ago 2026.

- **`nginx-prueba` vive en DOS redes.** El túnel `convoca` resuelve su destino
  por el DNS de Docker (`http://nginx-prueba:80`), así que tiene que estar en
  `reservasae_reservasae-internal`, la red de producción. Lo demás de la pila
  cuelga solo de su propia red.
- **Por eso los servicios se llaman `backend-prueba` y `frontend-prueba`.** Si
  se llamaran `backend` y `frontend`, compartir red haría que `nginx-prueba`
  pudiera resolver **los de producción**: una pantalla de pruebas escribiendo
  en la base real. El sufijo no es cosmético, es la barrera.
- **Efecto secundario que conviene saber**: mientras el entorno de pruebas esté
  levantado, `docker compose down` en producción no puede borrar la red (tiene
  un punto activo). No rompe nada y los contenedores sí se retiran.
- **La base de pruebas no se replica** porque es otro clúster con su propio
  volumen (`reservasae-prueba-datos`, **sin `pgdata` en el nombre**, ver abajo).
  Se ata a `127.0.0.1:5434` fijo y **nunca a `PG_BIND`**: no debe asomarse a la
  red privada de Tailscale ni que una réplica la confunda con la buena.
- **`ADMIN_JWT_SECRET` es distinto**, así que una sesión de pruebas no vale en
  producción. Va en `backend/.env.prueba` (fuera de git; plantilla en
  `.env.prueba.example`).
- **El compose de pruebas no se carga solo**: compose únicamente lee
  `docker-compose.yml` y su override, así que `desplegar.sh` y los demás
  guiones de sede lo ignoran por completo.

### Los datos falsos

```bash
cd /opt/sep/reservasae-prueba/backend
export ENTORNO=prueba
export DATABASE_URL=...@127.0.0.1:5434/reservasae_prueba
pnpm db:sembrar-prueba [--rehacer]
```

- **Dos guardias, y hacen falta los dos**: `ENTORNO=prueba` y que el nombre de
  la base lleve «prueba». Apuntar a producción se niega aunque la variable esté
  puesta. Comprobado a mano.
- **Va desde el clon, no dentro del contenedor**: la imagen de producción se
  instala con `--prod` y no trae `ts-node`. Por eso la base publica 5434.
- **Tras cambiar el schema hay que correr `pnpm exec prisma generate` en el
  clon** antes de sembrar. Los contenedores lo hacen en el build; los guiones
  que corren desde el clon usan el cliente que haya en `backend/generated`, y
  con uno viejo la siembra falla con errores de tipos que despistan.
- **Los números son repetibles** (generador con semilla fija): dos revisiones
  ven exactamente lo mismo.
- **El grupo tiene que casar con la etapa, y se elige la OFERTA que lo tenga.**
  Quien cursa va en un grupo abierto y quien acabó en uno cerrado. Elegir solo
  la cobertura no basta: si la oferta no tiene ningún grupo abierto, el respaldo
  mete gente «en formación» en un curso vencido, y el tablero académico marca
  «atrasados» que en realidad son cursos caducados.
- **`hace()` recorta al presente, y por eso las fechas de grupo NO pasan por
  ella.** El recorte existe para que `ultimoAcceso` no caiga en el futuro; los
  grupos sí necesitan fechas futuras, y colarlos por ahí aplastó dieciséis
  contra el mismo instante y dejó certificados con nota en cursos que empezaban
  ese día. Es la misma lección de los guiones de sede: **el arreglo trajo su
  propio defecto.**
- **La autorización se fecha en el paso de «datos completos»**, nunca después de
  matricular: es la compuerta que el sistema dice imponer, y el código real es
  incapaz de generar ese historial.
- Siembra 24 empresas, ~60 reservas, **100 participaciones por las nueve
  etapas**, 180 actividades, avances a cuatro ritmos, notas, autorizaciones,
  fechas para los 67 grupos y las 15 acciones publicadas.
- **Deja brecha de nombres a propósito** (~600 cupos sin nadie detrás): es la
  cifra que abre el CRM y con la brecha en cero no se vería nada.
- **Unas cuantas personas repiten en dos cursos**, para que se vea que la misma
  cédula es *una* persona con dos participaciones.
- **Seis cuentas, una por perfil**, todas con `Prueba2026*` y todas
  `@ejemplo.test`. Nacen con `debeCambiarClave = false`: se entra a mirar, no a
  estrenar contraseña.

  | Cuenta | Rol | Dónde |
  |---|---|---|
  | `ana.jaramillo` | Líder de sistemas · **superadmin** | los dos |
  | `carlos.mesa` | Líder de inscripciones / Gestor académico | **uno en cada uno** |
  | `lucia.parra` | Gestora de inscripciones | solo ADECOPRIA |
  | `hector.ramos` | Gestor académico | solo BRITCHAM |
  | `marta.oquendo` | Líder de seguimiento académico | los dos |
  | `sofia.rendon` | Consulta | los dos |

  **Carlos es el que de verdad prueba el sistema**: lleva áreas distintas en
  cada convenio, así que descarga el reporte de ADECOPRIA y recibe 403 en el de
  BRITCHAM. Con todos llevando el mismo rol en los dos, un fallo en el recorte
  por área no se vería.

### La franja

`frontend/src/components/franja-entorno.tsx`, en el layout raíz, así que sale
en todas las pantallas.

- **Lleva color escrito a mano y es la única excepción a la regla de los
  tokens.** La paleta la edita el administrador; si la franja saliera del tema,
  bastaría un cambio de color para volverla invisible, que es exactamente lo
  que no puede pasar.
- **`ENTORNO` va como `ARG` del Dockerfile además de variable de entorno**: casi
  todas las páginas del panel son estáticas y Next las hornea al compilar. Solo
  con la variable en ejecución, la franja no saldría en ellas.
- **El enlace «Ir al sitio real» apunta a `/consulta`, no a la raíz**: allá la
  raíz devuelve 404 a propósito y parecería que producción está caída.
- **El correo de la portada va envuelto en `<!--email_off-->`.** Cloudflare
  tiene Email Obfuscation activo en la zona y reescribe cualquier dirección del
  HTML como `[email protected]`, dejando media credencial a quien lo lea con
  `curl` o sin JavaScript. Es un conjuro no evidente: **no lo borre.**

### Lo que sigue pendiente aquí

- **El riesgo que se asumía ocurrió el 18 ago 2026, y ya está cerrado.** A las
  18:07 la VM de Bogotá se apagó —limpio, no fue corte de luz—, El Socorro se
  promovió sola y el túnel `convoca` se fue con ella. El failover funcionó y
  producción no cayó ni un segundo, pero en El Socorro no existe `nginx-prueba`:
  `prueba.reservasae.com` quedó en 502 seis horas con toda su pila sana en
  Bogotá. La última petición que entró fue a las 18:06:27.

  Ahora pruebas tiene **su propio túnel**, `convoca-prueba`
  (`f6bd991c-3d0d-4a0f-b480-cd3df1269139`), con su ingress en
  `docker/cloudflared/prueba.yml` y su id en el `.env` de la raíz del clon
  (`TUNEL_PRUEBA_ID`, fuera de git).

  **Corre con `user: 1000:1000`.** La imagen de cloudflared corre como 65532 y
  el fichero que escribe `tunnel create` es 400 de quien lo creó: sin eso el
  contenedor reinicia en bucle con «permission denied», que suena a permisos de
  Docker y son los del fichero.

  **Esto no evita que pruebas caiga si Bogotá se apaga** — pruebas solo vive
  ahí. Evita que se quede caída después: vuelve sola al encender.

  **Este túnel es al revés que el de producción, y a propósito.** Aquel lleva
  `restart: "no"` y lo gobierna `arrancar-tunel.sh` porque puede migrar de sede
  y dos conectores parten el tráfico entre dos bases. Este no migra —solo
  existe en Bogotá y solo sirve un hostname—, así que revive solo y no necesita
  guardia. El perfil está para que la pila suba igual mientras el túnel no
  exista.

  De paso **`nginx-prueba` deja de estar en la red de producción**. Era la
  única razón por la que la pila de pruebas tocaba la red real, y la barrera
  contra resolver el `backend` equivocado quedaba en el nombre del servicio.
  Ahora ni siquiera hay ruta.
- La casilla de tratamiento de datos del formulario público **no enlaza al
  texto**, aunque la política existe y `GET /api/politicas/:slug/RESERVA` la
  sirve. Es de producción, no del entorno de pruebas, pero aquí se ve más
  porque el formulario es usable de punta a punta.

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

### Los seis guiones

Todos en `scripts/`, todos idempotentes, todos con el mismo criterio: **antes de
destruir algo, comprobar que hay a dónde ir**.

| Guión | Dónde | Qué hace |
|---|---|---|
| `desplegar.sh` | principal | construye, comprueba y **solo entonces** marca el commit |
| `seguir-al-principal.sh` | réplicas | temporizador cada 2 min: se pone en el commit marcado y construye |
| `arrancar-tunel.sh` | todas | temporizador cada 1 min: levanta el túnel **solo si le toca** |
| `promover.sh` | una réplica | la convierte en principal |
| `rendirse.sh` | la sede relevada | suelta el tráfico y vuelve a ser réplica de otra |
| `estado.sh` | cualquiera | las tres sedes de un vistazo |

`comun.sh` tiene lo compartido y `sonda.sh` es el informador de una sola sede.

> **`rendirse.sh` elegía el volumen con `docker volume ls -q | grep pgdata |
> head -1`.** Con el entorno de pruebas en la misma máquina hay más de un
> volumen de Postgres, y `reservasae-prueba_` ordena **antes** que
> `reservasae_` (el guion precede al guion bajo en ASCII): habría borrado el
> equivocado. Ahora sale del contenedor `db` del propio proyecto de compose.
> El volumen de pruebas además se llama `-datos` y no `-pgdata`, para que ni
> siquiera coincida con ese patrón.

- **Bogotá marca un commit; las réplicas siguen la marca, no `origin/main`.** Un
  commit que rompa el arranque nunca llega a propagarse, porque `desplegar.sh`
  solo escribe `.desplegado` si el sitio responde después de construir.
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

### Failover: el runbook

**Promover no es automático, y es una decisión de diseño.** Con tres nodos —uno
de ellos el PC Dell— un promotor automático confundiría «Bogotá cayó» con «se me
fue el internet a mí». Dos bases aceptando reservas dan dos verdades que no se
pueden fusionar, porque la replicación es física.

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
