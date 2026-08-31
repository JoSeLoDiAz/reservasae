# 03 · Plan de migración

**Fase 3. Solo lectura: no se modificó ni una línea de código de producción, y no se ejecutó
ninguna migración.**

| | |
|---|---|
| Método | 3 bloqueantes resueltos → 2 planes en paralelo → conciliación → **una auditoría por migración** |
| Coste | 20 agentes, 0 fallos |
| Resultado | **12 migraciones en 5 despliegues**, 13 descartadas |
| Auditoría individual | **10 seguras de 12** · **12 de 12 con rollback ejecutable** |

> ⚠️ **Las migraciones NO están en `backend/prisma/migrations/`, y es a propósito.**
> Allí el arranque del contenedor las ejecutaría solas (`arrancar.sh:29`). Viven en
> [`migraciones-propuestas/`](migraciones-propuestas/) y se mueven **a mano**, una a una,
> después de revisarlas y de correr su verificación previa.

---

## 1 · Los tres bloqueantes, resueltos

### `propuestas_de_datos` — gana `REEMPLAZADA`

Los dos documentos de Fase 2 se contradecían. **Gana el valor de enum**, y el razonamiento es
lo mejor de esta fase porque **no aplicó la regla como dogma, aplicó su prueba**:

> El [ADR 0012](../adr/0012-el-enum-estadoreserva-se-queda-en-tres.md) fija el test antes de
> añadir un valor a un enum: contar los predicados que preguntan *"¿no es X?"* y los mapas
> exhaustivos del frontend. Para `EstadoReserva` dieron **22 y 3**, y por eso se rechazó.
> **Para `EstadoPropuesta` dan 1 y 0.**

Y la razón decisiva es de modo de fallo, no de elegancia: los cinco lectores **ya filtran en
positivo** por `estado: 'PENDIENTE'`, así que con `REEMPLAZADA` la fila retirada deja de casar
**sin tocar una línea**. Con `archivadoEn` habría que editar los cinco, y **olvidar uno queda
enmascarado** — los dos lectores del CRM ordenan por `creadoEn desc`, así que seguirían
devolviendo la más nueva y el fallo solo se vería el día en que la más nueva es la archivada.

**Lo que cuesta deshacerla, dicho sin adornos:** Postgres no sabe quitar un valor de un enum.

### El TTL del hold — `Convenio.diasDeReserva`, por defecto 15 días

Y una distinción que importa: **la columna no es el interruptor**. Las migraciones dejan el
parámetro y las columnas puestas y **no encienden nada**. El interruptor es la variable de
entorno del proceso que caduca, siguiendo el patrón de los tres workers de la casa — y no el de
`Matricula` y `VigiaDeCupos`, que arrancan siempre y por eso se duplican entre sedes.

### "Administrador" — significa `LIDER_SISTEMAS`

No `SUPERADMIN`. Las dos rutas de escritura del cronograma **se quedan exactamente como
están**, y se retira la propuesta de Fase 2 de añadirles `@Roles(SUPERADMIN)` — que le habría
quitado el calendario a gente que hoy lo necesita.

Lo que se abre en su lugar es **el agujero real: E-01, mover una fecha hoy no deja rastro.**

---

## 2 · Las 12 migraciones, en 5 despliegues

| # | Despliegue | Migración | Arregla | Auditoría |
|---|---|---|---|---|
| 1 | 1 | `bitacora_de_cambios` | C-01, C-06, C-14 · INV-3 | ✅ segura |
| 2 | 1 | `bitacora_colgar_en_las_tablas` | ídem, los 43 triggers | ⚠️ **espera candados** |
| 3 | 1 | `lead_apunta_a_la_persona` | INV-7 | ✅ segura |
| 4 | 1 | `dias_de_reserva_del_convenio` | F-01 | ✅ segura |
| 5 | 1 | `vencimiento_de_la_reserva` | F-01 | ✅ segura |
| 6 | 1 | `topes_de_cobertura_y_vistas_de_descuadre` | G-05, INV-4 | ✅ segura |
| 7 | 2 | `unicos_parciales_de_formulario` | D-04 | ✅ segura · **0 pegas** |
| 8 | 2 | `estado_propuesta_reemplazada` | A-04, INV-1 | ✅ segura |
| 9 | 3 | `lead_por_participante_deja_de_ser_unico` | **A-03** | ✅ segura |
| 10 | 4 | `avisos_entrantes` | INV-6 | ✅ segura |
| 11 | 4 | `una_propuesta_pendiente_por_ficha` | D-04 | 🔴 **NO se despliega tal cual** |
| 12 | 5 | `lead_convertido_con_ficha` | INV-7 | ✅ segura |

---

## 3 · Las dos que no son seguras

### ⚠️ #2 · Colgar los 43 triggers — puede quedarse esperando

