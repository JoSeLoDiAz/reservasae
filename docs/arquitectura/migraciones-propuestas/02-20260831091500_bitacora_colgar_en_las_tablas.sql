-- 20260831091500_bitacora_colgar_en_las_tablas
-- Despliegue 1 · paso migrate · orden 2 de 12
-- Arregla: La segunda mitad de INV-3: sin esto la tabla de la 1 existe pero no la llena nadie. Cierra tambien la parte de D-02/C-10 que se puede cerrar hoy: al borrar un participante queda ('participantes', <id>, 'DELETE') y una fila por cada valores_anteriores que se fue con el, sin un solo valor.
--
-- AUDITADA POR SEPARADO: *** NO SE DESPLIEGA TAL CUAL ***
-- CORRECTA EN LO SUSTANCIAL, con tres pegas concretas y una advertencia de coste. Comprobado uno por uno: los 43 son exactos (43 modelos, 43 @@map en schema.prisma; `directorio_nit` no es huerfana, se renombro a `instituciones` en 20260823140000/migration.sql:21), las tres tablas de excepcion existen (schema.prisma:1578, 1920, 1843), las cuatro columnas vigiladas existen (20260828010000/migration.sq
--
-- PASO MANUAL PREVIO, obligatorio:
--   PM-1. DOS cosas, y ninguna es un comando de base de datos. (a) VENTANA TRANQUILA: correr la verificacion previa 3 y no desplegar hasta que devuelva cero filas. Esta migracion retiene 43 ACCESS EXCLUSIVE hasta el COMMIT; con una transaccion larga abierta ESPERA, y el peligro no es la espera sino que alguien la MATE: Prisma deja la fila sin finished_at, el siguiente arranque da P3009 y con `set -e` (backend/arrancar.sh:7, comprobado) eso si es el ciclo de reinicios, del que solo se sale con `prisma migrate resolve` a mano. (b) VISTO BUENO DEL DUENO, por escrito, ANTES: a partir del COMMIT el trigger es fail-closed --corre dentro de la transaccion del negocio, asi que si falla el apunte se cae la escritura del usuario--, que es lo contrario del fail-open deliberado de crm.service.ts:1758-1768. Ese cambio de semantica no se aprueba desde el codigo.
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- Se cuelga de todas las tablas de `public` menos dos, y se lee
-- de `pg_class`: asi no hay una lista de 43 nombres que pueda
-- quedarse vieja.
--
-- Va SIN `lock_timeout` a proposito: esperar deja el arranque
-- colgado un rato; fallar lo deja sin arrancar. Se despliega en
-- una ventana tranquila.
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
      -- mueve un pixel en el cliente de correo de otra persona,
      -- no un acto de nadie: no entran. El INSERT tampoco: la
      -- lista se arma en un solo acto, y ese acto ya queda en
      -- `campanas`.
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

-- REGLA QUE ACOMPANA A ESTA MIGRACION: este bucle solo ve las
-- tablas que existian el dia que corrio, y eso vale tambien
-- dentro del mismo `migrate deploy`. Toda migracion que cree una
-- tabla cuelga el trigger EN LA MISMA MIGRACION. Aqui la unica
-- afectada es `avisos_entrantes`, y su CREATE TRIGGER va escrito
-- en su propia migracion.

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- 1. La funcion tiene que estar. Si no, esta migracion falla.
-- SELECT to_regproc('public.bitacora_apuntar') IS NOT NULL AS "la funcion esta";
-- -- Esperado: TRUE
-- 
-- -- 2. Cuantas se van a colgar.
-- SELECT count(*) AS "tablas a colgar"
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relkind = 'r'
--    AND c.relname NOT IN ('_prisma_migrations', 'bitacora_cambios');
-- -- Esperado: 43
-- 
-- -- 3. LA IMPORTANTE. Esta migracion toma ACCESS EXCLUSIVE sobre
-- --    las 43 tablas A LA VEZ y los retiene hasta el COMMIT.
-- --    Con una transaccion larga abierta, ESPERA.
-- SELECT pid, state, now() - xact_start AS "lleva abierta", left(query, 80) AS "consulta"
--   FROM pg_stat_activity
--  WHERE xact_start IS NOT NULL
--    AND now() - xact_start > INTERVAL '5 seconds'
--    AND pid <> pg_backend_pid()
--  ORDER BY 3 DESC;
-- -- Esperado: CERO filas. Si devuelve alguna, se espera a que cierren.

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- 1. Tablas sin bitacora. DEBE devolver CERO filas.
-- SELECT c.relname AS "tabla sin bitacora"
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relkind = 'r'
--    AND c.relname NOT IN ('_prisma_migrations', 'bitacora_cambios')
--    AND NOT EXISTS (SELECT 1 FROM pg_trigger g
--                     WHERE g.tgrelid = c.oid AND NOT g.tgisinternal
--                       AND g.tgname = 'bitacora')
--  ORDER BY 1;
-- 
-- -- 2. El conteo.
-- SELECT count(*) FROM pg_trigger WHERE tgname = 'bitacora' AND NOT tgisinternal;
-- -- Esperado: 43
-- 
-- -- 3. Las tres excepciones existen y no son AFTER INSERT.
-- SELECT c.relname, pg_get_triggerdef(g.oid) AS "definicion"
--   FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
--  WHERE g.tgname = 'bitacora'
--    AND c.relname IN ('registros_auditoria','valores_anteriores','destinatarios_campana')
--  ORDER BY 1;
-- -- Esperado: 3 filas, ninguna con INSERT en su definicion.
-- 
-- -- 4. INVARIANTE DE HUMO: un UPDATE que no cambia nada NO deja
-- --    fila; uno que cambia algo deja UNA, con el nombre de la
-- --    columna y NINGUN valor.
-- BEGIN;
--   SELECT count(*) AS "antes" FROM "bitacora_cambios";
--   UPDATE "convenios" SET "orden" = "orden"
--    WHERE "id" = (SELECT "id" FROM "convenios" ORDER BY "id" LIMIT 1);
--   SELECT count(*) AS "tras el no-cambio" FROM "bitacora_cambios";
--   UPDATE "convenios" SET "orden" = "orden" + 1
--    WHERE "id" = (SELECT "id" FROM "convenios" ORDER BY "id" LIMIT 1);
--   SELECT "tabla", "operacion", "camposTocados", "actor"
--     FROM "bitacora_cambios" ORDER BY "ocurrioEn" DESC LIMIT 1;
-- ROLLBACK;
-- -- Esperado: "tras el no-cambio" IGUAL a "antes"; y la ultima fila
-- -- convenios | UPDATE | {orden} | NULL
-- -- (`convenios.orden` existe: schema.prisma:42.)
-- 
-- -- Criterio: si (1) devuelve alguna fila, si (2) no es 43, o si el
-- -- no-cambio de (4) deja rastro, SE REVIERTE (se descuelgan los
-- -- triggers) y se investiga antes de volver a intentarlo.

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- -- Descuelga los 43 triggers. La TABLA NO SE TOCA: lo que ya se
-- -- apunto no se tira (regla 1). Si se quisiera tirar tambien la
-- -- tabla, hay que revertir antes esta y despues la 090000.
-- DO $descolgar$
-- DECLARE
--   t record;
-- BEGIN
--   FOR t IN
--     SELECT c.relname
--       FROM pg_class c
--       JOIN pg_namespace n ON n.oid = c.relnamespace
--      WHERE n.nspname = 'public' AND c.relkind = 'r'
--        AND c.relname NOT IN ('_prisma_migrations', 'bitacora_cambios')
--   LOOP
--     EXECUTE format('DROP TRIGGER IF EXISTS "bitacora" ON public.%I', t.relname);
--   END LOOP;
-- END
-- $descolgar$;
-- 
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260831091500_bitacora_colgar_en_las_tablas';
