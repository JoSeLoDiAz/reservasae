# El estilo del panel

> Para quien toque la interfaz. Son cinco reglas, las pidió
> Mauricio una por una mirando la pantalla, y **cada una está
> puesta en un solo sitio a propósito** — para que no haya que
> acordarse de ellas al escribir código nuevo.
>
> Si algo de aquí «se ve raro» y la tentación es corregirlo en
> el componente, casi siempre la corrección va en el token.

## 1. Plano y cuadrado

**El radio es un token, no una clase.** En
[`globals.css`](../frontend/src/app/globals.css), dentro de
`@theme inline`:

```css
--radius-lg: 3px;
--radius-xl: 4px;
--radius-2xl: 4px;
```

Había **361** clases `rounded-*` repartidas por el código. No se
tocó ninguna: en Tailwind v4 el radio sale de esos tokens, así
que `rounded-2xl` mide hoy 4px en todo el panel y quien escriba
`rounded-xl` mañana sale en el estilo de la casa sin saberlo.

**Si necesita una esquina más redonda, no suba el token.** El
panel es una herramienta de trabajo institucional; el redondeo
generoso la hacía parecer una app de teléfono, y eso fue
exactamente la queja.

`rounded-full` se dejó intacto: lo usan cosas de verdad
circulares (indicadores de carga). No lo use para insignias.

## 2. El color va en la letra

**Sin caja, sin borde, sin fondo, sin punto, sin subrayado.**

```tsx
// bien
<span className="font-medium text-aviso">Faltan 4</span>

// mal
<span className="rounded-lg bg-aviso-suave px-2 py-0.5 text-aviso">…</span>
```

Vale para todo lo que tenga estado: etapas, completo/parcial,
datos de empresa, activo/cerrado.

**Por qué:** en una tabla de 400 filas, 400 rectángulos de color
compiten con los datos en vez de ordenarlos.

**Y sin subrayado en particular:** en una tabla el texto
subrayado se lee como enlace. La columna «Nombre completo» sí es
pulsable y va subrayada — si el estado también lo llevara, se
confundirían.

`PildoraEtapa` ya no es una píldora pese al nombre: es
`color: var(--etapa)` y nada más. Los once colores de etapa
siguen editándose desde **Apariencia**.

## 3. Solo Raleway

Es la única tipografía autorizada por la marca. Se cargaba
también **Geist Mono** y salía en documentos, teléfonos y fechas.
Fuera: ya no se descarga.

`--font-mono` apunta a Raleway, así que las ~40 clases
`font-mono` del código siguen funcionando y ya no cambian de
letra. Y para no perder lo que la mono daba:

```css
.font-mono { font-variant-numeric: tabular-nums; }
```

Cifras alineadas en columna, una sola tipografía. **No
reintroduzca una segunda fuente** para «que los números
cuadren»: use `tabular-nums`.

## 4. Nada de texto que explique lo obvio

Se borraron varios párrafos de ayuda. Los que sobrevivan a una
revisión tienen que pasar esta prueba: **¿le dice algo a quien
ya sabe usar el sistema?**

Ejemplos de los que se fueron, por si vuelve la tentación:

| Decía | Por qué sobra |
|---|---|
| «Las etapas de salida piden un motivo antes de guardar» | El sistema ya lo pide en el momento, que es cuando sirve |
| «Solo los que le sirven por vivir en GALÁN, SANTANDER…» | Dos renglones que descuadraban la barra entera |
| «Lo que usted puede preguntarle / Se los sabe el empleado» | El asesor ya sabe qué le toca |

Lo que se pierde de vista se puso en `title`. Un globo no se ve
solo, pero tampoco estorba.

## 5. La ficha no se pliega

Ninguna tarjeta de la ficha del lead lleva `plegable`. Se
plegaban cuando compartían columna y se empujaban entre sí; con
el expediente en dos columnas eso ya no pasa, y plegar solo
servía para esconder lo que se viene a mirar.

