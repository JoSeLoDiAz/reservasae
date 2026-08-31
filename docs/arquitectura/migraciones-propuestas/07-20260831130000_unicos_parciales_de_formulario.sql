-- 20260831130000_unicos_parciales_de_formulario
-- Despliegue 2 · paso migrate · orden 7 de 12
-- Arregla: D-04 (y expone D-05): dos @@unique TOTALES que ya rompen hoy, sin papelera de por medio. `preguntas.archivada` (schema.prisma:445) contra @@unique([formularioId, campoNucleo]) (:460), y `opciones.archivada` (:473) contra @@unique([preguntaId, valor]) (:477) -- las cuatro lineas comprobadas. Archivar
--
-- AUDITADA POR SEPARADO: SEGURA de aplicar sola.
-- Esta bien: no puede fallar y arregla lo que dice. Las cuatro citas comprobadas una a una (schema.prisma:444, :445, :460, :473, :477); los dos indices a borrar nacen en 20260729000000_modelo_inicial/migration.sql:308 y :314 como CREATE UNIQUE INDEX y no como constraints, luego DROP INDEX basta y no hace falta ALTER TABLE ... DROP CONSTRAINT; ninguna de las 43 migraciones los renombro ni los volvio 
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- D-04. Dos @@unique TOTALES que YA ROMPEN HOY, sin papelera de
-- por medio, porque las dos tablas archivan con un booleano que
-- el indice no mira:
--
--   preguntas.archivada (schema.prisma:445) contra
--     @@unique([formularioId, campoNucleo]) (:460)
--   opciones.archivada  (schema.prisma:473) contra
--     @@unique([preguntaId, valor])         (:477)
--
-- Hoy, archivar la pregunta del campo nucleo CORREO y crear otra
-- para el mismo campo CHOCA; archivar una opcion y crear otra con
-- el mismo valor, tambien. El comentario de :444 dice «las
-- preguntas se archivan, no se borran» y el indice no le hace
-- caso.
--
-- ESTA MIGRACION SOLO RELAJA. Todo dato que hoy es valido lo
-- sigue siendo: un indice parcial acepta todo lo que aceptaba el
-- total mas las filas archivadas. NO PUEDE FALLAR.
--
-- Nombres NUEVOS y descriptivos, no los `_key` de Prisma: se
-- sigue el unico precedente de la casa,
-- `politicas_datos_una_vigente`
-- (20260814120000_politica_por_destinatario/migration.sql:19-21),
-- que vive solo en SQL y no se menciona en su modelo. Reutilizar
-- el nombre de Prisma seria mentirle al ORM sobre una unicidad
-- que ya no tiene.

DROP INDEX IF EXISTS "preguntas_formularioId_campoNucleo_key";

-- «un campo del nucleo, una sola vez -- entre las vivas»
CREATE UNIQUE INDEX "preguntas_un_campo_nucleo_vivo"
    ON "preguntas"("formularioId", "campoNucleo")
 WHERE "archivada" = false;

DROP INDEX IF EXISTS "opciones_preguntaId_valor_key";

-- «un valor por pregunta -- entre las vivas»
CREATE UNIQUE INDEX "opciones_un_valor_vivo"
    ON "opciones"("preguntaId", "valor")
 WHERE "archivada" = false;

