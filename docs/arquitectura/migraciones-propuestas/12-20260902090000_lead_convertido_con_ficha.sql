-- 20260902090000_lead_convertido_con_ficha
-- Despliegue 5 · paso contract · orden 12 de 12
-- Arregla: D-03: un lead CONVERTIDO sin ficha es un estado imposible que hoy se alcanza. El ON DELETE SET NULL de leads_entrantes.participanteId (schema.prisma:789 y 20260828090000_.../migration.sql:53, las dos comprobadas) lo produce cada vez que se borra una participacion, y con el se pierde la trazabilidad 
--
-- AUDITADA POR SEPARADO: SEGURA de aplicar sola.
-- El SQL esta bien y no puede fallar por datos: los nombres existen todos (leads_entrantes_participanteId_fkey y participantes(id) comprobados en 20260828090000/migration.sql:53 y 42), el CHECK va NOT VALID a proposito, el rollback es ejecutable, deshace de verdad y borra su fila de _prisma_migrations. El riesgo de arranque es solo el candado: el DROP CONSTRAINT toma ACCESS EXCLUSIVE tambien sobre \
--
-- PASO MANUAL PREVIO, obligatorio:
--   TRES REQUISITOS DE CODIGO, y los tres se comprueban antes de lanzar. (1) P0-5 DESPLEGADO: borrarParticipacion tiene que negarse antes, con un mensaje. A partir de esta migracion, cualquier borrado fisico de una ficha con lead detras sale como error de clave foranea, y eso es lo que se quiere; sin el codigo que se niega antes, el gestor recibe un 500 crudo. (2) EL ExceptionFilter GLOBAL: comprobado hoy que no existe (`grep -n "useGlobalFilters|ExceptionFilter" backend/src/main.ts` -> 0), asi que 23503 y 23514 salen sin traducir. (3) LA LINEA DE LA SIEMBRA: `await prisma.leadEntrante.deleteMany();` antes de prueba.ts:349, en el mismo commit; si no, resembrar en desarrollo aborta. Y el VALIDATE del CHECK NO va aqui: va en guion de operacion, y solo despues de decidir que se hace con los leads CONVERTIDO cuya ficha ya no existe, que es una decision de negocio y no de esquema.
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- D-03. Un lead CONVERTIDO sin ficha es un estado imposible que
-- HOY se puede alcanzar: el ON DELETE SET NULL de
-- leads_entrantes.participanteId (schema.prisma:789,
-- migrations/20260828090000_.../migration.sql:53) lo produce cada
-- vez que se borra una participacion. El lead queda en un estado
-- que ninguna consulta detecta, y con el se pierde la
-- trazabilidad de origen: de que anuncio vino, cuanto costo, que
-- campana la trajo.
--
-- Va DESPUES de P0-5 (borrarParticipacion se niega a destruir) y
-- DESPUES del ExceptionFilter global. Si entra antes, el gestor
-- recibe un error de FK como 500 crudo en vez de un mensaje.
--
-- Restrict es coherente con las otras cinco relaciones Restrict
-- de Participante (schema.prisma:933-938): que un borrado
-- accidental ABORTE en vez de mutilar en silencio.
--
-- En schema.prisma, EN ESTE MISMO COMMIT:
--   :789  onDelete: SetNull  ->  onDelete: Restrict
ALTER TABLE "leads_entrantes"
  DROP CONSTRAINT IF EXISTS "leads_entrantes_participanteId_fkey";

ALTER TABLE "leads_entrantes"
  ADD CONSTRAINT "leads_entrantes_participanteId_fkey"
  FOREIGN KEY ("participanteId") REFERENCES "participantes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Y el estado imposible, con nombre.
