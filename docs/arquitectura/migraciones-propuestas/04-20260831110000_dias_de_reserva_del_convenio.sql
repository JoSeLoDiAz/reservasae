-- 20260831110000_dias_de_reserva_del_convenio
-- Despliegue 1 · paso expand · orden 4 de 12
-- Arregla: F-01, primera mitad: el hold no caduca y R1 no tiene de donde sacar el TTL para estampar `venceEn`. Hasta hoy `grep -rn "diasDeReserva" backend frontend` daba cero.
--
-- AUDITADA POR SEPARADO: SEGURA de aplicar sola.
-- APTA PARA DESPLEGAR EN CUANTO SE ANADA EL CAMPO AL schema.prisma. El SQL es correcto y no puede tumbar el arranque.  Lo que verifique y sale bien: - Los numeros de linea del comentario son exactos, uno a uno: Convenio schema.prisma:28-71, Oferta :174-198, docker-compose.yml:29 = `image: postgres:17-alpine`. - La descripcion de Oferta es fiel: :179-184 son cuposMaximos, cuposOcupados y el `abierta`
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- El TTL del hold, F-01. Bloqueante resuelto: vive en Convenio y
-- no en Oferta.
--
-- Por que aqui: `Convenio` (schema.prisma:28-71) guarda
-- identidad, datos del SEP y marca; `Oferta` (:174-198) guarda
-- solo contadores y el interruptor `abierta`. Ninguna de las dos
-- tiene hoy un parametro numerico de negocio, asi que el
-- precedente no es «que columna se parece mas» sino quien tiene
-- la mano, y la tiene el convenio.
--
-- Dias CALENDARIO, no habiles: no hay calendario de festivos
-- colombianos en el repositorio y inventarlo aqui seria una
-- dependencia nueva escondida en una migracion.
--
-- NOT NULL DEFAULT 15 y no anulable: el interruptor de encendido
-- NO es esta columna. Es la variable de entorno del proceso que
-- caduca, siguiendo el patron de los tres trabajadores de la
-- casa. Una columna anulable como interruptor obliga a preguntar
-- «NULL significa apagado o significa sin configurar» en cada
-- lectura, y esa pregunta no tiene respuesta buena.
--
-- En Postgres 11+ anadir una columna NOT NULL con un DEFAULT no
-- volatil NO reescribe la tabla: es un cambio de catalogo. El
-- cluster es postgres:17-alpine (docker-compose.yml:29).

ALTER TABLE "convenios"
  ADD COLUMN "diasDeReserva" INTEGER NOT NULL DEFAULT 15;

-- Cero dias seria «vence al crearse», que no es una
-- configuracion: es un error de dedo. Se cumple trivialmente al
-- aplicarlo, porque todas las filas acaban de nacer en 15.
ALTER TABLE "convenios"
  ADD CONSTRAINT "convenios_dias_de_reserva_positivo"
  CHECK ("diasDeReserva" > 0);

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- 1. La columna no existe. Comprobado tambien en el repositorio:
-- --    grep -rn "diasDeReserva" backend frontend -> CERO.
-- SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns
--                     WHERE table_name='convenios' AND column_name='diasDeReserva')
--          AS "columna libre";
-- -- Esperado: TRUE
-- 
-- -- 2. Cuantos convenios van a quedar en 15 dias.
-- SELECT count(*) AS "convenios", count(*) FILTER (WHERE "activo") AS "activos"
--   FROM "convenios";
-- -- Informativo: son los que habra que revisar a mano si 15 no es
-- -- el numero que quiere el negocio para alguno. Son dos.

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- 1. La columna, con su tipo, su NOT NULL y su default.
-- SELECT data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name='convenios' AND column_name='diasDeReserva';
-- -- Esperado: integer | NO | 15
-- 
-- -- 2. INVARIANTE: ni un convenio sin TTL, ni uno con TTL absurdo.
-- SELECT count(*) FILTER (WHERE "diasDeReserva" IS NULL) AS "sin ttl",
--        count(*) FILTER (WHERE "diasDeReserva" <= 0)    AS "ttl invalido",
--        min("diasDeReserva") AS "minimo", max("diasDeReserva") AS "maximo"
--   FROM "convenios";
-- -- Esperado: 0, 0, 15, 15
-- 
-- -- 3. El CHECK esta y esta validado.
-- SELECT convalidated FROM pg_constraint
--  WHERE conname = 'convenios_dias_de_reserva_positivo';
-- -- Esperado: TRUE
-- 
-- -- Criterio: si (2) no da 0, 0, 15, 15 justo despues de aplicar,
-- -- algo escribio la columna durante la migracion. SE REVIERTE.

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- ALTER TABLE "convenios" DROP CONSTRAINT IF EXISTS "convenios_dias_de_reserva_positivo";
-- ALTER TABLE "convenios" DROP COLUMN IF EXISTS "diasDeReserva";
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260831110000_dias_de_reserva_del_convenio';
