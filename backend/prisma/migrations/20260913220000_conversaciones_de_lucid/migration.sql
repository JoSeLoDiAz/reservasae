-- lo que Lucid manda de cada conversacion

CREATE TYPE "EstadoConversacion" AS ENUM ('PEGADA', 'SIN_DUENO', 'AMBIGUA');

CREATE TABLE "conversaciones_entrantes" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "origenSistema" TEXT NOT NULL,
    "externoId" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "ocurridoEn" TIMESTAMP(3),
    "resumen" TEXT NOT NULL,
    "carga" JSONB,
    "estado" "EstadoConversacion" NOT NULL,
    "notaId" TEXT,
    "candidatos" JSONB,
    "recibidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversaciones_entrantes_pkey" PRIMARY KEY ("id")
);

-- un reintento no deja dos notas
CREATE UNIQUE INDEX "conversaciones_entrantes_origenSistema_externoId_key"
    ON "conversaciones_entrantes"("origenSistema", "externoId");

CREATE INDEX "conversaciones_entrantes_convenioId_estado_recibidoEn_idx"
    ON "conversaciones_entrantes"("convenioId", "estado", "recibidoEn");

-- para reenganchar el sin dueno cuando aparezca
CREATE INDEX "conversaciones_entrantes_celular_idx"
    ON "conversaciones_entrantes"("celular");

ALTER TABLE "conversaciones_entrantes"
    ADD CONSTRAINT "conversaciones_entrantes_convenioId_fkey"
    FOREIGN KEY ("convenioId") REFERENCES "convenios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
