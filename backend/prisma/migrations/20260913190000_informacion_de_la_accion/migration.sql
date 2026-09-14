-- Los tres textos de «Informacion Accion de Formacion».
--
-- `objetivo` ya existia y se enseniaba sin poder editarlo. El cliente
-- pidio el 13 sep 2026 que el apartado pase a llamarse «Informacion
-- Accion de Formacion» y contenga tres campos editables: objetivo,
-- contenido y competencia. Los tres se leen en el formulario publico,
-- detras de un «Mas informacion».
--
-- Nulables y sin valor por defecto: las 15 acciones que ya existen no
-- tienen estos textos, y un vacio es «todavia no se ha escrito», que
-- es distinto de una cadena en blanco.
ALTER TABLE "acciones_formacion" ADD COLUMN "contenido" TEXT;
ALTER TABLE "acciones_formacion" ADD COLUMN "competencia" TEXT;
