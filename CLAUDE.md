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

## Estado actual (20 ago 2026 · v0.3.0)

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
- ✅ **La autorización de datos ya se puede revocar** (27 ago 2026), que
  hasta hoy era imposible: `revocadaEn` se leía en siete consultas y no se
  escribía en ninguna. Ver «Los cinco bloques».
- ❌ Los grupos no tienen fechas (los proyectos no las traen).
- ✅ **Las 15 acciones están publicadas** (7 en ADECOPRIA y 8 en BRITCHAM ADEE)
  desde el 20 ago 2026, y hay **1 reserva real**. El sitio público ya recibe.
  Hasta esa fecha estaban todas ocultas a propósito, por no tener fechas.
- ✅ **El failover es automático** desde el 15 ago 2026: si el principal deja
  de atender cinco minutos y una tercera sede lo confirma, El Socorro (o
  Bogotá) se promueve sola, y la sede que vuelve se rinde sola.
- ✅ **CRM, sección de inscripciones**: tablero de etapas, ficha, brecha de
  nombres, carga masiva y **seguimiento académico**. Ver «El CRM».
- ✅ **Cronograma** de grupos, **académico en acordeón** con sus estados y el
  80 % para certificar, **inscripción pública** con enlace de completado,
  **el F7 de empresas** y **tablas con columnas a elegir**. Ver más abajo.
- ⏳ Del CRM faltan las tareas con fecha, el correo y el adaptador del LMS.
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
`GET /admin/participantes/academico`, `GET /admin/participantes/catalogos`,
`POST /admin/participantes/:id/revocar-autorizacion`,
`GET /admin/sep/alistamiento-f7`
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

### Las tablas del panel (20 ago 2026)

`frontend/src/components/admin/tabla.tsx`, una sola para las cuatro listas:
reservas, organizaciones, inscripciones e inscritos. Cada pantalla declara sus
columnas como datos; el componente pone elegirlas, filtrarlas, ordenarlas,
paginarlas y guardar vistas con nombre.

- **Filtra en el navegador y lo dice.** Sobre las filas cargadas, no sobre la
  base. Cuando el servidor tiene más, la barra enseña «filtrando sobre 200 de
  1.204» y ofrece traerlas todas. Callarlo daría un recuento que **parece** el
  total y no lo es, que es la peor clase de cifra.
- **Un filtro sobre una columna que se oculta NO desaparece**: queda su ficha
  arriba marcada «oculta». Un filtro invisible que sigue filtrando explica
  resultados que nadie se explica.
- **Las columnas de una persona viven en `columnas-participante.tsx`**, no
  repetidas en Inscripciones y en Inscritos: son la misma fila en dos momentos
  del proceso, y definirlas dos veces garantiza que se separen.
- **El detalle de una reserva pasó a un cajón lateral** (`cajon.tsx`). La fila
  desplegable llevaba un `colSpan` fijo, y con columnas que se quitan y se
  ponen ese número se descuadra solo.
- **La elección se guarda en `localStorage`, no en la base**: es la forma de
  mirar de cada quien, no la de todos. Se lee en un efecto y no en el estado
  inicial porque en el servidor no existe y rompería la hidratación.
- **`porDefecto` sale de las columnas sin `aparte`.** Marcar una `fija` impide
  quitarla: sin documento ni nombre no se sabe de quién es la fila.
- **Volver a la página 1 al filtrar se hace durante el render**, comparando una
  firma de los filtros, no en un efecto: así no hay un pintado intermedio con
  la página vieja.

**La primera acción por lote**: asignar el mismo asesor a varias fichas.
`PATCH /admin/participantes/lote/asesor`.

- **Cada ficha deja su movimiento con quién lo hizo.** Sin eso, veinte fichas
  cambiarían de dueño sin rastro, que es lo contrario de lo que se pidió.
- **Devuelve `cambiadas`, `sinCambio` y `fuera`**, no un total. Las que ya
  tenían ese asesor no se tocan y las de otro convenio no entran: contarlas
  todas como cambiadas sería mentir sobre lo que pasó.
- **Un movimiento con la misma etapa antes y después no es un cambio de etapa**,
  así que el historial pinta su nota en lugar de «Nuevo → Nuevo».


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
- **Duplicar copia todo menos las respuestas.** `POST /admin/formularios/:id/
  duplicar` trae secciones, preguntas, opciones, apariencia y logos, y nace en
  borrador. **La trampa son las condicionales**: apuntan a su madre *por id*, así
  que copiadas tal cual la copia seguiría apuntando al formulario original. Se
  crean sin la condición y se remapea en una segunda pasada, cuando los ids
  nuevos ya existen. Lo archivado no se arrastra: una copia empieza limpia.
- **El candado de los campos del núcleo solo cubre a los imprescindibles.**
  Antes cubría a todos, y había opcionales —«Número de colaboradores», «red
  asociada»— marcados `obligatorioParaPublicar: false` que aun así no había
  forma de quitar. Se puede reservar sin ellos, así que un formulario de evento
  puede prescindir de ellos. La marca es la misma que ya gobernaba si un campo
  del sistema puede ser opcional.
- **Dos formularios contra la misma oferta no pueden sobrevender.** El evento de
  Medellín ofrece las mismas acciones y los mismos cupos que `/adecopria`, y
  reserva contra la misma fila de `ofertas`: el `UPDATE` condicional atómico es
  uno solo. Lo que separa a los dos es `Reserva.formularioId`, que dice por qué
  enlace entró cada reserva. Comprobado: 130 → 127 al reservar desde el enlace
  del evento, y 130 otra vez al cancelar.
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
- **Dos capas contra el destello, y la primera va por HOST, no por ruta.**
  `components/estilos-gremio.tsx` es un Server Component que emite la paleta ya
  en el HTML desde el layout **raíz** (necesita `API_INTERNA`, que va en
  `docker-compose.yml`), y `SCRIPT_PALETA` repinta desde `localStorage` en las
  visitas siguientes.

  **Antes lo hacía `[convenio]/layout.tsx` y por eso se quitó**: por ruta, el
  formulario corto salía de un color y el largo de otro, siendo el mismo
  trámite. Por host los dos comparten dominio y salen iguales, y de paso
  `/consulta` y `/completar/<token>` del subdominio también. **No vuelva a
  inyectarla por ruta.**

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

### La forma del panel

Sale de SICC —el sistema de correspondencia del mismo grupo— pero **solo la
forma**: barra lateral con iconos, chip del usuario al pie con su avatar, cajón
en móvil con velo, cabecera que dice en qué pantalla se está, y Plus Jakarta
Sans.

- **La paleta NO se copió.** El verde y el azul de SICC son la identidad del
  SENA, que este sitio no nombra, y fijar colores en el código dejaría sin
  efecto el editor de apariencia. El menú se pinta con los tokens de
  `ENCABEZADO`, así que **aquí el administrador también elige el color de la
  barra**, cosa que allá está fija.
- **Los estados activos usan `bg-current`**, que tiñe con el propio color del
  texto: contrasta con cualquier fondo que el admin elija, claro u oscuro. Un
  `bg-marca-suave` se habría vuelto invisible sobre un encabezado oscuro.
- **Los iconos van dibujados en `components/admin/iconos.tsx`**, no importados:
  eran quince, y traerse un paquete de mil por eso engorda el bundle y añade
  algo que mantener. Usan `currentColor`.
- **`piezas.tsx` tiene lo que repiten todas las pantallas**: la cifra grande con
  su icono en un cuadro teñido —el fondo sale de `color-mix` sobre el mismo
  token que el trazo, así que un solo color da los dos—, la píldora de estado,
  el encabezado de pantalla y el vacío.
- **Las cifras no van en monoespaciada.** Esa fuente se eligió para alinear
  columnas y en un número grande solo lo hace parecer un log; `tabular-nums`
  alinea igual sin cambiar de voz.

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

# Dar concesiones a una cuenta que ya existe, sin tocarle la clave.
pnpm --filter backend db:crear-admin correo@ejemplo.com "Nombre" --solo-permisos

