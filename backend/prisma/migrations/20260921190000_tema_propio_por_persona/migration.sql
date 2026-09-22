-- Los colores de cada persona, encima de los del sistema.
--
-- Nullable y sin relleno: quien no ha elegido nada sigue viendo la
-- paleta general (tabla "temas"), exactamente como hasta hoy.
ALTER TABLE "administradores" ADD COLUMN "temaPropio" JSONB;
