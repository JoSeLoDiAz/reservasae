-- historico de importaciones: quien subio que, cuando y como

CREATE TYPE "OrigenDeCarga" AS ENUM ('ARCHIVO', 'PEGADO');

CREATE TABLE "cargas_de_participantes" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "ofertaId" TEXT,
    -- nulo si se borra la cuenta; por eso `autor` va al lado
    "adminId" TEXT,
    "autor" TEXT NOT NULL,
    "origen" "OrigenDeCarga" NOT NULL,
    "nombreArchivo" TEXT,
    "filas" INTEGER NOT NULL,
    "creados" INTEGER NOT NULL DEFAULT 0,
    "yaExistian" INTEGER NOT NULL DEFAULT 0,
    "duplicados" INTEGER NOT NULL DEFAULT 0,
    "descartados" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargas_de_participantes_pkey" PRIMARY KEY ("id")
);

-- un recuento negativo no significa nada
ALTER TABLE "cargas_de_participantes"
  ADD CONSTRAINT "carga_recuentos_no_negativos" CHECK (
    "filas" >= 0 AND "creados" >= 0 AND "yaExistian" >= 0
    AND "duplicados" >= 0 AND "descartados" >= 0 AND "fallidos" >= 0
  );

CREATE INDEX "cargas_de_participantes_convenioId_creadoEn_idx"
  ON "cargas_de_participantes"("convenioId", "creadoEn");

ALTER TABLE "participantes" ADD COLUMN "cargaId" TEXT;

-- para abrir una importacion y ver a quien metio
CREATE INDEX "participantes_cargaId_idx" ON "participantes"("cargaId");

ALTER TABLE "cargas_de_participantes"
  ADD CONSTRAINT "cargas_de_participantes_convenioId_fkey"
  FOREIGN KEY ("convenioId") REFERENCES "convenios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cargas_de_participantes"
  ADD CONSTRAINT "cargas_de_participantes_ofertaId_fkey"
  FOREIGN KEY ("ofertaId") REFERENCES "ofertas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cargas_de_participantes"
  ADD CONSTRAINT "cargas_de_participantes_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "administradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "participantes"
  ADD CONSTRAINT "participantes_cargaId_fkey"
  FOREIGN KEY ("cargaId") REFERENCES "cargas_de_participantes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
