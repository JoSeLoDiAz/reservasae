-- Que formulario le da la marca a cada gremio.

-- El subdominio de un gremio tiene que salir con SU logo y
-- SUS colores, y la apariencia solo existe a nivel de
-- formulario. Hasta hoy se deducia por convencion: el
-- formulario cuyo slug coincide con el del convenio. Esa
-- regla falla en silencio en cuanto alguien renombra un
-- formulario o crea el segundo, y ADECOPRIA ya tiene dos
-- publicados. Con la columna, la convencion se escribe una
-- vez y despues nadie depende de ella.
ALTER TABLE "convenios" ADD COLUMN "formularioMarcaId" TEXT;

ALTER TABLE "convenios"
  ADD CONSTRAINT "convenios_formularioMarcaId_fkey"
  FOREIGN KEY ("formularioMarcaId") REFERENCES "formularios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "convenios_formularioMarcaId_idx"
  ON "convenios"("formularioMarcaId");

-- la convencion de hoy, ya escrita
UPDATE "convenios" c
   SET "formularioMarcaId" = f."id"
  FROM "formularios" f
 WHERE f."slug" = c."slug"
   AND c."formularioMarcaId" IS NULL;
