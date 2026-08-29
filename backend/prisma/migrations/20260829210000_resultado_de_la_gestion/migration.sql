-- como salio la gestion
CREATE TYPE "ResultadoGestion" AS ENUM ('CONTACTO', 'SIN_RESPUESTA', 'DATO_MALO');

-- nulo en las notas de antes y en las del sistema
ALTER TABLE "notas_participante" ADD COLUMN "resultado" "ResultadoGestion";

-- para "quien lleva N intentos sin contacto"
CREATE INDEX "notas_participante_participanteId_resultado_idx"
  ON "notas_participante"("participanteId", "resultado");
