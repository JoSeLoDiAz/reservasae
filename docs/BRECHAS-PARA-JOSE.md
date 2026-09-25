# Brechas abiertas — comprobadas contra `dev`

**Para José.** Cada punto de aquí se verificó **contra el código de `origin/dev`**, no contra
una lista heredada. Debajo de cada uno va cómo se comprobó, para que puedas refutarlo en un
minuto si me equivoco.

- **Base de la comprobación:** `origin/dev` en `f300062` (24 sep 2026).
- **Fecha:** 25 de septiembre de 2026.
- **Lo primero, porque cambia el resto:** de los cuatro que yo daba por críticos, **uno ya lo
  habías cerrado** (`MESA-02`). Está abajo, en «lo que ya no hace falta».

---

## Resumen

| | Qué es | Dónde |
|---|---|---|
| **B-01** | El control de reparto de leads se salta por la puerta de editar | `crm.controller.ts` · `@Patch(':id')` |
| **A-08** | Dos entradas simultáneas crean dos leads | `leads.service.ts` |
| **B-03** | Se puede mover de acción a alguien ya certificado | `crm.service.ts` · `asignar()` |
| **B-08** | La puerta pública no valida el documento | `preinscripcion.service.ts` |
| **A-15** | La rama firme del webhook no marca `procesadoEn` | `leads.service.ts` |
| **B-14** | Crear ficha por la puerta pública no deja auditoría | `preinscripcion.service.ts` |
| **LMS** | Nadie escribe el avance del aula | bloqueado fuera |
| **SENA** | Los retiros no viajan en el cargue | bloqueado fuera |

**Cuatro de las seis primeras son el mismo defecto de forma**, y por eso van juntas al final en
«el patrón».

---

## B-01 · El reparto de leads tiene una puerta de al lado

**Qué pasa.** Repartir leads entre asesores está protegido: `conveniosQueReparten` comprueba
que quien reparte responda por el equipo, y la comprobación es buena ---se hace sobre las
fichas de verdad, no sobre lo que venga en el cuerpo---.

Pero solo la lleva **el reparto por lotes**. La puerta que edita un lead de uno en uno no la
pasa, y su DTO acepta `asesorId`.

**Cómo lo comprobé.** En `crm.controller.ts` de `dev`, `conveniosQueReparten` aparece dos
veces: el import y la línea 496, dentro de `@Patch('lote/asesor')`. `@Patch(':id')` (línea 589)
llama a `this.crm.actualizar(id, dto, admin, ambito.convenios, ip)` sin pasarlo, y `actualizar()`
no lo menciona. `asesorId` está en el DTO (`crm/dto.ts:417`).

**Lo que cuesta.** Un gestor de inscripciones ---que ES un asesor--- puede pasarse fichas a sí
mismo o quitárselas a otro, de una en una. Y con eso deja de ser fiable la tabla de
Seguimiento de asesores entera, que es la que dice quién va mal.

**Arreglo.** Exigir `conveniosQueReparten` en `@Patch(':id')` **cuando el cuerpo traiga
`asesorId`**, con el mismo mensaje del lote. Si no lo trae, la puerta se queda como está.

---

## A-08 · Dos entradas a la vez crean dos leads

**Qué pasa.** Antes de crear un lead se busca si ya existe por `origenSistema + externoId`. Si
dos llegan en el mismo instante, **las dos pasan la búsqueda** y las dos crean.

**Cómo lo comprobé.** `leads.service.ts` de `dev`: `findUnique` sobre
`origenSistema_externoId`, y si no hay, `create`. **Ni un solo `P2002` en todo el fichero**
(`grep -c` da 0), mientras que otros seis ficheros del backend sí lo capturan.

**Lo que cuesta.** Los reintentos de Meta son exactamente este caso. Resultado: la misma
persona dos veces y dos asesores llamándola.

**Arreglo.** `try/catch` del `create`, y si el código es `P2002`, volver a leer y devolver
`{ ...vista, repetido: true }` ---que es lo que ya devuelve la rama de arriba---. La única
unicidad de verdad es la de la base; la comprobación previa solo evita el caso común.

---

## B-03 · Se puede mover de acción a alguien ya certificado

**Qué pasa.** `asignar()` cambia la oferta ---y con ella la acción de formación--- de un
participante. **No mira en qué etapa está.**

**Cómo lo comprobé.** `crm.service.ts:4442` en `dev`: `asignar()` selecciona `etapa` en su
consulta y después no la usa. Ciento dieciocho renglones sin una comparación contra
`CERTIFICADO`, `RETIRADO` ni ninguna terminal.

**Lo que cuesta.** El certificado de una persona deja de corresponder con lo que cursó. Eso no
es un defecto de pantalla: es lo que se le reporta al SENA.

**Arreglo.** Rechazar si la etapa es terminal (`CERTIFICADO`, `RETIRADO`, `NO_APROBO`), con un
mensaje que diga por qué. Si hay que poder corregir un error de asignación de un certificado,
que sea una puerta aparte y con permiso propio ---no la de uso diario---.

---

## B-08 · La puerta pública no valida el documento

**Qué pasa.** `documentoValido(tipo, numero)` existe y lo llaman siete ficheros. **El de
preinscripción no.** Normaliza el documento y lo guarda.