# Cambiar el rol de una cuenta que ya existe, sin tocarle la clave.
pnpm --filter backend db:crear-admin correo@ejemplo.com "Nombre"   --rol SUPERADMIN --solo-permisos
```

> **El rol solo se cambia si `--rol` se escribió de verdad**, y ese detalle es lo
> que lo hace seguro: `--rol` vale `SUPERADMIN` por omisión, así que aplicarlo
> siempre convertiría en superadmin a cualquiera al que se le reinicie la
> contraseña. Comprobado en pruebas en los dos sentidos.
>
> **Hasta el 26 ago 2026 el script no cambiaba el rol**: a una cuenta existente
> solo le tocaba la clave. La herramienta documentada para arreglar accesos no
> podía ascender a nadie, y tocaba ir a la base a mano contra producción.
>
> **Para el día a día, mejor el panel** (`/admin/usuarios`): crea, asciende y
> **exige al menos una concesión al crear**, que el script no hace — él reparte
> todos los convenios activos. El script es para el primer usuario y para cuando
> nadie puede entrar.
>
> **En el clon del servidor el script no corre tal cual**: se instala sin las
> dependencias de desarrollo, así que no hay `prisma` ni `ts-node` útiles. El
> cliente se genera dentro de la imagen, no en el clon.

> **El script otorga también la concesión por convenio**, y tiene que hacerlo:
> con el ámbito aplicado, una cuenta sin fila en `AdminConvenio` no ve nada y
> recibe 403 en todas las rutas con área. Sin esto, el mecanismo documentado
> para recuperar el acceso creaba cuentas que no podían trabajar. Un
> `SUPERADMIN` nace `LIDER_SISTEMAS` en todos los convenios activos; los demás,
> `GESTOR_INSCRIPCION`.

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
git clone git@github.com:JoSeLoDiAz/reservasae.git
cd reservasae
pnpm install

cp backend/.env.example backend/.env
docker compose up -d db          # Postgres en localhost:5433
pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend prisma db seed

pnpm dev:backend    # :4000
pnpm dev:frontend   # :3000
pnpm --filter backend db:crear-admin tu@correo.com "Tu Nombre"
```

> **Cada quien con su base, y esto no es opcional.** El `backend/.env` del
> portátil de Josse apunta, vía túnel SSH, **a la base del servidor**: cualquier
> migración o seed que se corra desde ahí va directo a producción. Un `.env`
> copiado de otro equipo hereda ese apunte sin avisar. Empiece siempre desde
> `.env.example` y compruebe que `DATABASE_URL` dice `localhost:5433`.

**Trabajar en la rama propia**, nunca en `dev` directamente:

```bash
git checkout dev-mauricio
git pull origin dev             # traer lo que haya hecho el resto
# …trabajar, commits en español explicando el porqué…
git push origin dev-mauricio
```

Para integrar, un PR de `dev-mauricio` a `dev` en GitHub. Vale también un merge
directo, pero el PR deja escrito qué entró y cuándo, que es lo que se echa de
menos tres meses después.

**A `pruebas` y a `main` no se empuja de frente**: `pruebas` la mueve quien va a
enseñar algo al cliente, y `main` solo después de que lo apruebe.

## La versión

`/api/estado` la saca del `package.json` del backend, no de una constante suelta
—había tres números distintos: `1.0.0` en la raíz, `0.0.1` en el backend y
`0.1.0` escrito a mano en el código—. Se sube en los dos `package.json` al
publicar, y se etiqueta el commit:

```bash
git tag -a v0.2.0 -m "qué trae"
git push origin v0.2.0
```

`APP_VERSION` sigue mandando si está puesta: es lo que hace que el entorno de
pruebas se anuncie como `0.2.0-prueba` sin tocar el código.

## Las ramas

```
dev-mauricio ──┐
               ├──►  dev  ──►  pruebas  ──►  main
Josse ─────────┘      │           │            │
                  nadie lo    prueba.        las TRES
                  despliega   reservasae     sedes
```

| Rama | Qué es | Dónde corre |
|---|---|---|
| `dev` | el día a día. Josse trabaja aquí | en ningún sitio |
| `dev-mauricio` | rama propia de Mauricio Andrés Palma | en ningún sitio |
| `pruebas` | lo que el cliente revisa | `prueba.reservasae.com` |
| `main` | lo aprobado | **las tres sedes** |

- **`main` es lo que de verdad está en producción**, no «lo último bueno». Así
  `git log main` responde qué está corriendo sin ir a mirar al servidor. Avanza
  solo con un `merge --ff-only` desde `pruebas`, después de aprobarlo.
- **Hasta el 19 ago 2026 no había tal cosa**: se trabajaba en `main` y se
  copiaba a `entorno-pruebas`, así que las dos eran el mismo commit y la rama
  de pruebas no filtraba nada. Lo único que protegía a producción era que el
  despliegue es manual.
- **Las tres sedes van por `main`**, no solo la principal: Bogotá y el PC Dell
  tienen su clon en la misma rama aunque solo corran la base, porque al
  promoverlas tienen que poder levantar la aplicación sin cambiar de sitio.
  `/opt/sep/reservasae-prueba` va por `pruebas`.
- **`dev-mauricio` lleva guion y no barra.** Git no admite a la vez una rama
  `dev` y otra `dev/mauricio`: un ref no puede ser fichero y carpeta a la vez.
- **El repositorio no llega a GitHub**: el push está bloqueado, así que el
  código viaja en `git bundle` por scp. Por eso las ramas se mueven con
  `fetch <bundle> rama:refs/remotes/bundle/rama` y luego `merge --ff-only`.

> **El remoto de GitHub ya funciona, y es el sitio común.** Se desatascó el 19 ago
> 2026 empujando desde `sep-vm`. Los `git bundle` siguen existiendo para llevar
> código al servidor, pero **entre personas se usa GitHub**: es donde se mira quién
> va por dónde. Ojo: desde el portátil de Josse el push puede seguir bloqueado por
> el clasificador, así que si falla, se empuja desde `sep-vm`.

## Arrancar en una máquina nueva

Esto es lo que hay que hacer la primera vez, en Windows. Escrito para Mauricio,
pero sirve para cualquiera.

### Antes de empezar

| | |
|---|---|
| Git para Windows | `git --version` |
| Node.js 22 LTS | `node --version` |
| VS Code | |
| WSL 2 | `wsl -l -v` → debe decir **Running** y versión **2** |
| Docker Desktop | `docker ps` tiene que responder |

**Docker Desktop tiene que estar abierto y arrancado** antes de tocar la base. Si
`docker ps` da error, no es el proyecto: es Docker que no ha terminado de subir.

### pnpm, y por qué esta versión y no otra

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm --version    # tiene que decir 10.33.0
```

**No lo instales con `npm i -g pnpm` ni pongas `pnpm@latest`.** pnpm 11 aplica la
política `minimumReleaseAge` y el build falla cuando el lockfile trae paquetes
publicados en las últimas 24 h. La versión está fijada en `package.json` y en los
dos Dockerfiles, y tiene que coincidir.

### El proyecto

```powershell
git clone git@github.com:JoSeLoDiAz/reservasae.git
cd reservasae
pnpm install

