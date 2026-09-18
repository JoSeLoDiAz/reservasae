-- enlace emitido al registrarse
ALTER TABLE "enlaces_completado"
  ADD COLUMN "delRegistro" BOOLEAN NOT NULL DEFAULT false;

-- viejos: casan por la hora
UPDATE "enlaces_completado" e
   SET "delRegistro" = true
  FROM "participantes" p
 WHERE p."id" = e."participanteId"
   AND e."emitidoPorId" IS NULL
   AND abs(extract(epoch FROM (e."creadoEn" - p."creadoEn"))) < 5;
