-- AlterTable
ALTER TABLE "convenios" ADD COLUMN     "sepNombreConviniente" TEXT,
ADD COLUMN     "sepProyectoId" INTEGER;

-- AlterTable
ALTER TABLE "acciones_formacion" ADD COLUMN     "sepAfId" INTEGER;

-- AlterTable
ALTER TABLE "grupos" ADD COLUMN     "sepGrupoId" INTEGER;

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "tamanoSepId" INTEGER,
ADD COLUMN     "tipoDocumentoSepId" INTEGER;

-- AlterTable
ALTER TABLE "personas" ADD COLUMN     "barrio" TEXT,
ADD COLUMN     "caracterizacionPreguntada" TIMESTAMP(3),
ADD COLUMN     "caracterizacionRechazada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "departamentoSepId" INTEGER,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "estrato" INTEGER,
ADD COLUMN     "generoSepId" INTEGER,
ADD COLUMN     "municipioSepId" INTEGER;

-- AlterTable
ALTER TABLE "participantes" ADD COLUMN     "beneficiarioPrevio" BOOLEAN,
ADD COLUMN     "nivelOcupacionalSepId" INTEGER;

-- CreateTable
CREATE TABLE "caracterizaciones_persona" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "caracterizacionSepId" INTEGER NOT NULL,
    "autorizacionId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caracterizaciones_persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caracterizaciones_persona_autorizacionId_idx" ON "caracterizaciones_persona"("autorizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "caracterizaciones_persona_personaId_caracterizacionSepId_key" ON "caracterizaciones_persona"("personaId", "caracterizacionSepId");

-- AddForeignKey
ALTER TABLE "caracterizaciones_persona" ADD CONSTRAINT "caracterizaciones_persona_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caracterizaciones_persona" ADD CONSTRAINT "caracterizaciones_persona_autorizacionId_fkey" FOREIGN KEY ("autorizacionId") REFERENCES "autorizaciones_datos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- el estrato va de 1 a 6; nulo mientras el asesor no lo tenga
ALTER TABLE "personas"
  ADD CONSTRAINT "personas_estrato_valido"
  CHECK ("estrato" IS NULL OR ("estrato" >= 1 AND "estrato" <= 6));
