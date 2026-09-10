-- la accion que pidio el lead, ya resuelta al entrar

ALTER TABLE "leads_entrantes" ADD COLUMN "accionFormacionId" TEXT;

-- SetNull y no Cascade: borrar una accion no puede llevarse el
-- lead, que sigue siendo una persona que pidio algo
ALTER TABLE "leads_entrantes"
  ADD CONSTRAINT "leads_entrantes_accionFormacionId_fkey"
  FOREIGN KEY ("accionFormacionId") REFERENCES "acciones_formacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "leads_entrantes_accionFormacionId_idx"
  ON "leads_entrantes"("accionFormacionId");
