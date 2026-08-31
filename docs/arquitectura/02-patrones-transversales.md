# 02 · Patrones transversales — SQL y justificación

**Fase 2. Solo lectura: no se modificó ni una línea de código de producción. Este documento
es SQL propuesto, no aplicado.**

Tercera versión. La primera se devolvió con `RECHAZAR Y DEVOLVER`: 12 choques y 19
correcciones. La segunda se devolvió con `DEVOLVER PARA ARREGLOS PUNTUALES`: cuatro vetos sin
cerrar, nueve choques nuevos y once correcciones. Esta parte de las tres tandas como
restricción de entrada, no como sugerencias.

---

## 0 · Qué cambió, choque por choque

La decisión que hace desaparecer nueve de los doce choques originales es una sola: **se retira
la extensión de Prisma**. No hay `exigirContexto`, no hay `enTransaccion(fn)`, no hay
`$extends`, no hay `AsyncLocalStorage`. El mecanismo de la Fase 2 es SQL en la base y nada
más. Nada de lo que sigue puede rechazar una escritura que hoy funciona, porque no hay nada
en el camino de escritura que pueda decir que no.

| # | Choque | Cómo queda resuelto |
|---|---|---|
| 1 | La extensión apagaba `AuditoriaService` y el `catch` de `auditoria.service.ts:132-134` lo ocultaba | No hay extensión. `registrar()` sigue haciendo su `create` suelto tal cual. La bitácora **convive**: responde otra pregunta y se lee aparte (§1.6) |
| 2 | `backend/src/crm/rui/`, fuera de alcance, con 9 escrituras sin transacción | No se edita ni un archivo de `rui/`. Un trigger sobre `consultas_rui` no toca código: la cola sigue funcionando igual y además queda auditada |
| 3 | `Matricula` y `VigiaDeCupos`, providers incondicionales | Siguen igual. `matricula.ts:88` (`$transaction([...])`) no necesita cambiar nada, y el §4.4 ya **no** les propone ningún candado: la propuesta anterior los apagaba y se retira |
| 4 | Archivar `admin_convenio` sin tocar `admin.guard.ts:120-123` era una regresión de permisos | `admin_convenio` **no se archiva** en esta fase. Verificado: `admin.guard.ts:120-123` lee `adminConvenio.findMany({ where: { adminId } })` sin filtro, y `admin.service.ts:279` sigue borrando dentro de la transacción de `:275`. Queda fuera hasta que exista el embudo de D-02 (§3.4) |
| 5 | Archivar respuestas al revivir una reserva dejaría dos juegos vivos | `respuestas` **no se archiva** en esta fase: sus lecturas están en cinco sitios y dos son tableros que las pintan todas (§3.4) |
| 6 | Archivar la última propuesta pendiente rompía «una pendiente por ficha» | **No se resuelve archivando, y por eso el archivado de `propuestas_de_datos` sale de esta fase.** El dedupe dejaba `estado='PENDIENTE'`, y los dos escritores borran por ese predicado sin mirar `archivadoEn` (`preinscripcion.service.ts:959-961`, `leads.service.ts:371-376`): la constancia archivada se borraba sola en el siguiente formulario. Lo que queda de pie es la regla «una pendiente por ficha», y va **con** el código que la hace atómica, no delante (§3.3) |
| 7 | El trigger deshacía el `omit` de `prisma.service.ts:8-9` metiendo los bytes del logo en JSONB | La bitácora **no guarda ningún valor de ninguna columna**. Solo nombres. Los bytes no llegan a escribirse en ninguna parte (§1.3) |
| 8 | La migración con GRANT/REVOKE dejaba sin arrancar al contenedor | **Cero `GRANT`, cero `REVOKE`, cero `CREATE ROLE` en `backend/prisma/migrations/`.** Todo eso vive en un guion de operación, con guarda `pg_roles` (§2.3) |
| 9 | El outbox reemplazaba `destinatarios_campana` sin decirlo | El outbox se retira entero. `destinatarios_campana` se conserva y se le añade una columna; lo que se propone nuevo es una bandeja de **entrada**, que no existe (§5) |
| 10 | Las `$transaction([...])` que la firma no admitía | No hay firma nueva. Ninguna de las 30 llamadas cambia |
| 11 | `NUNCA_SE_HISTORIA` de `clase-de-dato.ts:79-82` | Se respeta a fortiori: no se guarda el valor de **ninguna** columna, ni la cédula ni ninguna otra (§1.3) |
| 12 | Lo que sí respetaba y había que decir | Se mantiene: no se toca `sobrecupoPorId`/`sobrecupoMotivo`, no se toca `promoverListaDeEspera` (`reservas.service.ts:384-440`), no se añade ni un valor a ningún enum, `backend/src/crm/sep/` no se roza |

Y las 19 correcciones de la primera tanda: la 1, 2, 3, 4 y 13 caen con la extensión; la 5 en
§2.3; la 6, 7 y 8 en §1.3; la 9 en §1.4; la 10 en §1.7; la 11 en §1.5; la 12 en §1.2, §5.2 y
§5.3; la 14, 15 y 16 en §5; la 17 en §2.4; la 18 abajo; la 19 en §6.

### Qué cambió en la tercera vuelta

Seis cosas, y ninguna es un rediseño:

1. **`propuestas_de_datos` deja de archivarse en esta fase** (§3.3). El archivado se borraba
   solo, y además choca con el `REEMPLAZADA` del diseño hermano. **Decisión abierta.**
2. **Se retira el `pg_try_advisory_lock` del §4.4.** Es un candado de sesión sobre un pool:
   apagaba los dos workers incondicionales. Veto contra mí mismo.
3. **Todo objeto que este diseño crea lleva su bloque en `schema.prisma`** (§1.2, §5.2, §5.3),
   con la única salvedad —dicha, no escondida— de los índices parciales, que Prisma no sabe
   expresar.
4. **La toma de `destinatarios_campana` deja de descuadrar el presupuesto de reintentos**
   (§5.2), y el `RETURNING` recupera lo que la consulta de hoy trae.
5. **`avisos_entrantes.cuerpo` pasa de `JSONB` a texto** y su CHECK deja de rechazar el caso
   para el que existe la bandeja (§5.3).
6. **Los guiones de operación pasan por la guarda de puerto** de `guardia-de-base.ts` (§2.4).

### Corrección 18 — las erratas, y dos números que no me cuadran

Las rutas van completas donde el nombre es ambiguo: `backend/src/crm/clase-de-dato.ts`,
`backend/src/correo/campanas/campanas.service.ts`,
`backend/src/instituciones/web/web.service.ts`, `backend/src/crm/rui/rui.service.ts`,
`backend/arrancar.sh` (**no hay `arrancar.sh` en la raíz**; la versión anterior lo citaba sin
carpeta).

Dos discrepancias que declaro en vez de callar, porque la regla es citar:

- **Las `$transaction` con array son 17, no 20.** El censo, con el comando:
  ```
  grep -rn '\$transaction' backend/src --include=*.ts | grep -v spec   →  31 líneas
  ```
  De esas 31, una es el doble de pruebas `backend/src/instituciones/web/harness.ts:95`.
  Quedan **30 reales**: **13 interactivas** (`admin/admin.service.ts:275`;
  `crm/crm.service.ts:990,1749,2252`; `cronograma/cronograma.service.ts:224`;
  `formularios/formularios.service.ts:354`; `instituciones/web/web.service.ts:295`;
  `leads/leads.service.ts:338`; `politicas/politicas.service.ts:111`;
  `reservas/reservas.service.ts:73,162,227`; `tableros/tableros.service.ts:1150`) y **17 con
  array** — exactamente las 17 que enumera la corrección 4. El razonamiento del veto es
  correcto y el número de la cabecera no cuadra con su propia lista. No cambia nada del
  diseño: la forma array no tiene `tx`, y por eso no se le pide nada.

- **`Oferta.cuposOcupados` suma `cuposConfirmados`, no `cuposSolicitados`.** El §6 de Fase 0
  dice lo segundo. El código dice lo primero: `reservas.service.ts:100` mueve `confirmados`,
  `:186` mueve `confirmados - reserva.cuposConfirmados`, `:237` mueve
  `-reserva.cuposConfirmados` y `:437` mueve `promovidos`. Y la prueba de carga lo fija:
  `backend/prisma/prueba-carga.ts:136-144` compara el contador contra
  `SUM(cuposConfirmados)`. Importa porque la vista de reconciliación del §4.2 se escribe con
  ese invariante y no con el otro.

---

## 1 · Patrón 1 — Bitácora de cambios por trigger

**Ataca:** C-01, C-14 (14 de 71 escrituras auditan), E-01 (el cronograma no registra nada).
**Invariante:** INV-3.

### 1.1 La idea, en una frase

Hay tres preguntas y ya hay dos tablas para dos de ellas. Esta añade la tercera, y no sustituye
a ninguna.

| Tabla | Pregunta | Quién la escribe | Qué guarda |
|---|---|---|---|
| `registros_auditoria` | **por qué** pasó, en palabras | `AuditoriaService.registrar()`, 13 llamadas | actor, acción del catálogo, resumen, campos tocados |
| `valores_anteriores` | **qué decía** el dato | `crm.service.ts:1277`, `preinscripcion.service.ts:1160` | el valor viejo, según `CLASE_POR_CAMPO` |
| **`bitacora_cambios`** *(nueva)* | **qué se tocó** y cuándo | la base, sola | tabla, fila, operación, nombres de columna. **Ningún valor** |

Las 13 llamadas, con su comando:
`grep -rn "\.registrar(" backend/src --include=*.ts | grep -v spec` → 14 líneas, y una de ellas
es `preinscripcion.controller.ts:28`, que llama a otro método con el mismo nombre. **Son 13.**
C-14 cuenta 14 *escrituras de negocio* auditadas de 71, que no es lo mismo que 13 llamadas: una
llamada puede cubrir varias escrituras.

La bitácora es la única de las tres que no se puede olvidar de llamar, y la única que ve las 9
escrituras de `rui/` y todo lo que ningún `registrar()` cubre. **Lo que no ve nadie hoy no son
escrituras en SQL crudo contra `"participantes"`: esas 28 líneas son todas de lectura**
—comprobado, ninguna es `INSERT`, `UPDATE` ni `DELETE`— y son el problema del §3.1, no de este
patrón.

Y no le quita trabajo a ninguna de las otras dos. `registros_auditoria` sigue siendo el sitio
donde vive el «por qué»; `valores_anteriores` sigue siendo el **único** sitio donde vive un
valor viejo, con la política de `clase-de-dato.ts` intacta.

### 1.2 La tabla — y cómo escribirla sin que derive

La corrección 12 tiene razón: `id BIGINT GENERATED ALWAYS AS IDENTITY` frente a
`@default(autoincrement())` es una migración correctora esperando a que alguien corra
`prisma migrate dev`. La defensa aquí es **no tener ningún `DEFAULT` que pueda no coincidir**.
Todos los valores los pone el trigger.

**Y la regla vale para todo lo que este diseño crea, no solo para esta tabla.** `CLAUDE.md:3200-3201`
la deja escrita con su incidente: *«si se crea un índice en SQL, se declara en el schema. Prisma
reconcilia contra el schema, no contra lo que hay en la base»*. Con columnas y tablas es peor
que con índices, porque Prisma **sí** las modela y el siguiente `migrate dev` no propone un
`DROP INDEX` inocuo sino un `DROP COLUMN` o un `DROP TABLE`. Por eso llevan bloque de modelo:
`bitacora_cambios` (aquí), `destinatarios_campana.tomadaEn` (§5.2) y `avisos_entrantes` entera
(§5.3).

