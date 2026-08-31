-- 20260831100000_lead_apunta_a_la_persona
-- Despliegue 1 · paso expand · orden 3 de 12
-- Arregla: INV-7, A-01 y la mitad de D-03: hoy no se puede escribir el JOIN LeadEntrante -> Persona -> Participante -> Reserva -> Oferta. Un lead PENDIENTE o DESCARTADO no tiene Participante y nunca lo tendra, y `participanteId` es onDelete SetNull, asi que borrar una ficha corta la cadena en silencio.
--
-- AUDITADA POR SEPARADO: SEGURA de aplicar sola.
-- APLICABLE SOLA SIN RIESGO DE TUMBAR EL ARRANQUE, PERO NO SE ENTREGA SOLA: le falta el cambio de schema.prisma en el mismo despliegue. El SQL no puede fallar (columna anulable sin DEFAULT, FK validada contra filas todas en NULL, `personas`/`personas_pkey` existen y son TEXT, ningun enum, ningun NOT NULL/CHECK/UNIQUE, los tres nombres libres y ademas iguales a los que generaria Prisma). El rollback 
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- El eslabon que le falta a INV-7. Hoy este JOIN no se puede
-- escribir:
--   LeadEntrante -> Persona -> Participante -> Reserva -> Oferta
--
-- Por que Persona y no solo Participante, que ya existe (:783):
--  1. `participanteId` es onDelete SetNull (:789): borrar una
--     ficha corta la cadena EN SILENCIO. Eso es D-03.
--  2. Un lead PENDIENTE o DESCARTADO no tiene Participante y
--     nunca lo tendra; hoy no se puede unir a nadie, y son justo
--     los que A-01 dice que nadie ve.
--  3. Participante no es la persona: es la persona en una
--     formacion y un convenio. «Cuantos leads mando este ser
--     humano» se contesta con un GROUP BY sobre personaId.
--  4. El valor YA se calcula y se tira: cruzar-con-el-crm.ts lo
--     devuelve (:28) y lo rellena en las tres ramas (:72, :91,
--     :108); leads.service.ts:304 lo usa; y el update de
--     :339-349 no lo escribe.
--
-- Restrict y no SetNull: Persona ya esta protegida igual desde
-- Participante.persona (schema.prisma:933). Una cadena que se
-- puede cortar sola no es una cadena.

ALTER TABLE "leads_entrantes" ADD COLUMN "personaId" TEXT;

CREATE INDEX "leads_entrantes_personaId_idx" ON "leads_entrantes"("personaId");

ALTER TABLE "leads_entrantes"
  ADD CONSTRAINT "leads_entrantes_personaId_fkey"
  FOREIGN KEY ("personaId") REFERENCES "personas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La bitacora NO se vuelve a colgar: `leads_entrantes` ya la
-- tiene desde 20260831091500, y un trigger es por tabla, no por
-- columna.

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- 1. El nombre esta libre y la tabla referenciada existe.
-- SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns
--                     WHERE table_name='leads_entrantes' AND column_name='personaId')
--          AS "columna libre",
--        to_regclass('public.personas') IS NOT NULL AS "personas existe";
-- -- Esperado: TRUE y TRUE
-- 
-- -- 2. El tamano de la tabla: el ADD CONSTRAINT la escanea entera.
-- SELECT count(*) AS "leads" FROM "leads_entrantes";
-- -- Informativo. Con todas las filas en NULL el escaneo no puede
-- -- encontrar ninguna violacion, pero conviene saber cuanto tarda.

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- 1. La columna, el indice y la FK.
-- SELECT (SELECT count(*) FROM information_schema.columns
--           WHERE table_name='leads_entrantes' AND column_name='personaId')      AS "columna",
--        (SELECT count(*) FROM pg_indexes
--           WHERE indexname='leads_entrantes_personaId_idx')                     AS "indice",
--        (SELECT count(*) FROM pg_constraint
--           WHERE conname='leads_entrantes_personaId_fkey' AND convalidated)     AS "fk validada";
-- -- Esperado: 1, 1, 1
-- 
-- -- 2. INVARIANTE: al aplicar, TODAS en NULL. Nadie perdio nada.
-- SELECT count(*) FILTER (WHERE "personaId" IS NOT NULL) AS "con persona",
--        count(*)                                        AS "total"
--   FROM "leads_entrantes";
-- -- Esperado justo despues de aplicar: 0 y el total de la previa.
-- 
-- -- 3. INVARIANTE que empieza a valer cuando el codigo escriba:
-- --    ningun personaId puede apuntar a una persona que no existe.
-- SELECT count(*) AS "huerfanos"
--   FROM "leads_entrantes" l
--  WHERE l."personaId" IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM "personas" p WHERE p."id" = l."personaId");
-- -- Esperado: 0, siempre. Si no es 0, la FK no esta haciendo su trabajo.
-- 
-- -- Criterio: si (1) no da 1,1,1 o si (2) no da 0 al aplicar, SE REVIERTE.

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- -- OJO AL ORDEN: si el codigo ya escribio `personaId`, el DROP
-- -- COLUMN se lleva ese dato. Si solo hay que soltar el Restrict,
-- -- ejecutar UNICAMENTE la primera sentencia y dejar la columna.
-- ALTER TABLE "leads_entrantes" DROP CONSTRAINT IF EXISTS "leads_entrantes_personaId_fkey";
-- DROP INDEX IF EXISTS "leads_entrantes_personaId_idx";
-- ALTER TABLE "leads_entrantes" DROP COLUMN IF EXISTS "personaId";
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260831100000_lead_apunta_a_la_persona';
