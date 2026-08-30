# Handoff: Rediseño del CRM Convoca

## Resumen

> **Lea antes `DECISIONES.md`.** Recoge las decisiones tomadas después de escribir este
> documento y manda sobre él en los puntos donde se contradigan (llave de `localStorage`,
> unidades en rem, sombras en elementos flotantes, paleta guardada por gremio).

Rediseño visual completo del CRM Convoca (gestión de gremios, acciones de formación,
leads, inscritos y reservas para reportes al SENA). El objetivo del rediseño fue eliminar
el lenguaje de "tarjetas cuadradas apiladas" del sistema actual y sustituirlo por un
lenguaje de **líneas y bordes sutiles**, con jerarquía tipográfica en lugar de cajas de
color, densidad de datos alta y un entorno visual propio de un CRM profesional.

Cubre **38 pantallas navegables**, tema claro y oscuro, panel lateral plegable y ficha
de detalle por cada acción de formación (AF1–AF7 de ADECOPRIA con datos reales).

---

## Sobre los archivos de diseño

Los archivos de `diseño/` son **referencias de diseño hechas en HTML** — un prototipo que
muestra el aspecto y el comportamiento previstos. **No son código de producción para copiar
tal cual.**

La tarea es **recrear estos diseños dentro del entorno del código real** (React, Vue,
Laravel Blade, lo que use el CRM actual), con sus patrones, su router y sus librerías
establecidas. Si todavía no existe un entorno, elija el marco de trabajo más adecuado al
proyecto e impleméntelos allí.

El prototipo usa un runtime propio (`support.js`) que **no debe portarse**. Lo que sí debe
portarse es: los tokens de color, la tipografía, las medidas, la estructura de cada
pantalla, los estados y el contenido literal.

### Cómo abrir el prototipo

`diseño/Convoca Rediseño.dc.html` se abre directamente en un navegador. Los tres archivos
de la carpeta deben estar juntos.

---

## Fidelidad

**Alta fidelidad (hifi).** Colores, tipografía, espaciados, estados e interacciones son
definitivos. Recréelos con precisión. Cuando el codebase ya tenga un componente equivalente
(tabla, botón, campo), úselo y ajústelo a estos tokens en lugar de crear uno nuevo.

---

## Tokens de diseño

Están declarados como variables CSS en `:root` y `[data-tema="oscuro"]`. El cambio de tema
se hace poniendo `data-tema="oscuro"` en el elemento raíz.

### Color — tema claro

| Token | Valor | Uso |
|---|---|---|
| `--marca` | `#1d4ed8` | Acción principal, enlaces, elemento activo |
| `--marca-fuerte` | `color-mix(in oklab, var(--marca) 76%, #000)` | Hover de enlace |
| `--marca-suave` | `color-mix(in oklab, var(--marca) 8%, #fff)` | Fondo de fila activa |
| `--marca-texto` | `#ffffff` | Texto sobre botón primario |
| `--fondo` | `#f6f7f9` | Fondo de la aplicación |
| `--superficie` | `#ffffff` | Panel lateral, cabeceras, paneles |
| `--superficie-alterna` | `#f4f6f9` | Hover de menú, franjas |
| `--borde` | `#e2e8f0` | Borde estructural (1px) |
| `--hairline` | `color-mix(in oklab, var(--borde) 62%, #fff)` | Separador interno, más tenue |
| `--titulo` | `#0f172a` | Títulos y cifras |
| `--texto` | `#1e293b` | Texto de cuerpo |
| `--texto-suave` | `#64748b` | Rótulos, notas, texto secundario |
| `--tabla-cabecera-texto` | `#475569` | Cabecera de tabla |
| `--tabla-fila-resaltada` | `color-mix(in oklab, var(--marca) 4%, #fff)` | Hover de fila |
| `--campo-fondo` | `#ffffff` | Fondo de input/select |
| `--campo-borde` | `#cbd5e1` | Borde de input/select |
| `--exito` | `#047857` | Confirmada, disponible, correcto |
| `--aviso` | `#a16207` | En espera, pendiente, atención |
| `--error` | `#be123c` | Cancelada, error |
| `--acento` | `#16a06a` | Acento secundario |
| `--acento-texto` | `#0f7a52` | Rótulo sobre acento |
| `--acento-suave` | `#eef7f2` | Fondo de acento |
| `--pad-fila` | `9px` | Relleno vertical de fila de tabla |

