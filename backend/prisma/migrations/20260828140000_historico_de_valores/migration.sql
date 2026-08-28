-- El «Historial Logs»: qué decía antes.
--
-- El otro historial —movimientos_participante— cuenta QUÉ HIZO
-- alguien. Este cuenta QUÉ DECÍA EL DATO. Son dos preguntas y
-- por eso son dos tablas: «Ana cambió el correo el martes» no
-- sirve para restablecerlo, y «decía maria@ferreteria.com» no
-- dice quién lo tocó.
--
-- Existe para poder DESHACER. Sin el valor viejo, una
-- corrección equivocada es definitiva.

CREATE TYPE "ClaseDeDato" AS ENUM (
  'CONTACTO',
  'IDENTIDAD',
  'FORMACION',
  'SENSIBLE'
);

CREATE TABLE "valores_anteriores" (
    "id"              TEXT NOT NULL,
    "participanteId"  TEXT NOT NULL,
    "campo"           TEXT NOT NULL,
    "clase"           "ClaseDeDato" NOT NULL,

    -- NULL cuando la clase es SENSIBLE —ahí se guarda que
    -- cambió, nunca qué decía— y también cuando el campo
    -- estaba vacío, que es distinto de no haberlo guardado.
    -- `habiaValor` desempata las dos cosas.
    "valorAnterior"   TEXT,
    "habiaValor"      BOOLEAN NOT NULL DEFAULT true,

    "adminId"         TEXT,
    -- Congelado: la cuenta puede desaparecer y la huella no.
    "actorNombre"     TEXT NOT NULL,
    "ip"              TEXT,

    -- Se restableció desde aquí. La fila NO se borra: deshacer
    -- también es un cambio y se tiene que poder ver.
    "restauradoEn"    TIMESTAMP(3),
    "restauradoPorId" TEXT,

    "creadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valores_anteriores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "valores_anteriores_participanteId_creadoEn_idx"
  ON "valores_anteriores"("participanteId", "creadoEn");
CREATE INDEX "valores_anteriores_creadoEn_idx"
  ON "valores_anteriores"("creadoEn");

-- Si se borra la participación se va su histórico con ella:
-- sin la ficha, un «antes decía X» no se puede ni leer ni
-- restablecer. De que se borró queda la huella en la
-- auditoría, que es donde tiene que estar.
ALTER TABLE "valores_anteriores"
  ADD CONSTRAINT "valores_anteriores_participanteId_fkey"
  FOREIGN KEY ("participanteId") REFERENCES "participantes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- El histórico NO se va con quien lo hizo: por eso está
-- `actorNombre` congelado al lado.
ALTER TABLE "valores_anteriores"
  ADD CONSTRAINT "valores_anteriores_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "administradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "valores_anteriores"
  ADD CONSTRAINT "valores_anteriores_restauradoPorId_fkey"
  FOREIGN KEY ("restauradoPorId") REFERENCES "administradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
