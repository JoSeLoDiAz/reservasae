-- CreateEnum
CREATE TYPE "FamiliaServicio" AS ENUM ('EDUCACION', 'EMPRESAS');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('LICENCIA', 'IMPLEMENTACION', 'SOPORTE', 'FORMACION', 'EQUIPO');

-- AlterTable
ALTER TABLE "oportunidades" ADD COLUMN     "cantidad" INTEGER,
ADD COLUMN     "servicioId" TEXT;

-- CreateTable
CREATE TABLE "servicios" (
    "id" TEXT NOT NULL,
    "familia" "FamiliaServicio" NOT NULL,
    "tipo" "TipoServicio" NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servicios_familia_visible_orden_idx" ON "servicios"("familia", "visible", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_familia_nombre_key" ON "servicios"("familia", "nombre");

-- CreateIndex
CREATE INDEX "oportunidades_servicioId_idx" ON "oportunidades"("servicioId");

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

