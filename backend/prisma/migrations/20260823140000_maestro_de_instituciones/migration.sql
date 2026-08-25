-- El directorio de NIT pasa a ser el maestro de organizaciones.
--
-- Prisma proponia DROP TABLE directorio_nit + CREATE TABLE
-- instituciones, que se lleva por delante las 175 filas
-- cargadas. Aqui va como RENAME + ALTER: la tabla es la
-- misma, con mas columnas.

-- CreateEnum
CREATE TYPE "TamanoEmpresa" AS ENUM ('MICROEMPRESA', 'PEQUENA', 'MEDIANA', 'GRANDE');

-- CreateEnum
CREATE TYPE "ClasificacionEmpresa" AS ENUM ('ASOCIACION', 'CENTRO_DESARROLLO_TECNOLOGICO', 'EMPRESA_ASOCIATIVA_DE_TRABAJO', 'EMPRESA_PRIVADA', 'EMPRESA_PUBLICA', 'ENTIDAD_ECONOMIA_SOLIDARIA', 'ENTIDAD_SIN_ANIMO_DE_LUCRO', 'ENTIDAD_TERRITORIAL', 'GREMIO', 'MIXTA');

-- CreateEnum
CREATE TYPE "FuenteDato" AS ENUM ('CARGA', 'RUES', 'WEB', 'HUMANO');

-- CreateEnum
CREATE TYPE "EstadoConsultaRues" AS ENUM ('PENDIENTE', 'EN_CURSO', 'LISTA', 'SIN_RESULTADO', 'FALLIDA');

-- RenameTable: la misma tabla, con las 175 filas dentro
ALTER TABLE "directorio_nit" RENAME TO "instituciones";

ALTER TABLE "instituciones" RENAME CONSTRAINT "directorio_nit_pkey" TO "instituciones_pkey";
ALTER INDEX "directorio_nit_nit_activo_idx" RENAME TO "instituciones_nit_activo_idx";
ALTER INDEX "directorio_nit_nit_razonSocial_key" RENAME TO "instituciones_nit_razonSocial_key";

-- `fuente` era texto libre con default 'CARGA'; pasa a enum.
-- Todas las filas existentes valen 'CARGA', asi que el cast
-- no pierde ninguna.
ALTER TABLE "instituciones" ALTER COLUMN "fuente" DROP DEFAULT;
ALTER TABLE "instituciones"
  ALTER COLUMN "fuente" TYPE "FuenteDato" USING "fuente"::"FuenteDato";
ALTER TABLE "instituciones" ALTER COLUMN "fuente" SET DEFAULT 'CARGA';

-- AlterTable: lo que devuelve el RUES y no tenia donde caer
ALTER TABLE "instituciones"
  ADD COLUMN "nombreComercial"    TEXT,
  ADD COLUMN "fechaFundacion"     TIMESTAMP(3),
  ADD COLUMN "direccion"          TEXT,
  ADD COLUMN "telefono"           TEXT,
  ADD COLUMN "correo"             TEXT,
  ADD COLUMN "paginaWeb"          TEXT,
  ADD COLUMN "ciudadNombre"       TEXT,
  ADD COLUMN "departamentoNombre" TEXT,
  ADD COLUMN "departamentoSepId"  INTEGER,
  ADD COLUMN "municipioSepId"     INTEGER,
  ADD COLUMN "tamano"             "TamanoEmpresa",
  ADD COLUMN "numeroEmpleados"    INTEGER,
  ADD COLUMN "clasificacion"      "ClasificacionEmpresa",
  ADD COLUMN "sectorEconomico"    TEXT,
  ADD COLUMN "codigoCiiu"         TEXT,
  ADD COLUMN "fuentePorCampo"     JSONB,
  ADD COLUMN "verificadaPorId"    TEXT,
  ADD COLUMN "verificadaEn"       TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "instituciones_razonSocial_idx" ON "instituciones"("razonSocial");

-- AddForeignKey
ALTER TABLE "instituciones" ADD CONSTRAINT "instituciones_verificadaPorId_fkey" FOREIGN KEY ("verificadaPorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: la que reserva cuelga del maestro
ALTER TABLE "empresas" ADD COLUMN "institucionId" TEXT;

-- CreateIndex: la tabla no tenia ninguno
CREATE INDEX "empresas_institucionId_idx" ON "empresas"("institucionId");
CREATE INDEX "empresas_razonSocial_idx" ON "empresas"("razonSocial");

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_institucionId_fkey" FOREIGN KEY ("institucionId") REFERENCES "instituciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: lo que averigua un robot, antes de que nadie lo mire
CREATE TABLE "propuestas_institucion" (
    "id" TEXT NOT NULL,
    "institucionId" TEXT NOT NULL,
    "campos" JSONB NOT NULL,
    "fuente" "FuenteDato" NOT NULL,
    "estado" "EstadoPropuesta" NOT NULL DEFAULT 'PENDIENTE',
    "camposAceptados" TEXT[],
    "resueltoPorId" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propuestas_institucion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "propuestas_institucion_institucionId_estado_idx" ON "propuestas_institucion"("institucionId", "estado");
CREATE INDEX "propuestas_institucion_estado_creadoEn_idx" ON "propuestas_institucion"("estado", "creadoEn");

-- AddForeignKey
ALTER TABLE "propuestas_institucion" ADD CONSTRAINT "propuestas_institucion_institucionId_fkey" FOREIGN KEY ("institucionId") REFERENCES "instituciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "propuestas_institucion" ADD CONSTRAINT "propuestas_institucion_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: la cola del RUES, igual que la del RUI
CREATE TABLE "consultas_rues" (
    "id" TEXT NOT NULL,
    "institucionId" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "estado" "EstadoConsultaRues" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "respuesta" JSONB,
    "camposNuevos" INTEGER,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "tomadaEn" TIMESTAMP(3),
    "resueltaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_rues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultas_rues_estado_prioridad_creadoEn_idx" ON "consultas_rues"("estado", "prioridad", "creadoEn");
CREATE INDEX "consultas_rues_institucionId_idx" ON "consultas_rues"("institucionId");

-- AddForeignKey
ALTER TABLE "consultas_rues" ADD CONSTRAINT "consultas_rues_institucionId_fkey" FOREIGN KEY ("institucionId") REFERENCES "instituciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