**Cómo lo comprobé.** `grep -c documentoValido` sobre
`preinscripcion/preinscripcion.service.ts` en `dev`: **0**. Sobre `crm.service.ts`,
`leads.service.ts`, `carga.ts`, `conversion.service.ts`, `mesa-de-entrada.service.ts` y
`listo-para-ficha.ts`: lo llaman.

**Lo que cuesta.** Una cédula con letras entra por el formulario público, que es **la puerta
por la que entra más gente**. Y de ahí sale al cargue del SENA.

**Arreglo.** Llamarlo donde ya se normaliza, y devolver el 400 con el mismo texto que las
otras puertas.

---

## A-15 · La rama firme del webhook no marca `procesadoEn`

**Qué pasa.** Cuando el cruce encuentra una coincidencia **firme**, el lead se ata a la ficha
y pasa a `CONVERTIDO`. Se escriben `participanteId`, `estado` y `motivo`. **`procesadoEn` no.**

**Cómo lo comprobé.** `leads.service.ts` de `dev`, el `update` de la rama `coincide.firme`:
tres campos, y `procesadoEn` no está entre ellos. Las tres puertas del panel sí lo ponen.

**Lo que cuesta.** Es el camino **más recorrido** de los cuatro. Cualquier cosa que se apoye en
`procesadoEn` ---una cola, un reintento, un informe de «qué queda por procesar»--- ve esos
leads como pendientes para siempre.

**Arreglo.** Añadir `procesadoEn: new Date()` a esa rama.

---

## B-14 · Crear ficha por la puerta pública no deja auditoría

**Qué pasa.** Hay dos sitios en todo el backend que crean un participante: `crm.crear()` y
`preinscripcion.service.ts`. El primero emite `PARTICIPANTE_CREADO`. El segundo **deja solo un
movimiento de etapa y ni una fila de auditoría**.

**Cómo lo comprobé.** `preinscripcion.service.ts` en `dev` tiene el `AuditoriaService`
inyectado y lo usa dos veces (líneas 1369 y 1492), pero el `participante.create` está en la
431 y no hay ningún `PARTICIPANTE_CREADO` en el fichero. En `crm.service.ts` aparece dos veces.

**Lo que cuesta.** La traza de «de dónde salió esta ficha» tiene un agujero justo en la puerta
que más fichas crea.

**Arreglo.** Emitirlo igual que en `crm.crear()`, con el autor puesto a la puerta pública.

---

## El patrón, que es lo que de verdad hay que mirar

**B-08, B-14 y A-15 son el mismo defecto de forma:** un arreglo que cierra el camino del panel
y deja abierta la puerta pública. Con B-01 son cuatro de seis.

Preinscripción y el webhook son **por donde entra más gente y lo que menos se mira**, porque no
tienen pantalla que los delate: cuando fallan, fallan en silencio.

**Sugerencia concreta, más allá de los seis arreglos:** una prueba que recorra las puertas que
crean o modifican una ficha y exija que todas llamen a las mismas tres cosas ---validación de
documento, validación de celular y auditoría---. Hoy eso se comprueba a ojo, y a ojo se ha
escapado cuatro veces esta semana.

---

## Lo que no depende de nosotros

### El aula está bloqueada por el LMS

Las pantallas de Seguimiento académico y Seguimiento del aula leen `actividades` y
`avances_actividad`. **Nada en `backend/src` de `dev` escribe esas dos tablas** ---lo comprobé
buscando `create`, `update`, `upsert` y `createMany` sobre las dos---. Solo las escriben las
siembras, que son de desarrollo.

En producción eso significa dos cosas: esas pantallas salen vacías, y **`cambiarEtapa` impide
certificar a cualquiera**, que es lo que paga el SENA.

**La pregunta para quien maneje el LMS:** ¿puede mandarnos, por persona y actividad, si está
completada y cuándo? Da igual el medio ---API, un volcado periódico, un Excel---. El modelo ya
está y las pantallas ya saben leerlo.

### El retiro está bloqueado por el SENA

`ETAPAS_DEL_REPORTE` se deriva de `OCUPAN_SILLA`: INSCRITO, EN_FORMACION y CERTIFICADO. Las
cuatro salidas ---NO_APROBO, DESERTO, ABANDONO, RETIRADO--- están fuera, así que **quien se
retira desaparece del cargue** en vez de reportarse como retirado.

El propio comentario del código dice dónde se añadirían, así que el trabajo es de minutos. Lo
que falta es la respuesta.

**La pregunta para el SENA:** ¿qué valor espera la columna `ESTADO` del cargue para alguien que
se retiró, desertó, abandonó o no aprobó? Poniendo cualquier cosa se arriesga el rechazo del
cargue entero.

---

## Lo que ya no hace falta

**`MESA-02` — la paginación de la mesa: cerrado.** `frontend/src/app/admin/mesa/page.tsx` en
`dev` ya tiene `pagina`, `datos.paginas` y los dos botones con su `disabled`. Estaba en mi
lista como abierto y llevaba días resuelto.

Lo digo porque es la lección de todo este repaso: **un pendiente se comprueba contra `dev`, no
contra la lista.** Trabajamos en paralelo, y la lista envejece más rápido de lo que se
actualiza.