**La salvedad, dicha y no escondida: los índices parciales no se pueden declarar.** Prisma no
sabe expresar `WHERE` en un índice, y el único precedente de la casa lo confirma:
`politicas_datos_una_vigente` (`migrations/20260814120000_politica_por_destinatario/migration.sql:19-21`)
vive **solo** en SQL, y el modelo `PoliticaDatos` no lo menciona. Igual que los `CHECK`, que
`CLAUDE.md:3204-3206` acepta expresamente que vayan a mano. Los tres parciales que este diseño
crea —`destinatarios_campana_por_tomar`, `avisos_entrantes_una_vez` y `avisos_entrantes_por_tomar`—
quedan invisibles para Prisma, y lo que aplica entonces es la segunda mitad de la regla
(`CLAUDE.md:3202-3203`): **si `migrate dev` propone un `DROP INDEX` que nadie pidió, es esto; no
lo deje pasar.**

El modelo, en `backend/prisma/schema.prisma`:

```prisma
/// Qué se tocó, lo pone la base y no el programa.
///
/// No sustituye a `RegistroAuditoria` —eso cuenta POR QUÉ, en
/// palabras— ni a `ValorAnterior` —eso cuenta QUÉ DECÍA—. Esta
/// cuenta QUÉ SE TOCÓ, y es la única que no depende de que
/// alguien se acuerde de llamarla.
///
/// Aquí NO va el valor de ninguna columna, de ninguna tabla,
/// nunca. Solo nombres. Una segunda copia de datos personales
/// es la copia que nadie se acuerda de proteger, y esta tabla
/// no se puede podar desde la aplicación.
model BitacoraCambio {
  /// Sin `@default`: lo pone el trigger. Un default aquí es un
  /// sitio por donde el SQL y el modelo pueden separarse.
  id String @id

  tabla     String
  filaId    String?
  operacion String

  /// Nombres de columna. Vacío en INSERT y en DELETE.
  camposTocados String[]

  /// La transacción de Postgres. Une lo que pasó de una vez.
  txId BigInt

  /// Nulos mientras nadie los ponga, y es correcto que lo
  /// sean: un worker no es una persona.
  origen String?
  actor  String?

  ocurrioEn DateTime

  @@index([tabla, filaId, ocurrioEn])
  @@index([ocurrioEn])
  @@index([txId])
  @@map("bitacora_cambios")
}
```

Y el SQL. **Este bloque se genera con `pnpm exec prisma migrate dev --create-only`** y luego se
le añaden a mano los comentarios y el trigger; no se teclea. Lo de abajo es lo que debe salir,
escrito con el estilo de la casa (`migrations/20260828140000_historico_de_valores/migration.sql:19-42`):

```sql
-- backend/prisma/migrations/2026XXXXXXXXXX_bitacora_de_cambios/migration.sql

CREATE TABLE "bitacora_cambios" (
    "id"            TEXT NOT NULL,

    "tabla"         TEXT NOT NULL,
    "filaId"        TEXT,
    "operacion"     TEXT NOT NULL,

    -- Nombres de columna. NUNCA valores.
    "camposTocados" TEXT[],

    "txId"          BIGINT NOT NULL,
    "origen"        TEXT,
    "actor"         TEXT,
    "ocurrioEn"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bitacora_cambios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bitacora_cambios_tabla_filaId_ocurrioEn_idx"
    ON "bitacora_cambios"("tabla", "filaId", "ocurrioEn");
CREATE INDEX "bitacora_cambios_ocurrioEn_idx" ON "bitacora_cambios"("ocurrioEn");
CREATE INDEX "bitacora_cambios_txId_idx"      ON "bitacora_cambios"("txId");
```

`TEXT[]` sin `NOT NULL` y sin `DEFAULT` es exactamente lo que Prisma emite para `String[]` sin
`@default([])`: se comprueba en
`migrations/20260823064205_crm_canales_rui_y_auditoria/migration.sql:64`
(`"camposTocados" TEXT[],`), que es la columna homónima de `registros_auditoria`. Y
`TIMESTAMP(3)` sin default es lo que emite para `DateTime` sin `@default(now())`.

### 1.3 El trigger — y por qué no guarda valores

Esta es la corrección más importante de las 19, y va junta con las 6, 7 y 8.

`backend/src/crm/clase-de-dato.ts:79-82` dice, con su motivo escrito en `:75-78`:

```ts
export const NUNCA_SE_HISTORIA = [
  'numeroDocumento',
  'tipoDocumentoSepId',
] as const;
```

Y `clase-de-dato.ts:3-10` dice para qué existe el archivo entero: *«guardar valores viejos crea
una segunda copia de datos personales, y es la copia que nadie se acuerda de proteger»*.

La versión rechazada guardaba `to_jsonb(OLD)` en un DELETE. Sobre `personas`, cuyas columnas
`tipoDocumentoSepId` y `numeroDocumento` son `schema.prisma:801-802`. Es decir: **borrar los
datos de una persona era lo que creaba la copia permanente de su cédula.**

La corrección propuesta por el veto era declarar columnas ocultas tabla por tabla. Hago algo
más fuerte y más simple de auditar: **la bitácora no guarda el valor de ninguna columna de
ninguna tabla.** No hay lista de ocultas que mantener, no hay tabla nueva que se pueda
configurar mal, y una tabla nueva no empieza a copiar datos personales porque alguien la añadió
— exactamente la propiedad de «lista blanca que falla cerrada» que `CLASE_POR_CAMPO` ya tiene.

Lo que se pierde es el «qué decía antes». No se pierde: eso es `valores_anteriores`, que ya
existe, ya está gobernado por `CLASE_POR_CAMPO` y ya guarda `NULL` para lo `SENSIBLE`
(`schema.prisma:1894-1899`). **Convivir, no sustituir**, también vale para esa tabla.

```sql
-- ¿Qué se tocó? Lo apunta la base, no el programa.
--
-- NUNCA exige contexto. Si `app.actor` no está puesto, la fila
-- se escribe igual con actor NULL. Un mecanismo de auditoría
-- que puede rechazar la escritura que audita se convierte, el
-- día que falla, en un sistema que no escribe: eso es lo que
-- se devolvió en la primera pasada.
--
-- SECURITY DEFINER a propósito: es lo que permite que mañana
-- el rol de la aplicación NO tenga permiso de escritura
-- directa sobre esta tabla y aun así la bitácora se llene.
-- Ver §2.
CREATE OR REPLACE FUNCTION "bitacora_apuntar"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_antes   jsonb;
  v_despues jsonb;
  v_campos  text[];
  v_fila    text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- `actualizadoEn` es la ÚNICA columna que se ignora, y es
    -- porque `@updatedAt` la mueve en cada escritura del ORM:
    -- sin quitarla, un UPDATE que no cambia nada dejaría una
    -- fila igual.
    --
    -- `version` NO se ignora, y no es un olvido. `PoliticaDatos
    -- .version` (schema.prisma:1085) es la version exacta del
    -- texto a la que apunta cada AutorizacionDatos: es la
    -- prueba de habeas data. Silenciarla seria callar la
    -- columna con mas consecuencias legales del esquema.
    v_antes   := to_jsonb(OLD) - 'actualizadoEn';
    v_despues := to_jsonb(NEW) - 'actualizadoEn';

    SELECT array_agg(k ORDER BY k) INTO v_campos
      FROM jsonb_object_keys(v_despues) AS k
     WHERE v_antes -> k IS DISTINCT FROM v_despues -> k;

    -- Solo se movio la marca de tiempo: no hay nada que contar.
    -- Esto es lo que evita que el trabajador de campanas llene
    -- la bitacora de ruido, y tambien lo que hace que el vigia
    -- de cupos no cueste nada (ver §1.8).
    IF v_campos IS NULL THEN
      RETURN NULL;
    END IF;

    v_fila := v_despues ->> 'id';

  ELSIF TG_OP = 'INSERT' THEN
    v_campos := '{}';
    v_fila   := to_jsonb(NEW) ->> 'id';

  ELSE  -- DELETE
    -- Un DELETE apunta QUE la fila desaparecio y CUAL era. NO
    -- apunta que tenia dentro, y por eso ejercer el derecho de
    -- supresion no crea aqui una copia de lo suprimido.
    v_campos := '{}';
    v_fila   := to_jsonb(OLD) ->> 'id';
  END IF;

  INSERT INTO "bitacora_cambios"
      ("id", "tabla", "filaId", "operacion", "camposTocados",
       "txId", "origen", "actor", "ocurrioEn")
  VALUES
      (gen_random_uuid()::text,
       TG_TABLE_NAME,
       v_fila,
       TG_OP,
       v_campos,
       pg_current_xact_id()::text::bigint,
       nullif(current_setting('app.origen', true), ''),
       nullif(current_setting('app.actor',  true), ''),
       clock_timestamp());

  RETURN NULL;
END;
$fn$;
```

Tres detalles que importan y que la versión anterior falló:

- **`current_setting('app.actor', true)`** — el segundo argumento es `missing_ok`. Devuelve
  `NULL` si nadie lo puso. **No lanza.** Ese es todo el mecanismo de convivencia: hoy nadie lo
  pone y no pasa nada.
- **`to_jsonb` sí serializa los `bytea` en memoria** para poder comparar (`logos.datos`,
  `schema.prisma:1253`; `campanas.bannerDatos`, `:1753`). Lo que **no** ocurre es que se
  escriban: de `v_despues` solo sale `array_agg(k)`, que son nombres. Reemplazar un logo deja
  la fila `('logos', <id>, 'UPDATE', {datos})` y ni un byte. El `omit` de
  `prisma.service.ts:8-9` sigue haciendo su trabajo, que es que los bytes no viajen a la
  aplicación; este trigger hace el suyo, que es que no se escriban en ningún otro sitio.
- **`gen_random_uuid()`** es de serie desde Postgres 13 y el clúster es `postgres:17-alpine`
  (`docker-compose.yml:29`). `pg_current_xact_id()` también.

Y `to_jsonb(NEW) ->> 'id'` sirve para las 43 tablas porque no hay ni una clave primaria que no
sea `String` ni una compuesta: `grep -n "@id" backend/prisma/schema.prisma | grep -v String` → 0
líneas, `grep -c "@@id" backend/prisma/schema.prisma` → 0, y no hay ninguna tabla implícita de
relación N-M (`grep -rn 'CREATE TABLE "_' backend/prisma/migrations` → 0).

### 1.4 Colgarlo de las tablas

`NO ENCONTRADO: ningún CREATE TRIGGER ni CREATE FUNCTION en las 43 migraciones.` Comprobado con
`grep -rniE "grant |revoke |row level security|CREATE TRIGGER|CREATE FUNCTION" backend/prisma/migrations`
→ cero. Esta sería la primera.

