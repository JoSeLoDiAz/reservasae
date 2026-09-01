-- el nombre tal como lo mando el emisor, sin volver a partirlo

ALTER TABLE "leads_entrantes" ADD COLUMN "primerNombre"    TEXT;
ALTER TABLE "leads_entrantes" ADD COLUMN "segundoNombre"   TEXT;
ALTER TABLE "leads_entrantes" ADD COLUMN "primerApellido"  TEXT;
ALTER TABLE "leads_entrantes" ADD COLUMN "segundoApellido" TEXT;
