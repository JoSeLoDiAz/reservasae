-- una fila por sesion, en vez de un campo unico

CREATE TYPE "TipoDeSesion" AS ENUM ('PRESENCIAL', 'SINCRONICA', 'PAT');

CREATE TABLE "sesiones_de_grupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoDeSesion" NOT NULL,
    "dia" TIMESTAMP(3),
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,

    CONSTRAINT "sesiones_de_grupo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sesiones_de_grupo_grupoId_orden_key"
    ON "sesiones_de_grupo"("grupoId", "orden");

CREATE INDEX "sesiones_de_grupo_grupoId_idx" ON "sesiones_de_grupo"("grupoId");

ALTER TABLE "sesiones_de_grupo"
    ADD CONSTRAINT "sesiones_de_grupo_grupoId_fkey"
    FOREIGN KEY ("grupoId") REFERENCES "grupos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- HH:MM de 24 h
ALTER TABLE "sesiones_de_grupo"
    ADD CONSTRAINT "sesiones_de_grupo_horas_con_formato"
    CHECK (
      "horaInicio" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "horaFin" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    );

-- una sesion no termina antes de empezar
ALTER TABLE "sesiones_de_grupo"
    ADD CONSTRAINT "sesiones_de_grupo_fin_despues_del_inicio"
    CHECK ("horaFin" > "horaInicio");

-- la PAT no lleva dia: vale para todos los del grupo
ALTER TABLE "sesiones_de_grupo"
    ADD CONSTRAINT "sesiones_de_grupo_pat_sin_dia"
    CHECK ("tipo" <> 'PAT' OR "dia" IS NULL);

-- lo ya escrito pasa a ser la primera sesion del grupo.
-- La virtual conserva su dia; la presencial NO, porque el que
-- tenia era el de inicio del grupo y repetirlo es decirlo dos
-- veces (comprobado: en las diez coincidian)
INSERT INTO "sesiones_de_grupo" ("id", "grupoId", "orden", "tipo", "dia", "horaInicio", "horaFin")
SELECT
    'ses_' || g."id",
    g."id",
    1,
    CASE WHEN a."modalidad" = 'VIRTUAL' THEN 'SINCRONICA'::"TipoDeSesion"
         ELSE 'PRESENCIAL'::"TipoDeSesion" END,
    CASE WHEN a."modalidad" = 'VIRTUAL' THEN g."sesionDia" ELSE NULL END,
    g."horaInicio",
    g."horaFin"
  FROM "grupos" g
  JOIN "acciones_formacion" a ON a."id" = g."accionFormacionId"
 WHERE g."horaInicio" IS NOT NULL
   AND g."horaFin" IS NOT NULL
   AND g."horaFin" > g."horaInicio";

ALTER TABLE "grupos" DROP CONSTRAINT IF EXISTS "grupos_horas_con_formato";
ALTER TABLE "grupos" DROP CONSTRAINT IF EXISTS "grupos_hora_fin_con_inicio";
ALTER TABLE "grupos" DROP CONSTRAINT IF EXISTS "grupos_hora_fin_despues_del_inicio";
ALTER TABLE "grupos" DROP CONSTRAINT IF EXISTS "grupos_sesion_dentro_del_grupo";

ALTER TABLE "grupos" DROP COLUMN "horaInicio";
ALTER TABLE "grupos" DROP COLUMN "horaFin";
ALTER TABLE "grupos" DROP COLUMN "sesionDia";
