-- Lo que la base del cliente trae y no tenia donde caer.
-- Siete columnas nulables: no rompe nada hacia atras.
ALTER TABLE "leads_entrantes"
  ADD COLUMN "fechaNacimiento"       TIMESTAMP(3),
  ADD COLUMN "estrato"               INTEGER,
  ADD COLUMN "barrio"                TEXT,
  ADD COLUMN "direccion"             TEXT,
  ADD COLUMN "cargoEnEmpresa"        TEXT,
  ADD COLUMN "nivelOcupacionalSepId" INTEGER,
  ADD COLUMN "beneficiarioPrevio"    BOOLEAN;
