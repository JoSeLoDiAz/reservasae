-- el encuentro en vivo del grupo

ALTER TABLE "grupos" ADD COLUMN "sesionDia" TIMESTAMP(3);

-- la sesion no sale de las fechas del grupo
ALTER TABLE "grupos"
  ADD CONSTRAINT "grupos_sesion_dentro_del_grupo"
  CHECK (
    "sesionDia" IS NULL
    OR (
      "fechaInicio" IS NOT NULL
      AND "sesionDia" >= "fechaInicio"
      AND ("fechaFin" IS NULL OR "sesionDia" <= "fechaFin")
    )
  );
