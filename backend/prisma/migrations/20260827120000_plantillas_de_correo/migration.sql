-- Plantillas de correo: un texto que se escribe una vez y se
-- manda muchas.
--
-- Lo que cambia de una persona a otra va entre llaves --
-- {{saludo}}, {{fechaInicio}} -- y lo resuelve el codigo, no
-- la base. Aqui solo vive el texto.
--
-- convenioId nulo quiere decir «sirve para todos los
-- gremios». Con gremio, solo aparece en el suyo: el tono de
-- BRITCHAM no tiene por que ser el de ADECOPRIA.

CREATE TABLE "plantillas_correo" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT,
    "nombre" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_correo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plantillas_correo_convenioId_activa_idx"
  ON "plantillas_correo"("convenioId", "activa");

-- Si se borra el gremio se van sus plantillas: no le sirven a
-- nadie mas y llevan su tono.
ALTER TABLE "plantillas_correo"
  ADD CONSTRAINT "plantillas_correo_convenioId_fkey"
  FOREIGN KEY ("convenioId") REFERENCES "convenios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- La plantilla NO se va con quien la escribio: ya se uso para
-- escribirle a gente, y borrarla dejaria correos sin origen.
ALTER TABLE "plantillas_correo"
  ADD CONSTRAINT "plantillas_correo_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "administradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
