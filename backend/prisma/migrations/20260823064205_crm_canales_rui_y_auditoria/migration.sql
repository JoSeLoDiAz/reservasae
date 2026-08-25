-- canal de la nota, cola del rui y auditoria

-- CreateEnum
CREATE TYPE "CanalContacto" AS ENUM ('CORREO', 'WHATSAPP', 'TEXTO', 'LLAMADA');

-- CreateEnum
CREATE TYPE "EstadoConsultaRui" AS ENUM ('PENDIENTE', 'EN_CURSO', 'LISTA', 'SIN_RESULTADO', 'FALLIDA');

-- AlterTable
ALTER TABLE "notas_participante" ADD COLUMN     "canales" "CanalContacto"[];

-- AlterTable
ALTER TABLE "participantes" ADD COLUMN     "revisarDocumento" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "personas" ADD COLUMN     "generoOtroTexto" TEXT,
ADD COLUMN     "tieneWhatsapp" BOOLEAN,
ADD COLUMN     "whatsappRevisadoEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "directorio_nit" (
    "id" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "digitoDeclarado" TEXT,
    "fuente" TEXT NOT NULL DEFAULT 'CARGA',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directorio_nit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas_rui" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "tipoDocumentoSepId" INTEGER NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "estado" "EstadoConsultaRui" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "nombreEncontrado" TEXT,
    "nombreTecleado" TEXT,
    "nombreCoincide" BOOLEAN,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "tomadaEn" TIMESTAMP(3),
    "resueltaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_rui_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "actorNombre" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "convenioId" TEXT,
    "resumen" TEXT,
    "camposTocados" TEXT[],
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "directorio_nit_nit_activo_idx" ON "directorio_nit"("nit", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "directorio_nit_nit_razonSocial_key" ON "directorio_nit"("nit", "razonSocial");

-- CreateIndex
CREATE INDEX "consultas_rui_estado_prioridad_creadoEn_idx" ON "consultas_rui"("estado", "prioridad", "creadoEn");

-- CreateIndex
CREATE INDEX "consultas_rui_personaId_idx" ON "consultas_rui"("personaId");

-- CreateIndex
CREATE INDEX "registros_auditoria_entidad_entidadId_creadoEn_idx" ON "registros_auditoria"("entidad", "entidadId", "creadoEn");

-- CreateIndex
CREATE INDEX "registros_auditoria_creadoEn_idx" ON "registros_auditoria"("creadoEn");

-- AddForeignKey
ALTER TABLE "consultas_rui" ADD CONSTRAINT "consultas_rui_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- datos_completos deja de ser etapa y pasa a ser estado
-- calculado. El valor del enum se conserva: el historico
-- de movimientos dice por donde paso cada quien de verdad,
-- y reescribirlo seria borrar la traza que sostiene la
-- auditoria. Solo se mueve a quien esta ahi parado hoy.
UPDATE "participantes"
SET "etapa" = 'CONTACTADO'
WHERE "etapa" = 'DATOS_COMPLETOS';
