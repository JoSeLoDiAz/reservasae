-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "contactoCargo" TEXT,
ADD COLUMN     "contactoCorreo" TEXT,
ADD COLUMN     "contactoNombre" TEXT,
ADD COLUMN     "departamentoSepId" INTEGER,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "municipioSepId" INTEGER,
ADD COLUMN     "numeroTrabajadores" INTEGER,
ADD COLUMN     "papelEnConvenio" TEXT,
ADD COLUMN     "sectorEconomico" TEXT,
ADD COLUMN     "telefono" TEXT;

-- CreateTable
CREATE TABLE "enlaces_completado" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "emitidoPorId" TEXT,

    CONSTRAINT "enlaces_completado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enlaces_completado_token_key" ON "enlaces_completado"("token");

-- CreateIndex
CREATE INDEX "enlaces_completado_participanteId_idx" ON "enlaces_completado"("participanteId");

-- AddForeignKey
ALTER TABLE "enlaces_completado" ADD CONSTRAINT "enlaces_completado_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enlaces_completado" ADD CONSTRAINT "enlaces_completado_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