--
-- NOT VALID a proposito: es MUY probable que ya haya filas asi,
-- porque el SetNull lleva vivo desde que existe la tabla.
-- Validarlo va en guion de operacion, despues de arreglar las
-- que haya --y "arreglar" aqui significa decidir que se hace con
-- un lead cuya ficha ya no existe, que es una decision de
-- negocio y no de esquema.
ALTER TABLE "leads_entrantes"
  ADD CONSTRAINT "leads_entrantes_convertido_con_ficha"
  CHECK ("estado" <> 'CONVERTIDO' OR "participanteId" IS NOT NULL) NOT VALID;

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- 1. Cuantos leads estan YA en el estado imposible. Es el numero
-- --    que dice cuanta trazabilidad de pauta se ha perdido, y el
-- --    que habra que arreglar antes de poder VALIDATE.
-- SELECT count(*) AS "CONVERTIDO sin ficha"
--   FROM "leads_entrantes"
--  WHERE "estado" = 'CONVERTIDO' AND "participanteId" IS NULL;
-- 
-- -- 2. La FK actual, para confirmar el nombre exacto antes de
-- --    tirarla.
-- SELECT conname, confdeltype FROM pg_constraint
--  WHERE conrelid = 'leads_entrantes'::regclass AND contype = 'f';
-- -- confdeltype 'n' = SET NULL, 'r' = RESTRICT
-- 
-- -- 3. Y LA COMPROBACION QUE NO ES SQL, y que nadie documento:
-- --    backend/prisma/seed/prueba.ts:344-360 (borrarLoSembrado)
-- --    borra ocho tablas en orden inverso a las dependencias y NO
-- --    borra leadEntrante. Hoy funciona porque el SET NULL lo
-- --    tapa. Con RESTRICT, el
-- --    `prisma.participante.deleteMany()` de :349 ABORTA la
-- --    siembra entera el dia que un lead apunte a una ficha
-- --    sembrada --y en desarrollo eso pasa, porque
-- --    meta-pruebas.controller.ts es un banco de pruebas vivo.
-- --    Hay que anadir `await prisma.leadEntrante.deleteMany();`
-- --    antes de :349, EN EL MISMO COMMIT. (La misma linea cubre el
-- --    Restrict de `personaId` de la migracion 3.)

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- a. La FK es RESTRICT.
-- SELECT conname, confdeltype FROM pg_constraint
--  WHERE conrelid = 'leads_entrantes'::regclass AND contype = 'f';
-- -- esperado: confdeltype = 'r'
-- 
-- -- b. Borrar una ficha con lead detras ahora ABORTA en vez de
-- --    mutilar. Debe fallar con 23503.
-- BEGIN;
--   DELETE FROM "participantes"
--    WHERE id = (SELECT "participanteId" FROM "leads_entrantes"
--                 WHERE "participanteId" IS NOT NULL LIMIT 1);
-- ROLLBACK;
-- 
-- -- c. El CHECK esta, NOT VALID.
-- SELECT conname, convalidated FROM pg_constraint
--  WHERE conname = 'leads_entrantes_convertido_con_ficha';
-- 
-- -- d. Y la siembra sigue corriendo:
-- --      pnpm db:sembrar-prueba
-- --    contra una base de DESARROLLO (nunca el 5433). Si aborta
-- --    con un error de clave foranea sobre leads_entrantes, es el
-- --    punto 3 de la verificacion previa y falta la linea en
-- --    borrarLoSembrado().

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- ALTER TABLE "leads_entrantes"
--   DROP CONSTRAINT IF EXISTS "leads_entrantes_convertido_con_ficha";
-- 
-- ALTER TABLE "leads_entrantes"
--   DROP CONSTRAINT IF EXISTS "leads_entrantes_participanteId_fkey";
-- ALTER TABLE "leads_entrantes"
--   ADD CONSTRAINT "leads_entrantes_participanteId_fkey"
--   FOREIGN KEY ("participanteId") REFERENCES "participantes"("id")
--   ON DELETE SET NULL ON UPDATE CASCADE;
-- 
-- -- ANADIDO para seguir la convencion de las once restantes: sin
-- -- esta linea el DDL se deshace pero la fila se queda, y el
-- -- siguiente `migrate deploy` no la vuelve a aplicar.
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260902090000_lead_convertido_con_ficha';
-- -- Seguro y completo: volver a SetNull no puede fallar por datos.
-- -- Y hay que devolver onDelete: SetNull a schema.prisma:789 en el
-- -- mismo commit.
