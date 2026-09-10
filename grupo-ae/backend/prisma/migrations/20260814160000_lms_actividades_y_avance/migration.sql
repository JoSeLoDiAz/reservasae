-- CreateEnum
CREATE TYPE "TipoActividad" AS ENUM ('LECCION', 'RECURSO', 'TAREA', 'QUIZ', 'FORO', 'ENCUESTA', 'EVALUACION');

-- CreateEnum
CREATE TYPE "EstadoAvance" AS ENUM ('EN_CURSO', 'ENTREGADA', 'APROBADA', 'NO_APROBADA');

-- AlterTable
ALTER TABLE "participantes" ADD COLUMN     "ultimoAcceso" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "actividades" (
    "id" TEXT NOT NULL,
    "accionFormacionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoActividad" NOT NULL DEFAULT 'LECCION',
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,
    "ponderacion" DECIMAL(5,2),
    "duracion" INTEGER,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avances_actividad" (
    "id" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "estado" "EstadoAvance" NOT NULL DEFAULT 'EN_CURSO',
    "calificacion" DECIMAL(5,2),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "iniciadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadaEn" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avances_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actividades_accionFormacionId_publicada_orden_idx" ON "actividades"("accionFormacionId", "publicada", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "actividades_accionFormacionId_orden_key" ON "actividades"("accionFormacionId", "orden");

-- CreateIndex
CREATE INDEX "avances_actividad_participanteId_estado_idx" ON "avances_actividad"("participanteId", "estado");

-- CreateIndex
CREATE INDEX "avances_actividad_actividadId_estado_idx" ON "avances_actividad"("actividadId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "avances_actividad_participanteId_actividadId_key" ON "avances_actividad"("participanteId", "actividadId");

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_accionFormacionId_fkey" FOREIGN KEY ("accionFormacionId") REFERENCES "acciones_formacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_actividad" ADD CONSTRAINT "avances_actividad_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_actividad" ADD CONSTRAINT "avances_actividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- una calificacion fuera de 0..100 no significa nada
ALTER TABLE "avances_actividad"
  ADD CONSTRAINT "avances_calificacion_valida"
  CHECK ("calificacion" IS NULL OR ("calificacion" BETWEEN 0 AND 100));

-- completar deja fecha
ALTER TABLE "avances_actividad"
  ADD CONSTRAINT "avances_completada_fechada"
  CHECK ("estado" = 'EN_CURSO' OR "completadaEn" IS NOT NULL);

-- el orden de las actividades empieza en 1
ALTER TABLE "actividades"
  ADD CONSTRAINT "actividades_orden_positivo" CHECK ("orden" >= 1);
