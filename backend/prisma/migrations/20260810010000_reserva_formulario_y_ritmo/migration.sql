-- De que formulario salio cada reserva.
ALTER TABLE "reservas" ADD COLUMN "formularioId" TEXT;

CREATE INDEX "reservas_formularioId_idx" ON "reservas"("formularioId");

ALTER TABLE "reservas" ADD CONSTRAINT "reservas_formularioId_fkey"
  FOREIGN KEY ("formularioId") REFERENCES "formularios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- El ritmo diario barre esta tabla por fecha.
CREATE INDEX "movimientos_reserva_creadoEn_idx" ON "movimientos_reserva"("creadoEn");

-- Rellena lo que ya existe: la unica pista es alguna respuesta suya.
UPDATE "reservas" r
   SET "formularioId" = s."formularioId"
  FROM (
    SELECT DISTINCT ON (resp."reservaId") resp."reservaId", p."formularioId"
      FROM "respuestas" resp
      JOIN "preguntas" p ON p.id = resp."preguntaId"
  ) s
 WHERE s."reservaId" = r.id;
