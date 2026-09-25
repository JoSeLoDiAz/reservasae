# Brechas abiertas — comprobadas contra `dev`

**Para José.** Cada punto de aquí se verificó **contra el código de `origin/dev`**, no contra
una lista heredada. Debajo de cada uno va cómo se comprobó, para que puedas refutarlo en un
minuto si me equivoco.

- **Base de la comprobación:** `origin/dev` en `f300062` (24 sep 2026).
- **Fecha:** 25 de septiembre de 2026.
- **Lo primero, porque cambia el resto:** de los cuatro que yo daba por críticos, **uno ya lo
  habías cerrado** (`MESA-02`). Está abajo, en «lo que ya no hace falta».

---

## Esto te va a saltar al desplegar, y no es un recordatorio

`pnpm prisma:deploy` ahora es `db:guardia → migrate deploy → **db:brechas**`. Después de
aplicar las migraciones, la consola te escupe las brechas que sigan abiertas, con su impacto y
su arreglo.

**No lee esta lista: abre los ficheros y lo comprueba.** Cada brecha trae su detector, así que
**el día que cierres una desaparece sola del aviso** ---sin tocar el script, sin acordarte de
borrar nada---. Si algún día no sale ninguna, sale en verde y ya.

Sale con código 0 a propósito: **no rompe el despliegue**. Un despliegue que falla por un aviso
se desactiva el mismo día, y entonces el aviso no sirve para nada.

Si quieres verlo sin desplegar: `pnpm --filter backend db:brechas`.

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
| **EXPORT-UTC** | El Excel de leads va en UTC y la pantalla en Bogotá | `columnas-participante.tsx` |
| **LMS** | Nadie escribe el avance del aula | bloqueado fuera |
| **SENA** | Los retiros no viajan en el cargue | bloqueado fuera |

**Cuatro de las seis primeras son el mismo defecto de forma**, y por eso van juntas al final en
«el patrón».

