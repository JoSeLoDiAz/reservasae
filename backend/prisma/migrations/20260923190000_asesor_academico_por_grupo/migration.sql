-- El asesor academico que lleva un grupo entero.
--
-- «Por grupo entero» (cliente, 23 sep 2026): la carga se mide en
-- grupos y el PAX sale solo de sus coberturas. Es DISTINTO del
-- `asesorId` del participante, que es el de inscripciones.
--
-- Nulo por omision y `ON DELETE SET NULL`: borrar una cuenta no puede
-- llevarse el grupo por delante; el grupo se queda sin asesor y sale
-- en la lista de los que hay que repartir.
ALTER TABLE "grupos" ADD COLUMN "asesorAcademicoId" TEXT;

ALTER TABLE "grupos"
  ADD CONSTRAINT "grupos_asesorAcademicoId_fkey"
  FOREIGN KEY ("asesorAcademicoId") REFERENCES "administradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Para «los grupos de este asesor», que es la consulta del tablero.
CREATE INDEX "grupos_asesorAcademicoId_idx" ON "grupos"("asesorAcademicoId");
