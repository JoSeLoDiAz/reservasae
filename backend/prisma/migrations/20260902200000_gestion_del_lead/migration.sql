-- La gestion baja a la mesa: se puede llamar a un lead sin ficha.
--
-- Un lead de pauta sin cedula entraba bien y no podia salir: no se
-- convertia (Persona exige documento) y tampoco se podia trabajar,
-- porque llamar y dejar nota solo existia sobre Participante.
--
-- La tabla NO se renombra aunque el modelo pase a NotaDeGestion:
-- arrastraria la PK, dos indices y dos FK a mano, y un indice mal
-- reconciliado desaparece sin que nada falle.

-- de quien es el lead, y cuando se toco por ultima vez
ALTER TABLE "leads_entrantes" ADD COLUMN "asesorId" TEXT;
ALTER TABLE "leads_entrantes" ADD COLUMN "ultimaGestionEn" TIMESTAMP(3);

ALTER TABLE "leads_entrantes"
  ADD CONSTRAINT "leads_entrantes_asesorId_fkey"
  FOREIGN KEY ("asesorId") REFERENCES "admins"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "leads_entrantes_convenioId_asesorId_ultimaGestionEn_idx"
  ON "leads_entrantes"("convenioId", "asesorId", "ultimaGestionEn");

-- la nota puede colgar de un lead, de una ficha, o de los dos
ALTER TABLE "notas_participante" ALTER COLUMN "participanteId" DROP NOT NULL;
ALTER TABLE "notas_participante" ADD COLUMN "leadId" TEXT;

-- SET NULL: borrar una ficha no puede llevarse el historial del lead
ALTER TABLE "notas_participante" DROP CONSTRAINT "notas_participante_participanteId_fkey";
ALTER TABLE "notas_participante"
  ADD CONSTRAINT "notas_participante_participanteId_fkey"
  FOREIGN KEY ("participanteId") REFERENCES "participantes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notas_participante"
  ADD CONSTRAINT "notas_participante_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads_entrantes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- al menos una, NO exactamente una: tras convertir lleva las dos,
-- y eso es lo que hace continuo el rastro de la gestion
ALTER TABLE "notas_participante"
  ADD CONSTRAINT "nota_cuelga_de_algo"
  CHECK ("participanteId" IS NOT NULL OR "leadId" IS NOT NULL);

CREATE INDEX "notas_participante_leadId_creadoEn_idx"
  ON "notas_participante"("leadId", "creadoEn");
CREATE INDEX "notas_participante_leadId_resultado_idx"
  ON "notas_participante"("leadId", "resultado");
