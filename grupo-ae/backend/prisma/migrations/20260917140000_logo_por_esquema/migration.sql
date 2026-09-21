-- CreateEnum
CREATE TYPE "EsquemaDeLogo" AS ENUM ('AMBOS', 'CLARO', 'OSCURO');

-- AlterTable
ALTER TABLE "logos" ADD COLUMN     "esquema" "EsquemaDeLogo" NOT NULL DEFAULT 'AMBOS';

