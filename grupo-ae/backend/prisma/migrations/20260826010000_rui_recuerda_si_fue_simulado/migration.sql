-- Cada consulta recuerda si la contestó el simulador.

-- Antes, la ficha lo decidía leyendo RUI_PROVEEDOR: esa
-- variable dice con qué corre el servidor HOY, y eso no
-- cambia lo que ya se respondió ayer. Apagar el simulador
-- convertía sus nombres inventados en respuestas del Estado,
-- que es justo lo contrario de lo que este validador existe
-- para hacer.
ALTER TABLE "consultas_rui"
  ADD COLUMN "simulado" BOOLEAN NOT NULL DEFAULT false;

-- Lo ya respondido por el simulador se marca. Se reconoce
-- sin ambigüedad porque él mismo se nombra en la respuesta;
-- no hace falta adivinar por fechas.
UPDATE "consultas_rui"
   SET "simulado" = true
 WHERE "nombreEncontrado" LIKE 'SIMULADO · %';
