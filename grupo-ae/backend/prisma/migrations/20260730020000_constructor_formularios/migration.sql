-- AlterEnum
BEGIN;
CREATE TYPE "CampoNucleo_new" AS ENUM ('EMPRESA_NIT', 'EMPRESA_RAZON_SOCIAL', 'EMPRESA_COLABORADORES', 'EMPRESA_RED_ASOCIADA', 'EMPRESA_RED_ASOCIADA_OTRA', 'CONTACTO_NOMBRE', 'CONTACTO_CORREO', 'CONTACTO_CELULAR', 'CONTACTO_CARGO', 'ACCION_FORMACION', 'OFERTA', 'CUPOS_SOLICITADOS', 'ACEPTA_TERMINOS', 'ACEPTA_POLITICA_DATOS');
ALTER TABLE "preguntas" ALTER COLUMN "campoNucleo" TYPE "CampoNucleo_new" USING ("campoNucleo"::text::"CampoNucleo_new");
ALTER TYPE "CampoNucleo" RENAME TO "CampoNucleo_old";
ALTER TYPE "CampoNucleo_new" RENAME TO "CampoNucleo";
DROP TYPE "public"."CampoNucleo_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoPregunta" ADD VALUE 'FECHA';
ALTER TYPE "TipoPregunta" ADD VALUE 'PARRAFO';

-- Los DROP DEFAULT que propone Prisma para "administradores.actualizadoEn" y
-- "temas.colores" se omiten a proposito: Prisma siempre escribe esos valores,
-- pero el default protege cualquier INSERT hecho a mano desde psql.

-- AlterTable
ALTER TABLE "formularios" ADD COLUMN     "mensajeExito" TEXT;

-- AlterTable
ALTER TABLE "preguntas" ADD COLUMN     "dependeDePreguntaId" TEXT,
ADD COLUMN     "dependeDeValor" TEXT,
ADD COLUMN     "largoMaximo" INTEGER,
ADD COLUMN     "largoMinimo" INTEGER,
ADD COLUMN     "marcador" TEXT,
ADD COLUMN     "maximo" INTEGER,
ADD COLUMN     "minimo" INTEGER,
ADD COLUMN     "seccionId" TEXT;

-- AlterTable
ALTER TABLE "respuestas" ADD COLUMN     "etiquetasSeleccion" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "secciones" (
    "id" TEXT NOT NULL,
    "formularioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "secciones_formularioId_orden_idx" ON "secciones"("formularioId", "orden");

-- CreateIndex
CREATE INDEX "preguntas_seccionId_orden_idx" ON "preguntas"("seccionId", "orden");

-- AddForeignKey
ALTER TABLE "secciones" ADD CONSTRAINT "secciones_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "formularios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "secciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_dependeDePreguntaId_fkey" FOREIGN KEY ("dependeDePreguntaId") REFERENCES "preguntas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

