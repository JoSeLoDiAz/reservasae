-- La caracterización, atada al gremio donde se declaró.
--
-- Colgaba de UNA autorización -la del gremio donde se capturó primero-
-- y la llave única era (persona, caracterización): una marca, una vez
-- POR PERSONA. Así que revocar en un gremio se llevaba la marca del
-- reporte del OTRO, donde la persona sigue autorizando; y una marca
-- consentida solo en uno viajaba en el reporte del otro.
--
-- Son datos sensibles -víctima del conflicto armado, una discapacidad-
-- y es lo que ve el SENA.

-- 1. La columna, primero nula para poder rellenarla.
ALTER TABLE "caracterizaciones_persona" ADD COLUMN "convenioId" TEXT;

-- 2. El relleno: el gremio sale de la política que ampara su
--    autorización, que es de donde se dedujo siempre.
UPDATE "caracterizaciones_persona" c
   SET "convenioId" = p."convenioId"
  FROM "autorizaciones_datos" a
  JOIN "politicas_datos" p ON p.id = a."politicaDatosId"
 WHERE a.id = c."autorizacionId";

-- 3. Si alguna quedara sin gremio -una autorización huérfana- se borra
--    antes de poner el NOT NULL. Una marca que no se sabe en qué gremio
--    se declaró no se puede reportar a nadie, y conservarla con un
--    convenio inventado sería peor: diría que alguien declaró algo que
--    no consta que declarara.
DELETE FROM "caracterizaciones_persona" WHERE "convenioId" IS NULL;

ALTER TABLE "caracterizaciones_persona" ALTER COLUMN "convenioId" SET NOT NULL;

-- 4. La llave: una marca, una vez POR GREMIO.
DROP INDEX IF EXISTS "caracterizaciones_persona_personaId_caracterizacionSepId_key";
CREATE UNIQUE INDEX "caracterizaciones_persona_personaId_caracterizacionSepId_convenioId_key"
    ON "caracterizaciones_persona" ("personaId", "caracterizacionSepId", "convenioId");

CREATE INDEX "caracterizaciones_persona_convenioId_idx"
    ON "caracterizaciones_persona" ("convenioId");

ALTER TABLE "caracterizaciones_persona"
  ADD CONSTRAINT "caracterizaciones_persona_convenioId_fkey"
  FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
