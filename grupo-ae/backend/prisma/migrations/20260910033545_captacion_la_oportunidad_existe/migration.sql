-- CreateEnum
CREATE TYPE "TipoEmbudo" AS ENUM ('EMPRESA', 'PERSONA');

-- CreateEnum
CREATE TYPE "EtapaOportunidad" AS ENUM ('CAPTADO', 'CONTACTADO', 'CALIFICADO', 'PROPUESTA_ENVIADA', 'EN_NEGOCIACION', 'GANADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "MotivoCierre" AS ENUM ('PRECIO_ACEPTADO', 'UNICA_OPCION', 'RECOMENDACION', 'PRECIO_ALTO', 'SIN_PRESUPUESTO', 'SE_FUE_CON_OTRO', 'FUERA_DE_TIEMPO', 'NO_ERA_QUIEN_DECIDE', 'NUNCA_RESPONDIO', 'NO_LE_INTERESA', 'DATOS_ERRADOS', 'OTRO');

-- AlterTable
ALTER TABLE "administradores" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "plantillas_correo" ALTER COLUMN "etapasPermitidas" DROP DEFAULT;

-- AlterTable
ALTER TABLE "politicas_datos" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "temas" ALTER COLUMN "colores" DROP DEFAULT;

-- CreateTable
CREATE TABLE "oportunidades" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "embudo" "TipoEmbudo" NOT NULL,
    "etapa" "EtapaOportunidad" NOT NULL DEFAULT 'CAPTADO',
    "titulo" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "probabilidad" INTEGER NOT NULL DEFAULT 5,
    "probabilidadPropia" BOOLEAN NOT NULL DEFAULT false,
    "cierreEsperado" TIMESTAMP(3),
    "asesorId" TEXT,
    "personaId" TEXT,
    "empresaId" TEXT,
    "origen" "OrigenParticipante" NOT NULL DEFAULT 'ASESOR',
    "campana" TEXT,
    "leadId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primeraRespuestaEn" TIMESTAMP(3),
    "minutosPrimeraRespuesta" INTEGER,
    "ultimoToqueEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradaEn" TIMESTAMP(3),
    "motivoCierre" "MotivoCierre",
    "notaCierre" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_oportunidad" (
    "id" TEXT NOT NULL,
    "oportunidadId" TEXT NOT NULL,
    "de" "EtapaOportunidad",
    "a" "EtapaOportunidad" NOT NULL,
    "nota" TEXT,
    "adminId" TEXT,
    "actorNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_oportunidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oportunidades_codigo_key" ON "oportunidades"("codigo");

-- CreateIndex
CREATE INDEX "oportunidades_convenioId_etapa_idx" ON "oportunidades"("convenioId", "etapa");

-- CreateIndex
CREATE INDEX "oportunidades_convenioId_asesorId_etapa_idx" ON "oportunidades"("convenioId", "asesorId", "etapa");

-- CreateIndex
CREATE INDEX "oportunidades_convenioId_cierreEsperado_idx" ON "oportunidades"("convenioId", "cierreEsperado");

-- CreateIndex
CREATE INDEX "oportunidades_personaId_idx" ON "oportunidades"("personaId");

-- CreateIndex
CREATE INDEX "oportunidades_empresaId_idx" ON "oportunidades"("empresaId");

-- CreateIndex
CREATE INDEX "movimientos_oportunidad_oportunidadId_creadoEn_idx" ON "movimientos_oportunidad"("oportunidadId", "creadoEn");

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_oportunidad" ADD CONSTRAINT "movimientos_oportunidad_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_oportunidad" ADD CONSTRAINT "movimientos_oportunidad_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