### Color — etapas del embudo (mismas en ambos temas, con variante oscura)

| Etapa | Claro | Oscuro |
|---|---|---|
| Interesado | `#5b6472` | `#a3aec0` |
| Contactado | `#1f4e85` | `#7cb2f0` |
| Datos completos | `#4c3a8c` | `#b3a4f0` |
| Inscrito | `#1a6e58` | `#5ec6a8` |
| En formación | `#8a5a12` | `#e0b155` |

### Color — tema oscuro

| Token | Valor |
|---|---|
| `--marca` | `#60a5fa` |
| `--marca-suave` | `color-mix(in oklab, var(--marca) 14%, #0b1220)` |
| `--marca-texto` | `#0b1220` |
| `--fondo` | `#0b1220` |
| `--superficie` | `#131c2e` |
| `--superficie-alterna` | `#1a2439` |
| `--borde` | `#26324a` |
| `--hairline` | `color-mix(in oklab, var(--borde) 74%, #0b1220)` |
| `--titulo` | `#f2f6ff` |
| `--texto` | `#e8edf7` |
| `--texto-suave` | `#9aa8c0` |
| `--tabla-cabecera-texto` | `#c3cee0` |
| `--tabla-fila-resaltada` | `color-mix(in oklab, var(--marca) 9%, #131c2e)` |
| `--campo-fondo` | `#0f1829` |
| `--campo-borde` | `#33405c` |
| `--exito` | `#34d399` |
| `--aviso` | `#fbbf24` |
| `--error` | `#fb7185` |
| `--acento` | `#34d399` |
| `--acento-texto` | `#5ee0ad` |
| `--acento-suave` | `#0d2b21` |

### Tipografía

**Raleway** (Google Fonts), pesos 400 / 500 / 600 / 700.
`font-family: Raleway, system-ui, sans-serif`. `-webkit-font-smoothing: antialiased`.

| Rol | Tamaño | Peso | Otros |
|---|---|---|---|
| Base del documento | 13,5px | 400 | `line-height: 1.45` |
| Título de pantalla | 21px | 700 | `letter-spacing: -.02em` |
| Nombre de la marca (panel) | 15,5px | 700 | `letter-spacing: -.01em` |
| Cifra de indicador (KPI) | 27px | 700 | `letter-spacing: -.03em`, `font-variant-numeric: tabular-nums` |
| Cifra central de dona | 38px | 700 | igual que KPI |
| Título de panel/sección | 14px | 700 | `letter-spacing: -.01em` |
| Módulo del menú | 13px | 600 | |
| Submenú | 12,5px | 500 (600 si activo) | |
| Fila de tabla | 12,5px | 400 (600 en la columna principal) | |
| Cabecera de tabla | 10,5px | 600 | `letter-spacing: .06em`, `text-transform: uppercase` |
| Rótulo de sección | 10px | 600 | `letter-spacing: .1em`, `text-transform: uppercase` |
| Nota / subtítulo | 12,5px | 400 | `line-height: 1.6`, color `--texto-suave` |
| Subtexto de celda | 11px | 400 | color `--texto-suave` |
| Cuerpo largo (objetivo AF) | 13px | 400 | `line-height: 1.7`, `text-wrap: pretty`, ancho completo |
| Botón | 12,5px | 600 | |
| Ruta de navegación | 12,5px | 500 (600 el último) | |

Todas las cifras en tablas y KPIs usan `font-variant-numeric: tabular-nums`.

### Radios, sombras, bordes