```sql
-- Se cuelga de todas las tablas de `public` menos dos, y se
-- lee de `pg_class`: asi no hay una lista de 43 nombres que
-- pueda quedarse vieja.
DO $colgar$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       -- `_prisma_migrations` es de Prisma, no del negocio, y
       -- ademas se escribe DENTRO de esta misma migracion.
       -- `bitacora_cambios` se auditaria a si misma.
       AND c.relname NOT IN ('_prisma_migrations', 'bitacora_cambios')
     ORDER BY c.relname
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS "bitacora" ON public.%I', t.relname);

    IF t.relname IN ('registros_auditoria', 'valores_anteriores') THEN
      -- Sus INSERT ya SON la huella: apuntarlos otra vez es
      -- duplicar. Lo que aqui hay que ver es que alguien las
      -- toque o las borre, que es justo lo que C-06 teme.
      EXECUTE format(
        'CREATE TRIGGER "bitacora" AFTER UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION "bitacora_apuntar"()', t.relname);

    ELSIF t.relname = 'destinatarios_campana' THEN
      -- Una campana de 5.000 buzones son 5.000 filas por cada
      -- columna que se mueva. Las aperturas y los clics los
      -- mueve un pixel en el cliente de correo de otra
      -- persona, no un acto de nadie: no entran. El INSERT
      -- tampoco: la lista se arma en un solo acto, y ese acto
      -- ya queda en `campanas`.
      EXECUTE format(
        'CREATE TRIGGER "bitacora"
           AFTER UPDATE OF "estado", "correo", "motivo", "intentos"
              OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION "bitacora_apuntar"()', t.relname);

    ELSE
      EXECUTE format(
        'CREATE TRIGGER "bitacora" AFTER INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION "bitacora_apuntar"()', t.relname);
    END IF;
  END LOOP;
END
$colgar$;
```

**Este bucle solo ve las tablas que existían el día que corrió, y eso vale también dentro del
mismo `migrate deploy`:** una tabla creada en una migración POSTERIOR no la alcanza. De ahí la
regla que acompaña al patrón y que no se puede dejar a la comprobación manual del §1.5:

> **Toda migración que cree una tabla cuelga el trigger en la misma migración**, con
> `CREATE TRIGGER "bitacora" AFTER INSERT OR UPDATE OR DELETE ON "<tabla>" FOR EACH ROW
> EXECUTE FUNCTION "bitacora_apuntar"();` como última sentencia.

En este documento eso afecta exactamente a una tabla, `avisos_entrantes` (§5.3), y su
`CREATE TRIGGER` va escrito allí.

**Por qué esta migración no puede dejar el contenedor en ciclo de reinicios** (regla 6,
`backend/arrancar.sh:7,29`): crea una tabla nueva, una función y triggers. No añade ni un valor
de enum —así que no hay `ALTER TYPE ... ADD VALUE` que no se pueda usar en la misma
transacción—, no toca ni una fila existente, no añade ninguna restricción que un dato viejo
pueda violar, y no nombra ningún rol. Sobre una base recién creada por `initdb` —la de
`docker-compose.prueba.yml:42-45`, la del desarrollador de `backend/.env.example:20-36`, o la
que recrea vacía `scripts/rendirse.sh:90-92`— corre igual que sobre la de producción.

Lo único que sí puede pasar: `CREATE TRIGGER` toma `ACCESS EXCLUSIVE` sobre cada tabla un
instante. Con transacciones largas abiertas, la migración **espera**. No pongas `lock_timeout`:
esperar deja el arranque colgado un rato; fallar lo deja sin arrancar para siempre. Se despliega
en una ventana tranquila.

### 1.5 Comprobación (corrección 11)

La consulta de la versión anterior nunca pasaba porque `_prisma_migrations` está en `public`,
es `relkind = 'r'` y nunca va a tener trigger:

```sql
-- Tablas sin bitácora. Debe devolver CERO filas.
SELECT c.relname AS "tabla sin bitácora"
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relname NOT IN ('_prisma_migrations', 'bitacora_cambios')
   AND NOT EXISTS (
         SELECT 1 FROM pg_trigger g
          WHERE g.tgrelid = c.oid
            AND NOT g.tgisinternal
            AND g.tgname = 'bitacora')
 ORDER BY 1;
```

Esta consulta es la **red**, no el mecanismo: el mecanismo es la regla del §1.4, que cuelga el
trigger en la misma migración que crea la tabla. La red existe porque alguien se va a olvidar.
`NO ENCONTRADO: integración continua` (Fase 0 §7): hoy no hay dónde colgarla automáticamente. Va
al documento de comprobaciones en servidor y a un spec de Jest en cuanto haya CI.

### 1.6 Cómo se lee junto con lo que ya existe

```sql
-- La historia de una ficha: lo mecánico y lo humano, juntos.
SELECT b."ocurrioEn", b."tabla", b."operacion", b."camposTocados",
       b."actor",
       r."actorNombre", r."accion", r."resumen"
  FROM "bitacora_cambios" b
  LEFT JOIN "registros_auditoria" r
         ON r."entidadId" = b."filaId"
        AND r."creadoEn" BETWEEN b."ocurrioEn" - INTERVAL '5 seconds'
                             AND b."ocurrioEn" + INTERVAL '5 seconds'
 WHERE b."tabla" = 'participantes'
   AND b."filaId" = $1
 ORDER BY b."ocurrioEn" DESC;
```

**Ese `LEFT JOIN` por ventana de tiempo es una heurística, y lo digo antes de que alguien lo
descubra.** No se puede unir por `txId`, porque `AuditoriaService.registrar()` corre **fuera** de
la transacción a propósito y con su motivo escrito (`crm.service.ts:1758-1768`: *«auditar no
puede tumbar el borrado que ya ocurrió»*). Son dos transacciones distintas. El join firme llega
en el paso 4 del §6, cuando `app.actor` empiece a llegar.

### 1.7 `origen` y `actor`: hoy nulos, y está bien

La corrección 10 señalaba que `SIN_CONTEXTO` se contradecía consigo mismo y que los dos
mecanismos se anulaban. Aquí no hay dos mecanismos: hay uno, y su valor por defecto es NULL.

Una fila con `actor` nulo **no es un fallo**. Significa una de tres cosas, todas ciertas:
el `RuiWorker` no es una persona; `Matricula` no es una persona; o esa escritura todavía no
ha pasado por el paso 4. No hay alarma que suene por eso, porque una alarma que suena siempre
es una alarma apagada.

Lo que sí es una consulta útil desde el día uno, y no depende del contexto:

```sql
-- Escrituras sobre datos de persona que la bitácora ve y
-- `registros_auditoria` no. Es el 80% de C-14, medido en vez
-- de estimado.
SELECT b."tabla", b."operacion", count(*) AS veces
  FROM "bitacora_cambios" b
 WHERE b."tabla" IN ('personas', 'participantes', 'reservas', 'grupos', 'grupos_cobertura')
   AND b."ocurrioEn" > now() - INTERVAL '7 days'
   AND NOT EXISTS (
         SELECT 1 FROM "registros_auditoria" r
          WHERE r."entidadId" = b."filaId"
            AND r."creadoEn" BETWEEN b."ocurrioEn" - INTERVAL '5 seconds'
                                 AND b."ocurrioEn" + INTERVAL '5 seconds')
 GROUP BY 1, 2
 ORDER BY veces DESC;
```

### 1.8 El costo, dicho antes de aplicarlo

- **Cada escritura que cambia algo pasa a ser dos.** Un `UPDATE` sobre `participantes` escribe
  además una fila de ~150 bytes. Un `.xlsx` de 800 filas por `plantillas.service.ts:400-405`
  deja 800 filas de bitácora. Es el precio de INV-3 y no hay versión barata.
- **Y hay un goteo constante que la versión anterior no contaba: los dos sondeos.** Cada
  consulta al RUI que se procesa deja **dos** filas sobre `consultas_rui` —la toma
  (`rui.service.ts:314-326`) y el resultado (`:438`, `:453` o `:466`)—, y lo mismo
  `consultas_rues` (`web.service.ts:149-160`, `:261`, `:273`). Con los dos trabajadores
  corriendo todo el día ese goteo es el grueso del volumen, no el `.xlsx`.
- **Lo que NO cuesta, y conviene decirlo porque parece que sí.** `vigia-de-cupos.ts:74`
  reescribe `avisos_de_cupos` en cada revisión aunque los números no se hayan movido; pero
  `AvisoDeCupos` no tiene `@updatedAt`, así que si `inscritos` y `faltan` siguen iguales
  `v_campos` sale NULL y el trigger devuelve sin escribir (§1.3). Y la vuelta en vacío del
  sondeo tampoco cuesta: el `UPDATE ... WHERE "id" = (SELECT ... LIMIT 1)` no toca ninguna fila
  cuando la cola está vacía, y un trigger `FOR EACH ROW` sobre cero filas no corre.
- **Y hay un cambio de semántica que hay que aprobar a ojos abiertos.** El trigger corre
  **dentro** de la transacción del negocio: si el `INSERT` en la bitácora fallara, la escritura
  del usuario se cae con él. Eso es lo contrario de la decisión escrita en
  `crm.service.ts:1758-1768`, donde `registrar()` es fail-open a propósito y el `catch` de
  `auditoria.service.ts:132-134` se traga el error. **El trigger es fail-closed y hay que
  decirlo así.** Sostengo que las dos son correctas y no se contradicen, porque son dos cosas
  distintas: `registrar()` escribe una frase después del hecho y no debe poder deshacerlo; el
  trigger escribe el hecho, y para INV-3 «si no se puede apuntar, no pasó» es la semántica que
  se pide. Además los modos de fallo no son iguales: `registrar()` se puede caer por una acción
  fuera del catálogo o un `userAgent` raro; el trigger solo se cae si la base se cae, y entonces
  la escritura del negocio se caía igual. **Va en la lista de aprobación.**
- **Rollback**: `DROP TRIGGER "bitacora" ON <tabla>` en bucle, o `DROP FUNCTION
  "bitacora_apuntar"() CASCADE`, que se lleva los triggers. La tabla se queda: lo que ya se
  apuntó no se tira.

---

## 2 · Patrón 2 — Inmutabilidad y retención de la bitácora

**Ataca:** C-06 (la bitácora es borrable), correcciones 7 y 17.

Este patrón existe porque las correcciones 7 y 17 lo sacaron del anterior a empujones: una
tabla que nadie puede podar y que se llena justo cuando alguien pide que le borren los datos es
peor que no tenerla.

### 2.1 Lo que no se puede hacer, y por qué

**La bitácora no puede ser inalterable hoy.** No por falta de `REVOKE`, sino porque:

```
backend/.env.example:9   POSTGRES_USER=reservasae
backend/.env.example:17  DATABASE_URL=postgresql://reservasae:...@db:5432/reservasae
docker-compose.yml:32-33 env_file: backend/.env   (en el servicio `db:` de :28)
```

`POSTGRES_USER` es el rol que `initdb` crea en la imagen oficial de Postgres, y ese rol es
**superusuario**. Es el mismo rol con el que se conecta la aplicación. Un superusuario:

- ignora todo `GRANT` y todo `REVOKE`;
- ignora `ROW LEVEL SECURITY`;
- puede `ALTER TABLE ... DISABLE TRIGGER`;
- y puede volver a concederse lo que se le quite.

Escribir `REVOKE ALL ON "bitacora_cambios" FROM reservasae` no protege nada: es una línea que
parece seguridad. **El §0 de la versión anterior tenía razón en el diagnóstico** —esto corrige
C-06, que decía «la aplicación se conecta con el rol dueño del esquema»: es peor, es el
superusuario— y la remediación era la que estaba mal.

Así que la inmutabilidad va por pasos, y el primero no da inmutabilidad: da **detección**.

### 2.2 Paso A — la puerta cerrada por dentro (esto sí va en la migración)

