-- cada canal por el que llego una persona
CREATE TABLE "toques_de_origen" (
    "id" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "origen" "OrigenParticipante" NOT NULL,
    "clase" "OrigenLead" NOT NULL,
    "primeraVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "veces" INTEGER NOT NULL DEFAULT 1,
    "campana" TEXT,

    CONSTRAINT "toques_de_origen_pkey" PRIMARY KEY ("id")
);

-- un toque por canal: volver por el mismo suma veces
CREATE UNIQUE INDEX "toques_de_origen_participanteId_origen_key" ON "toques_de_origen"("participanteId", "origen");

CREATE INDEX "toques_de_origen_participanteId_idx" ON "toques_de_origen"("participanteId");

ALTER TABLE "toques_de_origen" ADD CONSTRAINT "toques_de_origen_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- el origen que ya tenian es su primer toque
INSERT INTO "toques_de_origen" ("id", "participanteId", "origen", "clase", "primeraVez", "ultimaVez", "veces")
SELECT
  md5(random()::text || p."id"),
  p."id",
  p."origen",
  CASE
    WHEN p."origen"::text IN ('REDES','INSTAGRAM','FACEBOOK','LINKEDIN') THEN 'PAUTA'::"OrigenLead"
    WHEN p."origen"::text = 'AUTOGESTION' THEN 'ORGANICO'::"OrigenLead"
    ELSE 'IMPORTACION'::"OrigenLead"
  END,
  p."creadoEn",
  p."creadoEn",
  1
FROM "participantes" p;