- Radio general de contenedor: **14px**
- Radio de botón, campo, select: **10px**
- Radio de pastilla pequeña / chip: **7–8px**
- Radio de círculo de icono: **50%**
- **Sin sombras.** La separación es siempre por borde de 1px (`--borde`) o `--hairline`.
- Todo borde es `1px solid`. No hay bordes gruesos ni acentos de 3–4px a la izquierda.

### Espaciado

- Relleno horizontal de contenido: **28px**
- Relleno de panel/tarjeta: **20px 22px**
- Relleno de fila de tabla: **var(--pad-fila) 14px** (9px vertical)
- Relleno de cabecera de pantalla: **26px 28px 22px** (16px arriba si hay enlace "Volver")
- Separación entre secciones: **20px**
- Ancho del panel lateral: **250px** abierto / **62px** plegado
- Alto de la cabecera superior: **56px**
- Alto de campo y botón: **34px**

---

## Estructura general (shell)

```
┌──────────┬────────────────────────────────────────────┐
│ aside    │ header  (56px)                             │
│ 250px /  ├────────────────────────────────────────────┤
│ 62px     │ cabecera de pantalla                       │
│          ├────────────────────────────────────────────┤
│          │ contenido (scroll vertical)                │
└──────────┴────────────────────────────────────────────┘
```

- Raíz: `display:flex; height:100vh; min-height:640px; overflow:hidden`.
- La columna derecha es `flex:1; display:flex; flex-direction:column; min-width:0`.
- Solo el bloque de contenido tiene scroll (`flex:1; min-height:0; overflow-y:auto`).

### Panel lateral (aside)

`width:250px; background:--superficie; border-right:1px solid --borde;`
`transition: width .18s ease`.

Contenido, de arriba abajo:

1. **Cabecera de marca** — logo 24×24px, "Convoca" 15,5px/700, bajada "Relaciones que
   generan resultados" 11px/`--texto-suave`, y a la derecha el botón `‹` que pliega el panel
   (24×24, radio 7px, hover con fondo `--superficie-alterna`).
2. **Selector de gremio** — rótulo "SELECCIONE GREMIO" (10px/600/uppercase/.1em) y un
   `select` de 34px con opciones: Todos los gremios · ADECOPRIA · BRITCHAM ADEE.
3. **Resumen** — fila propia con icono de mosaico. Lleva al tablero. Cuando está activa:
   fondo `--marca-suave`, texto `--marca`. Radio 10px, márgenes 12px.
4. **Rótulo "PANEL DE GESTIÓN"** y los 7 módulos plegables.
5. **Pie "AJUSTES"** — conmutador Claro / Oscuro en un grupo de dos con borde y radio 10px.

**Estado plegado (62px):** logo centrado, botón `›`, la fila de Resumen y los 7 módulos
como círculos de 34px con borde de 1px e icono de 17px, y al pie el botón de tema (luna ☾ /
sol ☀) también circular. Cada círculo lleva `title` con el nombre del módulo. Clic en un
círculo **despliega el panel y abre ese módulo**, no solo despliega.

El estado plegado/desplegado se persiste en `localStorage` bajo la clave `convoca-panel`
con los valores `"abierto"` / `"cerrado"`.

### Módulos y sus pantallas

Los iconos son SVG de trazo (`stroke-width:1.7`, `stroke-linecap:round`,
`stroke-linejoin:round`, `fill:none`, viewBox 24×24), aplicados como `mask-image` para que
tomen el color del tema. **Sin emoji** — se renderizan distinto en cada sistema operativo y
no respetan el color del tema.

| Módulo | Icono | Pantallas |
|---|---|---|
| Calendario | calendario | Ver cronograma · Formación |
| Gestión de Inscripciones | portapapeles con visto | Gestión de leads · Control de Inscritos |
| Sistemas de Información | capas | Reservas · Empresas registradas · Empresas aliadas - afiliadas · Inscritos Acción Formación · Reportes SENA |
| Gestión Académica | gráfica de líneas | Tablero académico · Avance |
| Formularios | documento con líneas | Creación Formularios · Formularios Activos · Habeas Data |
| Campaña Mailing | sobre | Campañas · Plantillas · Cuenta de correo |
| Configuración | controles deslizantes | Apariencia · Webhook de Meta · Usuarios · Mi perfil |

