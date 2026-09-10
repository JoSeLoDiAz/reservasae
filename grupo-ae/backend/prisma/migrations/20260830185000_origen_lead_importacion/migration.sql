-- el tercer valor: lo que no es pauta ni organico

-- Va en su PROPIA migracion y antes de `toques_de_origen`, y no
-- es una manía: Postgres no deja USAR un valor de enum recien
-- añadido dentro de la misma transaccion, y Prisma corre cada
-- migracion en una. Juntarlas es lo que hizo fallar aquella con
-- «invalid input value for enum "OrigenLead": "IMPORTACION"».
ALTER TYPE "OrigenLead" ADD VALUE IF NOT EXISTS 'IMPORTACION';
