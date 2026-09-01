-- el lead trae donde vive, para poder resolver la sede

-- Oferta es accion x ubicacion: con el curso solo se sabe que
-- quiere y no donde lo va a tomar, y la ficha nacia sin poder
-- matricularse
ALTER TABLE "leads_entrantes" ADD COLUMN "departamentoSepId" INTEGER;
ALTER TABLE "leads_entrantes" ADD COLUMN "municipioSepId" INTEGER;
ALTER TABLE "leads_entrantes" ADD COLUMN "generoSepId" INTEGER;
ALTER TABLE "leads_entrantes" ADD COLUMN "aceptaHabeasData" BOOLEAN;
