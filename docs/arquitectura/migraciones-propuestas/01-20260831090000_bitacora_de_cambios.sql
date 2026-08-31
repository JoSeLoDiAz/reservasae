-- 20260831090000_bitacora_de_cambios
-- Despliegue 1 · paso expand · orden 1 de 12
-- Arregla: C-01, C-14, C-06, C-16 e INV-3: hoy la unica huella de que se toco una fila depende de que alguien se acuerde de llamar a AuditoriaService. Esta tabla la apunta la base.
--
-- AUDITADA POR SEPARADO: SEGURA de aplicar sola.
-- SEGURA: se aplica sola sin riesgo de tumbar el arranque. No puede fallar (solo crea objetos nuevos, con los tres nombres libres comprobados contra las 43 migraciones) y no puede esperar candado (no toca ni una relacion existente; el ACCESS EXCLUSIVE sobre las 43 tablas queda para la migracion 2, que es el motivo de partirla y esta bien partida). Rollback valido y en el orden correcto -- triggers, 
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- Bitacora de cambios: QUE se toco, lo apunta la base y no el
-- programa. C-01, C-14, C-06, E-01. INV-3.
--
-- Esta migracion NO cuelga el trigger de ninguna tabla de
-- negocio: eso es la siguiente, y se parten porque colgar toma
-- ACCESS EXCLUSIVE sobre las 43 tablas a la vez y es lo unico
-- de este bloque que puede quedarse esperando un candado ajeno.
--
-- Aqui NO va el valor de ninguna columna de ninguna tabla,
-- nunca. Solo nombres. Una segunda copia de datos personales
-- es la copia que nadie se acuerda de proteger.

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

-- NUNCA exige contexto. Si `app.actor` no esta puesto, la fila
-- se escribe igual con actor NULL. Un mecanismo de auditoria
-- que puede rechazar la escritura que audita se convierte, el
-- dia que falla, en un sistema que no escribe.
--
-- SECURITY DEFINER a proposito: es lo que permite que manana el
-- rol de la aplicacion NO tenga escritura directa sobre esta
-- tabla y aun asi la bitacora se llene.
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
    -- `actualizadoEn` es la UNICA columna que se ignora, y es
    -- porque `@updatedAt` la mueve en cada escritura del ORM.
    -- `version` NO se ignora: PoliticaDatos.version es la
    -- prueba de habeas data.
    v_antes   := to_jsonb(OLD) - 'actualizadoEn';
    v_despues := to_jsonb(NEW) - 'actualizadoEn';

    SELECT array_agg(k ORDER BY k) INTO v_campos
      FROM jsonb_object_keys(v_despues) AS k
     WHERE v_antes -> k IS DISTINCT FROM v_despues -> k;

    -- Solo se movio la marca de tiempo: no hay nada que contar.
    IF v_campos IS NULL THEN
      RETURN NULL;
    END IF;

    v_fila := v_despues ->> 'id';

  ELSIF TG_OP = 'INSERT' THEN
    v_campos := '{}';
    v_fila   := to_jsonb(NEW) ->> 'id';

  ELSE  -- DELETE
    -- Apunta QUE la fila desaparecio y CUAL era. NO apunta que
    -- tenia dentro: ejercer el derecho de supresion no crea
    -- aqui una copia de lo suprimido.
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

-- La puerta cerrada por dentro. No protege del dueno de la
-- base: un superusuario la desactiva. Protege de lo que de
-- verdad pasa --un deleteMany mal escrito, un guion de
-- mantenimiento, el $executeRawUnsafe de
-- backend/prisma/aplicar-migracion.mjs:43-- y desactivarla deja
-- rastro en el log del servidor, que es mas de lo que hay hoy.
CREATE OR REPLACE FUNCTION "bitacora_es_solo_de_lectura"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION
    'La bitacora no se corrige ni se borra desde la aplicacion (intento de %).', TG_OP
    USING ERRCODE = '42501';
END;
$fn$;