Copy-Item backend\.env.example backend\.env
```

**Abre `backend/.env` y comprueba que `DATABASE_URL` dice `localhost:5433`.**
No es un formalismo: el `.env` del portátil de Josse apunta, vía túnel SSH, **a la
base del servidor**, y un `.env` copiado de otro equipo hereda ese apunte sin
avisar. Cualquier migración o seed que se corra con ese apunte va directo a
producción. Empieza siempre desde `.env.example`.

Hace falta además `ADMIN_JWT_SECRET`, mínimo 32 caracteres. Sin ella el backend
**no arranca**, y es deliberado. Para local vale cualquier cosa larga:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Sin Docker: Postgres nativo

Docker solo hace falta para **levantar la base**. Ningún script del proyecto lo
usa: `pnpm dev:backend`, `dev:frontend`, las migraciones, las siembras y los tests
corren en Node a secas. Quien no tenga Docker instala PostgreSQL y ya.

**Instala PostgreSQL 17** desde <https://www.postgresql.org/download/windows/>.
En el instalador, **pon el puerto 5433 en vez del 5432**: es el que ya dice
`.env.example`, y así no hay que tocar la cadena de conexión ni acordarse de por
qué no conecta. Apunta la contraseña que le des a `postgres`.

Luego, en «SQL Shell (psql)» —entrando como `postgres` al puerto 5433—:

```sql
CREATE ROLE reservasae WITH LOGIN PASSWORD 'la-que-quieras';
CREATE DATABASE reservasae OWNER reservasae;
```

Y en `backend/.env`:

```
DATABASE_URL="postgresql://reservasae:la-que-quieras@localhost:5433/reservasae?schema=public"
```

A partir de ahí, **todo lo demás es idéntico**: `prisma migrate deploy`, `db seed`,
`db:crear-admin` y los dos `pnpm dev:`. Sáltate solo el `docker compose up -d db`.

> Si algún día instalas Docker, el `db` del compose también publica el 5433 y
> chocará con el Postgres nativo. Se arregla parando el servicio de Windows
> («Servicios» → `postgresql-x64-17` → Detener) antes de levantar el compose.

**La otra opción es Postgres dentro de WSL 2**, que ya está instalado. Es más
parecido a producción —el mismo Postgres de Linux— pero tiene una trampa: el
servicio no arranca solo al encender, hay que hacer `sudo service postgresql start`
en cada sesión, y hay que abrirle el acceso por contraseña en `pg_hba.conf`. El
instalador de Windows no tiene ninguna de las dos cosas, así que para trabajar
sale más a cuenta.

**Lo que NO se puede hacer sin Docker**, y no hace falta:

- Construir las imágenes. El despliegue se hace en el servidor, no en el portátil.
- Levantar la pila entera con nginx. En local no hay nginx: `frontend/next.config.ts`
  tiene un rewrite que replica exactamente el salto que hace nginx en producción,
  y por eso el código del frontend es idéntico en los dos sitios.

### La base y los datos

```powershell
docker compose up -d db                              # con Docker; si no, ver arriba
pnpm --filter backend exec prisma migrate deploy     # las tablas
pnpm --filter backend prisma db seed                 # el catálogo real
pnpm --filter backend db:crear-admin tu@correo.com "Tu Nombre"
```

La siembra es idempotente: se puede repetir sin miedo. Carga las 15 acciones, 67
grupos, 106 ofertas y 4.797 cupos, y **nunca toca `cuposOcupados`** ni el `visible`
de una acción que alguien haya ocultado.

Si quieres además datos de CRM inventados —personas, avances, notas— para ver las
pantallas con algo dentro:

```powershell
$env:ENTORNO="prueba"
pnpm --filter backend db:sembrar-prueba --rehacer
```

### Arrancar

```powershell
pnpm dev:backend     # :4000
pnpm dev:frontend    # :3000
```

Entra en <http://localhost:3000/admin> con la cuenta que creaste.

> **Cuidado con `localhost` al probar la API desde Node.** El fetch de Node resuelve
> `localhost` a `::1` y Nest escucha en `0.0.0.0`, que es solo IPv4: la conexión se
> corta sin explicación. Usa `127.0.0.1`. En el navegador no pasa.

### El día a día

```powershell
git checkout dev-mauricio
git pull origin dev          # traer lo que haya hecho el resto
# …trabajar, commits en español explicando el POR QUÉ…
git push origin dev-mauricio
```

Para integrar, un PR de `dev-mauricio` a `dev` en GitHub. Vale también un merge
directo, pero el PR deja escrito qué entró y cuándo, que es lo que se echa de menos
tres meses después.

**A `pruebas` y a `main` no se empuja de frente.** `pruebas` la mueve quien va a
enseñar algo al cliente, y `main` solo después de que lo apruebe.

### Antes de cada push

```powershell
pnpm --filter backend exec tsc --noEmit -p tsconfig.json
pnpm --filter backend test
pnpm --filter frontend exec tsc --noEmit
pnpm --filter frontend build
```

Los cuatro tienen que pasar. Hay tests que **fallan a propósito** si alguien rompe
un contrato: las cabeceras de los tres reportes al SEP, la matriz de permisos por
rol y los contrastes de las paletas. Si uno de esos falla, no lo silencies: está
avisando de algo que el cliente iba a notar.

> **Del lint hay errores preexistentes** —`react-hooks/set-state-in-effect`,
> `react-hooks/refs` y tres imports sin usar— que no son tuyos. Antes de arreglar
> uno, comprueba con `git stash` que venía de antes.

### Lo que conviene leer antes de tocar nada

- **Este archivo entero.** El porqué de las decisiones no obvias está aquí y no
  repartido por el código: los comentarios son de una línea y no explican nada.
- `backend/src/admin/permisos.ts` — quién puede hacer qué.
- `backend/src/crm/anclas.ts` — por qué las fechas de los tableros salen del
  historial de movimientos y no de las columnas de fecha.
- `backend/src/crm/completitud.ts` — la única regla de qué le falta a una ficha.

## Desplegar

```bash
ssh sep-vm
cd /opt/sep/reservasae
git pull
docker compose up -d --build
./reload-nginx.sh          # ← ya no es obligatorio, ver abajo
```

Verificar:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4600/          # frontend
curl -s http://127.0.0.1:4600/api/estado                                  # backend
```

> **Ya no hace falta recargar nginx, y esa es la novedad.** Hasta el 23 ago 2026
> nginx resolvía el destino **una sola vez al arrancar**: `docker compose up`
> recreaba backend y frontend con IP nueva, nginx no se recreaba, y quedaba
> apuntando a las viejas. Salía un 502 que además despistaba, porque una mitad
> del sitio seguía respondiendo 200. Pasó en el despliegue del 30 jul y otra vez
> en el failover del 23 ago, que dejó la API caída sin que nadie lo notara.
>
> Ahora `docker/nginx/default.conf` lleva `resolver 127.0.0.11` y el destino en
> una **variable**, que es lo que obliga a nginx a volver a preguntarle al DNS de
> Docker cada 10 s. Comprobado ocupándole la IP al backend para forzar el cambio:
> se recuperó solo, sin recargar. El precio es perder `keepalive` contra el
> upstream, que con este volumen no se nota.
>
> `reload-nginx.sh` sigue ahí por si acaso, pero ya no es obligatorio. Y el
> mismo arreglo va en `docker/nginx/prueba.conf`.

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

### El cronograma, y el académico contra él

`/admin/cronograma`: cuándo empieza y termina cada grupo. Un acordeón por
acción de formación —**en orden, AF1, AF2…**— y dentro, uno por grupo.

- **Editarlo es de quien configura la formación** (`@Requiere('configuracion',
  'ESCRIBIR')`), no del superadmin: el líder de sistemas tiene que poder poner
  las fechas, y con `@Roles(SUPERADMIN)` quedaba fuera de su propia pantalla.
- **`fin` nunca antes que `inicio`, y no hay `fin` sin `inicio`.** Un grupo con
  solo fecha de fin no se puede juzgar y ensuciaría el académico.
- **`estadoDeGrupo()`**: `SIN_FECHAS`, `POR_EMPEZAR`, `EN_CURSO`, `TERMINADO`.
  Sin fechas no se inventa nada: se dice que faltan.

El seguimiento académico (`/admin/participantes/academico`) va también en
acordeón y estrena estados. **Los nuevos separan tres cosas que antes eran la
misma:**

| | |
|---|---|
| `SIN_INGRESO` | su grupo arrancó y nunca entró al aula |
| `SIN_ARRANCAR` | entró, pero no ha aprobado ni una actividad |
| `COMPLETADO` | aprobó el 80 % o más: **listo para certificar** |

- **`MINIMO_PARA_CERTIFICAR = 0.8`, y se comprueba en el servidor.** Pasar a
  `CERTIFICADO` por debajo del 80 % de lo obligatorio se rechaza. El botón se
  esconde, pero el que manda es el guard.
- **El orden de la escalera importa**: certificado, salidas y «listo para
  certificar» ganan a cualquier juicio de ritmo. Alguien que aprobó el 90 %
  no es «atrasado» porque su grupo vaya rápido.