```sql
-- Va en la MISMA migración del §1: la tabla nace ya cerrada.
--
-- No protege del dueño de la base: un superusuario la puede
-- desactivar. Protege de lo que de verdad pasa, que es un
-- `deleteMany` mal escrito, un guion de mantenimiento y un
-- `$executeRawUnsafe` (backend/prisma/aplicar-migracion.mjs:43
-- ejecuta SQL arbitrario). Y desactivarla deja rastro en el
-- log del servidor, que es mas de lo que hay hoy.
CREATE OR REPLACE FUNCTION "bitacora_es_solo_de_lectura"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION
    'La bitácora no se corrige ni se borra desde la aplicación (intento de %).', TG_OP
    USING ERRCODE = '42501';
END;
$fn$;

CREATE TRIGGER "bitacora_solo_inserta"
  BEFORE UPDATE OR DELETE ON "bitacora_cambios"
  FOR EACH ROW EXECUTE FUNCTION "bitacora_es_solo_de_lectura"();

-- TRUNCATE necesita su propio trigger: no admite FOR EACH ROW.
CREATE TRIGGER "bitacora_sin_truncate"
  BEFORE TRUNCATE ON "bitacora_cambios"
  FOR EACH STATEMENT EXECUTE FUNCTION "bitacora_es_solo_de_lectura"();
```

Consecuencia buscada: la poda del §2.4 tiene que desactivar el trigger a mano. Podar deja de ser
algo que se hace sin querer.

### 2.3 Paso B — el rol de aplicación (esto NO va en ninguna migración)

Corrección 5, literal: `GRANT SELECT ON "bitacora_cambios" TO reservasae_app` contra una base
sin ese rol es `role "reservasae_app" does not exist`, migración marcada como fallida en
`_prisma_migrations`, y el contenedor no vuelve a arrancar hasta un `migrate resolve` a mano.
Con `backend/arrancar.sh:7` (`set -e`) y `:29` (`pnpm exec prisma migrate deploy`), eso es el
crítico 6 de Fase 0 otra vez.

Por eso: **`grep -rn "GRANT\|REVOKE\|CREATE ROLE" backend/prisma/migrations/` sobre lo que
propone este documento tiene que dar cero.** Todo lo de abajo es un guion que corre una persona.

```sql
-- docs/operacion/01-rol-de-aplicacion.sql
--
-- SE CORRE A MANO, con psql, contra UNA base concreta, como
-- dueño. NO va en backend/prisma/migrations/: `migrate deploy`
-- corre solo en cada arranque del contenedor
-- (backend/arrancar.sh:29) y una migración que falle deja el
-- backend sin arrancar.
--
--   psql "$DATABASE_URL_DUENO" -v clave="$CLAVE_APP" \
--        -f docs/operacion/01-rol-de-aplicacion.sql
\set ON_ERROR_STOP on
\i docs/operacion/00-guardia-de-puerto.sql

-- 1. El rol, solo si no está. Idempotente.
SELECT format('CREATE ROLE reservasae_app LOGIN PASSWORD %L', :'clave')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reservasae_app')
\gexec

-- 2. Los permisos, con la guarda que pidió la corrección 5.
DO $permisos$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reservasae_app') THEN
    RAISE NOTICE 'No existe el rol reservasae_app: no se concede nada.';
    RETURN;
  END IF;

  EXECUTE 'GRANT USAGE ON SCHEMA public TO reservasae_app';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
             TO reservasae_app';
  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO reservasae_app';

  -- Las tablas que cree la PROXIMA migracion tambien.
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public
             GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO reservasae_app';

  -- La bitacora: ni una letra de escritura directa. Entra
  -- sola, por el trigger, que es SECURITY DEFINER y corre como
  -- el dueño. Esta es la razon de aquel SECURITY DEFINER.
  EXECUTE 'REVOKE ALL ON TABLE "bitacora_cambios" FROM reservasae_app';
  EXECUTE 'GRANT SELECT ON TABLE "bitacora_cambios" TO reservasae_app';

  -- `registros_auditoria` solo se inserta y se lee: comprobado,
  -- sus cuatro usos son auditoria.service.ts:118 (create) y
  -- :139, crm.service.ts:392 y preinscripcion.service.ts:999
  -- (lecturas). Quitarle UPDATE y DELETE no rompe nada.
  EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "registros_auditoria" FROM reservasae_app';

  -- `valores_anteriores` SI se actualiza: crm.service.ts:1434
  -- marca `restauradoEn` al deshacer. Solo se le quita DELETE.
  EXECUTE 'REVOKE DELETE ON TABLE "valores_anteriores" FROM reservasae_app';
END
$permisos$;
```

**Lo que la versión anterior dejaba en el aire y ahora se cierra:**

1. `REVOKE DELETE ON "valores_anteriores"` **no rompe la cascada** de `crm.service.ts:1749-1755`.
   En Postgres las acciones referenciales de una clave foránea se ejecutan con los privilegios
   del **dueño de la tabla**, no con los del rol que dispara el borrado; así que el
   `onDelete: Cascade` de `schema.prisma:1914` sigue funcionando aunque `reservasae_app` no
   pueda hacer `DELETE` directo. Lo mismo vale para el `SetNull` de `registros_auditoria.adminId`.
   Esto se cierra por la semántica documentada de Postgres, no por haberlo probado contra una
   base levantada, y lo digo tal cual.
2. Lo que **sigue abierto** es que `prisma migrate deploy` tenga con qué crear tablas.
   `reservasae_app` no puede hacer DDL. Hace falta separar las dos cadenas:

```prisma
datasource db {
  provider  = "postgresql"
  // la aplicación: rol restringido
  url       = env("DATABASE_URL")
  // las migraciones: el dueño. `migrate deploy` usa esta.
  directUrl = env("DIRECT_URL")
}
```

Hoy `schema.prisma:8-11` **NO** tiene `directUrl`. Añadirlo es un cambio en producción y va en
la lista de aprobación.

### 2.4 Retención — la corrección 17

Una tabla append-only sin plan de poda es una promesa de que alguien va a entrar a mano. Y
guardar para siempre no es una virtud: es lo contrario de lo que pide la Ley 1581 que
`clase-de-dato.ts:63-72` cita.

**Y antes del primer guion, la guarda de puerto.** `backend/prisma/guardia-de-base.ts:3-25`
existe porque *«una base local y el túnel a producción son INDISTINGUIBLES desde la cadena de
conexión»* y porque *«un aviso escrito no es un candado»*: la regla es de puerto, **el 5433 es
producción** (`guardia-de-base.ts:38`), y se puede saltar a propósito con `PERMITIR_PRODUCCION=si`.
Un `psql -f` se salta esa guarda entera, y estos guiones son el único sitio del diseño donde algo
se borra de verdad. Así que la guarda se escribe una vez y se incluye desde los cuatro:

```sql
-- docs/operacion/00-guardia-de-puerto.sql
--
-- El mismo candado de backend/prisma/guardia-de-base.ts:16-24,
-- para lo que entra por psql y no por Prisma. Se incluye con
-- `\i` desde cada guion de operacion.
--
--   psql ... -v permitir=si   para saltarlo a proposito.
\if :{?permitir}
\else
  \set permitir no
\endif

SELECT :'PORT' = '5433' AND :'permitir' <> 'si' AS "parar" \gset
\if :parar
  \echo '*** PUERTO 5433: eso es PRODUCCION. ***'
  \echo 'Si es a proposito, repita con  -v permitir=si'
  \q
\endif
```

```sql
-- docs/operacion/02-podar-bitacora.sql
--
-- A MANO. Trimestral. Y SE APRUEBA: es el unico sitio del
-- diseño donde algo se borra de verdad.
--
-- Antes de podar, se saca el trozo a un archivo. Podar no es
-- perder: es dejar de tener la copia caliente.
\set ON_ERROR_STOP on
\i docs/operacion/00-guardia-de-puerto.sql
\set meses 18

BEGIN;

  -- 1. Al disco, primero.
  \copy (SELECT * FROM "bitacora_cambios" WHERE "ocurrioEn" < now() - (:'meses' || ' months')::interval) TO 'bitacora-podada.csv' CSV HEADER

  -- 2. Abrir la puerta, borrar, cerrarla. Los tres pasos en la
  --    misma transaccion: si algo falla, la puerta no se queda
  --    abierta.
  ALTER TABLE "bitacora_cambios" DISABLE TRIGGER "bitacora_solo_inserta";

  DELETE FROM "bitacora_cambios"
   WHERE "ocurrioEn" < now() - (:'meses' || ' months')::interval;

  ALTER TABLE "bitacora_cambios" ENABLE TRIGGER "bitacora_solo_inserta";

COMMIT;

VACUUM (ANALYZE) "bitacora_cambios";
```

El `VACUUM` va **después** del `COMMIT` a propósito: no corre dentro de un bloque de transacción.

Y la consulta para saber si hace falta, antes de que haga falta:

```sql
SELECT pg_size_pretty(pg_total_relation_size('bitacora_cambios')) AS tamano,
       count(*)                                                   AS filas,
       min("ocurrioEn")                                           AS "la más vieja"
  FROM "bitacora_cambios";
```

**Se descartó particionar por `ocurrioEn`.** `PARTITION BY RANGE` haría la poda un `DROP`
barato, pero exige crear la partición del mes que viene, y `NO ENCONTRADO: @nestjs/schedule,
@Cron, bull, bullmq, agenda ni node-cron` (Fase 0 §1): no hay quién la cree. Una partición que
falta convierte **cada escritura de todo el sistema** en un error, porque el trigger está en
todas las tablas y es fail-closed (§1.8). El riesgo es de otra magnitud que el beneficio. Y
particionar además obligaría a meter la clave de partición en la primaria, que es justo lo que
el §1.2 no puede describir en `schema.prisma`.

---

## 3 · Patrón 3 — Archivado uniforme

**Ataca:** INV-1, INV-2, D-01, D-02. **Choques 4, 5 y 6.**

### 3.1 Lo que la Fase 1 ya dejó claro

D-02 no es «falta una columna»: son **72 consultas a `participante` en 14 archivos**, de las que
solo cuatro pasan por `donde()`, más **28 líneas de SQL crudo** contra `"participantes"` en
cuatro ficheros (`backend/src/crm/control.ts`, `planeacion-de-pauta.ts`, `tablero-academico.ts`,
`tablero-af.ts` — comprobado con `grep -rn '"participantes"' backend/src --include=*.ts | grep -v spec`,
28 líneas, **todas de lectura**). Un `archivadoEn` que solo se aplique en `donde()` deja fuera
casi todo, y **el reporte al SEP es una de las que se lo saltarían**.

Así que este patrón entrega **la forma**, no el interruptor. Y en esta fase **la forma no se
aplica a ninguna tabla**: el §3.3 explica por qué la única candidata que quedaba se retiró.

### 3.2 La forma, copiada de lo que ya hay en la casa

Tres columnas, un CHECK con la forma del CHECK del sobrecupo
(`migrations/20260814140000_crm_personas_y_participantes/migration.sql:222-225`), y un índice
único parcial con la forma del único que existe
(`migrations/20260814120000_politica_por_destinatario/migration.sql:19-21`).

```sql
ALTER TABLE "<tabla>"
  ADD COLUMN "archivadoEn"     TIMESTAMP(3),
  ADD COLUMN "archivadoPorId"  TEXT,
  ADD COLUMN "archivadoMotivo" TEXT;

-- «un archivado sin motivo no es un archivado», con la misma
-- forma que `participantes_sobrecupo_justificado`.
--
-- `archivadoPorId` queda fuera de la igualdad a proposito: hay
-- archivados que no los hace una persona.
ALTER TABLE "<tabla>"
  ADD CONSTRAINT "<tabla>_archivo_coherente"
  CHECK (("archivadoEn" IS NULL) = ("archivadoMotivo" IS NULL));
```

