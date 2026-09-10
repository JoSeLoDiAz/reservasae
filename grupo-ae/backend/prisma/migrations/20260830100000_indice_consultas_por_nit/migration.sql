-- encolar() dejo de buscar por institucionId y ahora deduplica por NIT:
-- una empresa, una consulta, aunque la pidan varias fichas distintas.
-- Sin este indice cada encolar() recorre la tabla entera.
CREATE INDEX "consultas_rues_nit_idx" ON "consultas_rues"("nit");

-- el banco unico pregunta por NIT + estado: si hay una sin resolver, o
-- una LISTA reciente que no vale la pena repetir.
CREATE INDEX "consultas_rues_nit_estado_idx" ON "consultas_rues"("nit", "estado");