### La inscripción pública y el enlace de completado

Dos pasos a propósito. En `/[convenio]/preinscripcion` la persona elige acción
y ciudad y deja **lo mínimo**: documento, nombres, apellidos, género, celular y
correo. Ahí ya está dentro. Después, «quiero terminar de completar toda mi
información» abre el resto en `/completar/<token>`.

- **Se parte en dos porque el formulario largo espanta.** Con lo mínimo la
  persona ya cuenta como lead y el asesor puede llamarla; lo demás puede
  llegar por su cuenta y ahorrarse la llamada.
- **El token es de un solo uso y dura 15 días**, 32 bytes en base64url. Emitir
  uno nuevo invalida el anterior: dos enlaces vivos a la misma ficha son dos
  formas de entrar y solo una se puede revocar.
- **No encontrado, caducado y ya usado dan el MISMO mensaje.** Distinguirlos
  convertiría la ruta en un oráculo de qué tokens existen.
- **Registrarse dos veces no duplica**: la persona se busca por documento y, si
  ya estaba en esa formación, se le devuelve su enlace.
- **Los datos de la empresa se pueden dejar para después** sin perder los de la
  persona: se guardan por separado y el enlace se cierra al terminar.
- Cualquiera de dentro puede **volver a emitirlo** desde la ficha
  (`POST /admin/participantes/:id/enlace`).


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

> **El corte de «tamaño de organización» ya va por el Decreto 957** (27 ago
> 2026). Contaba por número de empleados (Ley 590 original) mientras el SEP
> clasifica por ingresos y sector, así que una empresa de 8 empleados y $30.000
> millones salía «Microempresa» en la pantalla y «Grande» en el archivo. El dato
> bueno ya estaba en la base —`Empresa.tamanoSepId`, el que viaja al F7—;
> simplemente nadie lo miraba aquí.
>
> - **La talla se DERIVA de la etiqueta del catálogo**, no de un mapa de doce
>   entradas al lado: un mapa a mano y el catálogo generado acaban discrepando el
>   día que el SEP añada un valor. `tallaDeOrganizacion()` en `catalogos-sep.ts`.
> - **El número de empleados se conserva solo como respaldo, y la pantalla dice
>   cuántas van por cada criterio.** Mientras no todas hayan declarado su rango de
>   ingresos, la cifra mezcla dos criterios que no dan lo mismo; callarlo daría
>   un recuento que *parece* exacto y no lo es.
> - **Las mipymes van sumadas y aparte.** Es la cifra que los proyectos
>   comprometen, e iba repartida en tres barras: para saber si se cumple había que
>   sumarlas a ojo.
> - Sigue haciendo falta **pedirle a cada organización su sector y su rango de
>   ingresos** — eso no es código. El enlace de completado ya lo pide.

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

### Los tres reportes

`/admin/sep`. **Reporte de control** (27 columnas, el legible), **Reporte al
SEP** (54, el que se sube) y el **F7 de empresas** (18). Código en
`backend/src/crm/sep/`.

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

- **El F7 NO va por persona**, a diferencia de los otros dos: una fila es una
  organización **dentro de una acción de formación**, con cuántos de los suyos
  se están formando. La misma empresa con gente en dos cursos son dos filas.
- **Sus cabeceras traen dos erratas del cliente y van tal cual**: la de la
  persona de contacto lleva un espacio **delante** y «DE LA  EMPRESA» un
  espacio **doble**. `formatos.spec.ts` las fija; si alguien las «corrige»,
  falla el build.
- **Lo que le falta a cada organización sale en `/admin/empresas`**, columna
  «Datos para el F7», y son exactamente los datos que pide el enlace de
  completado. Así la lista de incompletas es accionable y no una queja.
- **`Empresa.clasificacion`** (pública, privada o mixta) se añadió para la
  última columna, que no tenía de dónde salir.

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

- **Lo que se ve desde fuera o no se deshace es del superadmin**, aunque el área
  lo permita: publicar o retirar un formulario, duplicarlo, la apariencia
  —general y por formulario—, las cuentas de usuario y **todos los borrados**.
  El líder de sistemas construye; abrir al público es otra cosa.
  **Publicar se comprueba dentro de la ruta y no sobre ella**: el mismo `PATCH`
  edita el título y los textos, que sí son de quien construye, así que bloquear
  la ruta entera le habría quitado también eso.
- **Se puede borrar lo que antes exigía consola.** Una reserva devuelve sus
  cupos a la oferta y arrastra a la organización si se queda sin ninguna otra;
  una participación se lleva sus notas y su avance pero **no a la persona**,
  porque la misma cédula puede estar en el otro convenio. Una reserva con gente
  inscrita detrás **no se borra** —lo impide también el `onDelete: Restrict` de
  la base—: se cancela.
- **El diálogo pide escribir el NIT o el documento.** Un «¿está seguro?» se
  acepta sin leer; teclear un número obliga a mirar cuál se está borrando.

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

### Un subdominio por gremio (26 ago 2026)

`adecopria.reservasae.com` y `britcham-adee.reservasae.com`, más
`reservasae.com` como puerta general. Los tres van al mismo nginx y a la misma
base: **lo que separa es el ámbito, no el subdominio.** El letrero sin la
cerradura sería peor que nada, porque todos creerían que está cerrado.

- **El subdominio ES el slug del convenio**, así que no hay campo ni tabla de
  equivalencias. Se pensó en `britcham.` a secas y se descartó: una traducción
  más que mantener sincronizada, para nada.
- **No hizo falta cerradura nueva.** Ya existía el recorte por gremio con la
  cabecera `x-gremio`; el host se traduce a gremio y entra por el mismo sitio.
- **Pero la dirección NO se ignora en silencio, y la cabecera sí.** Aquella es
  una comodidad del panel y caer al otro gremio es inofensivo. El subdominio
  **afirma** en qué gremio está: caer al otro pintaría las cifras de BRITCHAM
  bajo el logo de ADECOPRIA, que es peor que un error. Si la cuenta no tiene ese
  convenio, se le dice y no entra.
- **Se comprueba también en el login**, que es `@Publica()` y se salta el guard.
  Sin eso se entraba bien y después toda pantalla contestaba que no, que parece
  un sistema roto en vez de una puerta equivocada.
- **Con el gremio fijado por la dirección, el desplegable se queda en uno.**
  Ofrecer el otro dejaría elegir un gremio que el servidor va a ignorar. Por lo
  mismo la dirección manda sobre el `localStorage`: uno de la visita anterior
  pintaría arriba un gremio distinto al de las tablas.
- **La puerta general se cierra con `PANEL_GENERAL_SOLO_SUPERADMIN=si`**, no en
  el código: en local y en pruebas tiene que seguir abierta o nadie podría
  desarrollar ni revisar con las demás cuentas.
- **nginx no se toca** (`server_name _` y ya pasa `Host $host`), y el ingress
  del túnel `convoca` se edita **en el panel de Cloudflare**, no en un archivo:
  corre con `--token`, así que se añaden hostnames sin desplegar ni reiniciar.

Comprobado con la misma cuenta por las tres direcciones: 19 organizaciones por
ADECOPRIA, 18 por BRITCHAM y 24 por la general. **19 + 18 ≠ 24 y es correcto**
— una empresa que reservó en los dos cuenta en los dos.

#### La raíz del gremio y su marca (27 ago 2026)

- **La raíz de un subdominio sirve el formulario corto de ese gremio.** Antes
  daba 404. Es un **rewrite y nunca un redirect**: la barra tiene que seguir
  diciendo `adecopria.reservasae.com/`, y un redirect además delataría la ruta
  interna. Va en `frontend/src/middleware.ts`.
- **El rewrite va ANTES del corte del túnel, y DESPUÉS de comprobar `esTunel`.**
  Antes del corte porque el middleware sale por ahí en cuanto el host no es de
  túnel, y entonces no se ejecutaría jamás en producción. Después de `esTunel`
  porque un host `.trycloudflare.com` tiene tres etiquetas y la suya no está en
  `RESERVADOS`: al revés, un túnel de pruebas se reescribiría y **se saltaría la
  puerta que cierra el panel**, que es justo para lo que existe ese archivo.
