-- medir el embudo del formulario publico

CREATE TABLE "pasos_de_visita" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "paso" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ms" INTEGER,
    "detalle" TEXT,
    "convenioId" TEXT,
    "slug" TEXT NOT NULL,
    "puerta" TEXT,
    "utmFuente" TEXT,
    "utmCampana" TEXT,
    "utmContenido" TEXT,
    "huboFbclid" BOOLEAN,
    "referente" TEXT,
    "ancho" TEXT,
    "navegador" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pasos_de_visita_pkey" PRIMARY KEY ("id")
);

-- gana la primera: ir y volver no cuenta dos veces
CREATE UNIQUE INDEX "pasos_de_visita_visitaId_paso_key" ON "pasos_de_visita"("visitaId", "paso");
CREATE INDEX "pasos_de_visita_creadoEn_idx" ON "pasos_de_visita"("creadoEn");
CREATE INDEX "pasos_de_visita_convenioId_creadoEn_idx" ON "pasos_de_visita"("convenioId", "creadoEn");

ALTER TABLE "pasos_de_visita" ADD CONSTRAINT "pasos_de_visita_convenioId_fkey"
    FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