-- Y LA ADVERTENCIA QUE VA CON ESTO (D-05): los dos indices de
-- arriba son INVISIBLES para Prisma, porque Prisma no sabe
-- expresar WHERE. Los @@unique se RETIRAN del schema.prisma en
-- esta misma entrega. Si algun dia `prisma migrate dev` propone
-- un DROP INDEX que nadie pidio, es esto: CLAUDE.md:3202-3203,
-- «no lo deje pasar».

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- 1. Los dos indices totales estan, con el nombre exacto que se
-- --    va a borrar. Comprobado su origen en
-- --    20260729000000_modelo_inicial/migration.sql:308 y :314: son
-- --    CREATE UNIQUE INDEX, no constraints, asi que DROP INDEX basta.
-- SELECT indexname FROM pg_indexes
--  WHERE indexname IN ('preguntas_formularioId_campoNucleo_key','opciones_preguntaId_valor_key')
--  ORDER BY 1;
-- -- Esperado: las 2 filas
-- 
-- -- 2. Los nombres nuevos estan libres.
-- SELECT NOT EXISTS (SELECT 1 FROM pg_indexes
--                     WHERE indexname IN ('preguntas_un_campo_nucleo_vivo','opciones_un_valor_vivo'))
--          AS "nombres libres";
-- -- Esperado: TRUE
-- 
-- -- 3. Cuanto archivado hay hoy: es la medida de lo que estaba
-- --    bloqueado sin que nadie lo supiera.
-- SELECT (SELECT count(*) FROM "preguntas" WHERE "archivada") AS "preguntas archivadas",
--        (SELECT count(*) FROM "opciones"  WHERE "archivada") AS "opciones archivadas";
-- 
-- -- 4. NINGUN llamador usa la clave compuesta de Prisma que se
-- --    retira del schema. Comprobado en el repositorio:
-- --    grep -rn "preguntaId_valor\|formularioId_campoNucleo" backend/src frontend/src -> CERO.

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- 1. Los totales se fueron, los parciales estan, y son parciales.
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE tablename IN ('preguntas','opciones')
--    AND indexname IN ('preguntas_formularioId_campoNucleo_key','opciones_preguntaId_valor_key',
--                      'preguntas_un_campo_nucleo_vivo','opciones_un_valor_vivo')
--  ORDER BY 1;
-- -- Esperado: 2 filas, las dos nuevas, y las dos con WHERE (archivada = false)
-- 
-- -- 2. INVARIANTE, y este es el que importa: la unicidad ENTRE LAS
-- --    VIVAS sigue intacta. Las dos consultas deben dar CERO.
-- SELECT "formularioId", "campoNucleo", count(*)
--   FROM "preguntas" WHERE "archivada" = false AND "campoNucleo" IS NOT NULL
--  GROUP BY 1,2 HAVING count(*) > 1;
-- 
-- SELECT "preguntaId", "valor", count(*)
--   FROM "opciones" WHERE "archivada" = false
--  GROUP BY 1,2 HAVING count(*) > 1;
-- -- Esperado: CERO filas cada una.
-- 
-- -- 3. La comprobacion de que se relajo lo que se queria relajar se
-- --    hace DESDE EL PANEL, no en SQL: archivar una pregunta de
-- --    campo nucleo y crear otra para el mismo campo. Antes daba
-- --    error de unicidad; ahora tiene que dejar.
-- 
-- -- Criterio: si (1) no muestra los dos parciales con su WHERE, o si
-- -- (2) devuelve UNA SOLA fila, SE REVIERTE inmediatamente: eso
-- -- significaria que la unicidad viva se perdio, que es lo unico
-- -- que esta migracion no puede permitirse.

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- -- Ejecutable SOLO mientras no exista un choque entre archivadas y
-- -- vivas. Si ya alguien archivo una pregunta de campo nucleo y
-- -- creo otra para el mismo campo, el CREATE UNIQUE INDEX de abajo
-- -- falla, y eso es la prueba de que el arreglo hacia falta:
-- -- volver atras exigiria borrar una de las dos, que es lo que la
-- -- regla 1 prohibe. En ese caso, se deja el parcial y se revierte
-- -- solo la fila de _prisma_migrations.
-- DROP INDEX IF EXISTS "opciones_un_valor_vivo";
-- CREATE UNIQUE INDEX "opciones_preguntaId_valor_key"
--     ON "opciones"("preguntaId", "valor");
-- 
-- DROP INDEX IF EXISTS "preguntas_un_campo_nucleo_vivo";
-- CREATE UNIQUE INDEX "preguntas_formularioId_campoNucleo_key"
--     ON "preguntas"("formularioId", "campoNucleo");
-- 
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260831130000_unicos_parciales_de_formulario';