- **`etiquetaDelHost` está duplicada en el frontend** (`lib/gremio-del-host.ts`)
  porque el middleware corre en el runtime edge y no puede consultar la base. Es
  la misma duplicación consciente que ya hay entre `rutas-reservadas.ts` y
  `lib/marca.ts`, y por el mismo motivo. **La que manda es la del servidor.**
- **`GET /marca` varía por Host.** Con eso el login y el panel entero salen con
  el logo y los colores del gremio **sin tocar una línea del frontend**:
  `ProveedorMarca` ya lo pedía y el panel se pinta entero con tokens. Efecto
  secundario a recordar: ese endpoint deja de ser cacheable a ciegas, así que
  cualquier caché que se ponga delante tiene que variar por Host.
- **`GET /marca/gremio/:slug` lleva el slug en la RUTA a propósito.** La caché
  de Next se indexa por URL: con un `/marca` a secas y el host en una cabecera,
  los dos gremios compartirían entrada 30 s y uno vería los colores del otro sin
  que nada fallara. Comprobado poniendo BRITCHAM en verde: los dos HTML
  divergieron y no se contaminaron.
- **`Convenio.formularioMarcaId`, y tiene que ser explícito.** La apariencia
  solo existe a nivel de formulario, así que hacía falta decir cuál da la marca.
  Se dedujo por convención —el formulario cuyo slug coincide con el del
  convenio— y esa regla **falla en silencio** el día que alguien renombre uno o
  cree el segundo: ADECOPRIA ya tiene dos publicados. La migración escribe la
  convención una vez y después nadie depende de ella. La siembra la pone en una
  base nueva y **no pisa** lo que un admin haya elegido.
- **La marca del gremio incluye el formulario en BORRADOR.** En producción nacen
  así, y con la regla normal el subdominio saldría con los colores generales,
  con 200 y sin error visible — indistinguible de «no pasa nada» y caro de ver.
  Publicar al público y elegir la paleta del panel son dos decisiones distintas.
- **El precio: la aplicación entera deja de prerenderizarse.** `EstilosGremio`
  lee `headers()` y eso vuelve dinámicas las 37 rutas. Se asume a cambio de que
  no haya destello. Está aislado en su propio archivo justo para poder moverlo a
  `[convenio]/layout.tsx` y al del panel si algún día pesa.
- **Nada de esto se ve en local**: `etiquetaDelHost` exige tres etiquetas y
  `localhost:3000` da null siempre. El día a día seguirá viendo la marca
  general, así que una regresión aquí puede pasar semanas sin que nadie la note.
  Se comprueba con `curl -H 'Host: adecopria.reservasae.com'`.

> ### ⚠️ Los dos subdominios apuntan HOY a PRUEBAS (27 ago 2026)
>
> `adecopria.reservasae.com` y `britcham-adee.reservasae.com` **sirven la pila de
> pruebas con datos inventados**, no producción. Su ingress está en
> `docker/cloudflared/prueba.yml` y su DNS apunta al túnel `convoca-prueba`
> (`f6bd991c-…`), no a `convoca`.
>
> **Por qué:** es la única forma de verlos en un navegador. El comodín de
> Cloudflare cubre **un solo nivel**, así que `adecopria.prueba.reservasae.com`
> da error de TLS, y pagar el certificado avanzado por esto no tiene sentido.
> Nadie conoce estas direcciones todavía y la franja lo grita en cada pantalla.
>
> **Al estrenar de verdad hay que devolverlas**, y son tres pasos:
>
> 1. Quitar los dos `hostname` de `docker/cloudflared/prueba.yml`.
> 2. `cloudflared tunnel route dns --overwrite-dns 467fde36-227b-481b-8870-ba8763f939fe adecopria.reservasae.com`
>    (y lo mismo con `britcham-adee.reservasae.com`).
> 3. Reiniciar el túnel de pruebas para que suelte el ingress viejo.
>
> En el panel de Cloudflare las dos rutas siguen listadas bajo el túnel
> `convoca`; están **inertes**, porque el DNS es lo que decide. Conviene no
> borrarlas: son lo que hay que reactivar al estrenar.
>
> **Y no se puede probar el subdominio en local:** `etiquetaDelHost` exige tres
> etiquetas y `localhost:3000` da null. Para verlo en el navegador de un
> portátil hace falta una entrada en `hosts`, que sí funciona porque la regla
> mira la primera etiqueta y nada más:
>
> ```
> 127.0.0.1 adecopria.local.test
> 127.0.0.1 britcham-adee.local.test
> ```

#### Lo que encontró la revisión adversarial (27 ago 2026)

Cinco lentes sobre el cambio, con dos escépticos por hallazgo. De 41 candidatos
sobrevivieron 14, y de esos **cinco eran reales**. Lo que enseñó:

- **`X-Forwarded-Host` la pone quien quiera, y nginx no la limpiaba.** El
  middleware leía `x-forwarded-host ?? host`, así que mandándola con un dominio
  normal **el corte del túnel se saltaba y el panel salía por el túnel** —
  reproducido en vivo. Y en producción permitía reescribir a un gremio mientras
  la paleta salía del otro. Ahora `esTunel` mira **las dos** cabeceras y basta
  con que una lo parezca (no se puede esquivar añadiendo, solo quitando), el
  gremio sale de **`host` a secas** —la misma fuente que lee el backend— y nginx
  pone `X-Forwarded-Host $host` en los dos ficheros.
- **El Host no tiene por qué ser un dominio.** `//malo.reservasae.com` daba la
  etiqueta `//malo`, y metida en un `new URL()` saca la petición del origen. Se
  valida dentro de `etiquetaDelHost`, no en el sitio que la llama, para que
  cubra a todos.
- **El guard comprobaba `convenios` y no `alcance`.** Quien lleva el área en un
  gremio y no en el otro entraba por el subdominio equivocado **con ámbito
  vacío**: no se filtraba nada, pero se llevaba pantallas en blanco en vez de un
  no. Ahora falla con el gremio dicho en el mensaje.
- **El índice de la migración no estaba en el schema**, así que la siguiente
  migración lo habría borrado sin que nadie lo notara.
- **La lección que más se repite**: dos fuentes para la misma decisión acaban
  discrepando. El frontend elegía el gremio por una cabecera y el backend por
  otra, y el resultado era el formulario de un gremio bajo la marca del otro —
  exactamente lo que este cambio existe para evitar.

### Los cinco bloques de arreglos del recorrido (27 ago 2026)

El recorrido de pruebas del flujo entero encontró una lista, y se
cerró por bloques. Lo que queda escrito de cada uno:

**La preinscripción pública valida en el SERVIDOR.** La
autorización de datos solo se comprobaba en el navegador: el DTO
la declara opcional y la constancia se dejaba dentro de un `if`,
así que un POST directo metía cédula, nombre, celular y correo
sin la constancia que hay que poder demostrar, y mandando
`aceptaPolitica: false` entraba igual. Se comprueba con `!== true`
y **antes de crear a la persona** — rechazar después dejaría los
datos dentro de todos modos.

Los ids del SEP se comprobaban con `if (departamento && municipio)`,
o sea solo si llegaban los dos: partiendo la petición en dos,
`municipioCuadra` no se llamaba nunca. `motivoDeIdInvalido` de
`crm/catalogos-sep.ts` es ahora la única regla y recibe **lo ya
guardado**, para juzgar el departamento que valdrá al terminar y
no el que llegó. Estaba solo en el panel, así que la ruta del
asesor rechazaba un género inventado y **la del ciudadano lo
aceptaba**: la pública era la más permisiva de las dos.

**`escalera.ts`: la escalera de etapas es una escalera.**
`cambiarEtapa` es un solo PATCH y el asesor elige la etapa de
llegada, así que sin reglas de transición la de salida no contaba
para nada — y las dos compuertas estaban colgadas de una PALABRA
en vez de del hecho.