Ese CHECK **no puede fallar al aplicarse**: las tres columnas nacen NULL en todas las filas, y
`(NULL IS NULL) = (NULL IS NULL)` es verdadero. Es la comprobación que exige la regla 6 antes de
poner una restricción sobre una tabla con datos.

Y las tres columnas, cuando se apliquen, llevan su bloque en `schema.prisma` — la regla del
§1.2: lo que Prisma modela y no ve, la siguiente migración generada lo borra.

### 3.3 `propuestas_de_datos`: por qué NO se archiva en esta fase

El censo es exacto y sigue siéndolo:
`grep -rn "propuestaDeDatos\." backend/src --include=*.ts | grep -v spec` → **siete líneas**, y
cero SQL crudo contra `"propuestas_de_datos"`. El embudo entero:

```
crm.service.ts:2444-2447  findFirst({ where: { participanteId, estado:'PENDIENTE' },
                                      orderBy: { creadoEn: 'desc' } })
crm.service.ts:2487-2490  idéntica
crm.service.ts:2524       update({ where: { id: propuesta.id } })
leads.service.ts:371-376  deleteMany({ where: { participanteId, estado:'PENDIENTE' } })
leads.service.ts:377-382  create
preinscripcion.service.ts:959-961  deleteMany, igual
preinscripcion.service.ts:963-965  create
```

**Las dos lecturas ya toman la más nueva.** Eso sigue siendo verdad. Lo que no era verdad es que
archivar fuera seguro con el código de hoy sin tocarlo. Dos motivos independientes, y cada uno
basta:

1. **El archivado se borraría solo.** El dedupe marcaba `archivadoEn`/`archivadoMotivo` y dejaba
   `estado = 'PENDIENTE'`. Los dos escritores borran exactamente por ese predicado y **sin mirar
   `archivadoEn`**: `preinscripcion.service.ts:959-961` y `leads.service.ts:371-376`. La
   siguiente propuesta de esa ficha borra físicamente lo que la migración acababa de archivar.
   Sería un archivado cosmético que dura hasta el próximo formulario, y rompería la regla 1 con
   código que el propio diseño declaraba intacto.
2. **«Un `deleteMany` nunca deja dos vivas» es falso sin transacción.**
   `preinscripcion.service.ts:959` y `:963` corren sobre `this.prisma`, **fuera de toda
   transacción** —`dejarPropuesta` (`:920`) se llama desde `registrar` en `:365`, y no hay
   ninguna `$transaction` en ese camino—, y `registrar` es la ruta **pública** sin guard
   (`preinscripcion.controller.ts:12,22-29`). Dos envíos concurrentes de la misma ficha —un doble
   clic en el formulario— pueden borrar los dos y crear los dos. `leads.service.ts:371-382` tiene
   la misma ventana dentro de un `$transaction` interactivo en READ COMMITTED. Con el índice
   único puesto, el segundo `create` sale como P2002 → **500 crudo**, porque el §9 declara
   `NO ENCONTRADO: useGlobalFilters ni ExceptionFilter en backend/src/main.ts`. El índice que la
   versión anterior llamaba «imposible de desplegar en silencio» sí puede saltar en una ruta de
   usuario.

Y hay un tercer motivo, que no es un fallo sino una colisión de diseño: **el documento hermano
`maquinas-de-estado` propone marcar `REEMPLAZADA` en `EstadoPropuesta`** (`schema.prisma:1584-1588`:
hoy `PENDIENTE | ACEPTADA | DESCARTADA`). Si aterrizan los dos, `propuestas_de_datos` acaba con
**dos ejes de vitalidad** —`estado` y `archivadoEn`—, que es exactamente la trampa por la que el
§3.4 se niega a tocar `reservas`. **Hay que escoger un eje, y no lo puede escoger este
documento.**

> ⚠️ **DECISIÓN ABIERTA (§8.7).** Qué eje gobierna la vitalidad de `propuestas_de_datos`:
> `archivadoEn` (este documento) o `REEMPLAZADA` en `EstadoPropuesta` (`maquinas-de-estado`).
> Uno, no los dos.

Por todo eso, y aplicando aquí el mismo criterio con el que el §3.4 le niega las columnas a
`participantes` —*«una columna sin usar es una invitación a usarla antes de tiempo»*—:
**`propuestas_de_datos` no recibe nada en esta fase.**

**Lo que queda de pie es la regla, y va entera y en el paso de código.** Hoy la regla es un
comentario (`preinscripcion.service.ts:958`, «una pendiente por ficha: la ultima es la que
vale»). Para que sea una restricción hacen falta cuatro cosas **en el mismo cambio**, y ninguna
antes que las otras:

```
a. La atomicidad: `deleteMany` + `create` pasa a ser un solo acto por ficha
   —una transaccion interactiva, o un INSERT ... ON CONFLICT crudo—, en
   preinscripcion.service.ts:959-965 y en leads.service.ts:371-382.
b. El eje decidido, y su filtro en el `where` de esos dos `deleteMany`:
     · si gana `archivadoEn`  →  { participanteId, estado:'PENDIENTE', archivadoEn: null }
     · si gana `REEMPLAZADA`  →  el `deleteMany` se convierte en `updateMany` de estado,
                                 y no hacen falta columnas nuevas
c. El dedupe de lo que ya hay, ANTES del indice. Y no es hipotetico: la
   ventana de (2) lleva meses abierta, asi que puede haber fichas con dos
   PENDIENTE hoy mismo. Sin el dedupe, el CREATE UNIQUE INDEX falla y con
   el se cae `migrate deploy` y el arranque del contenedor (regla 6).
d. Y solo entonces:
     CREATE UNIQUE INDEX "propuestas_una_pendiente_viva"
         ON "propuestas_de_datos"("participanteId")
      WHERE "estado" = 'PENDIENTE'        -- (+ AND "archivadoEn" IS NULL, si gana ese eje)
```

Va en el paso 6 del §6. **No hay «el SQL va delante del código»**: aquí el SQL delante del
código es un 500 en la puerta pública.

### 3.4 Dónde NO se aplica, y por qué cada una

- **`propuestas_de_datos`** (choque 6). Ver §3.3: el archivado se borraría solo y el eje está
  en disputa con el diseño hermano. **Queda fuera de esta fase.**
- **`respuestas`** (choque 5). `reservas.service.ts:129` las borra al revivir una reserva
  cancelada, en la ruta pública `POST /reservas`. Sus lecturas son cinco
  (`formularios.service.ts:483,779`; `tableros.service.ts:884,1010,1211`) y al menos dos las
  pintan todas. Archivar sin arreglar antes esas lecturas deja dos juegos de respuestas para la
  misma reserva. **Queda fuera.**
- **`admin_convenio`** (choque 4). `admin.guard.ts:120-123` hace
  `adminConvenio.findMany({ where: { adminId } })` **sin ningún filtro**. Archivar en vez de
  borrar en `admin.service.ts:279` haría que quitarle un convenio a alguien dejara de
  quitárselo. Es D-02 en la tabla de permisos. **Queda fuera hasta que el guard filtre.**
- **`participantes`** (D-01, D-02). 72 consultas Prisma + 28 líneas de SQL crudo, incluido el
  reporte al SEP. **Ni siquiera se le añaden las columnas**: una columna sin usar es una
  invitación a usarla antes de tiempo.
- **`reservas`** — y este no lo pedía el veto, lo pide la regla 3. `promoverListaDeEspera`
  (`reservas.service.ts:384-440`) filtra por `cuposEnEspera > 0` y `estado: { not: CANCELADA }`
  (`:393-399`), no por «está viva». Un `archivadoEn` sobre `reservas` añade un **segundo eje de
  vitalidad** que esos predicados no miran: una reserva archivada y no cancelada seguiría
  entrando en la promoción. Es exactamente la trampa por la que ya se retiraron dos diseños.
  **No se toca `reservas`.**
- **`caracterizaciones_persona`** — y aquí voy contra la regla 1 a propósito, con el motivo
  escrito. `preinscripcion.service.ts:900-901` las borra enteras para reemplazarlas, con su
  comentario en `:898-899`: *«si la persona vuelve y quita una casilla, quitarla tiene que
  servir de algo»*. Son el dato del artículo 5 de la Ley 1581 (`clase-de-dato.ts:63-72`,
  `schema.prisma:1868-1874`). **Archivarlas sería guardar que alguien fue víctima del conflicto
  después de que pidiera que no constara.** Aquí el borrado físico es la conducta correcta, y
  la bitácora del §1 deja la constancia sin el valor, que es exactamente lo que
  `ClaseDeDato.SENSIBLE` manda. Va en la lista de aprobación como excepción declarada.

### 3.5 Y C-10, que no se arregla aflojando la cascada

`valores_anteriores.participanteId` es `onDelete: Cascade` (`schema.prisma:1914`), así que
`crm.service.ts:1755` se lleva el historial de deshacer.

La tentación es cambiarlo a `SetNull`. **Sería un error.** `ValorAnterior.valorAnterior`
(`schema.prisma:1898`) guarda correos, celulares, direcciones y nombres viejos. Conservar esas
filas cuando la ficha se borra es guardar los datos personales de alguien **precisamente cuando
se ejerció la supresión**: la corrección 7 con otra ropa. La cascada es correcta.

C-10 se arregla no borrando, y no borrar exige el embudo de D-02. Mientras tanto lo que se gana
es que la bitácora deja `('participantes', <id>, 'DELETE')` y una fila por cada
`valores_anteriores` que se fue con él — sin un solo valor. Se sabe **qué desapareció y
cuándo**, que es lo que hoy no se sabe.

---

## 4 · Patrón 4 — Bloqueo y aforo

**Ataca:** F-02, G-01, G-03, y el hueco estructural de G. **Respeta la regla 2.**

### 4.1 Lo que el SQL puede y lo que no

El arreglo de F-02 y G-01 es **código**: leer dentro del candado. `reservas.service.ts:229` lee
sin `FOR UPDATE` y toma el candado en `:234`; `editar` y `TablerosService.cancelarReserva`
tienen el mismo defecto. Eso no se arregla con DDL.

Lo que el SQL puede hacer son tres cosas, y ninguna bloquea el sobrecupo autorizado.

### 4.2 El descuadre, visible

```sql
-- El invariante que la prueba de carga ya comprueba
-- (backend/prisma/prueba-carga.ts:136-144) pero que nadie mira
-- en produccion. Cancelar pone cuposConfirmados a 0
-- (reservas.service.ts:242), asi que no hace falta filtrar
-- por estado.
CREATE OR REPLACE VIEW "v_descuadre_de_cupos" AS
SELECT o."id"                                         AS "ofertaId",
       o."cuposMaximos",
       o."cuposOcupados",
       COALESCE(SUM(r."cuposConfirmados"), 0)::int    AS "sumaConfirmados",
       o."cuposOcupados"
         - COALESCE(SUM(r."cuposConfirmados"), 0)::int AS "descuadre"
  FROM "ofertas" o
  LEFT JOIN "reservas" r ON r."ofertaId" = o."id"
 GROUP BY o."id"
HAVING o."cuposOcupados" <> COALESCE(SUM(r."cuposConfirmados"), 0);
```

Con esa vista, el cargue masivo de `plantillas.service.ts:400-405` —que escribe
`cuposSolicitados` (`plantillas/catalogo.ts:136`) en un `for` sin candado y sin mover el
contador— **deja de ser invisible**.

