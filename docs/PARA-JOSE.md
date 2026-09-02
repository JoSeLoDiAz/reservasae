# Para José — lo que hay que hacer

**Una sola lista.** Solo está aquí lo que **no puedo hacer yo**: ejecutar migraciones, y
decisiones o datos que solo tú tienes. Todo lo demás ya está hecho y commiteado.

Rama: `arq/crm-hardening`, también en `dev-mauricio`.
Estado hoy: **`tsc` limpio en backend y frontend · 1047 pruebas en 96 suites, verde.**

---

## Parte 1 · Aplicar migraciones (4 pasos)

Están escritas, con SQL, rollback y verificación, en
[`docs/arquitectura/migraciones-propuestas/`](arquitectura/migraciones-propuestas/).

**No están en `backend/prisma/migrations/` a propósito**: ahí el arranque del contenedor las
ejecutaría solas. Se mueven a mano, una a una.

### El procedimiento, igual para todas

```
1. Mover el .sql a backend/prisma/migrations/<nombre>/migration.sql
2. Aplicar el cambio de schema.prisma EN LA MISMA ENTREGA
   (si no, el siguiente `migrate dev` ve drift y genera la migración que las tira)
3. Correr la VERIFICACIÓN PREVIA que trae el fichero. Si no da lo que dice, no desplegar.
4. Desplegar.
5. Correr la VERIFICACIÓN POSTERIOR. Si no cuadra, revertir con el rollback del fichero.
```

> ⚠️ **Antes de nada, renumerar.** Las mías empiezan en `20260831090000` y tú ya metiste
> `20260831230000_lead_con_su_accion` y `20260901180000_lead_con_su_ubicacion`. Prisma aplica
> por orden alfabético: hay que ponerles fecha posterior a la tuya más reciente.

### 1.1 · La que más rinde, y ya puedes

**`09-…_lead_por_participante_deja_de_ser_unico.sql`**

Quita el `participanteId String? @unique` de `LeadEntrante` (`schema.prisma:820`).

**Por qué importa, y por qué ahora es más urgente que antes:** tu `llave-del-lead.ts` mete el
código del curso en la llave **a propósito**, para que la misma persona pida AF1 y después AF2.
Esas dos filas cruzan **FIRME** contra la misma ficha, y **la segunda viola el único** → P2002 →
**500 crudo**, porque no hay `ExceptionFilter`.

Y se autooculta: el reintento entra por la guarda de idempotencia y contesta **200 con
`repetido: true`**. El emisor cree que quedó bien. El lead queda PENDIENTE para siempre.

**Su único requisito de código —el ramificado por `firme`— lo pusiste tú ayer.** Ya está.

> Las 1047 pruebas no pueden ver esto: `solo-lo-firme-ata.spec.ts:31-37` falsea
> `leadEntrante.update` con un `push` a un array, y ahí no hay índice único. No es un fallo del
> spec: es que este tipo de bug necesita base real.

### 1.2 · La bitácora (dos ficheros, en este orden)

**`01-…_bitacora_de_cambios.sql`** → la tabla y las funciones. Segura.
**`02-…_bitacora_colgar_en_las_tablas.sql`** → los 43 triggers.

De estas dependen **cuatro problemas graves**. Sin ellas, escribir por SQL directo no deja
rastro y la bitácora se puede vaciar.

> ⚠️ **La 02 necesita ventana tranquila.** Toma `ACCESS EXCLUSIVE` sobre las 43 tablas y
> **los acumula hasta el `COMMIT`** — no es "un instante", como decía mi documento anterior;
> me corrijo. Con una transacción larga abierta, espera; y **si alguien la mata a medias**,
> Prisma deja la fila sin `finished_at`, el siguiente arranque da **P3009** y con `set -e` eso
> sí es ciclo de reinicios. Corre antes la verificación previa que trae el fichero.

**Y una decisión que es tuya**, no mía: a partir de la 02 la bitácora es **`fail-closed`** —un
fallo al apuntar tumba la escritura del usuario—. Eso es **lo contrario** de lo que hay hoy:
`AuditoriaService.registrar()` es `fail-open` a propósito y su comentario explica por qué.
Si prefieres mantener `fail-open`, dilo y ajusto el trigger.

### 1.3 · Las nueve restantes

Cupos, papelera, hold con TTL. Cada una con su ficha. **Ninguna corre riesgo de tumbar el
arranque salvo la 11**, que va marcada y detrás de un paso manual — y que, si prefieres, **se
puede no poner**: lo que resuelve ya lo cierra la 08.

---

## Parte 2 · Tres preguntas que solo tú puedes contestar

### 2.1 · 🔴 ¿Dónde se pone `sepProyectoId`?

**El cargue al SEP no se puede generar. Ninguno.**

