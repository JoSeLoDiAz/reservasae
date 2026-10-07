-- de que cohorte venia y a cual fue, para poder deshacer un traslado
ALTER TABLE "movimientos_participante"
  ADD COLUMN "coberturaAntes"   TEXT,
  ADD COLUMN "coberturaDespues" TEXT;