- `INTERESADO → EN_FORMACION` se saltaba la compuerta de
  matrícula entera —datos, autorización, oferta, contacto y
  cupo— porque miraba `etapa === 'INSCRITO'`. La compuerta es de
  **entrar al aula**, no de una etiqueta, y solo se pide a quien
  viene de fuera: a quien vuelve, volver a exigirle cupo le
  cerraría el regreso a un grupo lleno.
- **El primer arreglo trajo su propio defecto, y se vio en
  vivo.** Aquella versión eximía de la compuerta a quien volvía
  al aula, y eso dejó `INSCRITO` **más débil que antes**:
  revocando la autorización y pasando de `RETIRADO` a `INSCRITO`
  se volvía a matricular a quien había pedido que no se usaran
  sus datos. Ahora son **dos** comprobaciones y no una: el
  **cupo** solo se pide a quien viene de fuera —se consume una
  vez, y volver a exigirlo cerraría el regreso a un grupo
  lleno—, y los **datos y la autorización** se piden siempre,
  porque la autorización se puede revocar y «ya la pasó una vez»
  no dice nada sobre hoy. Separarlas es lo que hace correctas
  las dos; juntas había que elegir entre bloquear regresos
  legítimos y dejar entrar a quien revocó.
- `RETIRADO → CERTIFICADO` certificaba a quien se había ido. Con
  avance cargado el 80 % se cumple y la fila entra al reporte.
  Ahora hay que pasar primero por «En formación», y ese paso
  queda en el historial: **es la diferencia entre no poder y
  tener que decirlo.** `INSCRITO` sí puede cerrar, porque hay
  grupos sin fechas y nadie pasa solo a `EN_FORMACION`.
- `fechaMatricula` iba colgada de `INSCRITO`, así que quien
  entraba directo a `EN_FORMACION` se quedaba sin ella — y el
  cargue congela el rango de edad contra esa fecha: sin ella lo
  calcula al exportar y la misma persona cambia de rango entre
  dos cargues por haber cumplido años.

**El F7 escribía objetos en las celdas.** «TAMAÑO DE LA EMPRESA»
llevaba el objeto entero del catálogo en vez de su etiqueta, así
que las 18 filas salían con `[object Object]`. Era el único de
los tres formatos sin `?.etiqueta`, y **compilaba porque el
retorno de `fila()` era inferido**: ahora está tipado, que es lo
que impide que vuelva.

Y **se bajaba con cero organizaciones**: un .xlsx con la
cabecera, ninguna fila y la hoja de incompletas al lado. Eso es
un archivo que *parece* el reporte, y el cliente arma sus INSERT
concatenando celdas. El candado estaba en la pantalla para los
dos reportes de personas y no en este; ahora lo tiene el
servidor, que es quien manda porque **la descarga va por
navegación** y basta pegar la URL. De paso `alistamientoF7`
existía sin ruta, así que la pantalla pintaba la cifra de
personas al lado del botón del F7, que va por organización.

**Un spread pisaba la cerradura.** En `porUbicacion` el `where`
tenía dos spreads y los dos traen la clave `accionFormacion`, así
que `?convenio=britcham-adee` desde una cuenta que solo tiene
ADECOPRIA **borraba el ámbito** y devolvía las ofertas de
BRITCHAM. Va en `AND`: el filtro pedido se **interseca**, nunca
sustituye. Su spec mira el `where` que sale y no el resultado —
es lo único que distingue «interseca» de «sustituye».

**Lo que viene en el CUERPO también se comprueba.** Los cinco
guardias de formularios cubren el id de la RUTA; `seccionId` y
`dependeDePreguntaId` vienen en el cuerpo y no los miraba nadie.
Lo segundo es lo peor: la condicional se evalúa contra la
respuesta de su madre, y una madre de otro formulario nunca la
tiene aquí — la pregunta queda oculta para siempre y su respuesta
se descarta en el servidor, que es lo correcto para una pregunta
oculta. **Un formulario publicado pierde un campo sin que nada
falle**, y con el del NIT oculto no se puede reservar.

Y por la puerta **pública**: `prepararRespuestas` solo
comprobaba que el formulario estuviera publicado, no que fuera
del convenio de la oferta. Un POST con la oferta de un gremio y
el `formularioSlug` del otro dejaba una reserva cuyos cupos
salían de uno y cuyo `formularioId` apuntaba al otro: las
respuestas validadas contra preguntas que la persona nunca vio,
la reserva invisible para los dos gremios y la tasa de respuesta
de ambos falseada. El mensaje es el mismo que «no está
publicado», a propósito.

**Los días son los de Bogotá.** `date_trunc('day', x)` a secas
parte los días a las 19:00, así que las cinco horas de
tarde-noche —cuando la gente diligencia— se cargaban al día
siguiente. **El arreglo ya existía en `crm/control.ts`** y los
cuatro `date_trunc` de los tableros se quedaron fuera. Ahora está
una sola vez en `comun/dia-bogota.ts`, y `ventana.ts` importa de
ahí el desplazamiento en vez de declararlo otra vez. El fragmento
devuelve **texto** y no un timestamp: un `date_trunc` en hora de
Bogotá vuelve a Node como Date y ahí se lee otra vez en UTC — el
mismo error dos veces, y la segunda invisible.

- `ritmo14` sobre una ventana de 7 sumaba siete días y dividía
  entre catorce: **la mitad del ritmo real**. Ahora devuelve
  `null`, y la tarjeta dice que hacen falta dos semanas en vez de
  inventarse un «Estable».
- «Hoy» se etiquetaba «27 ago → 26 ago». El último día dentro se
  calculaba restando un día entero a `hasta`, y eso solo vale
  cuando `hasta` es la medianoche siguiente: el periodo en curso
  se recorta en «ahora», que ya está dentro del último día. Un
  milisegundo sale bien en los dos casos.
- **El propio spec de la proyección tenía el defecto dentro**:
  construía sus días con `toISOString()` y su HOY era medianoche
  UTC, o sea las 19:00 del día anterior en Bogotá.

**Ya se puede revocar la autorización de datos.** `revocadaEn` se
leía en siete consultas y no se escribía en ninguna: la columna,
el índice y todo lo de abajo la honraban, y no había puerta. El
sistema decía poder demostrar la autorización y era incapaz de
honrar su revocación, que es el otro lado del artículo 8 de la
Ley 1581.

`POST /admin/participantes/:id/revocar-autorizacion`, con motivo
y canal obligatorios — lo que hay que poder demostrar no es que
se revocó, es **cuándo y por dónde lo pidió la persona**. Marca
todas las vivas de ese convenio, porque dejar una viva la deja
dentro del reporte. **No borra la fila**: hay que poder decir que
hubo autorización desde tal día hasta tal otro, y borrarla borra
la mitad de la frase. **La etapa no cambia** — revocar no es
retirarse, y decidirlo por la persona sería poner en su boca algo
que no dijo; lo que pasa solo es que deja de poder matricularse y
sale del reporte, porque eso ya lo hacían las consultas. Va con
`inscripciones · ESCRIBIR` y no con superadmin: lo pide la
persona por teléfono y el derecho no espera. En la auditoría va
el canal y cuántas, **no el motivo**: es texto libre y puede
traer datos de la persona.

**Un «no tiene» no es un celular.** No se validaba en ningún
sitio, y va al reporte del SEP como número de contacto y a la
compuerta de matrícula como «alguna forma de contactarla»: con
`celular: "no tiene"` alguien quedaba matriculado y nadie podía
llamarlo. `comun/celular.ts` distingue `celularValido` (vacío
vale: es opcional) de `celularUtil` (vacío no sirve para
contactar). En la carga masiva es un **aviso y no un rechazo**,
igual que el correo.

Y `mensajeEncabezado` se enviaba en el submit de `/admin/marca`
sin tener campo en pantalla, así que no había forma de ponerlo ni
de quitarlo y cada Guardar lo dejaba vacío.

> **Todos los specs nuevos se probaron por mutación**: se le quita
> el candado al código, se comprueba que el test falla, y se
> devuelve. Un test que no puede fallar es peor que ninguno,
> porque da confianza sin darla.