`Tarjeta` **sigue aceptando** `plegable` — lo usan otras
pantallas. Simplemente no lo use en la ficha.

---

## La cabecera de la ficha, y por qué está así

```
Nombre                                          ETAPA
DOCUMENTO   [GREMIO]                        Interesado
C.C. …
─────────────────────────────────────────────────────
ETAPA        ASESOR       ACCIÓN FORMACIÓN    GRUPO
[select]     [select]     [buscable]          [buscable]
```

- **Identidad y barra de acción comparten caja.** Que estén
  dentro del mismo borde es lo que dice que la barra opera sobre
  *esta* persona.
- **Anchos desiguales, sobre doce columnas**: 2 · 3 · 4 · 3.
  Simétrico no es que todo mida igual — «Interesado» no necesita
  el mismo sitio que un nombre de curso de sesenta caracteres.
- **`items-start` en la barra**: sin él, la fila se estira a la
  columna más alta y deja un palmo de vacío bajo las cortas.
- **Nada de `overflow-hidden` en la cabecera.** «Acción de
  formación» y «Grupo» son `SelectorBuscable`, que abre su lista
  *dentro* de la página: un ancestro que recorta se la come. El
  `<select>` de «Asesor» no se enteraba porque su lista la pinta
  el sistema operativo.
- **El gremio solo sale si se están mirando los dos.** Con uno
  elegido arriba, repetirlo en cada ficha es gastar un hueco.
- **«Entró por» y «En el sistema desde» viven en «Control de
  cambios»**, no en la cabecera: son de dónde salió la ficha y
  cuándo, que es lo que esa tarjeta narra.

## Los filtros viven en la URL

[`frontend/src/lib/filtros-en-la-url.ts`](../frontend/src/lib/filtros-en-la-url.ts).

```
/admin/participantes?etapa=CONTACTADO&asesor=abc&estado=PARCIAL
```

En la dirección y **no** en `useState` ni en `localStorage`,
porque una vista filtrada es algo que se **manda**: «mira los
treinta que están sin asesor» se resuelve pegando un enlace en el
chat. De paso salen gratis recargar sin perder el filtro, el
botón «atrás», y guardar en favoritos.

- Nombres cortos y legibles: `?curso=`, no `?accionFormacionId=`.
- Todo lo que entra por la URL **se valida** contra lo que existe:
  una etapa inventada se ignora en vez de dejar la pantalla
  cargando sin decir por qué.
- `replace` y no `push`: quien pulsa un filtro no está navegando,
  y con `push` el botón «atrás» deshace filtros de uno en uno en
  vez de salir de la pantalla.
- Lo que la pantalla impone (`tramo`) **no** viaja: no es del
  usuario y enseñarlo como quitable mentiría.

## Un fallo que costó tres intentos, para no repetirlo

Al pulsar el conmutador de tema, la pantalla se descuadraba
—cabecera recortada, barra a media altura, franja en blanco— y
seguía así hasta recargar.

**No era el tema.** `data-tema` no define ni una regla de layout
(solo colores y `color-scheme`, comprobado en el CSS compilado), y
no hay una sola utilidad `dark:` en el proyecto.

**Era el FOCO.** Al pulsar, el navegador lleva el botón a la
vista y para eso recorre *todos* sus contenedores desplazables.
Como es el último control de la barra lateral, es el que más
abajo cae.

Los dos primeros arreglos —`overflow-clip` en el marco, y meter
Ajustes dentro de la columna que sí scrollea— son correctos, pero
los dos suponen saber **cuál** contenedor se mueve. El que
funciona no lo supone:

```tsx
onMouseDown={(e) => e.preventDefault()}
```

Sin foco no hay desplazamiento, venga del contenedor que venga.
Con teclado no cambia nada, y ahí el desplazamiento sí se quiere.

**Si ve ese `preventDefault` y le parece raro, no lo quite.**
