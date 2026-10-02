# `jose/dv-tecleado` · seis cosas antes de subirla

**No sube todavía.** Seis cosas, y tres están verificadas ejecutando, no leyendo.
Van con archivo y línea para que no tengas que volver a encontrarlas.

Lo que sí entró y ya está en producción: **`v0.18.0-JD`**, con las dos mitades de
forma (`forma-arregla` y encima `forma-apariencia`). El capítulo del diseño queda
cerrado.

---

## Lo que está bien, y conviene decirlo primero

- **Descartar tu B-01 y quedarte con la de José** es la decisión correcta y no
  era la cómoda.
- **El detector que daba su arreglo por brecha abierta**: tenías razón, buscaba
  en el controlador y él lo puso en el servicio.
- **El círculo del desplegable de asignar (`d308edd`) es el mejor hallazgo de la
  entrega.** Para aparecer había que tener un lead y para tener el primero había
  que aparecer: una cuenta nueva no podía recibir ninguno **nunca**. Eso explica
  la mitad de lo que el equipo venía reportando, y la otra mitad era la regla de
  repartir. Las dos causas, no una.
- Y avisar de lo de `PUEDEN_LLEVAR_FICHAS` **antes** de fundir fue lo correcto,
  aunque el efecto no sea el que creías: `LIDER_SISTEMAS` está en
  `REPARTEN_FICHAS`, y `motivoParaNoTocarElAsesor` sale en
  `if (quien.reparte) return null` antes de consultar `llevaFichas`. Un líder de
  sistemas sí puede coger un lead libre.

---

## 1 · 🔴 El guion no corre en ninguna máquina

`backend/package.json:52` lanza `db:nit-pegado` con **`tsx`**. Los otros treinta
guiones usan `ts-node`. **`tsx` no existe en este proyecto**, y está comprobado
ejecutando, no leyendo:

```
grep -c "tsx@" pnpm-lock.yaml          -> 0
git diff --name-only dev...HEAD | grep pnpm-lock  -> (vacío, no tocaste el lock)
pnpm --filter backend exec ts-node --version      -> v10.9.2
pnpm --filter backend exec tsx --version          -> "tsx" no se reconoce
```

Es la forma exacta del PR #2: compila, 2.387 pruebas en verde, y **lo que es el
motivo de la entrega no arranca**.

**Arreglo:** `tsx` → `ts-node`. Comprobado que el guion es compatible —imports
CommonJS, `main()` al pie, sin top-level await—, así que no toca el lockfile ni
obliga a reconstruir la imagen. Añadir `tsx` como dependencia sí movería las dos
cosas.

## 2 · 🔴 Y arreglado con la palabra obvia, manda un DV falso al SENA

`RELLENABLES` incluye `digitoVerificacion` (`unir-nit-pegado.ts:75`), así que al
unir se copia el DV de la fila **pegada** a la **buena** cuando esta lo tiene
vacío.

El DV no es una propiedad de la organización como la dirección: **es una función
del NIT**, y las dos filas tienen NIT distinto. Corrido el algoritmo de la DIAN
sobre tu propio ejemplo:

| | |
|---|---|
| `DV("8001837677")` —la pegada, diez dígitos— | **1** |
| `DV("800183767")` —la buena— | **7** |

Si la buena lo tiene nulo, le grabas el **1**. Y de ahí sale al cargue en
`crm/sep/formato-cargue-sep.ts:150`. Que el estado existe lo sabes tú mismo:
`integridad.ts:218`, de esta misma rama, cuenta las empresas sin dígito.

Lo que lo hace evitable es que **tu propio docblock ya enuncia la regla que
incumple**, aplicada a otro campo: «NO TOCA `institucionId` A PROPÓSITO… apunta a
una ficha con el NIT MALO. Copiarla sería mudar el error de tabla». El DV es el
mismo caso.

**Arreglo:** sacarlo de `RELLENABLES`, o escribir
`calcularDigitoVerificacion(buena.nit)`. Lo primero es más honesto.

## 3 · 🔴 B-03 deja a un certificado sin poder recibir su primer grupo

«A quien ya cursó no se le cambia la acción de formación» **no distingue cambiar
de poner por primera vez**. Un `CERTIFICADO` sin grupo no puede recibir el suyo,
y sin grupo **no entra al reporte del SENA**. El 400 además dice algo que no es.

