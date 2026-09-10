-- AlterEnum
-- Los proyectos tienen TRES modalidades, no dos: "PRESENCIAL HIBRIDA" es la de
-- los foros donde el mismo grupo junta asistentes en sede y conectados en vivo.
-- Sin este valor, esas dos acciones se guardaban como VIRTUAL, que es falso.
-- Postgres 12+ admite ADD VALUE dentro de transaccion mientras no se USE el
-- valor nuevo en la misma transaccion; aqui solo se declara.
ALTER TYPE "Modalidad" ADD VALUE IF NOT EXISTS 'HIBRIDA';

-- AlterTable
-- DEFAULT en actualizadoEn: sin el, anadir una columna NOT NULL falla si ya
-- existe algun administrador. Prisma lo gestiona luego con @updatedAt.
ALTER TABLE "administradores" ADD COLUMN     "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "celular" TEXT,
ADD COLUMN     "organizacion" TEXT;

-- AlterTable
-- El formulario pide celular, no telefono fijo. Se renombra en vez de crear y
-- borrar para no perder lo ya capturado.
ALTER TABLE "reservas" RENAME COLUMN "contactoTelefono" TO "contactoCelular";

-- AlterTable
-- Cuando la organizacion elige "Otro" gremio, aqui va cual.
ALTER TABLE "empresas" ADD COLUMN     "redAsociadaOtra" TEXT;

-- CreateTable
CREATE TABLE "marca" (
    "id" TEXT NOT NULL DEFAULT 'unica',
    "nombreApp" TEXT NOT NULL DEFAULT 'Convoca',
    "tituloPublico" TEXT NOT NULL DEFAULT 'Reserve sus cupos de formación',
    "subtituloPublico" TEXT NOT NULL DEFAULT 'La formación es gratuita y los cupos son limitados.',
    "piePagina" TEXT,
    "colorMarca" TEXT NOT NULL DEFAULT '#1d4ed8',
    "colorMarcaFuerte" TEXT NOT NULL DEFAULT '#1e3a8a',
    "colorMarcaSuave" TEXT NOT NULL DEFAULT '#eff6ff',
    "colorMarcaTexto" TEXT NOT NULL DEFAULT '#ffffff',
    "logoDatos" BYTEA,
    "logoTipoMime" TEXT,
    "logoNombre" TEXT,
    "logoVersion" INTEGER NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPorId" TEXT,

    CONSTRAINT "marca_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "marca" ADD CONSTRAINT "marca_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

