-- Los días para el cierre, como NÚMERO editable (no una fecha).
--
-- Josse los quiere como en su hoja: «# días para el cierre = 7», un
-- número que él teclea, no un calendario. La fecha de cierre que se
-- muestra sale del cronograma. Se cambia `proyeccionCierre` (fecha,
-- que nadie en produccion tenia) por `proyeccionDias` (entero).
ALTER TABLE "acciones_formacion" DROP COLUMN IF EXISTS "proyeccionCierre";
ALTER TABLE "acciones_formacion" ADD COLUMN "proyeccionDias" INTEGER;
