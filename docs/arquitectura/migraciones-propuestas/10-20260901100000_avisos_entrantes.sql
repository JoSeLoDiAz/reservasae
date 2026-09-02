-- 20260901100000_avisos_entrantes
-- Despliegue 4 · paso expand · orden 10 de 12
-- Arregla: A-09, A-11, A-08, A-16 e INV-6: el sobre crudo no se persiste ni antes ni despues. Firma invalida -> cero rastro (leads.controller.ts:166-174 lanza y no queda ni una linea); un campo extra el dia que el orquestador anada utm_campaign -> 400 y cero filas.
--
-- AUDITADA POR SEPARADO: SEGURA de aplicar sola.
-- APROBADA para aplicar sola: no puede tumbar el arranque, no espera candados, no inventa nombres y el rollback es correcto. Pero NO se aplica sin cerrar tres cosas.  LO QUE ESTA BIEN Y MERECE DECIRSE. El CHECK "avisos_entrantes_cuerpo_coherente" (`"vaciadoEn" IS NULL OR "cuerpo" IS NULL`) es la version correcta: ninguno de los dos operandos puede dar NULL, asi que no hay el agujero clasico del CHEC
--
-- PASO MANUAL PREVIO, obligatorio:
--   La tabla vacia NO cumple INV-6: el INSERT en leads.controller.ts va en el mismo despliegue, y tiene que ser ON CONFLICT DO NOTHING y no un `create` --lo que hace un unique en un create es lanzar P2002 y abortar la transaccion entera, y aqui el reintento no debe fallar, debe no hacer nada. Y hay que aprobar antes las dos cosas que abre, porque escribir antes de validar convierte una ruta publica sin guard (leads.controller.ts:149, al reves que su hermana de :66) en un INSERT por peticion: (a) TOPE DE TAMANO del cuerpo comprobado ANTES del INSERT --por encima se descarta y se anota el descarte, no el cuerpo--; (b) EL GUION MENSUAL DE VACIADO (UPDATE cuerpo = NULL, vaciadoEn = NOW()), con la guarda de puerto delante, porque `cuerpo` trae datos personales y esta tabla no la poda la aplicacion. Sin ese guion, esta tabla es la copia de datos personales que nadie se acuerda de proteger, que es lo que clase-de-dato.ts:3-10 existe para evitar.
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- A-09 e INV-6. El sobre tal como llego, ANTES de validar la
-- firma y antes de saber si sirve.
--
-- NO SUSTITUYE A `leads_entrantes`, y lo digo explicitamente:
-- `leads_entrantes` es el lead ya normalizado, con su propia
-- idempotencia @@unique([origenSistema, externoId])
-- (schema.prisma:791) y su `carga Json` (:776). Esta tabla esta
-- AGUAS ARRIBA de aquella.
--
-- Hoy, cuando la firma no cuadra, leads.controller.ts:166-174
-- lanza UnauthorizedException y NO QUEDA NADA, ni siquiera una
-- linea de log. Eso es INV-6 sin cumplir.