DROP TRIGGER IF EXISTS "bitacora_solo_inserta" ON "bitacora_cambios";
CREATE TRIGGER "bitacora_solo_inserta"
  BEFORE UPDATE OR DELETE ON "bitacora_cambios"
  FOR EACH ROW EXECUTE FUNCTION "bitacora_es_solo_de_lectura"();

-- TRUNCATE necesita su propio trigger: no admite FOR EACH ROW.
DROP TRIGGER IF EXISTS "bitacora_sin_truncate" ON "bitacora_cambios";
CREATE TRIGGER "bitacora_sin_truncate"
  BEFORE TRUNCATE ON "bitacora_cambios"
  FOR EACH STATEMENT EXECUTE FUNCTION "bitacora_es_solo_de_lectura"();

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- Las tres tienen que salir TRUE. Si alguna sale FALSE, no se despliega.
-- SELECT to_regclass('public.bitacora_cambios') IS NULL   AS "libre el nombre de tabla",
--        to_regproc('public.bitacora_apuntar')   IS NULL   AS "libre el nombre de funcion",
--        current_setting('server_version_num')::int >= 130000
--                                                         AS "postgres 13 o mas";
-- 
-- -- Y el censo con el que se compara despues: 43 tablas de negocio.
-- SELECT count(*) AS "tablas de negocio"
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relkind = 'r'
--    AND c.relname <> '_prisma_migrations';
-- -- Esperado: 43  (comprobado: `grep -c "@@map(" schema.prisma` -> 43)

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- 1. La tabla existe y esta vacia.
-- SELECT count(*) AS "filas" FROM "bitacora_cambios";
-- -- Esperado: 0
-- 
-- -- 2. Las dos funciones, y la de apuntar en SECURITY DEFINER.
-- SELECT count(*)                                              AS "funciones",
--        count(*) FILTER (WHERE proname='bitacora_apuntar' AND prosecdef) AS "definer"
--   FROM pg_proc
--  WHERE proname IN ('bitacora_apuntar','bitacora_es_solo_de_lectura');
-- -- Esperado: 2 y 1
-- 
-- -- 3. La puerta cerrada: dos triggers propios sobre la bitacora.
-- SELECT count(*) FROM pg_trigger
--  WHERE tgrelid = 'bitacora_cambios'::regclass AND NOT tgisinternal;
-- -- Esperado: 2
-- 
-- -- 4. NINGUNA tabla de negocio auditada todavia: eso es la siguiente.
-- SELECT count(*) FROM pg_trigger WHERE tgname = 'bitacora' AND NOT tgisinternal;
-- -- Esperado: 0
-- 
-- -- 5. INVARIANTE: la bitacora rechaza que la corrijan. El UPDATE
-- --    DEBE fallar con 42501. Si NO falla, se revierte la migracion.
-- BEGIN;
--   INSERT INTO "bitacora_cambios"
--     ("id","tabla","filaId","operacion","camposTocados","txId","origen","actor","ocurrioEn")
--   VALUES ('prueba-de-humo','x',NULL,'INSERT','{}',0,NULL,NULL,now());
--   UPDATE "bitacora_cambios" SET "tabla" = 'y' WHERE "id" = 'prueba-de-humo';
-- ROLLBACK;
-- 
-- -- Criterio: si (1) no es 0, si (2) no es 2 y 1, si (3) no es 2,
-- -- si (4) no es 0, o si el UPDATE de (5) pasa sin error, SE REVIERTE.

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- -- Se puede correr entera: en este punto la tabla esta vacia
-- -- porque el trigger no cuelga todavia de ninguna tabla.
-- DROP TRIGGER IF EXISTS "bitacora_sin_truncate" ON "bitacora_cambios";
-- DROP TRIGGER IF EXISTS "bitacora_solo_inserta" ON "bitacora_cambios";
-- DROP FUNCTION IF EXISTS "bitacora_es_solo_de_lectura"();
-- DROP FUNCTION IF EXISTS "bitacora_apuntar"() CASCADE;
-- DROP TABLE IF EXISTS "bitacora_cambios";
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260831090000_bitacora_de_cambios';
