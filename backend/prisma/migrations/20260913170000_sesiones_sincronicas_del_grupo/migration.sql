-- el horario se parte en tres

ALTER TABLE "grupos" RENAME COLUMN "horario" TO "dias";

ALTER TABLE "grupos" ADD COLUMN "horaInicio" TEXT;
ALTER TABLE "grupos" ADD COLUMN "horaFin"    TEXT;

-- HH:MM de 24 h, o nada
ALTER TABLE "grupos"
  ADD CONSTRAINT "grupos_horas_con_formato"
  CHECK (
    ("horaInicio" IS NULL OR "horaInicio" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    AND
    ("horaFin"    IS NULL OR "horaFin"    ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  );

-- sin hora de inicio, el fin no dice nada
ALTER TABLE "grupos"
  ADD CONSTRAINT "grupos_hora_fin_con_inicio"
  CHECK ("horaFin" IS NULL OR "horaInicio" IS NOT NULL);

-- la frase vieja se parte; lo que no casa queda igual
UPDATE "grupos" g
   SET "dias"       = btrim(s.m[1]),
       "horaInicio" = lpad((CASE
                              WHEN s.m[4] IS NULL      THEN s.m[2]::int
                              WHEN lower(s.m[4]) = 'a' THEN s.m[2]::int % 12
                              ELSE (s.m[2]::int % 12) + 12
                            END)::text, 2, '0') || ':' || s.m[3],
       "horaFin"    = lpad((CASE
                              WHEN s.m[7] IS NULL      THEN s.m[5]::int
                              WHEN lower(s.m[7]) = 'a' THEN s.m[5]::int % 12
                              ELSE (s.m[5]::int % 12) + 12
                            END)::text, 2, '0') || ':' || s.m[6]
  FROM (
    SELECT "id",
           regexp_match(
             "dias",
             '^\s*([^,]+)\s*,\s*(?:[dD][eE]\s+)?(\d{1,2}):(\d{2})(?:\s*([apAP])\.?\s*[mM]\.?)?\s+a\s+(\d{1,2}):(\d{2})(?:\s*([apAP])\.?\s*[mM]\.?)?\s*$'
           ) AS m
      FROM "grupos"
     WHERE "dias" IS NOT NULL
  ) s
 WHERE g."id" = s."id"
   AND s.m IS NOT NULL
   -- 25:00 casa el patron y no es hora
   AND s.m[3]::int < 60
   AND s.m[6]::int < 60
   AND (CASE WHEN s.m[4] IS NULL THEN s.m[2]::int BETWEEN 0 AND 23
                                 ELSE s.m[2]::int BETWEEN 1 AND 12 END)
   AND (CASE WHEN s.m[7] IS NULL THEN s.m[5]::int BETWEEN 0 AND 23
                                 ELSE s.m[5]::int BETWEEN 1 AND 12 END);
