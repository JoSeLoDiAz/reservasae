-- Avisos de cupos sin completar.

-- Salen tres días hábiles antes del cierre de inscripciones,
-- que a su vez es una semana hábil antes de que arranque el
-- grupo. No se espera al cierre para descubrir que faltan:
-- para entonces ya no hay a quién llamar.
CREATE TABLE "avisos_de_cupos" (
  "id"               TEXT NOT NULL,
  "coberturaId"      TEXT NOT NULL,
  "fechaInicioGrupo" TIMESTAMP(3) NOT NULL,
  "avisarEn"         TIMESTAMP(3) NOT NULL,
  "cierreEn"         TIMESTAMP(3) NOT NULL,
  "cuposMaximos"     INTEGER NOT NULL,
  "inscritos"        INTEGER NOT NULL,
  "faltan"           INTEGER NOT NULL,
  "creadoEn"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadoEn"        TIMESTAMP(3),
  "canal"            TEXT,
  "atendidoEn"       TIMESTAMP(3),
  CONSTRAINT "avisos_de_cupos_pkey" PRIMARY KEY ("id")
);

-- Uno por grupo y por cronograma: si la fecha de arranque se
-- corre, nace un aviso nuevo en vez de duplicarse el viejo.
CREATE UNIQUE INDEX "avisos_de_cupos_coberturaId_fechaInicioGrupo_key"
  ON "avisos_de_cupos"("coberturaId", "fechaInicioGrupo");

CREATE INDEX "avisos_de_cupos_enviadoEn_avisarEn_idx"
  ON "avisos_de_cupos"("enviadoEn", "avisarEn");

ALTER TABLE "avisos_de_cupos"
  ADD CONSTRAINT "avisos_de_cupos_coberturaId_fkey"
  FOREIGN KEY ("coberturaId") REFERENCES "grupos_cobertura"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
