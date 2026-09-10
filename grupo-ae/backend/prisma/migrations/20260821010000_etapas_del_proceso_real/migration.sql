-- renombrar conserva las filas; recrear el tipo las
-- obligaria a migrar una por una
ALTER TYPE "EtapaParticipante" RENAME VALUE 'NUEVO' TO 'INTERESADO';
ALTER TYPE "EtapaParticipante" RENAME VALUE 'MATRICULADO' TO 'INSCRITO';

-- se fue avisando / dejo de entrar sin decir nada
ALTER TYPE "EtapaParticipante" ADD VALUE IF NOT EXISTS 'DESERTO';
ALTER TYPE "EtapaParticipante" ADD VALUE IF NOT EXISTS 'ABANDONO';

-- que pauta funciono: "REDES" no lo dice
ALTER TYPE "OrigenParticipante" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "OrigenParticipante" ADD VALUE IF NOT EXISTS 'FACEBOOK';
ALTER TYPE "OrigenParticipante" ADD VALUE IF NOT EXISTS 'LINKEDIN';
ALTER TYPE "OrigenParticipante" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "OrigenParticipante" ADD VALUE IF NOT EXISTS 'CORREO';

-- el default de la columna apuntaba al nombre viejo
ALTER TABLE "participantes" ALTER COLUMN "etapa" SET DEFAULT 'INTERESADO';
