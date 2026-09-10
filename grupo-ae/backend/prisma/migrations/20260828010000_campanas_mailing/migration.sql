-- Campanas de correo: un mensaje que sale a muchos, de a uno.
--
-- No hay proveedor de campanas, asi que esto sale por la cuenta
-- de Gmail de la oficina. Por eso una campana no es un envio:
-- es una COLA que se vacia despacio, respetando horario y
-- topes. Lanzar arma la lista y abre la llave; no manda nada.

CREATE TYPE "EstadoCampana" AS ENUM ('BORRADOR', 'ENVIANDO', 'PAUSADA', 'TERMINADA');
CREATE TYPE "EstadoDestinatario" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO', 'OMITIDO');

CREATE TABLE "campanas" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "bannerDatos" BYTEA,
    "bannerMime" TEXT,
    "bannerNombre" TEXT,
    "bannerVersion" INTEGER NOT NULL DEFAULT 1,
    "segmento" JSONB NOT NULL,
    "estado" "EstadoCampana" NOT NULL DEFAULT 'BORRADOR',
    "creadoPorId" TEXT,
    "lanzadaEn" TIMESTAMP(3),
    "terminadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campanas_convenioId_estado_idx" ON "campanas"("convenioId", "estado");

ALTER TABLE "campanas"
  ADD CONSTRAINT "campanas_convenioId_fkey"
  FOREIGN KEY ("convenioId") REFERENCES "convenios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- La campana NO se va con quien la escribio: ya se le mando a
-- gente y hay que poder decir que decia.
ALTER TABLE "campanas"
  ADD CONSTRAINT "campanas_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "administradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "destinatarios_campana" (
    "id" TEXT NOT NULL,
    "campanaId" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    -- congelado al armar la lista: si manana cambia su correo,
    -- hay que poder saber a donde se mando
    "correo" TEXT NOT NULL,
    "estado" "EstadoDestinatario" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "enviadoEn" TIMESTAMP(3),
    -- las aperturas son APROXIMADAS: Gmail descarga la imagen
    -- el mismo y Apple marca abierto a todos
    "abiertoEn" TIMESTAMP(3),
    "aperturas" INTEGER NOT NULL DEFAULT 0,
    -- los clics si son firmes: pasan por nuestro servidor
    "clicEn" TIMESTAMP(3),
    "clics" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "destinatarios_campana_pkey" PRIMARY KEY ("id")
);

-- una persona, una vez por campana
CREATE UNIQUE INDEX "destinatarios_campana_campanaId_participanteId_key"
  ON "destinatarios_campana"("campanaId", "participanteId");
CREATE INDEX "destinatarios_campana_campanaId_estado_idx"
  ON "destinatarios_campana"("campanaId", "estado");
-- para contar cuantos le llegaron hoy a una persona
CREATE INDEX "destinatarios_campana_participanteId_enviadoEn_idx"
  ON "destinatarios_campana"("participanteId", "enviadoEn");

ALTER TABLE "destinatarios_campana"
  ADD CONSTRAINT "destinatarios_campana_campanaId_fkey"
  FOREIGN KEY ("campanaId") REFERENCES "campanas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "destinatarios_campana"
  ADD CONSTRAINT "destinatarios_campana_participanteId_fkey"
  FOREIGN KEY ("participanteId") REFERENCES "participantes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
