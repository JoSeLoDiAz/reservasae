-- El aviso a quien lleva la ficha.
--
-- Una fila POR DESTINATARIO y no por suceso: «leida» es de cada
-- quien. Dos asesores mirando lo mismo no pueden compartir un
-- solo estado de lectura.
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT,
    "claveEvento" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leidaEn" TIMESTAMP(3),

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- Lo que hace idempotente el aviso: un reintento no avisa dos veces.
CREATE UNIQUE INDEX "notificaciones_destinatarioId_tipo_claveEvento_key"
  ON "notificaciones"("destinatarioId", "tipo", "claveEvento");

-- La consulta del panel: lo mio, sin leer, lo ultimo primero.
CREATE INDEX "notificaciones_destinatarioId_leidaEn_creadoEn_idx"
  ON "notificaciones"("destinatarioId", "leidaEn", "creadoEn");

-- Lo que le paso a ESTA ficha, para pintarlo en su historial.
CREATE INDEX "notificaciones_participanteId_creadoEn_idx"
  ON "notificaciones"("participanteId", "creadoEn");

-- Borrar la cuenta se lleva sus avisos: no son de nadie mas.
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_destinatarioId_fkey"
  FOREIGN KEY ("destinatarioId") REFERENCES "administradores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_participanteId_fkey"
  FOREIGN KEY ("participanteId") REFERENCES "participantes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