```sql
-- El otro aforo: sillas ocupadas contra el techo de la
-- cobertura. Separa el sobrecupo FIRMADO del accidental, que
-- es la distincion que el CHECK
-- `participantes_sobrecupo_justificado` no puede hacer.
--
-- OJO: la lista de etapas es una COPIA de
-- backend/src/crm/etapas.ts:30-34 (OCUPAN_SILLA), y ese
-- archivo existe porque la lista estaba escrita cuatro veces y
-- se corrigio en tres. Esta es la quinta. Va con un spec que
-- compare las dos.
CREATE OR REPLACE VIEW "v_sobrecupo_de_cobertura" AS
SELECT gc."id"                     AS "coberturaId",
       gc."cuposMaximos",
       count(p."id")::int          AS "sillasOcupadas",
       count(p."id") FILTER (WHERE p."sobrecupoPorId" IS NOT NULL)::int
                                   AS "conAutorizacion",
       count(p."id")::int - gc."cuposMaximos"
                                   AS "porEncimaDelTecho"
  FROM "grupos_cobertura" gc
  LEFT JOIN "participantes" p
         ON p."coberturaId" = gc."id"
        AND p."etapa" IN ('INSCRITO', 'EN_FORMACION', 'CERTIFICADO')
 GROUP BY gc."id"
HAVING count(p."id") > gc."cuposMaximos";
```

**Es una vista, no un CHECK, y es deliberado.** Un `CHECK sillasOcupadas <= cuposMaximos`
mataría el sobrecupo autorizado, que está modelado con `sobrecupoPorId` + `sobrecupoMotivo` y su
CHECK de coherencia. El refutador de Fase 1 ya retiró esa remediación una vez. Aquí el sobrecupo
no se prohíbe: **se cuenta, y se dice cuánto de él lleva firma.**

### 4.3 Los topes imposibles, sin poder fallar al aplicarse

`NO ENCONTRADO: ningún CHECK sobre "grupos_cobertura" en las 43 migraciones` (Fase 0 §6).

```sql
-- NOT VALID: no escanea las filas que ya estan, asi que esta
-- migracion NO PUEDE fallar por un dato viejo. Es la
-- diferencia entre añadir una restriccion y dejar el
-- contenedor en ciclo de reinicios (backend/arrancar.sh:7,29).
--
-- Lo que NOT VALID **no** hace: eximir a las escrituras
-- futuras. Ver abajo.
ALTER TABLE "grupos_cobertura"
  ADD CONSTRAINT "grupos_cobertura_base_no_negativa"
    CHECK ("cuposBase" >= 0) NOT VALID,
  ADD CONSTRAINT "grupos_cobertura_techo_sobre_base"
    CHECK ("cuposMaximos" >= "cuposBase") NOT VALID;
```

Estas dos acotan la **capacidad** (`cuposBase`, `cuposMaximos`, `schema.prisma:158-159`), no la
**ocupación**. No rozan el sobrecupo: el sobrecupo es gente por encima de `cuposMaximos`, y
`cuposMaximos` es lo que estas restricciones ordenan respecto de `cuposBase`. De hecho
`cuposMaximos = cuposBase + 30%` es precisamente el sobrecupo ya presupuestado
(`scripts/extraer-catalogo.py:14`, `SOBRECUPO = 0.30`).

**Y quién las puede hacer saltar después, dicho con nombre y línea.** `NOT VALID` solo se salta
el escaneo inicial: la restricción **se comprueba en todo INSERT y UPDATE posterior**. El único
escritor de `grupos_cobertura` en producción es `cronograma.service.ts:244-247` —comprobado con
`grep -rn "grupoCobertura\.\(update\|updateMany\|upsert\|create\)" backend/src --include=*.ts | grep -v spec`,
una sola línea, y las seis apariciones en SQL crudo son todas `SELECT`/`JOIN`—, y ese `update`
reescribe **las dos** columnas con un par ya validado: `tope >= base` en `:209-213` y `@Min(0)`
en `cronograma/dto.ts:57,63`. Así que el riesgo real es bajo. Pero es bajo **por el escritor**,
no por el `NOT VALID`, y esa es la frase que la versión anterior tenía mal.

Validarlas después, cuando alguien pueda mirar el resultado, en guion de operación:

```sql
-- docs/operacion/03-validar-topes.sql  (a mano, no en migración)
-- Si esto falla, hay datos malos que hay que arreglar. Fallar
-- aqui cuesta un mensaje; fallar en `migrate deploy` cuesta el
-- arranque.
\set ON_ERROR_STOP on
\i docs/operacion/00-guardia-de-puerto.sql

ALTER TABLE "grupos_cobertura" VALIDATE CONSTRAINT "grupos_cobertura_base_no_negativa";
ALTER TABLE "grupos_cobertura" VALIDATE CONSTRAINT "grupos_cobertura_techo_sobre_base";
```

### 4.4 Los dos workers que arrancan siempre — y por qué aquí no va ningún candado

`Matricula` y `VigiaDeCupos` arrancan sin interruptor (`crm.module.ts:41,43`) y, contra una sola
base, dos procesos pueden solaparse.

**La versión anterior proponía `pg_try_advisory_lock(hashtext('convoca:matricula'))` al principio
del tic. Se retira, y esto es un veto contra mí mismo.**

`pg_try_advisory_lock` es un candado **de sesión**: se suelta al soltarlo a mano o al cerrar la
conexión. Prisma reparte un *pool*. La conexión que atendió ese `SELECT` vuelve al pool **con el
candado puesto**, y no se cierra mientras el proceso viva. El tic siguiente
—`matricula.ts:36-37` y `vigia-de-cupos.ts:35-36` son `setTimeout` + `setInterval` sobre el mismo
`PrismaService`— puede caer en otra conexión, recibir `false` y **no volver a correr nunca**. Un
mecanismo de seguridad que apaga los dos providers incondicionales es exactamente la clase de
fallo por el que se devolvió la primera versión, con otro mecanismo. La versión anterior escribía
«se suelta solo al cerrar la conexión» sin sacar la consecuencia.

La variante transaccional, `pg_try_advisory_xact_lock`, sí se suelta sola — pero se suelta **al
cerrar la transacción**, y el tic de `Matricula` no es una transacción: es un bucle con una
`$transaction` por fila (`matricula.ts:88`). Un candado que se suelta en la primera fila no
protege el barrido.

**Y el motivo de fondo para no forzarlo:** el split-brain del hallazgo 10 de Fase 0 es entre
**sedes**, cada una con su propia base, y un advisory lock es por clúster. Aquí no había un
seguro barato: había un riesgo caro por un beneficio que no cubre el caso que lo justificaría.
INV-9 sigue abierto y se resuelve fuera de esta fase.

---

## 5 · Patrón 5 — Colas: tomar sin duplicar, y una bandeja de entrada

**Ataca:** el caso 1 del outbox (campañas), INV-5 e INV-6. **Correcciones 14, 15 y 16, choque 9.**

INV-5 e INV-6 viven en `docs/arquitectura/00-mapa-actual.md:267,278,572` — **no** en
`01-auditoria.md`, que es donde la versión anterior daba a entender que estaban.

### 5.1 El outbox se retira entero

Fase 0 §4, comprobado: **cero webhooks salientes**. No hay a quién entregar nada de forma
fiable hacia fuera. Un outbox es la respuesta a un problema que este repositorio no tiene.

Lo que sí tiene son **tres colas de trabajo**, y dos ya están bien resueltas:

| Cola | Toma | Estado |
|---|---|---|
| `consultas_rui` | `UPDATE … FOR UPDATE SKIP LOCKED` (`rui.service.ts:314-326`) | correcta |
| `consultas_rues` | igual (`web.service.ts:149-160`), con ventana de 15 min y su motivo escrito en `:134-144` | correcta |
| **`destinatarios_campana`** | `findFirst` (`campanas.service.ts:388-400`) + `update` después de enviar (`:494-501`) | **es la que falta** |

`destinatarios_campana` **ya es una cola**: tiene `estado` (`schema.prisma:1811`), `intentos`
(`:1815`), `enviadoEn` (`:1816`) y `@@unique([campanaId, correo])` (`:1840`). No se sustituye, no
se duplica, no se le pone una tabla al lado. Se le aplica el patrón que ya está escrito dos veces
en la casa.

### 5.2 La toma, con la forma de la casa

```prisma
// backend/prisma/schema.prisma, dentro de `model DestinatarioCampana`
// (:1792). Sin esto, el siguiente `migrate dev` genera el
// DROP COLUMN: CLAUDE.md:3200-3201.

  /// Cuando un trabajador la tomo. Null = libre. La ventana de
  /// recuperacion mira esta columna, no el estado: es la misma
  /// forma de `consultas_rui` y `consultas_rues`.
  tomadaEn DateTime?
```

```sql
-- Migración: una columna, aditiva, nullable. No puede fallar.
ALTER TABLE "destinatarios_campana" ADD COLUMN "tomadaEn" TIMESTAMP(3);

-- Parcial: Prisma no lo puede declarar. Es el caso del §1.2,
-- igual que `politicas_datos_una_vigente`. Si `migrate dev`
-- propone borrarlo, no lo deje pasar (CLAUDE.md:3202-3203).
CREATE INDEX "destinatarios_campana_por_tomar"
    ON "destinatarios_campana"("creadoEn")
 WHERE "estado" = 'PENDIENTE';
```

**Sin valor de enum nuevo.** No hace falta un `ENVIANDO` en `EstadoDestinatario`
(`schema.prisma:1725-1733`), y por dos razones —una menos que la versión anterior, porque la
tercera estaba mal citada—:

- Un `ALTER TYPE ... ADD VALUE` no se puede usar en la misma transacción, y ese fallo ya reventó
  en producción con su lección escrita en
  `migrations/20260830185000_origen_lead_importacion/migration.sql:3-7`: *«Postgres no deja USAR
  un valor de enum recien añadido dentro de la misma transaccion, y Prisma corre cada migracion
  en una. Juntarlas es lo que hizo fallar aquella con "invalid input value for enum
  OrigenLead: IMPORTACION"»*. Y ese camino se recorre de verdad: `grep -rn "ALTER TYPE"
  backend/prisma/migrations` → **quince líneas en cuatro migraciones, once de ellas
  `ADD VALUE`** (la versión anterior decía ocho).
- La regla 7. Comprobado con `grep -rnE "Record<(Estado|Etapa|Origen)" frontend/src`: hay Records
  exhaustivos en `frontend/src/lib/crm-api.ts:206,228,459`, `campanas-api.ts:8`,
  `admin-api.ts:369` y `frontend/src/app/admin/reservas/page.tsx:23`; más el objeto `as const`
  —que falla en runtime y no en compilación— de `frontend/src/components/consulta-reservas.tsx:97-101`,
  y las uniones de `frontend/src/lib/api.ts:10` y `tableros-api.ts:6`. *(El comando que citaba la
  versión anterior, `grep -rn "Record<Estado" frontend/src`, no devuelve la mitad de esa lista:
  los hechos eran ciertos y el comando no era el que los encontró.)*

**Este diseño no añade ni un valor a ningún enum de Postgres ni de TypeScript.**

Y **el precedente que la versión anterior citaba mal**: no es cierto que «`consultas_rui`
resuelve lo mismo con `tomadaEn` y no con un estado». Hace **las dos cosas**:
`rui.service.ts:314-315` es `SET "estado" = 'EN_CURSO', "tomadaEn" = NOW(), "intentos" =
"intentos" + 1`, e igual `web.service.ts:150`. La conclusión —no tocar el enum— se sostiene sola
por las dos razones de arriba; la razón que se daba, no.

La consulta que reemplaza a `campanas.service.ts:388-400`:

```sql
UPDATE "destinatarios_campana" d
   SET "tomadaEn" = NOW(),
       "intentos" = d."intentos" + 1
  FROM "campanas" c
 WHERE c."id" = d."campanaId"
   AND d."id" = (
   SELECT x."id"
     FROM "destinatarios_campana" x
     JOIN "campanas" c2 ON c2."id" = x."campanaId"
    WHERE x."estado" = 'PENDIENTE'
      AND c2."estado" = 'ENVIANDO'
      -- y recupera las colgadas: si el proceso murio despues
      -- de tomarla, sin esto se queda PENDIENTE y tomada para
      -- siempre. Es el mismo fallo que web.service.ts:134-139
      -- documenta con una fila del 26 de agosto bloqueando su
      -- institucion cuatro dias.
      AND (x."tomadaEn" IS NULL OR x."tomadaEn" < NOW() - INTERVAL '10 minutes')
    ORDER BY x."creadoEn" ASC
      FOR UPDATE OF x SKIP LOCKED
    LIMIT 1
 )
