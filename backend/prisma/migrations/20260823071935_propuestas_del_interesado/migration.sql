-- lo que manda el interesado cuando el asesor ya toco

-- CreateEnum
CREATE TYPE "EstadoPropuesta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'DESCARTADA');

-- AlterTable
ALTER TABLE "participantes" ADD COLUMN     "datosTocadosPorAsesorEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "propuestas_de_datos" (
    "id" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "campos" JSONB NOT NULL,
    "estado" "EstadoPropuesta" NOT NULL DEFAULT 'PENDIENTE',
    "camposAceptados" TEXT[],
    "resueltoPorId" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propuestas_de_datos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "propuestas_de_datos_participanteId_estado_idx" ON "propuestas_de_datos"("participanteId", "estado");

-- CreateIndex
CREATE INDEX "propuestas_de_datos_estado_creadoEn_idx" ON "propuestas_de_datos"("estado", "creadoEn");

-- AddForeignKey
ALTER TABLE "propuestas_de_datos" ADD CONSTRAINT "propuestas_de_datos_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propuestas_de_datos" ADD CONSTRAINT "propuestas_de_datos_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
