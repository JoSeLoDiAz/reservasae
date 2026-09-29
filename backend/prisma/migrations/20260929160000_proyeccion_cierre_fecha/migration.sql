-- La fecha de cierre de la proyeccion, editable e INDEPENDIENTE.
--
-- Josse quiere los TRES editables: # asesores, # dias para el cierre
-- y fecha de cierre (29 sep 2026). La fecha se SUMA a los dias, no
-- los reemplaza: los dias manejan la meta, la fecha es la de
-- referencia. Se conserva `proyeccionDias` y se añade
-- `proyeccionCierre`.
ALTER TABLE "acciones_formacion" ADD COLUMN "proyeccionCierre" TIMESTAMP(3);