RETURNING d."id", d."correo", d."campanaId", d."participanteId", d."nombre",
          c."asunto", c."cuerpo",
          (c."bannerDatos" IS NOT NULL) AS "tieneBanner";
```

Tres cosas de esa consulta que la versión anterior no tenía:

- **`FOR UPDATE OF x`** y no `FOR UPDATE` a secas: con el `JOIN`, bloquear también `campanas`
  haría que dos trabajadores de la misma campaña se estorbaran.
- **El `RETURNING` trae la campaña.** El `findFirst` de hoy la trae (`:396-398`:
  `campana: { select: { id, asunto, cuerpo, bannerDatos } }`) y el resto del método la usa:
  `:466` (`campana.asunto`), `:467` (`campana.cuerpo`), `:486` (`campana.id`, que es `campanaId`)
  y `:488` (`Boolean(campana.bannerDatos)`). Sin esos campos la consulta no reemplaza nada. El
  banner se devuelve como booleano y no como bytes precisamente porque `:488` solo pregunta si
  hay: pasar el `bytea` por cada destinatario de una campaña de 5.000 buzones no lo pide nadie.
- **Y el presupuesto de reintentos hay que arreglarlo en el mismo cambio, o baja de tres a uno.**
  Esta toma incrementa `intentos` —es la forma de la casa, y es lo que impide que un destinatario
  que mata el proceso se reintente para siempre—, pero `campanas.service.ts:499` ya incrementa al
  enviar bien y `:509` al fallar, y el corte está en `:514` (`if (fila.intentos >= 3)`). Con los
  tres incrementos, un destinatario pasa a `FALLIDO` tras uno o dos intentos reales, en silencio.
  **Los dos `increment` de `:499` y `:509` salen en el mismo commit que entra el `SKIP LOCKED`.**
  Por eso el §5.2 entero vive en el paso 5 del §6, que es un paso de código, y no en un paso de
  solo SQL.

### 5.3 Lo que sí falta: la bandeja de ENTRADA

`NO ENCONTRADO: tabla de eventos crudos de webhook, DLQ o cuarentena` (Fase 0 §4). Y
`leads.service.ts:272-277` deja en el log lo que no se pudo guardar.

Esto **no reemplaza `leads_entrantes`** — lo digo explícitamente por el choque 9.
`leads_entrantes` es el lead ya normalizado, con su propia idempotencia
`@@unique([origenSistema, externoId])` (`schema.prisma:791`) y su `carga Json` (`:776`). La
bandeja está **aguas arriba**: es el sobre tal como llegó, antes de validar la firma y antes de
saber si sirve.

```prisma
// backend/prisma/schema.prisma. Va con la migracion, no
// despues: una tabla creada solo en SQL la borra el siguiente
// `migrate dev` (CLAUDE.md:3200-3201).