**Arreglo:** condicionarlo al cambio REAL: leer `oferta.accionFormacionId` y
exigir `oferta.accionFormacionId !== p.accionFormacionId` antes de lanzar. Eso
conserva entero el motivo que defiendes en el docblock.

## 4 · 🟠 El `updateMany` de reservas puede morir a mitad

`unir-nit-pegado.ts:229` mueve las reservas con un `updateMany`, y `Reserva` tiene
`@@unique([empresaId, ofertaId])` (`schema.prisma:415`). Si las dos mitades
reservaron contra la **misma oferta** —que es justo lo que significa «su gente
repartida»— eso lanza P2002 y el guion sale con `exit(1)`, dejándolo **aplicado a
medias entre parejas**: las anteriores comprometidas, la que choca revertida, las
siguientes sin correr. El `$transaction` es por pareja, así que el «todo o nada»
del docblock es cierto dentro de una y falso entre varias.

**Y no es teórico.** Al escribir el SQL equivalente apareció exactamente ese caso:
**Fontán tenía reserva por los dos lados sobre la misma oferta** —1 cupo en la
buena y 3 en la pegada—. Ahí no se mueve: **se suman** (1+3=4, que es la verdad)
y se deja la huella en `movimientos_reserva`, cuidando que el contador de la
oferta no se descuadre.

**Arreglo:** detectarlo en la previa —buscar parejas `(empresaId, ofertaId)` que
existan en las dos filas— y decir que esa organización se une a mano.

## 5 · 🟠 La fusión rompe el filtro de fecha que el cliente pidió

Un defecto que **ninguna de las dos ramas tiene sola**: sale de juntarlas. Al
resolver el conflicto de `columnas-participante.tsx` «tomando los dos» se pierde
el filtro de fecha por columna del 30 sep.

De paso: `America/Bogota` queda escrito a mano en el frontend, mientras el backend
ya tiene esa decisión en `comun/dia-bogota.ts`. Dos verdades sobre la misma zona.

## 6 · 🟠 `asesoresAsignables` deja Gestión de leads en blanco

Va **obligatorio** en el tipo (`crm-api.ts:517`) y se recorre sin guarda
(`page.tsx:315` → `:621`). En la ventana del despliegue —frontend nuevo contra
backend viejo, o un backend reiniciando— llega `undefined` y `undefined.map` deja
la pantalla **en blanco para quien reparte**. Es el mismo caso que
`porAsesor.pendientes`, que ya está documentado como opcional por esto.

**Arreglo:** `asesoresAsignables?:` y `?? []`. Dos caracteres.

---

## Y una que no bloquea, pero cierra mal

El spec `a-quien-se-le-puede-asignar.spec.ts:138` **fija como contrato** que
`exigirAsesorDelConvenio` NO mire `PUEDEN_LLEVAR_FICHAS`:

```ts
expect(cuerpo).not.toContain('PUEDEN_LLEVAR_FICHAS')
```

Entiendo el razonamiento —no romper lo ya asignado— pero el efecto es que la regla
del cliente («solo Gestor y Líder de Inscripciones») vive **solo en el
desplegable**: por la API se le sigue pudiendo asignar fichas a un líder de
sistemas, por la ficha, por el lote y por crear. Es el «control en pie y vacío de
efecto», y esta vez **clavado por un test**: quien mañana cierre el agujero verá
fallar ese test, y el camino corto para ponerlo en verde es volver a abrirlo.

Si la decisión es que la regla es solo de presentación, que el test lo **diga** —y
el docblock también—. Si es una regla de verdad, hay **tres** puertas que
cerrarla: `exigirAsesorDelConvenio`, `asignarAsesorEnLote` y `crear()`.

Dato para decidir: en producción solo **una** ficha está en manos de un líder de
sistemas (`proyectos@`, ADECOPRIA). Las otras tres cuentas llevan cero.

---

## Mientras tanto

**El arreglo de los NIT pegados se hace con el SQL que ya está en el servidor**
(`/tmp/unir-nit-pegado.sql`), que está ensayado en seco contra esa misma base y
resuelve el choque de reservas del punto 4. No lo dupliques: cuando tu guion
quede bien, servirá para los que vengan después.

Y la rama **no funde limpia** hoy: un conflicto en `columnas-participante.tsx`.
Rebásala sobre `v0.18.0`, que es lo que hay en producción.
