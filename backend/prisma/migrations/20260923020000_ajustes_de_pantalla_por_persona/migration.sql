-- Los ajustes de pantalla de cada persona (escala de texto y ayudas de
-- accesibilidad), al lado de sus colores propios: antes vivian solo en el
-- navegador y no cruzaban de equipo.
ALTER TABLE "administradores" ADD COLUMN "ajustesDePantalla" JSONB;
