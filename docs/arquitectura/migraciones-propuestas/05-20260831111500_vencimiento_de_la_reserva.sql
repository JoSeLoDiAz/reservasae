-- 20260831111500_vencimiento_de_la_reserva
-- Despliegue 1 · paso expand · orden 5 de 12
-- Arregla: F-01, segunda mitad: `Reserva.venceEn` y `Reserva.caducadaEn`, con el CHECK que hace que caducar sea una forma de cancelar y no un estado nuevo. Sin tocar EstadoReserva, que se queda en tres (ADR 0012).
--
-- AUDITADA POR SEPARADO: SEGURA de aplicar sola.
-- CORRECTA EN LO QUE HACE, INCOMPLETA EN LO QUE ENTREGA. El SQL es imposible de romper al aplicarlo y el razonamiento que lo sostiene esta bien: caducar como CANCELADA en vez de un cuarto valor de enum es la decision buena, y la justificacion que da el comentario se comprueba en codigo -- promoverListaDeEspera filtra por `estado: { not: EstadoReserva.CANCELADA }` (reservas.service.ts:397, cita exact
--
-- PASO MANUAL PREVIO, obligatorio:
--   NO ES SQL, ES CODIGO, Y VA EN LA MISMA IMAGEN QUE SE DESPLIEGA. Comprobar antes de lanzar que el commit lleva `caducadaEn: null,` dentro del objeto `datos` de reservas.service.ts:102-117, junto al `canceladaEn: null` de :116. Sin esa linea, la primera empresa a la que se le venza el hold y vuelva a reservar dispara el CHECK: R4 revive la fila poniendo estado CONFIRMADA (:107) y canceladaEn NULL (:116) sin tocar caducadaEn, y eso revienta en POST /reservas, que es publico, sin guard y sin ExceptionFilter en todo el backend (comprobado: `grep -n "useGlobalFilters|ExceptionFilter" backend/src/main.ts` -> 0). Hoy no puede pasar porque caducadaEn solo lo escribe R7 y R7 no existe; el dia que se encienda, si la linea no esta, revienta la puerta principal. Comprobado que es el UNICO sitio: los escritores de estado son :107, :194, :244, :414 y tableros.service.ts:1170, y solo :107 lleva una fila de CANCELADA a viva.
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- El hold con TTL de F-01, SIN tocar EstadoReserva.
--
-- El enum se queda en tres (ADR 0012). Un valor nuevo se
-- deshace SOLO dentro de la misma transaccion:
-- promoverListaDeEspera filtra `estado: { not: CANCELADA }`
-- (reservas.service.ts:397), no «esta viva», asi que una reserva
-- recien caducada con cuposEnEspera > 0 casa ahi y :409-416 la
-- devuelve a CONFIRMADA. Y son 22 predicados mas 3 Record del
-- frontend. Caducar es CANCELAR: una cancelacion cuya autora es
-- el reloj.
--
-- Anulables: todas las filas existentes quedan en NULL, que
-- significa «sin vencimiento» -- el comportamiento de hoy.

ALTER TABLE "reservas" ADD COLUMN "venceEn"    TIMESTAMP(3);
ALTER TABLE "reservas" ADD COLUMN "caducadaEn" TIMESTAMP(3);

-- Impide que quede marcada como caducada una fila que no este
-- realmente cancelada. Se cumple trivialmente al aplicarlo:
-- `caducadaEn` acaba de nacer NULL en todas.
--
-- Con esto, `canceladaEn NOT NULL AND caducadaEn NULL` = alguien
-- la cancelo; con las dos = caduco. Un WHERE lo distingue sin
-- JOIN, que es lo que se pierde al no tener estado propio.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_caducada_es_cancelada"
  CHECK ("caducadaEn" IS NULL
         OR ("canceladaEn" IS NOT NULL AND "estado" = 'CANCELADA'));

-- TOTAL y no parcial, corrigiendo a 02-maquinas-de-estado.md
-- §1.1, que escribe el SQL con `WHERE "venceEn" IS NOT NULL` y a
-- la vez declara `@@index([venceEn])` en §1.2. No pueden ser las
-- dos: Prisma no sabe expresar WHERE, asi que el parcial seria
-- invisible para el schema y caeriamos en D-05 sin necesidad. El
-- proceso que caduca consulta `venceEn < now()`, que nunca casa
-- con NULL, asi que el parcial no compraba nada.
CREATE INDEX "reservas_venceEn_idx" ON "reservas"("venceEn");

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- 1. Los cuatro nombres estan libres.
-- SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns
--                     WHERE table_name='reservas' AND column_name IN ('venceEn','caducadaEn'))
--          AS "columnas libres",
--        NOT EXISTS (SELECT 1 FROM pg_constraint
--                     WHERE conname='reservas_caducada_es_cancelada')
--          AS "check libre",
--        NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='reservas_venceEn_idx')
--          AS "indice libre";
-- -- Esperado: TRUE, TRUE, TRUE
-- 
-- -- 2. El CHECK que ya existe y que gobierna la cancelacion, para
-- --    saber que sigue ahi y que el nuevo convive con el.
-- SELECT conname FROM pg_constraint WHERE conname = 'reservas_cancelada_sin_cupos';
-- -- Esperado: 1 fila (modelo_inicial/migration.sql:410-412)
-- 
-- -- 3. El reparto de estados de hoy, para comparar despues.
-- SELECT "estado", count(*) FROM "reservas" GROUP BY 1 ORDER BY 2 DESC;

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- 1. Las dos columnas, el CHECK validado y el indice.
-- SELECT (SELECT count(*) FROM information_schema.columns
--           WHERE table_name='reservas' AND column_name IN ('venceEn','caducadaEn')) AS "columnas",
--        (SELECT convalidated FROM pg_constraint
--           WHERE conname='reservas_caducada_es_cancelada')                          AS "check ok",
--        (SELECT count(*) FROM pg_indexes WHERE indexname='reservas_venceEn_idx')    AS "indice";
-- -- Esperado: 2, TRUE, 1
-- 
-- -- 2. INVARIANTE al aplicar: nadie tiene vencimiento todavia, o
-- --    sea que ninguna reserva cambio de comportamiento.
-- SELECT count(*) FILTER (WHERE "venceEn"    IS NOT NULL) AS "con vencimiento",
--        count(*) FILTER (WHERE "caducadaEn" IS NOT NULL) AS "caducadas"
--   FROM "reservas";
-- -- Esperado justo despues de aplicar: 0 y 0
-- 
-- -- 3. INVARIANTE permanente, el que vigila el CHECK desde fuera:
-- --    ninguna fila caducada que no este cancelada.
-- SELECT count(*) AS "caducadas sin cancelar"
--   FROM "reservas"
--  WHERE "caducadaEn" IS NOT NULL
--    AND ("canceladaEn" IS NULL OR "estado" <> 'CANCELADA');
-- -- Esperado: 0, siempre.
-- 
-- -- 4. Y el que hay que mirar cuando R7 se encienda: una caducada
-- --    no puede retener cupos (lo exige reservas_cancelada_sin_cupos).
-- SELECT count(*) AS "caducadas reteniendo cupo"
--   FROM "reservas"
--  WHERE "caducadaEn" IS NOT NULL
--    AND ("cuposConfirmados" <> 0 OR "cuposEnEspera" <> 0);
-- -- Esperado: 0, siempre.
-- 
-- -- Criterio: si (2) no da 0 y 0 al aplicar, o si (3) deja de dar 0
-- -- en cualquier momento, SE REVIERTE.

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- ALTER TABLE "reservas" DROP CONSTRAINT IF EXISTS "reservas_caducada_es_cancelada";
-- DROP INDEX IF EXISTS "reservas_venceEn_idx";
-- -- OJO: si R7 ya corrio, estas dos columnas son la unica prueba de
-- -- que una cancelacion la hizo el reloj y no una persona. Antes de
-- -- tirarlas, sacarlas a disco:
-- --   \copy (SELECT "id","venceEn","caducadaEn" FROM "reservas"
-- --           WHERE "venceEn" IS NOT NULL OR "caducadaEn" IS NOT NULL)
-- --     TO 'reservas-vencimiento.csv' CSV HEADER
-- ALTER TABLE "reservas" DROP COLUMN IF EXISTS "caducadaEn";
-- ALTER TABLE "reservas" DROP COLUMN IF EXISTS "venceEn";
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260831111500_vencimiento_de_la_reserva';
