-- donde se hace cada sesion

ALTER TABLE "sesiones_de_grupo" ADD COLUMN "ubicacionId" TEXT;

ALTER TABLE "sesiones_de_grupo"
    ADD CONSTRAINT "sesiones_de_grupo_ubicacionId_fkey"
    FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