CREATE TABLE "avisos_entrantes" (
    "id"            TEXT NOT NULL,

    "fuente"        TEXT NOT NULL,
    "gremio"        TEXT,

    -- La llave del emisor, para no procesar dos veces.
    "claveDeEvento" TEXT,

    -- Lo que NO cuadra la firma tambien se guarda. Hoy no deja
    -- rastro ninguno, y ese es el agujero de INV-6.
    "firmaValida"   BOOLEAN NOT NULL,

    -- TEXTO, no JSONB, y es lo que mas importa de esta tabla: un
    -- cuerpo que NO PARSEA es exactamente el caso para el que
    -- existe la bandeja, y en una columna JSONB no se puede
    -- guardar de ninguna forma.
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

-- `fuente` y `estado` son TEXT con CHECK, y NO enums de
-- Postgres. El argumento es el de siempre: un ALTER TYPE ADD
-- VALUE no se puede usar en la misma transaccion, y hay quince
-- ALTER TYPE en las 43 migraciones, once de ellos ADD VALUE, o
-- sea que ese camino se recorre de verdad. Un CHECK se cambia
-- con un ALTER TABLE y ya.
ALTER TABLE "avisos_entrantes"
  ADD CONSTRAINT "avisos_entrantes_fuente_conocida"
    CHECK ("fuente" IN ('META', 'ORQUESTADOR')),
  ADD CONSTRAINT "avisos_entrantes_estado_conocido"
    CHECK ("estado" IN ('PENDIENTE', 'PROCESADO', 'DESCARTADO', 'ATASCADO')),
  -- «si se vacio, no queda cuerpo». Y NADA MAS. La version
  -- anterior escribia
  --   CHECK (("cuerpo" IS NULL) = ("vaciadoEn" IS NOT NULL))
  -- que RECHAZA una llegada con el cuerpo vacio o ilegible: justo
  -- lo que esta tabla existe para guardar, y delante del 200 que
  -- la regla 5 exige.
  ADD CONSTRAINT "avisos_entrantes_cuerpo_coherente"
    CHECK ("vaciadoEn" IS NULL OR "cuerpo" IS NULL);

-- Idempotencia. Parcial porque Meta no siempre manda llave.
-- Parcial = invisible para Prisma (D-05).
CREATE UNIQUE INDEX "avisos_entrantes_una_vez"
    ON "avisos_entrantes"("fuente", "claveDeEvento")
 WHERE "claveDeEvento" IS NOT NULL;

CREATE INDEX "avisos_entrantes_por_tomar"
    ON "avisos_entrantes"("recibidoEn")
 WHERE "estado" = 'PENDIENTE';

-- Y LA BITACORA, EN ESTA MISMA MIGRACION. El bucle de
-- 20260831091500 ya corrio y no ve las tablas que nazcan
-- despues. Sin esta linea, la comprobacion de «tablas sin
-- bitacora» empieza a devolver una fila.
CREATE TRIGGER "bitacora"
  AFTER INSERT OR UPDATE OR DELETE ON "avisos_entrantes"
  FOR EACH ROW EXECUTE FUNCTION "bitacora_apuntar"();

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- 1. El nombre esta libre.
-- SELECT to_regclass('public.avisos_entrantes') IS NULL AS "tabla libre";
-- -- Esperado: TRUE. Cuidado con no confundirla con `avisos_de_cupos`,
-- -- que si existe y es otra cosa.
-- 
-- -- 2. La funcion de la bitacora tiene que estar, porque esta
-- --    migracion cuelga el trigger. Si no esta, falla.
-- SELECT to_regproc('public.bitacora_apuntar') IS NOT NULL AS "la funcion esta";
-- -- Esperado: TRUE
-- 
-- -- 3. El censo de tablas de negocio ANTES, para comprobar despues
-- --    que la nueva quedo auditada y el conteo subio de 43 a 44.
-- SELECT count(*) FROM pg_trigger WHERE tgname = 'bitacora' AND NOT tgisinternal;
-- -- Esperado: 43

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- 1. La tabla, sus tres CHECK y sus dos indices.
-- SELECT (SELECT count(*) FROM pg_constraint
--           WHERE conrelid = 'avisos_entrantes'::regclass AND contype = 'c') AS "checks",
--        (SELECT count(*) FROM pg_indexes
--           WHERE tablename = 'avisos_entrantes')                            AS "indices";
-- -- Esperado: 3 checks; 3 indices (la PK mas los dos declarados)
-- 
-- -- 2. LA REGLA DEL §1.4: ninguna tabla sin bitacora. Esta es la
-- --    consulta que esta migracion existe para no romper.
-- SELECT c.relname AS "tabla sin bitacora"
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relkind = 'r'
--    AND c.relname NOT IN ('_prisma_migrations', 'bitacora_cambios')
--    AND NOT EXISTS (SELECT 1 FROM pg_trigger g
--                     WHERE g.tgrelid = c.oid AND NOT g.tgisinternal AND g.tgname = 'bitacora');
-- -- Esperado: CERO filas.
-- 
-- SELECT count(*) FROM pg_trigger WHERE tgname = 'bitacora' AND NOT tgisinternal;
-- -- Esperado: 44
-- 
-- -- 3. INVARIANTE que la tabla existe para sostener: un aviso con
-- --    cuerpo vaciado no conserva cuerpo. Debe dar 0 siempre.
-- SELECT count(*) AS "vaciados que aun tienen cuerpo"
--   FROM "avisos_entrantes" WHERE "vaciadoEn" IS NOT NULL AND "cuerpo" IS NOT NULL;
-- -- Esperado: 0
-- 
-- -- 4. La idempotencia funciona y NO lanza: el reintento no hace
-- --    nada, no aborta la transaccion. (Prueba tomada del juego B,
-- --    y es la forma exacta que el codigo tiene que usar.)
-- BEGIN;
--   INSERT INTO "avisos_entrantes"
--       ("id","fuente","claveDeEvento","firmaValida","cuerpo","estado")
--   VALUES (gen_random_uuid()::text,'META','prueba-1',true,'{}','PENDIENTE')
--   ON CONFLICT ("fuente","claveDeEvento") WHERE "claveDeEvento" IS NOT NULL
--   DO NOTHING;
--   INSERT INTO "avisos_entrantes"
--       ("id","fuente","claveDeEvento","firmaValida","cuerpo","estado")
--   VALUES (gen_random_uuid()::text,'META','prueba-1',true,'{}','PENDIENTE')
--   ON CONFLICT ("fuente","claveDeEvento") WHERE "claveDeEvento" IS NOT NULL
--   DO NOTHING;
--   SELECT count(*) AS "debe ser 1" FROM "avisos_entrantes"
--    WHERE "claveDeEvento" = 'prueba-1';
-- ROLLBACK;
-- 
-- -- 5. Y el que hay que mirar cuando el codigo entre -- es la
-- --    respuesta a INV-6, que hoy no se puede contestar:
-- SELECT "fuente", "firmaValida", "estado", count(*)
--   FROM "avisos_entrantes" GROUP BY 1,2,3 ORDER BY 4 DESC;
-- -- Las filas con firmaValida = false son las que hoy desaparecen
-- -- sin dejar rastro.
-- 
-- -- Criterio: si (1) no da 3 y 3, o si (2) devuelve alguna fila o el
-- -- conteo no es 44, SE REVIERTE.

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- -- OJO: esta tabla es la unica constancia de los avisos con firma
-- -- invalida. Antes de tirarla, sacarla a disco:
-- --   \copy (SELECT "id","fuente","gremio","claveDeEvento","firmaValida",
-- --                 "estado","motivo","recibidoEn","procesadoEn"
-- --            FROM "avisos_entrantes") TO 'avisos-entrantes.csv' CSV HEADER
-- -- (Se omite "cuerpo" a proposito: trae datos personales.)
-- --
-- -- Y el rollback recomendado NO es este: es dejar la tabla y
-- -- apagar el codigo que la escribe. La tabla vacia no molesta a
-- -- nadie y lo guardado se conserva.
-- DROP TRIGGER IF EXISTS "bitacora" ON "avisos_entrantes";
-- DROP TABLE IF EXISTS "avisos_entrantes";
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260901100000_avisos_entrantes';