No puede fallar por un dato: es `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, 43 veces, y no
toca ni una fila. **Su riesgo es otro, y es el mismo que tumba un despliegue.**

Prisma corre cada fichero en **una** transacción, así que los 43 `ACCESS EXCLUSIVE` **se
acumulan** y se retienen hasta el `COMMIT`.

> **Corrección a Fase 2:** `02-patrones-transversales.md` dice que `CREATE TRIGGER` toma el
> candado *"sobre cada tabla un instante"*. **No es un instante.** Se acumulan.

Y el peligro no es la espera: **es que alguien la mate**. Prisma deja la fila sin `finished_at`,
el siguiente arranque da **P3009**, y con `set -e` eso sí es el ciclo de reinicios — del que
solo se sale a mano.

Hay además un **riesgo de interbloqueo** que el auditor encontró y que no estaba escrito: el
bucle toma los candados en orden alfabético (`participantes` antes que `personas`) y una
transacción de la aplicación que los tome al revés se cruza con la migración.

**Paso manual previo:** ventana tranquila, y no desplegar hasta que la verificación previa
devuelva cero transacciones largas abiertas.

### 🔴 #11 · El índice único de propuestas — seis defectos concretos

El propio auditor lo dice: *"la migración está bien pensada y es honesta en lo grande, **pero
NO se despliega tal cual**"*.

1. **`PM-2` no se puede ejecutar**: referencia `docs/operacion/00-guardia-de-puerto.sql`, que
   **no existe**. `docs/operacion/` tiene un solo fichero.
2. **"Una transacción interactiva" no basta**, y ese era el paso 2 del plan.
   `leads.service.ts:371-382` **ya** corre dentro de `$transaction`, y aun así en `READ
   COMMITTED` dos entradas concurrentes de la misma ficha se cruzan.
3. **Falta la segunda puerta que devuelve 500.** El texto solo nombra `preinscripcion`, pero
   `avisarQueYaEstaba` se llama desde `entra`, que es **el webhook** — y ahí un 500 **rompe la
   regla 5**: Meta apaga el webhook.
4. No menciona el candado: `CREATE INDEX` sin `CONCURRENTLY` toma `SHARE` y **encola a todos
   los escritores nuevos** detrás.

**Y hay una salida más barata, que el propio conciliador propone:** este índice **se puede no
poner**. Es la única de las doce que puede dejar el contenedor en ciclo de reinicios, y el
problema que resuelve ya lo cierra la migración 8 más el cambio de código. Ponerlo es un
cinturón sobre unos tirantes que ya sujetan.

---

## 4 · El fallo sistemático que encontró la conciliación

Dos agentes escribieron el plan por separado y produjeron **dos juegos de 11 migraciones**.
Hubo que elegir uno, y la razón por la que ganó no fue el SQL:

> **Ninguno de los once rollbacks del juego B borra su fila de `_prisma_migrations`.**
>
> Deshacer el DDL y dejar la fila puesta significa que el siguiente `migrate deploy` **NO la
> vuelve a aplicar**. El contenedor arranca con un esquema que no es el que el código cree que
> hay — **y en silencio**.

Es el peor tipo de defecto: no falla al hacerlo, falla semanas después y sin síntoma. Los doce
del juego canónico sí la borran.

De B sobrevive **una migración entera** —el paso de la FK del lead a `Restrict`, que A no
escribió— y tres verificaciones que apuntan a ficheros que existen.

**13 descartadas**, cada una con su motivo escrito.

---

## 5 · Ocho decisiones abiertas

Las dos que más pesan:

1. **El tope de `diasDeReserva`.** Los dos agentes escribieron `CHECK (> 0)` por su cuenta.
   **Es la única discrepancia con la decisión escrita**, que traía su propio tope. Hay que
   elegir uno.
2. **El visto bueno para el `fail-closed` de la bitácora.** A partir del `COMMIT` de la
   migración 2, **un fallo al apuntar tumba la escritura del usuario** — que es lo contrario de
   la decisión vigente: `AuditoriaService.registrar()` es `fail-open` a propósito, y su
   comentario explica por qué. **Esto lo tiene que aprobar una persona**, porque cambia qué
   pasa cuando la auditoría falla.

Las otras seis están en el documento de cada migración.

---

## 6 · Cómo se despliega esto

**Nadie ejecuta nada de aquí sin leerlo antes.** El orden:

1. Mover el `.sql` de `migraciones-propuestas/` a `backend/prisma/migrations/<nombre>/migration.sql`.
2. **Aplicar el cambio de `schema.prisma` en la misma entrega.** Si el SQL añade columnas y el
   schema no las declara, el siguiente `migrate dev` ve *drift* y **genera la migración que las
   tira**.
3. Correr la **verificación previa**. Si no da lo que dice, no se despliega.
4. Desplegar.
5. Correr la **verificación posterior**. Si no cuadra, se revierte con el rollback del fichero.

**Y una regla que no cambia: las migraciones las ejecuta una persona.** Ningún agente, ningún
guion automático.

---

## Lo que sigue

**Fase 4 — pruebas.** Con un límite dicho de antemano: **aquí no hay base de datos**, así que
las pruebas de concurrencia se entregan **escritas y listas para correr**, y las ejecuta José.
Puedo garantizar que la prueba está bien construida; no que pase.

Se parte de [`backend/prisma/prueba-carga.ts`](../../backend/prisma/prueba-carga.ts), que ya
hace exactamente eso —avalancha real contra API y base— y comprueba ocho invariantes.
