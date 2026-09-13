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

-- una sesion no termina antes de empezar
ALTER TABLE "grupos"
  ADD CONSTRAINT "grupos_hora_fin_despues_del_inicio"
  CHECK ("horaFin" IS NULL OR "horaInicio" IS NULL OR "horaFin" > "horaInicio");

-- el reloj de 24 h: "lunes a sabado, de 18:00 a 20:00"
UPDATE "grupos" g
   SET "dias"       = btrim(s.m[1]),
       "horaInicio" = lpad(s.m[2], 2, '0') || ':' || s.m[3],
       "horaFin"    = lpad(s.m[4], 2, '0') || ':' || s.m[5]
  FROM (
    SELECT "id",
           regexp_match(
             "dias",
             '^\s*([^,]+)\s*,\s*(?:[dD][eE]\s+)?(\d{1,2}):(\d{2})\s+a\s+(\d{1,2}):(\d{2})\s*$'
           ) AS m
      FROM "grupos"
     WHERE "dias" IS NOT NULL
  ) s
 WHERE g."id" = s."id"
   AND s.m IS NOT NULL
   AND s.m[2]::int BETWEEN 0 AND 23
   AND s.m[3]::int < 60
   AND s.m[4]::int BETWEEN 0 AND 23
   AND s.m[5]::int < 60;

-- el de 12 h, y EXIGE el meridiano en los dos extremos:
-- con uno solo no se sabe si las 2 son de la tarde, asi
-- que esa frase se queda entera y alguien la corrige
UPDATE "grupos" g
   SET "dias"       = btrim(s.m[1]),
       "horaInicio" = lpad(((s.m[2]::int % 12) + CASE WHEN lower(s.m[4]) = 'p' THEN 12 ELSE 0 END)::text, 2, '0')
                      || ':' || s.m[3],
       "horaFin"    = lpad(((s.m[5]::int % 12) + CASE WHEN lower(s.m[7]) = 'p' THEN 12 ELSE 0 END)::text, 2, '0')
                      || ':' || s.m[6]
  FROM (
    SELECT "id",
           regexp_match(
             "dias",
             '^\s*([^,]+)\s*,\s*(?:[dD][eE]\s+)?(\d{1,2}):(\d{2})\s*([apAP])\.?\s*[mM]\.?\s+a\s+(\d{1,2}):(\d{2})\s*([apAP])\.?\s*[mM]\.?\s*$'
           ) AS m
      FROM "grupos"
     WHERE "dias" IS NOT NULL
       AND "horaInicio" IS NULL
  ) s
 WHERE g."id" = s."id"
   AND s.m IS NOT NULL
   AND s.m[2]::int BETWEEN 1 AND 12
   AND s.m[3]::int < 60
   AND s.m[5]::int BETWEEN 1 AND 12
   AND s.m[6]::int < 60;