### Políticas y formularios sí llevan ámbito (27 ago 2026)

**Y hasta hoy no lo llevaban.** Lo encontró la misma revisión: desde el
subdominio de un gremio se podía **publicar la política de tratamiento de datos
del otro** —el texto legal que su gente acepta— y listar sus formularios.
Ninguno de los dos controladores leía el ámbito, mientras este archivo afirmaba
que «un asesor de ADECOPRIA no entra a BRITCHAM ni llamando a la API».

- **Fuera del ámbito la fila NO EXISTE**: se devuelve 404 y no 403. Un 403
  confirma que la política del otro convenio existe, y eso es un oráculo.
- **Una lista se ACOTA, no se prohíbe.** `GET /admin/politicas?convenioId=` con
  uno de fuera devuelve 200 y vacío: el filtro pedido se **interseca** con el
  ámbito, nunca lo sustituye. Pedir uno de fuera no puede devolverlo todo.
- **`ambito-de-politicas-y-formularios.spec.ts` lo fija**, con el mismo criterio
  que las cabeceras del SEP: si alguien quita el ámbito de ahí, falla el build.
- **`obtener` se partió en dos**: la pública comprueba el ámbito y `vista()` es
  la interna, sin comprobar, que usan los métodos que ya comprobaron.

#### Las 21 rutas, y por qué se cerraron todas de golpe (27 ago 2026)

**El primer intento cerró tres y documentó el resto como deuda. Fue un error, y
una segunda revisión lo demostró en veinte minutos:** `GET /admin/formularios/:id`
devolvía 404 con un id ajeno mientras **`PATCH` del mismo id respondía 200 y
escribía**. La lectura cerrada y la escritura abierta es la peor combinación
posible, y encima aquel párrafo enumeraba mal la deuda — `actualizar`,
`eliminar`, `duplicar` y `apariencia` no estaban en la lista y también estaban
abiertas.

Es exactamente el patrón que este archivo ya advertía: **el control en pie y
vacío de efecto.** El helper `vista()`, creado para que los métodos internos no
repitieran la comprobación, se volvió la puerta de servicio por la que entraban
las rutas que nunca comprobaron.

- **Cinco comprobaciones, no una.** `exigirFormulario`, `exigirSeccion`,
  `exigirPregunta`, `exigirOpcion` y `exigirAccion`: cada tabla llega al
  convenio por un camino distinto, igual que en `tableros/ambito.ts`. Van al
  principio del método, antes de tocar nada.
- **`fuera-del-ambito.spec.ts` recorre las 21 rutas** con ids del otro convenio
  y exige dos cosas: que no responda 200 y, sobre todo, **que no se haya
  escrito nada**. Lo segundo es lo que importa — es la aserción que no depende
  de qué código devuelva cada ruta.
- **Se comprobó que la prueba puede fallar.** Quitándole el candado a
  `actualizar`, falla 1 de 22; devolviéndolo, pasan las 22. Un test que no puede
  fallar es peor que ninguno, porque da confianza sin darla.
- **La lección para la próxima:** un arreglo ruta por ruta se olvida de alguna.
  Lo que no se olvida es una prueba que recorra la superficie entera.

> **`instituciones` no lleva ámbito, y es correcto.** Es el directorio maestro
> de NIT, compartido: la tabla no tiene `convenioId`, así que no hay nada que
> filtrar. Una revisión lo reportó como fuga y no lo es.
>
> **`empresas` se comparte por decisión del cliente**, pero la descarga de
> plantillas las volcaba **todas**, mientras el panel solo lista las que tienen
> alguna reserva dentro del ámbito. Ahora la descarga usa el mismo filtro que la
> pantalla desde la que se descarga.

### Los logos y la apariencia también llevan ámbito (27 ago 2026)

**Lo encontró el cliente antes que nosotros**: subió un logo entrando por
`adecopria.reservasae.com` y le salió también en BRITCHAM. La causa no era un
fallo suelto — era que **`/admin/marca` edita la marca GLOBAL desde cualquier
dirección**: los logos con `formularioId = null`, la única fila de `marca` y la
única de `temas`.

Y detrás había cuatro fugas de escritura que nadie había visto:

- **Las cuatro rutas de `/admin/logos` no miraban el ámbito.** El único candado
  contaba si el formulario **existe**, no de quién es.
- **El `GET` no tenía ni `@Requiere` ni `@Roles`**: lo veía cualquier sesión de
  admin, incluida la de solo consulta — y es la que entrega los ids que
  necesitan el `PATCH` y el `DELETE`.
- **El `DELETE` era el peor**: borra un logo del banner **público** del otro
  gremio, y su URL `/marca/logos/:id` deja de existir.
- **`PATCH` y `DELETE` solo reciben el id del logo**, así que validar el
  `formularioId` de entrada los dejaba abiertos: hay que resolver
  logo → formulario → convenio dentro del servicio.

Cómo quedó:

- **Los logos GENERALES se editan por la puerta general y por ninguna otra.**
  No pertenecen a ningún convenio, así que `{ in: ambito }` **no los cubre**: el
  candado mira `gremioFijo`. Sin eso se salta pasando el campo vacío, que es
  justo lo que hacía la pantalla.
- **`listarLogos` pasó a PRIVADA** y se añadió `listarLogosDelPanel`, que
  comprueba. Es la lección de `vista()` en formularios: un helper sin candado al
  que llega un controlador es la puerta de servicio por la que entra todo lo que
  nunca comprobó.
- **`logos-fuera-del-ambito.spec.ts`** recorre las cuatro rutas más
  `marca/formulario/:slug` y exige que no escriban nada. Comprobado que puede
  fallar: quitando el candado del borrado, falla 1 de 7.
- **La pantalla dice la verdad según la puerta.** En la dirección de un gremio
  los bloques globales dejan de ser editables y mandan al formulario que le da
  la cara, que es donde la apariencia por gremio ya funciona bien. Un campo
  editable que escribe en los dos gremios, dentro de una pantalla que dice ser
  de un gremio, es el mismo fallo con otra cara.

Y cuatro más del mismo patrón, fuera de la apariencia:

| | |
|---|---|
| `PATCH /admin/acciones/:id` | **publicaba u ocultaba del sitio público la acción del otro gremio.** `listarAcciones`, dos líneas arriba, sí acotaba |
| la carga masiva de empresas | `aplicarEmpresas` **ni declaraba** el ámbito en su firma |
| `/admin/empresas` | acotaba la empresa pero no el `include` de sus reservas, así que las columnas sumaban las del otro gremio |
| `rui/discrepancias` | devolvía documento y nombres de los últimos 50 sin acotar |

> **La lección, ya por cuarta vez:** el subdominio no creó ninguna de estas
> fugas, solo las hizo visibles. Antes todos entraban por la misma puerta y
> nadie notaba que el ámbito faltaba. **Lo que las encuentra no es leer ruta por
> ruta, es una prueba que recorra la superficie entera** — y las tres que
> existen (`fuera-del-ambito`, `logos-fuera-del-ambito`,
> `ambito-de-politicas-y-formularios`) están escritas así a propósito.

### Lo que falta

Tareas con fecha · adaptador del LMS (Moodle, solo lectura; hace falta la URL
y un token). El correo ya sale: ver «El correo».

> **Solo lectura del LMS**, decidido: alguien matricula allá y aquí se lee el
> avance. Y «al instante» se resuelve guardando una foto con su fecha y
> enseñando «actualizado hace N minutos»; consultar el LMS en cada carga de
> pantalla haría que un LMS lento sea una pantalla lenta.

---

## El correo (26 ago 2026)

Sale por **SMTP de Google Workspace** con el buzón
`proyectosena@grupo-ae.com.co`. `backend/src/correo/`.

- **La clave NO es la de la cuenta.** Google dejó de aceptarla para SMTP: lo
  que va en `SMTP_CLAVE` es una **contraseña de aplicación** de 16 letras
  (myaccount.google.com → Seguridad → Contraseñas de aplicaciones). Con la
  normal el servidor contesta «Username and Password not accepted», que no
  suena a lo que es. `explicar()` traduce ese 535 a la instrucción concreta.
