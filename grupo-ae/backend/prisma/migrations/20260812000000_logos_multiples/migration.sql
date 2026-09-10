-- hasta tres logos por ambito
CREATE TABLE "logos" (
    "id" TEXT NOT NULL,
    "formularioId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "etiqueta" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "logos_formularioId_orden_idx" ON "logos"("formularioId", "orden");

ALTER TABLE "logos" ADD CONSTRAINT "logos_formularioId_fkey"
  FOREIGN KEY ("formularioId") REFERENCES "formularios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- se traspasa el logo que ya hubiera
INSERT INTO "logos" ("id", "formularioId", "orden", "etiqueta", "datos",
                     "tipoMime", "nombre", "version", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid()::text, NULL, 0,
       COALESCE(NULLIF(regexp_replace(m."logoNombre", '\.[^.]+$', ''), ''), 'Logo'),
       m."logoDatos", m."logoTipoMime",
       COALESCE(m."logoNombre", 'logo'),
       GREATEST(m."logoVersion", 1), NOW(), NOW()
  FROM "marca" m
 WHERE m."logoDatos" IS NOT NULL AND m."logoTipoMime" IS NOT NULL;

INSERT INTO "logos" ("id", "formularioId", "orden", "etiqueta", "datos",
                     "tipoMime", "nombre", "version", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid()::text, f."id", 0,
       COALESCE(NULLIF(regexp_replace(f."logoNombre", '\.[^.]+$', ''), ''), 'Logo'),
       f."logoDatos", f."logoTipoMime",
       COALESCE(f."logoNombre", 'logo'),
       GREATEST(f."logoVersion", 1), NOW(), NOW()
  FROM "formularios" f
 WHERE f."logoDatos" IS NOT NULL AND f."logoTipoMime" IS NOT NULL;

-- ya trasvasado: fuera lo viejo
ALTER TABLE "marca"
  DROP COLUMN "logoDatos",
  DROP COLUMN "logoNombre",
  DROP COLUMN "logoTipoMime",
  DROP COLUMN "logoVersion";

ALTER TABLE "formularios"
  DROP COLUMN "logoDatos",
  DROP COLUMN "logoNombre",
  DROP COLUMN "logoTipoMime",
  DROP COLUMN "logoVersion";