/// El sobre tal como llegó, antes de validar la firma y antes
/// de saber si sirve. NO sustituye a `LeadEntrante`: está
/// aguas arriba de él.
model AvisoEntrante {
  /// Sin `@default`, como `BitacoraCambio`: lo pone quien
  /// inserta, y así el SQL y el modelo no se pueden separar.
  id String @id

  fuente String
  gremio String?

  /// La llave del emisor, para no procesar dos veces.
  claveDeEvento String?

  firmaValida Boolean

  /// El cuerpo tal cual, en TEXTO y no en JSON. Trae datos
  /// personales: por eso se vacía y por eso tiene retención.
  /// El sobre se queda para siempre; la carta no.
  cuerpo    String?
  vaciadoEn DateTime?

  estado   String
  motivo   String?
  intentos Int       @default(0)
  tomadaEn DateTime?

  recibidoEn  DateTime  @default(now())
  procesadoEn DateTime?

  @@map("avisos_entrantes")
}
```

```sql
-- `fuente` y `estado` son TEXT con CHECK, y NO enums de
-- Postgres. El argumento es el mismo que la corrección 14 hizo
-- contra la versión anterior: un ALTER TYPE ADD VALUE no se
-- puede usar en la misma transacción, y hay quince ALTER TYPE
-- en las 43 migraciones —once de ellos ADD VALUE—, o sea que
-- ese camino se recorre de verdad. Un CHECK se cambia con un
-- ALTER TABLE y ya.
CREATE TABLE "avisos_entrantes" (
    "id"            TEXT NOT NULL,

    "fuente"        TEXT NOT NULL,
    "gremio"        TEXT,

    -- La llave del emisor, para no procesar dos veces.
    "claveDeEvento" TEXT,

    -- Lo que NO cuadra la firma tambien se guarda. Hoy no deja
    -- rastro ninguno, y es el agujero de INV-6.
    "firmaValida"   BOOLEAN NOT NULL,

    -- TEXTO, no JSONB, y es la correccion que mas importa de
    -- esta tabla: un cuerpo que NO PARSEA es exactamente el
    -- caso para el que existe la bandeja, y en una columna
    -- JSONB no se puede guardar de ninguna forma. Es tambien
    -- lo que pedia la remediacion de A-09 en
    -- docs/arquitectura/01-riesgos.csv: «rawBody como bytea o
    -- texto».
    "cuerpo"        TEXT,
    "vaciadoEn"     TIMESTAMP(3),

    "estado"        TEXT NOT NULL,
    "motivo"        TEXT,
    "intentos"      INTEGER NOT NULL DEFAULT 0,
    "tomadaEn"      TIMESTAMP(3),

    "recibidoEn"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadoEn"   TIMESTAMP(3),

    CONSTRAINT "avisos_entrantes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "avisos_entrantes"
  ADD CONSTRAINT "avisos_entrantes_fuente_conocida"
    CHECK ("fuente" IN ('META', 'ORQUESTADOR')),
  ADD CONSTRAINT "avisos_entrantes_estado_conocido"
    CHECK ("estado" IN ('PENDIENTE', 'PROCESADO', 'DESCARTADO', 'ATASCADO')),
  -- «si se vacio, no queda cuerpo». Y NADA MAS.
  --
  -- La version anterior escribia
  --   CHECK (("cuerpo" IS NULL) = ("vaciadoEn" IS NOT NULL))
  -- que rechaza una llegada con el cuerpo vacio o ilegible:
  -- justo lo que esta tabla existe para guardar, y delante del
  -- 200 que la regla 5 exige.
  ADD CONSTRAINT "avisos_entrantes_cuerpo_coherente"
    CHECK ("vaciadoEn" IS NULL OR "cuerpo" IS NULL);

-- Idempotencia. Parcial porque Meta no siempre manda llave.
-- Parcial = invisible para Prisma: §1.2.
CREATE UNIQUE INDEX "avisos_entrantes_una_vez"
    ON "avisos_entrantes"("fuente", "claveDeEvento")
 WHERE "claveDeEvento" IS NOT NULL;

CREATE INDEX "avisos_entrantes_por_tomar"
    ON "avisos_entrantes"("recibidoEn")
 WHERE "estado" = 'PENDIENTE';

-- Y la bitacora, EN ESTA MISMA MIGRACION. El bucle del §1.4 ya
-- corrio y no ve las tablas que nazcan despues. Es la regla del
-- §1.4, y sin esta linea la comprobacion del §1.5 empieza a
-- devolver una fila.
CREATE TRIGGER "bitacora"
  AFTER INSERT OR UPDATE OR DELETE ON "avisos_entrantes"
  FOR EACH ROW EXECUTE FUNCTION "bitacora_apuntar"();
```

**La inserción, con la corrección 15 aplicada:**

```sql
-- ON CONFLICT DO NOTHING, no `create`. La version anterior
-- decia que el unique deduplicaba el reintento; lo que hace un
-- unique en un `create` es lanzar P2002 y ABORTAR la
-- transaccion entera. Aqui el reintento no falla: no hace nada.
INSERT INTO "avisos_entrantes"
    ("id", "fuente", "gremio", "claveDeEvento", "firmaValida", "cuerpo", "estado")
VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE')
ON CONFLICT ("fuente", "claveDeEvento") WHERE "claveDeEvento" IS NOT NULL
DO NOTHING;
```

Y la carta se tira cuando ya no hace falta, sin tirar el sobre:

```sql
-- docs/operacion/04-vaciar-avisos.sql — mensual
\set ON_ERROR_STOP on
\i docs/operacion/00-guardia-de-puerto.sql

UPDATE "avisos_entrantes"
   SET "cuerpo" = NULL, "vaciadoEn" = NOW()
 WHERE "cuerpo" IS NOT NULL
   AND ("estado" IN ('PROCESADO', 'DESCARTADO') OR "recibidoEn" < NOW() - INTERVAL '30 days');
```

Queda para siempre que llegó, de dónde, si la firma cuadraba y qué se hizo. No queda el nombre
de nadie. Rueda con la regla 1 —nada se borra, la fila se queda— y con la 7 de las correcciones
—no se crea una copia de datos personales que nadie pueda podar—.

**Y la regla 5 se cumple mejor que hoy, pero solo en el camino que va después de la firma, y hay
que decirlo.** `leads.controller.ts:176-181` lo explica: Meta reintenta si no recibe 200 y si
insiste sin éxito **apaga el webhook**. Con la bandeja, el `INSERT` y el `200` son lo primero que
pasa y lo único que puede fallar antes de contestar; el proceso viene después, y si se cae, la
fila queda `PENDIENTE` en vez de perderse. **Nada de 202: sigue siendo 200.** Pero
`leads.controller.ts:172-174` lanza `UnauthorizedException` cuando la firma HMAC no cuadra, y ese
`throw` **se queda**: escribir el sobre antes de verificar hace que la firma inválida deje
constancia —que es INV-6—, no que Meta deje de recibir su 401. Cambiar eso es otra decisión y no
la toma este documento.

**Y A-03 deja de ser un 500 con el lead atrapado.** `LeadEntrante.participanteId` es
`String? @unique` (`schema.prisma:783`), así que el segundo lead de la misma persona revienta y
el reintento se autooculta con `repetido: true`. Con la bandeja, ese aviso queda `ATASCADO` con
su motivo y su cuerpo, y es reprocesable. El `@unique` sigue siendo un fallo que hay que
arreglar; deja de ser un fallo **invisible**.

---

## 6 · El camino por pasos

Cinco patrones. Los tres primeros pasos son solo SQL y no tocan una línea de TypeScript.

| Paso | Qué | Toca código | Puede tumbar el arranque |
|---|---|---|---|
| **1** | Migración: `bitacora_cambios` **+ su modelo Prisma** + `bitacora_apuntar()` + triggers + `bitacora_solo_inserta` (§1, §2.2) | no | no: tabla nueva, sin enums, sin restricciones sobre datos viejos, sin roles |
| **2** | Migración: `tomadaEn` en `destinatarios_campana` **+ su campo Prisma** (§5.2); CHECK `NOT VALID` en `grupos_cobertura` (§4.3); vistas (§4.2) | no | no: columna nullable y CHECK `NOT VALID` |
| **3** | Guiones de operación: validar topes, medir la bitácora, primera poda si hace falta (§2.4, §4.3), **todos detrás de `00-guardia-de-puerto.sql`** | no | no: no están en `migrate deploy` |
| **4** | Código: `SELECT set_config('app.actor', $1, true)` como primera sentencia de las **13** transacciones interactivas. Un viaje de red más por transacción, en 13 sitios | sí, aditivo | no |
| **5** | Código: el `SKIP LOCKED` de §5.2 **y quitar los `increment` de `campanas.service.ts:499` y `:509` en el mismo commit**; leer dentro del candado en `reservas.service.ts` y `tableros.service.ts` (F-02, G-01) | sí | no |
| **6** | `propuestas_de_datos` entero y junto: atomicidad + filtro + dedupe + índice (§3.3). **Detrás de la decisión de eje (§8.7)** | sí | no, si va en ese orden |
| **7** | Migración + código: `avisos_entrantes` + su modelo + **su `CREATE TRIGGER "bitacora"` en la misma migración**; la bandeja en `leads.controller.ts` + un worker que la vacíe | sí | no |
| **8** | Operación: el rol `reservasae_app`, `directUrl`, los `REVOKE` (§2.3). **Solo aquí la bitácora pasa a ser inalterable de verdad** | `schema.prisma` + `.env` | sí, si se hace mal: por eso va el último y a mano |
| **9** | El embudo único de lectura de D-02, y solo entonces archivar `participantes` | sí, grande | — |

Las **17** llamadas `$transaction([...])` no entran en el paso 4 ni en ninguno. No hay `tx`
donde meter el `set_config`, y no hace falta: sus escrituras quedan en la bitácora igual, con
`actor` nulo. Si algún día se quiere el actor en `crm.service.ts:1297` —la que escribe
`valores_anteriores`— se convierte esa sola a interactiva, con su propia prueba. Una a una,
nunca por regla general.

`backend/src/crm/rui/` **no aparece en ningún paso.** Sus nueve escrituras sin transacción
siguen exactamente igual, y sus tablas quedan auditadas por el paso 1 sin abrir un archivo.

### Sobre «los cinco patrones»

El §5 de `docs/arquitectura/01-auditoria.md:392` nombra **cuatro**: outbox, auditoría por
trigger, soft-delete uniforme, bloqueo. La cabecera de la versión rechazada decía cinco y entregó
dos. Aquí van cinco, y el quinto no es un relleno: **inmutabilidad y retención** salió del patrón
de auditoría porque las correcciones 7 y 17 demostraron que sin plan de poda y sin decidir qué
pasa con el rol de la base, el patrón de auditoría no se puede desplegar. Y el outbox se entrega
como lo contrario de lo que pedía: se retira, y en su sitio va la cola que ya existe más la
bandeja que no existe.

---

## 7 · Lo que NO se puede hacer, dicho claro

1. **El trigger de auditoría SÍ se puede hacer.** Lo que no se puede hacer es la versión que
   exige contexto: cualquier mecanismo que rechace escrituras sin `app.actor` apaga
   `AuditoriaService`, `rui/` y los dos workers incondicionales. El trigger que apunta con
   `actor` nulo no rompe nada y se despliega el lunes.
2. **La bitácora no puede ser inalterable hoy**, y no por falta de `REVOKE`: la aplicación se
   conecta con el superusuario de la base (`backend/.env.example:9,17`), que ignora todo permiso,
   toda RLS y puede desactivar cualquier trigger. Sin el paso 8, lo que hay es **detección**,
   no inmutabilidad. Escribir el `REVOKE` sin el paso 8 sería seguridad de mentira.
3. **El actor no se puede atribuir de forma fiable desde la base sin tocar código.** No sirve
   poner `app.actor` a nivel de sesión desde un interceptor de Nest: Prisma reparte un pool de
   conexiones y el valor se le quedaría pegado a la conexión y saldría en la petición de otro
   usuario. Solo `set_config(..., true)` —transaccional— es seguro, y eso exige estar dentro de
   una transacción interactiva. De ahí el paso 4, y de ahí que solo cubra 13 sitios.
4. **No se puede serializar los dos workers con un advisory lock de sesión**, y por la misma
   razón del punto 3: el pool. `pg_try_advisory_lock` se le queda pegado a una conexión y el tic
   siguiente recibe `false` para siempre; la variante transaccional se suelta en la primera fila
   del barrido. Ver §4.4. INV-9 —que además es entre sedes, o sea entre bases distintas— queda
   fuera de esta fase.
5. **La papelera de participantes no se puede encender en esta fase.** D-02 no es una columna:
   son 72 consultas Prisma y 28 líneas de SQL crudo, y una de ellas es el reporte al SEP, que es
   el entregable contractual. Encenderla antes del embudo es mandar al SENA a gente archivada.
6. **`admin_convenio`, `respuestas` y `propuestas_de_datos` no se archivan** hasta que sus
   lecturas y sus escritores lo admitan. Archivar antes convierte una mejora en una regresión de
   seguridad, en dos juegos de respuestas para la misma reserva, o en un archivado que se borra
   solo en el siguiente formulario (§3.3).
7. **No hay quién corra la poda ni la verificación.** `NO ENCONTRADO: planificador` y
   `NO ENCONTRADO: integración continua`. Los guiones de operación son guiones de operación de
   verdad: los corre una persona hasta que exista dónde colgarlos.

---

## 8 · Decisiones que requieren aprobación

Van también en el campo estructurado; aquí con el contexto.

1. **El trigger corre dentro de la transacción del negocio: es fail-closed.** Si no se puede
   apuntar, la escritura se cae. Es lo contrario de la decisión escrita en
   `crm.service.ts:1758-1768` y del `catch` de `auditoria.service.ts:132-134`, que son fail-open
   a propósito, y sostengo que ambas son correctas porque son cosas distintas (§1.8). Pero es un
   cambio de modo de fallo y se aprueba a ojos abiertos.
2. **La bitácora se poda a los 18 meses**, con copia a disco antes. Es el único borrado real de
   todo el diseño. El plazo es una propuesta, no un dato del repositorio.
3. **`caracterizaciones_persona` sigue con borrado físico**, como excepción declarada a la
   regla 1, por el artículo 5 de la Ley 1581 y por
   `preinscripcion.service.ts:898-899`.
4. **`directUrl` en el datasource** (`schema.prisma:8-11`) y el rol `reservasae_app`: cambia la
   forma de conectarse en producción y hay que coordinarlo con las tres sedes.
5. **La lista de etapas de `v_sobrecupo_de_cobertura` es una quinta copia** de
   `backend/src/crm/etapas.ts:30-34`, y ese archivo existe justamente porque había cuatro. O se
   acepta con un spec que compare las dos, o la vista se saca del diseño.
6. **Reemplazar `logos.datos` sin tocar ninguna otra columna sí deja rastro** en esta versión
   (una fila con `camposTocados = {datos}`), a costa de que Postgres serialice los bytes en
   memoria para compararlos. Si se prefiere el ahorro, se añade `datos` a la lista ignorada del
   §1.3 y se pierde ese rastro. Recomiendo dejarlo como está.
7. **⚠️ Qué eje gobierna la vitalidad de `propuestas_de_datos`.** Este documento propone
   `archivadoEn`; el documento hermano `maquinas-de-estado` propone `REEMPLAZADA` en
   `EstadoPropuesta` (`schema.prisma:1584-1588`). **Los dos a la vez son dos ejes de vitalidad
   sobre la misma tabla**, que es la trampa por la que el §3.4 no toca `reservas`. Hasta que se
   decida, el paso 6 del §6 no arranca y la tabla se queda como está. Es la única decisión de
   este documento que bloquea trabajo.

---

## 9 · NO ENCONTRADO

Todo con el comando, no con un silencio.

- **Ningún `GRANT`, `REVOKE`, `ROW LEVEL SECURITY`, `CREATE TRIGGER` ni `CREATE FUNCTION` en las
  43 migraciones.**
  `grep -rniE "grant |revoke |row level security|CREATE TRIGGER|CREATE FUNCTION" backend/prisma/migrations`
  → 0 líneas.
- **Ningún `$extends`, `Prisma.defineExtension` ni `AsyncLocalStorage` en el backend.**
  `grep -rn "\$extends\|AsyncLocalStorage\|defineExtension" backend/src backend/prisma --include=*.ts`
  → 0 líneas. La extensión de la versión anterior habría sido el primer mecanismo de su clase en
  el repositorio.
- **Ninguna clave primaria que no sea `String`, y ninguna compuesta.**
  `grep -n "@id" backend/prisma/schema.prisma | grep -v String` → 0 líneas;
  `grep -c "@@id" backend/prisma/schema.prisma` → 0;
  `grep -rn 'CREATE TABLE "_' backend/prisma/migrations` → 0 (no hay tablas implícitas de N-M).
  Por eso `to_jsonb(NEW) ->> 'id'` sirve para las 43 tablas.
- **Ninguna tabla ni modelo llamado `bitacora` o `bandeja`.**
  `grep -rni "bitacora\|bandeja" backend/prisma/schema.prisma` → 0. Las dos únicas coincidencias
  en `backend/src` son la palabra «bandeja» en comentarios
  (`correo/campanas/base-cargada.ts:13`, `preinscripcion/preinscripcion.service.ts:363`).
- **Ningún `useGlobalFilters` ni `ExceptionFilter` en `backend/src/main.ts`.**
  `grep -n "useGlobalFilters\|ExceptionFilter" backend/src/main.ts` → 0. Sigue en pie el
  hallazgo 9 de Fase 0: una violación de CHECK o un P2002 salen como 500 crudo. **Y esto no lo
  arregla `NOT VALID`:** `NOT VALID` solo se salta el escaneo inicial de las filas viejas, y la
  restricción sigue comprobándose en todo INSERT y UPDATE posterior (§4.3). Lo que sostiene que
  ninguna restricción de este documento salte en una ruta de usuario no es la cláusula, sino los
  escritores: `grupos_cobertura` tiene uno solo y valida antes (`cronograma.service.ts:209-213`,
  `cronograma/dto.ts:57,63`), y el índice único de `propuestas_de_datos` se retiró de los pasos
  de solo SQL justamente porque sí podía saltar (§3.3). El filtro global sigue haciendo falta.
- **Ningún `directUrl` en el datasource.** `backend/prisma/schema.prisma:8-11` solo tiene `url`.
- **Ningún planificador.** Confirmado el `NO ENCONTRADO` de Fase 0 §1:
  `grep -rnE "@nestjs/schedule|@Cron|node-cron|bullmq|bull|agenda" backend/src backend/package.json`
  → 1 línea, y es la palabra «agenda» dentro de un comentario
  (`backend/src/crm/tablero-academico.ts:86`). Cero planificadores de verdad: solo
  `setTimeout`/`setInterval` en proceso. No hay dónde colgar la poda ni la comprobación del §1.5.
