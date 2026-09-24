-- Con que otra accion se puede cursar ESTA, ademas de ella.
--
-- Josse, 24 sep 2026: una persona de AF1 o AF2 puede estar tambien
-- en el foro (AF7 de ADECOPRIA) y cuenta como DOS inscripciones de
-- la misma persona, no como un duplicado. Las demas no se repiten.
--
-- Va por ID y no por codigo a proposito: «AF7» existe en los dos
-- gremios y NO es lo mismo --en ADECOPRIA es el foro y en BRITCHAM
-- es «Expansion global», presencial--, asi que una regla escrita
-- sobre el codigo dejaria repetir donde nadie lo pidio.
ALTER TABLE "acciones_formacion" ADD COLUMN "combinaConAccionId" TEXT;

-- SET NULL y no CASCADE: borrar el foro no puede llevarse por
-- delante las acciones que lo nombran.
ALTER TABLE "acciones_formacion"
  ADD CONSTRAINT "acciones_formacion_combinaConAccionId_fkey"
  FOREIGN KEY ("combinaConAccionId") REFERENCES "acciones_formacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "acciones_formacion_combinaConAccionId_idx"
  ON "acciones_formacion"("combinaConAccionId");

-- La pareja de hoy: las dos virtuales de ADECOPRIA con su foro.
UPDATE "acciones_formacion" af
   SET "combinaConAccionId" = foro.id
  FROM "acciones_formacion" foro
  JOIN "convenios" c ON c.id = foro."convenioId"
 WHERE c.slug = 'adecopria'
   AND foro.codigo = 'AF7'
   AND af."convenioId" = foro."convenioId"
   AND af.codigo IN ('AF1', 'AF2');