- **Sin las tres variables no se manda nada y se dice al arrancar**, en el log
  y en `/admin/correo`. Fingir que salió es lo único que no puede hacer.

### El desvío, y por qué existe

`CORREO_REDIRIGIR_A` se queda con **todo** el correo. Es lo que permite tener
las credenciales de verdad en un entorno que no lo es.

- **Un entorno de pruebas con SMTP real y sin desvío le escribe a gente de
  verdad**, y eso no se puede deshacer. Por eso `ENTORNO=prueba` **sin
  `CORREO_REDIRIGIR_A` se niega a mandar**: falla cerrado. Olvidar la variable
  deja el correo mudo, que es el fallo barato; el caro es el otro.
- **El correo desviado dice a quién iba**, en el asunto y en una franja arriba.
  Sin eso, un aviso de pruebas en la bandeja es indistinguible de uno real.
- **En producción va vacía**, y el arranque avisa a gritos si no lo está: una
  variable copiada por descuido dejaría a todos los inscritos sin sus correos
  sin que nadie se entere.
- La decisión vive en `desvio.ts` como función pura y `desvio.spec.ts` la fija.
  Es la barrera entera, así que se prueba sin levantar nada.

### Que no caiga en spam

**El dominio que firma es `grupo-ae.com.co`, no `reservasae.com`**, y ese **no
está en Cloudflare**: sus NS son `dns17/dns18.servidoresdns.net`. Los registros
hay que ponerlos allí. Cloudflare no pinta nada en esto.

A 26 ago 2026 ese dominio **no tiene SPF, ni DKIM, ni DMARC** — comprobado
contra 8.8.8.8. Sus MX apuntan a `smtp.google.com`, así que:

| Registro | Nombre | Valor |
|---|---|---|
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` |
| TXT | `google._domainkey` | el que genere la consola de Workspace |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:proyectosena@grupo-ae.com.co` |

- **DKIM no se inventa**: se genera en admin.google.com → Aplicaciones →
  Google Workspace → Gmail → Autenticar correo electrónico, y hay que darle a
  «Iniciar autenticación» **después** de publicar el TXT.
- **DMARC arranca en `p=none`**, que solo observa. Poner `p=reject` de entrada,
  con SPF o DKIM mal puestos, tira el correo bueno al vacío en silencio.
- **Un solo TXT de SPF.** Dos registros SPF en el mismo nombre invalidan los
  dos; si algún día se manda desde otro sitio, se añade otro `include:` al que
  ya hay.

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
  | `diego.salas` | Líder de sistemas, **sin** ser superadmin | los dos |

  **Diego es quien prueba la otra mitad**: construye formularios pero no puede
  publicarlos, duplicarlos, borrarlos ni tocar la paleta. Sin una cuenta así,
  esa distinción no se podía comprobar, porque el único líder de sistemas era
  Ana y además es superadmin.

  **Carlos es el que de verdad prueba el ámbito**: lleva áreas distintas en
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
- ✅ **La casilla de tratamiento de datos ya enseña el texto** (27 ago 2026).
  Decía «autorizo el tratamiento de mis datos» sin forma de leer qué se
  autorizaba, aunque la política existía y `GET /api/politicas/:slug/RESERVA`
  la servía. Va el texto y **no un enlace**: la preinscripción hizo ese mismo
  camino y su comentario sigue valiendo, «casi nadie abría el enlace, y eso no
  alcanza para sostener que la persona leyó lo que autorizó».
  `components/caja-de-politica.tsx` es una sola implementación para los dos
  formularios, y el texto de respaldo vive ahí una vez: estaba dentro de
  `preinscripcion.tsx`, y dos versiones de lo que la persona autoriza es
  exactamente lo que no puede pasar. Se pide **aparte** de la carga del
  formulario, para que un convenio sin política publicada no deje el formulario
  entero sin dibujarse.

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
- **Docker publica el puerto de la base en la IP de Tailscale, que al arrancar
  la máquina todavía no existe.** El contenedor muere con `cannot assign
  requested address` y la sede se queda **sin base**, con el backend en ciclo de
  reinicios. Pasó en Bogotá el 18 ago 2026, al volver de la caída. Por eso
  `asegurar-base.sh` la levanta en cuanto la dirección aparece: es un fallo de
  carrera entre dos servicios del sistema, no algo que se pueda arreglar dentro
  de `docker-compose.yml`.
- **El `hostname` de Bogotá es `sep-dev`, no `server-bogota`.** `rendirse.sh`
  nombra la ranura con `hostname`, así que la de Bogotá se llama `sep_dev`.
  Funciona y es consistente consigo misma, pero no busques `bogota` en
  `pg_replication_slots` porque no está.
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

### Los nueve guiones

Todos en `scripts/`, todos idempotentes, todos con el mismo criterio: **antes de
destruir algo, comprobar que hay a dónde ir**.

| Guión | Dónde | Qué hace |
|---|---|---|
| `asegurar-base.sh` | todas | temporizador cada 1 min: levanta la base si el arranque la dejó caída |
| `desplegar.sh` | principal | construye, comprueba y **solo entonces** marca el commit |
| `seguir-al-principal.sh` | réplicas | temporizador cada 2 min: se pone en el commit marcado y construye |
| `arrancar-tunel.sh` | todas | temporizador cada 1 min: levanta el túnel **solo si le toca** |
| `asegurar-base.sh` | todas | temporizador: levanta la base, y **la recrea si corre sin replicar** |
| `autopromover.sh` | Bogotá y Socorro | temporizador cada 1 min: promueve sola si el principal murió |
| `autorendirse.sh` | todas | temporizador cada 2 min: se rinde sola ante una línea temporal mayor |
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

> **Reiniciar una réplica la deja sin replicar, y reiniciar el contenedor no lo
> arregla.** Al arrancar la máquina, Docker levanta la base antes de que
> Tailscale termine de establecer el relevo, así que el contenedor nace sin ruta
> hacia la red privada y Postgres repite «could not connect to the primary
> server: Network unreachable» para siempre. **Las rutas se fijan al crear el
> contenedor**: `docker restart` conserva las viejas y solo
> `up -d --force-recreate db` las renueva. Pasó el 19 ago 2026 al actualizar el
> núcleo de Bogotá; `asegurar-base.sh` ya lo detecta y lo recrea solo, pero
> únicamente si el principal responde —si está caído, recrear no arregla nada y
> solo haría ruido cada minuto.

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

> **Probado de verdad el 18 ago 2026, y funcionó entero sin tocar nada.** Se
> paró la app de El Socorro a las 15:30:04. Bogotá lo vio `CAIDA` a los 3 s,
> contó 70 → 136 → 221 s y se promovió a las **15:36:31** (6 min 27 s: los 300 s
> más el ciclo del temporizador), levantando el túnel ella sola. El dominio
> volvió sin intervención. Después El Socorro y el PC Dell detectaron la línea 3
> y **se rindieron solos**, cada uno con su `pg_dump` previo. Los hashes de
> `reservas`, `empresas` y `ofertas` quedaron idénticos: no se perdió un byte.
>
> **Con dos sedes vivas el failover no puede actuar**, y conviene recordarlo: sin
> tercera opinión, ante un `INALCANZABLE` ninguna promueve. No es un defecto — es
> la regla que impide que una sede aislada se crea la última superviviente. Con
> dos nodos el quórum no existe, y la salida es `promover.sh` a mano.
>
> **Lo que encontró la prueba**: `promover.sh` no escribía `.desplegado`, que es
> justo lo que `rendirse.sh` borra al degradar una sede. La nueva principal se
> quedaba sin marca y las réplicas respondían «sin respuesta del principal, no
> cambio nada»: el despliegue quedaba detenido hasta que alguien lo corriera a
> mano. Falla seguro —nadie retrocede— pero es exactamente la clase de defecto
> que solo aparece cortando de verdad. Ahora `promover.sh` marca el commit, que
> ya venía de verificar con `esperar_local` igual que `desplegar.sh`.

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

- **Los comentarios del código son cortos**: una línea y **nunca más de 35
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
