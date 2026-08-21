-- donde trabaja la persona, con o sin reserva detras
ALTER TABLE "participantes" ADD COLUMN "empresaId" TEXT;

CREATE INDEX "participantes_empresaId_idx" ON "participantes"("empresaId");

ALTER TABLE "participantes"
  ADD CONSTRAINT "participantes_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- quien vino por una reserva ya tiene empresa: se copia
UPDATE "participantes" p
   SET "empresaId" = r."empresaId"
  FROM "reservas" r
 WHERE r."id" = p."reservaId" AND p."empresaId" IS NULL;
