-- La mesa de entrada: un lead antes de ser ficha.

-- Un lead de un anuncio trae nombre, telefono y correo, y NO
-- trae cedula. Y `personas` exige (tipoDocumentoSepId,
-- numeroDocumento) como clave unica, que es justo lo que hace
-- imposible el duplicado por documento y por lo que no existe
-- pantalla de fusionar duplicados.
--
-- Volver el documento opcional arreglaria el caso de hoy y
-- rompería esa garantia para siempre. Asi que el lead aterriza
-- aqui tal como llega, y de aqui sale: con documento valido se
-- convierte solo, y sin el espera a que un asesor lo complete.
--
-- `carga` guarda el cuerpo entero. En un webhook no es opcional:
-- es lo que deja depurar, reprocesar y demostrar que llego.
--
-- (origenSistema, externoId) unico es la idempotencia: los
-- webhooks reintentan, y el mismo lead dos veces no puede
-- producir dos fichas.

-- CreateEnum
CREATE TYPE "EstadoLeadEntrante" AS ENUM ('PENDIENTE', 'CONVERTIDO', 'DESCARTADO');
-- CreateTable
CREATE TABLE "leads_entrantes" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "origenSistema" TEXT NOT NULL,
    "externoId" TEXT NOT NULL,
    "origen" "OrigenParticipante" NOT NULL DEFAULT 'OTRO',
    "nombreCompleto" TEXT,
    "correo" TEXT,
    "celular" TEXT,
    "tipoDocumentoSepId" INTEGER,
    "numeroDocumento" TEXT,
    "interes" TEXT,
    "carga" JSONB NOT NULL,
    "estado" "EstadoLeadEntrante" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "participanteId" TEXT,
    "recibidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadoEn" TIMESTAMP(3),
    CONSTRAINT "leads_entrantes_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "leads_entrantes_participanteId_key" ON "leads_entrantes"("participanteId");
-- CreateIndex
CREATE INDEX "leads_entrantes_convenioId_estado_recibidoEn_idx" ON "leads_entrantes"("convenioId", "estado", "recibidoEn");
-- CreateIndex
CREATE UNIQUE INDEX "leads_entrantes_origenSistema_externoId_key" ON "leads_entrantes"("origenSistema", "externoId");
-- AddForeignKey
ALTER TABLE "leads_entrantes" ADD CONSTRAINT "leads_entrantes_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "leads_entrantes" ADD CONSTRAINT "leads_entrantes_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
