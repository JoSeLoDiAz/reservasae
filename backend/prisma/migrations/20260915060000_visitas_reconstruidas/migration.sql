-- el trafico de antes del contador, sacado del registro de nginx
CREATE TABLE "visitas_reconstruidas" (
  "id" TEXT NOT NULL,
  "dia" DATE NOT NULL,
  "slug" TEXT NOT NULL,
  "convenioId" TEXT,
  -- vacias y no nulas: el CASE de procedencia hace coalesce,
  -- y en Postgres dos NULL no chocan en una llave unica
  "referente" TEXT NOT NULL DEFAULT '',
  "utmFuente" TEXT NOT NULL DEFAULT '',
  "huboFbclid" BOOLEAN NOT NULL DEFAULT false,
  "navegador" TEXT NOT NULL DEFAULT 'OTRO',
  "visitas" INTEGER NOT NULL,
  "envios" INTEGER NOT NULL DEFAULT 0,
  "importadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visitas_reconstruidas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visitas_reconstruidas_dia_slug_referente_utmFuente_huboFbcl_key"
  ON "visitas_reconstruidas"("dia", "slug", "referente", "utmFuente", "huboFbclid", "navegador");
CREATE INDEX "visitas_reconstruidas_convenioId_dia_idx"
  ON "visitas_reconstruidas"("convenioId", "dia");

ALTER TABLE "visitas_reconstruidas"
  ADD CONSTRAINT "visitas_reconstruidas_convenioId_fkey"
  FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- un conteo no puede ser negativo
ALTER TABLE "visitas_reconstruidas"
  ADD CONSTRAINT "visitas_reconstruidas_conteos" CHECK ("visitas" >= 0 AND "envios" >= 0);
