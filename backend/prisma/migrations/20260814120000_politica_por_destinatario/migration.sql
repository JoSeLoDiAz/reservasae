-- a quien se le pide la autorizacion
CREATE TYPE "DestinatarioPolitica" AS ENUM ('RESERVA', 'PARTICIPANTE');

ALTER TABLE "politicas_datos"
  ADD COLUMN "destinatario" "DestinatarioPolitica" NOT NULL DEFAULT 'RESERVA',
  ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- la version se numera por destinatario
DROP INDEX IF EXISTS "politicas_datos_convenioId_version_key";

CREATE UNIQUE INDEX "politicas_datos_convenioId_destinatario_version_key"
  ON "politicas_datos"("convenioId", "destinatario", "version");

CREATE INDEX "politicas_datos_convenioId_destinatario_vigenteHasta_idx"
  ON "politicas_datos"("convenioId", "destinatario", "vigenteHasta");

-- una sola vigente por convenio y destinatario
CREATE UNIQUE INDEX "politicas_datos_una_vigente"
  ON "politicas_datos"("convenioId", "destinatario")
  WHERE "vigenteHasta" IS NULL;

-- la version empieza en 1
ALTER TABLE "politicas_datos"
  ADD CONSTRAINT "politicas_datos_version_positiva" CHECK ("version" >= 1);

-- no se cierra antes de empezar
ALTER TABLE "politicas_datos"
  ADD CONSTRAINT "politicas_datos_vigencia_coherente"
  CHECK ("vigenteHasta" IS NULL OR "vigenteHasta" >= "vigenteDesde");
