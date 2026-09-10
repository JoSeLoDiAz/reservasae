-- El tipo de documento pasa a ser el id del catalogo del
-- SEP: es lo que viaja al cargue y evita dos verdades.

ALTER TABLE "personas" ADD COLUMN "tipoDocumentoSepId" INTEGER;

-- convertir antes de soltar, o las filas que ya existen
-- se quedan sin valor y el NOT NULL revienta el arranque
UPDATE "personas" SET "tipoDocumentoSepId" = CASE "tipoDocumento"
  WHEN 'CC'   THEN 1
  WHEN 'TI'   THEN 2
  WHEN 'CE'   THEN 3
  WHEN 'PEP'  THEN 4
  WHEN 'NIT'  THEN 6
  WHEN 'PA'   THEN 41
  WHEN 'PPT'  THEN 61
  -- registro civil no existe en el catalogo del SEP
  WHEN 'RC'   THEN 5
  ELSE 5
END;

ALTER TABLE "personas" ALTER COLUMN "tipoDocumentoSepId" SET NOT NULL;

DROP INDEX "personas_tipoDocumento_numeroDocumento_key";
ALTER TABLE "personas" DROP COLUMN "tipoDocumento";
DROP TYPE "TipoDocumento";

CREATE UNIQUE INDEX "personas_tipoDocumentoSepId_numeroDocumento_key"
  ON "personas"("tipoDocumentoSepId", "numeroDocumento");

-- el id tiene que existir en el catalogo del SEP
ALTER TABLE "personas"
  ADD CONSTRAINT "personas_tipo_documento_conocido"
  CHECK ("tipoDocumentoSepId" IN (1,2,3,4,5,6,7,21,41,61,81,82,101,121,141));