`sep.service.ts:368` aborta si `convenio.sepProyectoId` es `null` — *"Póngalo en Formación antes
de exportar"*. **Ese campo no se puede escribir en ningún sitio**: no hay pantalla, ni ruta, ni
seed que lo ponga.

Es el entregable contractual con el SENA. Si esto lleva así desde el principio, alguien lo está
haciendo por fuera; si no, es que nunca se ha entregado.

**Es la pregunta que más rinde de todo el documento.**

### 2.2 · ¿Qué valores admite la columna `ESTADO` del cargue?

Hoy `formato-cargue-sep.ts:171` escribe `'ACTIVO'` **a fuego**, y `sep.service.ts:188` filtra
por `ETAPAS_DEL_REPORTE`, que no incluye las cuatro salidas del aula.

Resultado: **cuando alguien se retira, su fila desaparece del siguiente cargue**. Al SENA le
consta que estaba activo y después se evapora. Desde fuera es indistinguible de un error nuestro.

**La columna `ESTADO` ya existe en el formato.** Si el SENA admite un `RETIRADO` o equivalente,
avisar del retiro **no exige tocar ni un título ni una prueba**.

### 2.3 · Cuatro más del SENA, del mismo bloque

- ¿Existe ya un formato oficial para reportar retiros? Si sí, mi borrador se tira y se copian
  sus columnas.
- ¿El motivo va como texto libre o como causal de lista cerrada?
- ¿Exigen **horas efectivamente cursadas**? Si sí, **no es trabajo de formato: es un módulo de
  asistencia que no existe**.
- ¿Piden soporte firmado? La ficha no admite adjuntos de ningún tipo.

---

## Parte 3 · Cosas de tu código, cortas

Ninguna es grave. Las hago yo si prefieres, pero son tuyas y las conoces mejor.

| Qué | Dónde | Por qué |
|---|---|---|
| El `estado` del filtro llega al `where` sin validar, con `as never` | `mesa-de-entrada.controller.ts:50` | El resto del panel usa `@IsEnum` |
| El texto crudo de la excepción sale al cliente | `lote.service.ts:158` | Con la base caída, el mensaje de Prisma incluye el host |
| La conversión no es atómica: tres transacciones | `conversion.service.ts:232` | Si corta en medio, queda ficha creada y lead `PENDIENTE` |
| El lote no crea `CargaDeParticipantes` ni pone `cargaId` | `lote.service.ts:117` | El cargue de participantes sí lo hace, para saber qué pasó si se cae a la mitad |
| La mesa pagina en el servidor y no en la pantalla | `frontend/.../mesa/page.tsx:235` | Con más de 50 leads, los demás son inalcanzables |
| La mesa enseña el filtro `DESCARTADO` y nadie escribe ese estado | enum vs `backend/src` | Un contador que siempre dice 0 enseña a desconfiar de la pantalla |
| Al asesor se le dice "confirme antes de unirlos" y no se le da con qué | `leads.service.ts` + mesa | El motivo no nombra a la otra persona, y no hay ruta que ate el lead tras confirmar |

---

## Lo que ya está hecho, para que no lo busques

Cuatro commits en la rama, cada uno con su prueba y **comprobado que falla sin el arreglo**:

| Commit | Qué |
|---|---|
| `e90a185` | `PATCH /admin/leads/:id` normaliza el documento. Era la octava puerta y la única que no lo hacía — el mismo agujero que cerraste en preinscripción |
| `bb3cba7` | La coincidencia floja ya no escribe en la ficha ajena. Tu `if (firme)` cubría el `update`; las tres escrituras siguientes corrían igual |
| `9229f98` | La mesa dice `CC` y no `1` |
| `a9bc9fd` | Crear una ficha emite `PARTICIPANTE_CREADO`. Estaba en el catálogo y no lo emitía nadie, por ninguna de las cuatro puertas |

**Y retiro una pega que puse yo:** dije que la mesa devolvía la cédula en claro y había que
taparla. Me equivoqué. `taparDocumento` se escribió **para los logs** —lo dice su propio
comentario— y el listado de participantes devuelve la cédula entera igual. Además la mesa
**busca por documento**: taparlo dejaría al asesor sin comprobar lo que acaba de buscar.

---

## Y una cosa que no es una tarea

Tres de los cuatro arreglos de arriba son cosas que **tú ya habías arreglado en otro sitio** y
que se colaron otra vez por una puerta nueva. No es descuido: es que el sistema tiene ocho
puertas que escriben un documento y ninguna barrera que las obligue a todas.

Por eso la Fase 2 propone la capa 3 —un `CHECK` en la base— y no solo la llamada correcta en
cada servicio. **Es la diferencia entre una convención y una garantía.** Está en
[`borradores/llave-de-identidad-y-lms.md`](arquitectura/borradores/llave-de-identidad-y-lms.md),
con el aviso de que hay que limpiar los datos antes.
