# Decisiones de diseño — respuestas a la implementación

Complemento del `README.md`. Recoge las decisiones que el README no cubría y que
surgieron al aplicar la primera capa del rediseño. **Tiene la misma autoridad que el
README.** Si algo aquí contradice al README, manda este documento.

---

## 1. La paleta guardada en base de datos

Los 39 tokens que cada gremio edita desde Configuración → Apariencia **siguen mandando
sobre el CSS**. Ese comportamiento se queda como está.

La paleta del rediseño es el **nuevo punto de partida** para quien no haya tocado nada.
**No se sobrescribe** lo que un administrador eligió.

Añada un **"Restaurar valores por defecto"** en Configuración → Apariencia, para que el
gremio que quiera la paleta del rediseño la tome por su cuenta.

## 2. `--acento`, `--acento-texto`, `--acento-suave`

**Se quedan fijos en CSS. El catálogo sigue en 39 tokens.**

No son identidad de marca, son significado: marcan la validación del nombre y los estados
correctos. Si un gremio los repinta, un dato verificado y uno sin verificar pueden acabar
del mismo color. Es editable lo que identifica al gremio; no lo que comunica estado.

**`--exito`, `--aviso` y `--error` sí se quedan editables**, con sus tres fondos: son 6 de
los 39 y ya hay temas guardados que dependen de ellos. Sacarlos dejaría el catálogo en 33 y
rompería lo que los gremios tienen puesto — un coste real a cambio de un riesgo teórico.

La diferencia con `--acento` es que aquel nunca estuvo en el catálogo: no se le quita nada a
nadie dejándolo fijo.

Como salvaguarda, en Configuración → Apariencia valide dos cosas al guardar los tres colores
de estado: que sean distinguibles **entre sí**, y que cada uno mantenga contraste suficiente
contra `--superficie`. Un aviso basta, no hace falta bloquear. Con eso y el "Restaurar
valores por defecto" del punto 1, un tema mal puesto siempre tiene vuelta atrás.

## 3. Rayas verticales entre columnas

**Se quedan**, en `--hairline`.

Con 22 columnas el ojo salta en horizontal y la raya horizontal sola no basta.
**Regla:** solo en tablas de **más de ocho columnas**. En las de cinco o seis sobran
y ensucian.

## 4. Cebra de filas alternas

**Fuera.** Separador `--hairline` entre filas y resaltado `--tabla-fila-resaltada` al pasar
el cursor. Nada más. (Criterio 3 del README: máximo dos fondos por pantalla.)

## 5. Fila "Resumen" y rail plegado de 62px

**Se implementan los dos.** No es solo decoración:

- Llegar al tablero por el logotipo **no es descubrible**. Nadie hace clic en un logotipo
  esperando navegación, y no hay forma de saber que se puede.
- El rail plegado sin etiquetas es un acertijo. Por eso cada círculo lleva `title` con el
  nombre del módulo, y el clic **despliega el panel y abre ese módulo**, no solo despliega.

Un panel que se oculta solo sirve si plegado sigue significando algo.

## 6. Llave de `localStorage`

**Se mantiene la del código:** `convoca:plegado` con `"si"` / `"no"`.
Ignore lo que dice el README (`convoca-panel` / `"abierto"` / `"cerrado"`).
Cambiarla borraría la preferencia de todos los usuarios a cambio de nada.

## 7. Unidades: px vs rem

**La traducción a rem es correcta y es la que se queda.**

El panel escala el texto del 80 % al 150 % moviendo el `font-size` de la raíz; en px ese
ajuste de accesibilidad dejaría de funcionar. Los tamaños del README son la **referencia
visual**, no la unidad obligatoria.

Equivalencias ya aplicadas: 13,5px → `0.84375rem` · 12,5px → `0.78125rem` ·
10,5px → `0.65625rem`.

Las **medidas de caja** (altura de fila, alturas de campo y botón, radios, anchos del panel)
sí se quedan en px: no deben crecer con el texto.

## 8. Sombras

Correcto haber dejado 7 en lo que flota — cajón, modales, desplegables, toast. Ahí la sombra
separa planos, que es justamente para lo que sirve. El criterio "sin sombras" del README se
refiere al contenido en la página, no a las capas por encima de ella.

## 9. Orden de trabajo del vocabulario de secciones

1. `tabla` — es lo que más se ve
2. `kpis`
3. `lista`
4. `barra`
5. `filtros`
6. `aviso`
7. `texto`
8. `dona` — la última, es la única con dibujo

Con esos ocho, las 34 pantallas restantes se componen sin diseño nuevo.

## 10. Botón principal

Confirmado: el botón primario es **azul de marca** (`--marca`), no `--acento` verde. El verde
pintaba de verde el botón de todo el panel y le quitaba al gremio el color que él edita.

---

## Cómo resolver una duda que no esté escrita

En este orden:

1. **El prototipo** — `diseño/Convoca Rediseño.dc.html`, abierto en el navegador. Es la
   fuente para cualquier pantalla concreta: se puede medir e inspeccionar.
2. **Los diez criterios** del README (sección "Criterios del rediseño"). Están escritos
   precisamente para decidir lo que no está especificado.
3. **Preguntar.** Si la duda es funcional y no visual —qué hace un botón, qué datos trae una
   pantalla, si se sobrescribe algo del administrador— no la decida por su cuenta.