Rutas SVG exactas (dentro de `viewBox="0 0 24 24"`):

- **Resumen** — `<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/>`
- **Calendario** — `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>`
- **Gestión de Inscripciones** — `<path d="M15 5h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>`
- **Sistemas de Información** — `<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>`
- **Gestión Académica** — `<path d="M4 4v16h16"/><path d="M8 16l4-5 3 3 4-6"/>`
- **Formularios** — `<path d="M15 3H6v18h13V7z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h5"/>`
- **Campaña Mailing** — `<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 8.5l9 5.5 9-5.5"/>`
- **Configuración** — `<path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="17" r="2"/>`

Estado activo del icono: círculo relleno con `--titulo` e icono en `--superficie`
(invertido). Inactivo: sin relleno, borde `--borde`, icono `--texto-suave`.

Submenú abierto: el hijo activo lleva fondo `--marca-suave`, texto `--marca`, peso 600 y una
regla vertical de 2px en `--marca` a la izquierda (implementada como `box-shadow: inset 2px 0`).

### Cabecera superior (header)

56px de alto, `border-bottom:1px solid --borde`, fondo `--superficie`. Contiene:

- **Ruta de navegación** a la izquierda, construida dinámicamente: módulo / pantalla
  intermedia / pantalla actual. Cada nivel anterior es clicable (hover en `--marca`); el
  último va en 600 y `--titulo`. Separador `/` con `opacity:.45`.
  Ejemplos: `Panel / Resumen`, `Calendario / Formación / AF1`,
  `Gestión de Inscripciones / Gestión de leads / Sofía Arias Beltrán`.
- **Buscador** — campo de 34px, radio 10px, placeholder "Buscar".
- **Avatar** del usuario, circular.

---

## Vocabulario de secciones

El contenido de cada pantalla se compone con un conjunto cerrado de bloques. Impleméntelos
como componentes reutilizables.

### 1. `kpis` — franja de indicadores

Rejilla de tarjetas con borde de 1px y radio 14px. Cada una: rótulo (10px/600/uppercase),
cifra (27px/700/tabular-nums) y nota (11,5px/`--texto-suave`).

**Regla de columnas:** hasta 5 indicadores, `repeat(auto-fit, minmax(200px, 1fr))`. Con más
de 5, se parte en dos filas iguales: `repeat(ceil(n/2), minmax(0,1fr))` — así 8 indicadores
salen 4+4 y no 7+1.

### 2. `tabla`

- Cabecera: fondo `--superficie-alterna`, texto `--tabla-cabecera-texto`, 10,5px/600,
  uppercase, `letter-spacing:.06em`, `border-bottom:1px solid --borde`.
- Fila: `padding: var(--pad-fila) 14px`, separador `1px solid --hairline`.
- Hover de fila: `--tabla-fila-resaltada`.
- Celda principal en 600 y `--titulo`; subtexto opcional debajo en 11px/`--texto-suave`.
- Columnas numéricas alineadas a la derecha con `tabular-nums`.
- Estados en color de texto, **no** en pastilla de fondo: Confirmada `--exito`,
  En espera `--aviso`, Cancelada `--error`.

### 3. `lista` — filas con barra de avance

Cada fila: título, subtítulo opcional, valor a la derecha y barra de progreso de 4px de alto
con radio completo (pista `--superficie-alterna`, relleno `--marca`).

**Regla de columnas:** el número de columnas se calcula para dejar el menor número de huecos,
probando 2, 3 y 4. Con 5 elementos → 3 columnas (3+2). Con 8 → 4 columnas (4+4).
Con 7 → 4 (4+3). Contenido largo → una sola columna.