**Y una que ya no está en la tabla porque está cerrada:** la columna `asesorAcademicoId` sin
nadie que la escribiera ---tu hallazgo del 25 de septiembre---. La puerta está hecha y probada;
el detalle, al final, en [ASESOR-ACADEMICO](#asesor-academico--la-columna-sin-escritores-cerrada).

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

## EXPORT-UTC · El Excel de leads va en UTC y la pantalla en Bogotá

**Encontrada por el cliente el 25 sep 2026, y llegó por la puerta de atrás:** creía que el
filtro «Hoy» de Control de inscritos estaba roto. No lo estaba. Lo que pasa es esto.

**Qué pasa.** La tabla de leads arma el archivo con `valor` y pinta la pantalla con `pinta`.
Hoy solo `pinta` traduce la hora:

```ts
valor: (f) => f.creadoEn,                      // al Excel: 2026-09-25T00:48:18.641Z
pinta: (f) => <span>{fechaHora(f.creadoEn)}</span>   // a la pantalla: 24 sep, 7:48 p. m.
```

**Cómo lo comprobé.** En `tabla.tsx`, la descarga se arma con `c.valor(f)` (línea 497). En
`columnas-participante.tsx`, `valor` devuelve `f.creadoEn` crudo. Y en el export que me pasó
el cliente, dos filas salen como `2026-09-25T00:48Z` ---que en Bogotá son las 7:48 p. m. del
24---.

**Lo que cuesta.** Cinco horas de desfase, todos los días. Todo lead que entre **entre las 7
de la noche y medianoche** sale en el Excel con la fecha del día siguiente. Cualquier conteo
por día, corte de mes o informe armado desde ese archivo trae esas filas corridas un día. Y
quien compare el Excel con la pantalla concluye que una de las dos miente ---que es
exactamente lo que pasó---.

**Arreglo.** Que `valor` devuelva la fecha de Bogotá ya formateada («2026-09-24 19:48») en vez
de la cruda. En ese formato sigue ordenándose bien, porque va de año a minuto. Y son **todas**
las columnas de fecha de esa tabla ---creación, última actividad, último contacto---, no solo
la de creación.

### De paso, lo que NO es una brecha pero conviene saber

El cliente esperaba que «Hoy» le enseñara **el trabajo del día**. No lo hace, y está escrito
así a propósito: la ventana de Control de inscritos solo conoce dos fechas ---cuándo llegó el
lead y cuándo se inscribió por primera vez---. **Las gestiones no entran en la ventana.** El
equipo puede llamar a cincuenta personas hoy y esa pantalla no se mueve.

No es un fallo: es que **no hay ninguna vista que conteste «qué hizo el equipo hoy»**. Si se
decide hacerla, es una vista nueva que corte por la fecha de la gestión, no un ajuste del
periodo de esta.

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

---

## ASESOR-ACADEMICO · la columna sin escritores: **cerrada**

**Tu hallazgo, y era bueno.** «`asesorAcademicoId` tiene cero escritores: ni backend ni panel.»
Lo comprobé en la base de pruebas antes de tocar nada: **120 grupos, 0 con asesor**. Mi propio
paso de QA sobre esa pestaña había leído «filas: 1» y no me pregunté por qué era una.

Era una porque `repartirAcademicos` mete a todo el que no tiene asesor bajo la llave
`SIN_ASESOR`, así que la pantalla enseñaba **una sola fila, «Sin asesor asignado»**, con los
mil y pico participantes dentro. Se lee como un dato y no como lo que era: que la asignación
no existía.

**Qué construí** (es de la pantalla que entregué yo, así que la hice yo):

| Dónde | Qué |
|---|---|
| `cronograma/dto.ts` | `asesorAcademicoId?: string \| null` en `ActualizarGrupoDto`. Sin mandarlo no se toca; `null` suelta el grupo |
| `cronograma.service.ts` | `actualizarGrupo` lo escribe, **tras comprobarlo**; `listar` devuelve `asesorAcademicoId`, el nombre y el `convenioId` de la acción |
| `cronograma.service.ts` | `asesoresPosibles(ambito)`: las cuentas que pueden llevar grupos, una fila por persona con sus gremios |
| `cronograma.controller.ts` | `GET admin/cronograma/asesores`, con `@Requiere('configuracion', 'ESCRIBIR')` |
| `cronograma-vista.tsx` | El desplegable en la ficha del grupo. El botón pasa de «Editar fechas» a «Editar grupo» |
| `panel-asesores.tsx` | Cuando nadie tiene grupo asignado, la pestaña lo **dice** y enlaza a donde se arregla |

**La decisión que te quiero señalar, porque es la que puede morder.** El asesor se comprueba
**contra el gremio del grupo**, no contra el ámbito de quien edita:

```ts
where: {
  adminId: dto.asesorAcademicoId,
  convenioId: grupo.accionFormacion.convenioId,   // ← el del GRUPO
  rol: { in: ROLES_ACADEMICOS },
  admin: { activo: true },
}
```

Son dos cosas distintas y confundirlas es el defecto. Un líder de sistemas ve los dos gremios;
sin esta línea podría poner de asesor de un grupo de ADECOPRIA a alguien que solo responde por
BRITCHAM ---y que no puede ni entrar a lo que se le asignó---.

`ROLES_ACADEMICOS` son **tres**: `GESTOR_ACADEMICO`, `LIDER_ACADEMICO`, `LIDER_SISTEMAS`. Van
escritos a mano y no calculados sobre `PERMISOS`, porque asignar un grupo es una decisión de
negocio: el día que un rol nuevo escriba en «académico», que alguien decida aparte si además
debe poder llevar grupos. **`COUNTRY_MANAGER` queda fuera a propósito**: su permiso ahí es de
ver. Hay una prueba que lo fija, para que nadie lo añada sin pensarlo.

**Comprobado en el navegador, no solo con `tsc`:**

- BRITCHAM ADEE ofrece 6 candidatos; ADECOPRIA ofrece 4 (Carlos Mesa y Héctor Ramos fuera, que
  es correcto: solo son académicos en el otro gremio).
- Asignar → la ficha lo enseña → Seguimiento de asesores lo recoge y el aviso desaparece.
- Soltar → vuelve a cero, sin rastro.
- **Y por la API, saltándose el desplegable**: `PATCH` con una cuenta del otro gremio contesta
  `400` con el motivo. El desplegable filtra; el servidor no se fía de él.

**Lo que NO hice, y es tuyo:** nadie tiene grupos asignados todavía. La puerta está; quién
lleva cada grupo es una decisión de Mauricio y Diana, no mía. Mientras no se haga, la pestaña
lo dice en pantalla en vez de fingir un dato.

Pruebas nuevas: `backend/src/cronograma/asesor-del-grupo.spec.ts`, 7 casos.

---

## Lo que pasa a tu mesa · **tú indicas y ordenas**

«Bótale lo mío a José, que él indique y ordene qué hacer» (Mauricio, 25 sep 2026).

Son las cuatro cosas que estaban esperando una decisión suya. **Las pasa a ti para que las
priorices y digas qué se hace.** De cada una dejo el estado real comprobado, lo que hace falta
decidir y mi propuesta, para que puedas contestar con un sí o un no en vez de reabrir el tema.

### M-1 · Quién lleva cada grupo

**Estado:** la puerta está hecha (`3b5fb93`) y probada. En la base de pruebas, **120 grupos y
0 asignados**. En producción, presumiblemente igual: la columna nunca tuvo escritores.

**Lo que hay que decidir:** no nombres sueltos, sino **la regla**. Mi propuesta, para aprobar o
cambiar: *cada gremio reparte sus grupos entre sus cuentas con rol `GESTOR_ACADEMICO`; donde no
haya gestor, lo lleva el `LIDER_ACADEMICO`.* Con eso se puede sembrar el reparto de una vez y
después se corrige a mano el que haga falta.

**Y una pregunta de trabajo que es tuya:** asignarlos **uno por uno son 120 fichas**. Si dices
que sí, hago la asignación masiva ---elegir varios grupos de una acción y ponerles el mismo
asesor---. Si prefieres sembrarlo con un guion y que el panel solo corrija, también. Tú ordenas
cuál de las dos.

### M-2 · «Hoy» en Control de inscritos: creo que no es un fallo

**Lo que él reportó:** «pongo hoy y dice que nada cuando no es así, ayer se cerró con 39».

**Lo que comprobé en el código, y por qué creo que la pantalla tiene razón:**

1. La ventana **se calcula en Bogotá**, no en UTC: `resolverVentana` arranca en
   `inicioDeDiaBogota(ahora)` (`crm/ventana.ts`). Ahí no hay desfase.
2. Con ventana, `enPeriodo` corta sobre `PRIMERA_MATRICULA`: cuenta **a quién se matriculó
   dentro del periodo**, no el acumulado hasta hoy. «Hoy» son los de hoy, no el total.
3. Y `PRIMERA_MATRICULA` se ancla en llegar a `INSCRITO`. Un lead que entró hoy y sigue en
   `DATOS_COMPLETOS` **sube el total de leads y no cuenta como inscrito de hoy**.

Así que «39 ayer y más hoy, pero Hoy dice cero» encaja perfectamente con que los nuevos todavía
no estén matriculados. **Son dos números distintos leídos como si fueran el mismo.**

**Lo que no puedo cerrar yo:** él nunca mandó la captura, y sin ella no sé cuál de los dos
números miraba. Esto lo zanjas tú en producción en un minuto:

```sql
-- inscritos de HOY en Bogotá, con el mismo criterio de la pantalla
SELECT count(*) FROM participantes p
  JOIN LATERAL (
    SELECT MIN(m."creadoEn") momento FROM movimientos_participante m
     WHERE m."participanteId" = p.id
       AND m."etapaDespues" = 'INSCRITO'::"EtapaParticipante"
  ) an ON true
 WHERE an.momento >= date_trunc('day', now() AT TIME ZONE 'America/Bogota')
                     AT TIME ZONE 'America/Bogota';

-- leads creados HOY, que es el otro número
SELECT count(*) FROM participantes
 WHERE "creadoEn" >= date_trunc('day', now() AT TIME ZONE 'America/Bogota')
                     AT TIME ZONE 'America/Bogota';
```

Si los dos dan distinto y la pantalla enseña el primero, **no hay fallo: hay que cambiar el
rótulo.** Mi propuesta: que el desplegable diga «Inscritos hoy» y no «Hoy» a secas. Si dan
igual y la pantalla sigue en cero, entonces sí es un fallo y me lo devuelves.

### M-3 · La hoja «Organización» del segundo plano

Él tiene dos archivos de cargue. **El primero sube tal cual.** Al segundo le falta la hoja
*Organización* ---NIT, razón social y jefe---, y por eso no entra.

**Lo que hay que decidir:** si esos datos los pide él a la institución, o si el cargue debe
poder entrar sin ellos y completarse después desde el CRM. Hoy el validador los exige.

### M-4 · Los dos correos que destraban el aula y los retiros

Están escritos y listos para copiar en [`CORREOS-PARA-DESTRABAR.md`](CORREOS-PARA-DESTRABAR.md):
uno al proveedor del LMS ---pidiendo el avance de cada participante--- y otro al SENA ---qué
valor va en `ESTADO` para un retiro---.

Son las **dos únicas cosas del proyecto que no avanzan por más que trabajemos**, y las dos se
destraban con un correo. **Lo que hay que decidir es quién los manda**, porque llevan días
escritos y sin salir.

---

## Estado del despliegue, comprobado --- 25 sep 2026, 16:19 Bogotá

No es un reproche, es para que partamos del mismo sitio:

| Dónde | Qué hay |
|---|---|
| `origin/dev` · `origin/pruebas` | `f300062`, del 24 sep. **No se han movido** |
| `origin/main` | `66bb264`, del 22 sep |
| `prueba.reservasae.com` | Vivo, `0.10.4-JD-prueba`. `GET /api/admin/cronograma` → 401 (existe); **`/api/admin/cronograma/asesores` → 404** |

O sea: **`3b5fb93` no está en pruebas todavía**, y el merge de producción a `dev` que hiciste en
tu máquina no está en el remoto. Lo digo porque yo parto de `dev`: en cuanto lo subas rebaso y
te aviso.
