-- Si el lead se pagó o llegó solo.
--
-- Aparte de `OrigenParticipante` a propósito: aquel dice POR
-- QUÉ CANAL llegó —Facebook, WhatsApp, un evento— y viaja al
-- SEP. Este dice QUIÉN LO TRAJO, y es lo que permite medir
-- cuánto cuesta un inscrito.
--
-- Meterlo en el otro enum ensuciaría un catálogo que sale en el
-- reporte al Estado con una categoría que es nuestra.

CREATE TYPE "OrigenLead" AS ENUM ('PAUTA', 'ORGANICO');

-- Nulo en los que ya existían, y se queda nulo: no se puede
-- saber hacia atrás de dónde vino cada uno, y ponerles
-- ORGANICO a todos sería inventarse una métrica que después
-- alguien va a usar para decidir dónde gastar.
ALTER TABLE "participantes" ADD COLUMN "origenLead" "OrigenLead";

CREATE INDEX "participantes_convenioId_origenLead_idx"
  ON "participantes"("convenioId", "origenLead");
