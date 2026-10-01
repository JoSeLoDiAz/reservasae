-- MEMORIA DE LO DESCARTADO EN LA BANDEJA «POR REVISAR».
--
-- Hasta ahora descartar cerraba la propuesta y nada mas: la
-- limpieza previa a crear la siguiente solo borraba las
-- PENDIENTE, y la traduccion de la ficha del buscador solo
-- comparaba contra lo que la institucion YA tiene. Si alguien
-- descartaba un telefono y el campo quedaba vacio, la siguiente
-- consulta del mismo NIT proponia EL MISMO telefono. Por eso la
-- bandeja nunca bajaba de 45.
--
-- Tabla aparte y no columna en la propuesta: lo rechazado es un
-- hecho de la institucion, no de la propuesta que lo trajo, y la
-- pregunta «¿este campo con este valor ya se rechazo?» tiene que
-- resolverse con un golpe al indice unico y no leyendo el
-- historico entero de la ficha.
CREATE TABLE "descartes_de_campo" (
  "id"              TEXT NOT NULL,
  "institucionId"   TEXT NOT NULL,
  "campo"           TEXT NOT NULL,
  -- Valor normalizado: es lo que se compara.
  "valor"           TEXT NOT NULL,
  -- Valor tal como llego: es lo que se le muestra a una persona.
  "valorMostrado"   TEXT NOT NULL,
  "fuente"          "FuenteDato" NOT NULL,
  "descartadoPorId" TEXT,
  "creadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "descartes_de_campo_pkey" PRIMARY KEY ("id")
);

-- La llave del olvido: un valor rechazado se registra UNA vez
-- por institucion y campo, por mas veces que el robot lo repita.
CREATE UNIQUE INDEX "descartes_de_campo_institucionId_campo_valor_key"
  ON "descartes_de_campo" ("institucionId", "campo", "valor");

CREATE INDEX "descartes_de_campo_institucionId_idx"
  ON "descartes_de_campo" ("institucionId");

-- Si se borra la institucion se va su memoria con ella; si se
-- borra el admin la fila se queda (el descarte sigue siendo
-- cierto aunque quien lo hizo ya no trabaje aqui).
ALTER TABLE "descartes_de_campo"
  ADD CONSTRAINT "descartes_de_campo_institucionId_fkey"
  FOREIGN KEY ("institucionId") REFERENCES "instituciones" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "descartes_de_campo"
  ADD CONSTRAINT "descartes_de_campo_descartadoPorId_fkey"
  FOREIGN KEY ("descartadoPorId") REFERENCES "administradores" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
