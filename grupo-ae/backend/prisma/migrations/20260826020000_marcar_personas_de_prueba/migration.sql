-- Marcar las personas que se inventó la siembra de prueba.

-- La siembra reparte cédulas desde 1.010.200.000 subiendo
-- entre 700 y 9.000 cada vez. Ese es rango real de cédulas
-- colombianas: cada número inventado le pertenece a alguien
-- de verdad. Consultar el RUI con ellos le pide al Estado la
-- identidad de un ciudadano que no pidió nada.
--
-- Ya pasó: una consulta sobre un lead de demo devolvió a una
-- persona real, con nombre y apellidos, y quedó guardada.
ALTER TABLE "personas"
  ADD COLUMN "esDePrueba" BOOLEAN NOT NULL DEFAULT false;

-- El tramo que usa la siembra: 120 personas desde
-- 1.010.200.000, con saltos de hasta 9.000, no pasa de
-- 1.011.300.000. Se marca el tramo entero con holgura.
UPDATE "personas"
   SET "esDePrueba" = true
 WHERE "numeroDocumento" ~ '^[0-9]+$'
   AND "numeroDocumento"::bigint BETWEEN 1010200000 AND 1011400000;
