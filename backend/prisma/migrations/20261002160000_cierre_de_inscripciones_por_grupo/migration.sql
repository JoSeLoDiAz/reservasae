-- Cuando se dejan de recibir inscripciones PARA ESTE GRUPO.
--
-- Una accion no cierra entera: en el cronograma de ADECOPRIA, seis de
-- las siete cierran en dos o mas fechas, y AF3 tiene una distinta por
-- cada uno de sus cinco grupos. Hasta hoy no habia donde guardarlo.
--
-- Nula = la derivada de `fechaInicio` de siempre. Puesta, manda.
ALTER TABLE "grupos" ADD COLUMN "cierreInscripciones" TIMESTAMP(3);