Cuando la lista está vacía debe mostrar un mensaje ("Todavía no hay ninguna reserva en esta
acción"), nunca un bloque vacío.

### 4. `dona` — anillo con leyenda

SVG de 188×188 con `viewBox="0 0 132 132"`, rotado −90°, radio 30, trazo grueso, segmentos
con `stroke-dasharray`. En el centro: total (38px/700) y unidad (12,5px/`--texto-suave`).
Leyenda a la derecha: punto de color de 8px, etiqueta y valor, 13,5px, `gap:12px`.

### 5. `aviso`

Punto de 7px del color del estado + texto de 12,5px con `line-height:1.55`, en una línea
horizontal con `gap:10px`. Sin caja, sin fondo, sin barra lateral.

### 6. `filtros`

Rejilla `repeat(auto-fit, minmax(150px, 1fr))` con `gap:8px` que ocupa el ancho completo.
Cada filtro es un `select` de 34px, radio 10px. **No** deben quedar encogidos a la izquierda.

### 7. `texto`

Título 14px/700, nota 12,5px/`--texto-suave` (máx. 760px de ancho) y cuerpo opcional a
**ancho completo**, 13px, `line-height:1.7`, color `--texto`, `text-wrap:pretty`.
El cuerpo no lleva tope de caracteres: los textos del proyecto vienen en mayúsculas y una
columna estrecha los vuelve ilegibles.

### 8. `barra` — barra de acciones

Fila con botones secundarios a la izquierda y acciones a la derecha, `border-bottom` de 1px.

### Botones

- **Primario:** fondo `--marca`, texto `--marca-texto`, radio 10px, alto 34px,
  padding `0 14px`, 12,5px/600.
- **Secundario:** fondo `--superficie`, borde `1px solid --borde`, texto `--titulo`.
- Hover: primario a `--marca-fuerte`; secundario con fondo `--superficie-alterna`.

### Enlace "Volver"

`← Volver a <pantalla>`, 12,5px/600, color `--marca`, encima del título de la pantalla, con
`padding: 14px 28px 0`. **No es un botón** — la navegación hacia atrás no es una acción de
la misma clase que "Guardar" o "Publicar", y mezclarlas en la misma barra las confunde.
Cuando hay enlace Volver, el relleno superior de la cabecera baja de 26px a 16px.

---

## Pantallas

38 pantallas navegables. Las cuatro con diseño propio son el tablero, la lista de leads, la
ficha de lead y las fichas AF; el resto se compone con el vocabulario de secciones anterior.

### Panel / Resumen (tablero)

Indicadores del periodo, embudo por etapas y actividad reciente. Es la pantalla de entrada.

Embudo (`EMBUDO`): Interesado 21 · Contactado 24 · Datos completos 12 · Inscrito 31 ·
En formación 14, cada uno con su color de etapa.

### Gestión de leads

Tabla de leads con filtros y embudo. Columnas: fecha de entrada, correo, teléfono, nombre,
tipo de documento, número, departamento, etapa, datos que faltan.

Datos de ejemplo (`FILAS`), 11 registros. Los primeros:

| Fecha | Correo | Teléfono | Nombre | Doc | Número | Depto | Etapa | Faltan |
|---|---|---|---|---|---|---|---|---|
| 1/08/26, 8:04 a. m. | sofia.arias29@ejemplo.test | 328765869 | Sofía Arias Beltrán | C.C. | 1010331478 | BOYACÁ | Interesado | Faltan 4 |
| 3/08/26, 8:04 a. m. | david.pinzon26@ejemplo.test | 328286621 | David Alejandro Pinzón Rojas | C.C. | 1010316499 | SANTANDER | Contactado | Faltan 2 |

La lista completa está en la constante `FILAS` del prototipo.

Clic en una fila → ficha del lead.

### Ficha de lead (Sofía Arias Beltrán)

Dos columnas: contenido con pestañas a la izquierda, columna de contexto a la derecha.

**Cinco pestañas** (constante `CONTENIDO`):

1. **Datos** — datos del interesado: identificación, contacto, ubicación, formación.
2. **Empresa** — organización que lo nominó, con NIT, ubicación y clasificación.
3. **Notas** — notas del gestor, con tipo de nota.
4. **Origen** — de dónde entró el lead.
5. **Historial** — eventos con fecha (constante `EVENTOS`).

**Columna de contexto**, en este orden:

- Etapa actual y avance en el embudo.
- **Validación del nombre** — "Consulta no realizada · Documento de prueba: no se consulta
  ante el RUI."
- **Autorización de datos** — versión aceptada y por qué medio.
- Datos que faltan.

Eventos de ejemplo:

- 16/08/2026, 2:04 a. m. — Aceptó la política de tratamiento de datos · Versión 1 · La aceptó en el formulario web
- 1/08/2026, 8:04 a. m. — Entró al sistema en etapa Interesado · La empresa lo nominó · BRITCHAM ADEE

### Formación

Dos gremios, cada uno como una lista con su recuento de acciones publicadas.

**ADECOPRIA** — `/adecopria · 7 de 7 publicadas`

| Código | Acción | Modalidad | Ocupación |
|---|---|---|---|
| AF1 | Gestión de la Atención y Neuroeducación en la Era Digital | CURSO virtual · 40 h · 9 ubicaciones | 33 de 520 (6,3 %) |
| AF2 | Diseño Estratégico de Ecosistemas Educativos con Inteligencia Artificial | CURSO virtual · 40 h · 9 ubicaciones | 21 de 520 (4,0 %) |
| AF3 | Gobernanza Estratégica de la Diversidad, Equidad E Inclusión (dei) para Mujeres Líderes en el Sector Educativo | TALLER presencial · 8 h · 5 ubicaciones | 29 de 195 (14,9 %) |
| AF4 | Realidad Virtual y Cartografías Digitales para la Innovación Institucional | TALLER presencial · 8 h · 1 ubicación | 0 de 39 (0 %) |
| AF5 | Modelos de Asociatividad y Cooperativismo Escolar: Emprendimiento Social y Redes de Comercialización Responsable | TALLER presencial · 8 h · 2 ubicaciones | 0 de 78 (0 %) |
| AF6 | Fábrica de Soluciones Digitales: Metodologías de Innovación Abierta y Estructuración de Laboratorios Tecnológicos Institucionales | TALLER-BOOTCAMP presencial · 16 h · 2 ubicaciones | 14 de 78 (17,9 %) |
| AF7 | Salto Adelante (leapfrogging): Coherencia, Equidad y Humanismo en la Escuela Híbrida | FORO híbrido · 2 h · 10 ubicaciones | 52 de 650 (8,0 %) |

**BRITCHAM ADEE** — `/britcham-adee · 8 de 8 publicadas` (ver constante `ACCIONES`).

Cada fila abre **su propia** ficha, no una ficha genérica.

### Ficha de acción de formación (AF1–AF7)

Todos los datos están en la constante `FICHAS_AF` del prototipo, que es la fuente
autoritativa para esta pantalla. Estructura de cada ficha, en orden:

1. **Cabecera** — título de la acción, y debajo `AF# · ADECOPRIA · <modalidad> · Publicada`.
   Enlace "← Volver a Formación". Acciones: Ocultar, Exportar a PDF.
2. **Tres indicadores** — Avance sobre la meta / Ocupación del tope / Quién ha reservado.
3. **Ritmo de esta acción** — cupos netos por día de los últimos 14, descontando ediciones y
   cancelaciones, más la proyección.
4. **Oferta por ubicación** — tabla: Ubicación (con departamento como subtexto en las
   presenciales), Modalidad, Cupos, Reservados, Libres, Espera, Estado.
   Es contra estas filas que se descuenta el cupo.
5. **Grupos comprometidos** — lista en varias columnas. Es el plan del proyecto (cuántas
   cohortes y con qué reparto); **no llevan contador propio**.
6. **Dónde se está llenando** — solo las ubicaciones con reservas, con barra de avance.
7. **Reservas** — tabla: Fecha, Organización (con NIT), Contacto (con correo), Ubicación,
   Cupos, Estado.
8. **Objetivo de la acción** — texto literal del proyecto, en mayúsculas, a ancho completo.

Cifras por acción:

| | Avance | Tope | Reservas | Ritmo |
|---|---|---|---|---|
| AF1 | 33 de 400 (8,3 %) | 487 libres de 520 | 3 org · 0 en espera | 0,7/día · faltan 367 |
| AF2 | 21 de 400 (5,3 %) | 499 libres de 520 | 3 org · 0 en espera | 0/día · faltan 379 |
| AF3 | 29 de 150 (19,3 %) | 166 libres de 195 | 3 org · 6 en espera | 0/día · faltan 121 |
| AF4 | 0 de 30 (0 %) | 39 libres de 39 | 0 org | 0/día · faltan 30 |
| AF5 | 0 de 60 (0 %) | 78 libres de 78 | 0 org | 0/día · faltan 60 |
| AF6 | 14 de 60 (23,3 %) | 64 libres de 78 | 1 org | 1/día · se llena el 14/10/2026 |
| AF7 | 52 de 500 (10,4 %) | 598 libres de 650 | 6 org · 0 en espera | −0,1/día · se cancela más de lo que entra |

El cupo por grupo es la meta más un 30 % por deserción: `50 + 30 % = 65`,
`30 + 30 % = 39`, `250 + 30 % = 325` según la acción.

### Resto de pantallas

Reservas · Empresas registradas · Empresas aliadas - afiliadas · Inscritos Acción Formación ·
Reportes SENA · Control de Inscritos · Tablero académico · Avance · Ver cronograma ·
Creación Formularios · Formularios Activos · Habeas Data · Campañas · Plantillas ·
Cuenta de correo · Apariencia · Webhook de Meta · Usuarios · Mi perfil.

Pantallas que se abren desde dentro de otra: Inscribir a alguien · Cargar una lista ·
Ficha de empresa · Por revisar · Editor del formulario · Apariencia del formulario ·
Respuestas del formulario.

Sus datos de ejemplo están en las constantes `RESERVAS`, `REGISTRADAS`, `ALIADAS`,
`INSCRITOS` y en las funciones de `PANTALLAS`.

---

## Interacciones y comportamiento

| Interacción | Comportamiento |
|---|---|
| Clic en módulo del menú | Despliega/pliega su submenú. Solo uno abierto a la vez. |
| Clic en pantalla del submenú | Navega y marca la pantalla activa |
| Clic en círculo del rail plegado | Despliega el panel **y** abre ese módulo |
| Clic en `‹` / `›` | Pliega/despliega el panel (250 ↔ 62px, `transition: width .18s ease`), se persiste en `localStorage` |
| Clic en "Resumen" | Vuelve al tablero, limpia el módulo activo |
| Clic en nivel de la ruta | Navega a esa pantalla; el último nivel no es clicable |
| Clic en fila de tabla | Abre la ficha correspondiente (solo en tablas de leads, acciones y empresas) |
| Clic en pestaña de ficha | Cambia el contenido sin recargar |
| Hover de fila | Fondo `--tabla-fila-resaltada` |
| Hover de menú | Fondo `--superficie-alterna` |
| Hover de círculo del rail | Borde a `--texto-suave`, icono a `--titulo` |
| Conmutador de tema | `data-tema="oscuro"` en la raíz |

Sin animaciones más allá de la transición de ancho del panel. Es una herramienta de trabajo.

---

## Estado

| Variable | Tipo | Descripción |
|---|---|---|
| `pantalla` | `"tablero" \| "leads" \| "ficha" \| "pendiente" \| "generica"` | Qué se está mostrando |
| `generica` | string | Nombre de la pantalla genérica activa |
| `abierto` | string \| null | Módulo con el submenú desplegado |
| `pendienteModulo` | string | Módulo al que pertenece la pantalla activa (para la ruta) |
| `desde` | string \| null | Pantalla intermedia de la ruta, cuando se entró desde dentro de otra |
| `pestana` | string | Pestaña activa de la ficha de lead |
| `tema` | `"claro" \| "oscuro"` | Tema activo |
| `panel` | boolean | Panel desplegado (persistido en `localStorage`) |

**Persistencia:** solo `convoca-panel` en `localStorage`. El tema no se persiste en el
prototipo; en producción convendría persistirlo igual.

**Datos:** todo es estático en el prototipo. En producción cada pantalla necesita su
consulta; la forma de los datos está en las constantes citadas.

---

## Criterios del rediseño (qué respetar al portarlo)

Estos son los principios que hacen que el resultado se parezca al bosquejo. Si hay que
tomar una decisión no cubierta arriba, decídala con estos:

1. **Bordes de 1px, nunca sombras ni cajas apiladas.** La estructura se lee por líneas.
2. **El color va en el texto y en marcas pequeñas, no en fondos.** Un estado se comunica con
   el color de su palabra, no con una pastilla de color.
3. **Máximo dos fondos por pantalla:** `--superficie` y `--superficie-alterna`.
4. **Jerarquía por tipografía**, no por tamaño de caja.
5. **Nada de emoji.** Iconos de trazo que tomen el color del tema.
6. **Nunca dejar media pantalla vacía.** Filtros y rejillas ocupan el ancho disponible; las
   listas de elementos cortos se reparten en columnas.
7. **Un bloque vacío dice por qué está vacío**, no se deja en blanco.
8. **La navegación hacia atrás es un enlace, no un botón.** Los botones son acciones.
9. **La ruta de navegación nunca se pierde**, ni al entrar en una pantalla desde dentro de otra.
10. **Cifras en `tabular-nums`** siempre, para que las columnas se alineen.

---

## Recursos

- **`logo-convoca.png`** — logotipo, se usa a 24×24px en el panel. Incluido en `diseño/`.
- **Raleway** — Google Fonts, pesos 400/500/600/700.
  `https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap`
- **Iconos** — SVG de trazo escritos a mano, definidos arriba. No hay dependencia de una
  librería de iconos; si el codebase ya usa una (Lucide, Heroicons outline), sus equivalentes
  de trazo sirven y son preferibles.
- Todos los datos de personas, empresas y correos son **ficticios** (`@ejemplo.test`).

---

## Archivos de este paquete

```
design_handoff_convoca_crm/
├── README.md                       este documento
├── DECISIONES.md                   decisiones posteriores — manda sobre este README
├── capturas/                       12 capturas de las pantallas principales
└── diseño/
    ├── Convoca Rediseño.dc.html    el prototipo completo (abrir en el navegador)
    ├── support.js                  runtime del prototipo — NO portar
    └── logo-convoca.png            logotipo
```

Las capturas son referencia de composición, no de medidas — están tomadas a 906px de ancho,
más estrecho que el uso real. Para medir, abra el prototipo.

| Captura | Pantalla |
|---|---|
| `01-panel-resumen.png` | Panel / Resumen (tablero) |
| `02-gestion-de-leads.png` | Gestión de leads |
| `03-ficha-de-lead.png` | Ficha de lead, pestaña Datos |
| `04-formacion.png` | Formación — los dos gremios |
| `05-ficha-af1.png` | Ficha AF1 |
| `06-ficha-af3.png` | Ficha AF3 (presencial, con lista de espera) |
| `07-control-de-inscritos.png` | Control de Inscritos — 8 indicadores en 4+4, filtros a ancho completo |
| `08-cronograma.png` | Ver cronograma |
| `09-reservas.png` | Reservas — submenú activo, ruta de navegación |
| `10-empresas-registradas.png` | Empresas registradas |
| `11-tema-oscuro.png` | Tema oscuro |
| `12-panel-plegado.png` | Panel plegado a 62px |

Dentro de `Convoca Rediseño.dc.html`, el bloque `<style>` de la cabecera contiene los tokens,
el cuerpo contiene la plantilla, y el `<script>` final contiene los datos (`MODULOS`,
`ICONOS`, `FILAS`, `EMBUDO`, `ACCIONES`, `CONTENIDO`, `EVENTOS`, `RESERVAS`, `REGISTRADAS`,
`ALIADAS`, `INSCRITOS`, `PANTALLAS`, `FICHAS_AF`) y la lógica de navegación.
