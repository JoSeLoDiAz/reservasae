-- CreateEnum
CREATE TYPE "TipoGestion" AS ENUM ('LLAMADA', 'REUNION', 'CORREO', 'WHATSAPP', 'VISITA', 'TAREA');

-- AlterTable
ALTER TABLE "marca" ALTER COLUMN "nombreApp" SET DEFAULT 'Grupo AE',
ALTER COLUMN "tituloPublico" SET DEFAULT 'Cuéntenos qué necesita',
ALTER COLUMN "subtituloPublico" SET DEFAULT 'Déjenos sus datos y un asesor lo contacta.';

-- CreateTable
CREATE TABLE "gestiones" (
    "id" TEXT NOT NULL,
    "oportunidadId" TEXT NOT NULL,
    "tipo" "TipoGestion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "nota" TEXT,
    "venceEn" TIMESTAMP(3),
    "hechaEn" TIMESTAMP(3),
    "asesorId" TEXT,
    "creadaPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gestiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metas_comerciales" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "asesorId" TEXT,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "embudo" "TipoEmbudo",
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_comerciales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gestiones_asesorId_venceEn_hechaEn_idx" ON "gestiones"("asesorId", "venceEn", "hechaEn");

-- CreateIndex
CREATE INDEX "gestiones_oportunidadId_creadoEn_idx" ON "gestiones"("oportunidadId", "creadoEn");

-- CreateIndex
CREATE INDEX "metas_comerciales_convenioId_anio_mes_idx" ON "metas_comerciales"("convenioId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "metas_comerciales_convenioId_asesorId_anio_mes_embudo_key" ON "metas_comerciales"("convenioId", "asesorId", "anio", "mes", "embudo");

-- AddForeignKey
ALTER TABLE "gestiones" ADD CONSTRAINT "gestiones_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestiones" ADD CONSTRAINT "gestiones_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestiones" ADD CONSTRAINT "gestiones_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_comerciales" ADD CONSTRAINT "metas_comerciales_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_comerciales" ADD CONSTRAINT "metas_comerciales_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "administradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
