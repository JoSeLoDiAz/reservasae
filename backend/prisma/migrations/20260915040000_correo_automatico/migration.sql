-- que dispara sola una plantilla
CREATE TYPE "DisparadorDePlantilla" AS ENUM ('NINGUNO', 'PREINSCRIPCION');
CREATE TYPE "MotivoDeCorreoAutomatico" AS ENUM ('PREINSCRIPCION');
CREATE TYPE "EstadoCorreoAutomatico" AS ENUM ('PENDIENTE', 'ENVIADO', 'OMITIDO', 'FALLO');

ALTER TABLE "plantillas_correo"
  ADD COLUMN "disparador" "DisparadorDePlantilla" NOT NULL DEFAULT 'NINGUNO';

CREATE INDEX "plantillas_correo_disparador_activa_idx"
  ON "plantillas_correo"("disparador", "activa");

CREATE TABLE "correos_automaticos" (
  "id" TEXT NOT NULL,
  "motivo" "MotivoDeCorreoAutomatico" NOT NULL,
  "participanteId" TEXT NOT NULL,
  "convenioId" TEXT NOT NULL,
  "estado" "EstadoCorreoAutomatico" NOT NULL DEFAULT 'PENDIENTE',
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "detalle" TEXT,
  "entregadoA" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimoIntentoEn" TIMESTAMP(3),
  "procesadoEn" TIMESTAMP(3),
  CONSTRAINT "correos_automaticos_pkey" PRIMARY KEY ("id")
);

-- uno por ficha y motivo: registrarse dos veces no manda dos
CREATE UNIQUE INDEX "correos_automaticos_participanteId_motivo_key"
  ON "correos_automaticos"("participanteId", "motivo");
CREATE INDEX "correos_automaticos_estado_creadoEn_idx"
  ON "correos_automaticos"("estado", "creadoEn");

ALTER TABLE "correos_automaticos"
  ADD CONSTRAINT "correos_automaticos_participanteId_fkey"
  FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "correos_automaticos"
  ADD CONSTRAINT "correos_automaticos_convenioId_fkey"
  FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
