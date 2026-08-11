-- Apariencia propia de cada formulario. NULL o clave ausente = hereda.
ALTER TABLE "formularios"
  ADD COLUMN "coloresClaro"  JSONB,
  ADD COLUMN "coloresOscuro" JSONB,
  ADD COLUMN "logoDatos"     BYTEA,
  ADD COLUMN "logoTipoMime"  TEXT,
  ADD COLUMN "logoNombre"    TEXT,
  ADD COLUMN "logoVersion"   INTEGER NOT NULL DEFAULT 0;
