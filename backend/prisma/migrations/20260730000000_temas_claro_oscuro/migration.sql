-- Paletas separadas para modo claro y modo oscuro.
--
-- Los cuatro colores sueltos que vivian en `marca` se van: ahora cada esquema
-- tiene su paleta completa en `temas`. No basta con oscurecer el tema claro,
-- porque en oscuro hay que bajar la saturacion de la marca y subir la
-- luminosidad del texto o el resultado vibra.

CREATE TYPE "EsquemaColor" AS ENUM ('CLARO', 'OSCURO');
CREATE TYPE "ModoPorDefecto" AS ENUM ('SISTEMA', 'CLARO', 'OSCURO');

CREATE TABLE "temas" (
    "id" TEXT NOT NULL,
    "esquema" "EsquemaColor" NOT NULL,
    "colorMarca" TEXT NOT NULL,
    "colorMarcaFuerte" TEXT NOT NULL,
    "colorMarcaSuave" TEXT NOT NULL,
    "colorMarcaTexto" TEXT NOT NULL,
    "colorFondo" TEXT NOT NULL,
    "colorSuperficie" TEXT NOT NULL,
    "colorBorde" TEXT NOT NULL,
    "colorTexto" TEXT NOT NULL,
    "colorTextoSuave" TEXT NOT NULL,
    "colorTitulo" TEXT NOT NULL,
    "colorEncabezadoFondo" TEXT NOT NULL,
    "colorEncabezadoTexto" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPorId" TEXT,

    CONSTRAINT "temas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "temas_esquema_key" ON "temas"("esquema");

ALTER TABLE "temas" ADD CONSTRAINT "temas_actualizadoPorId_fkey"
  FOREIGN KEY ("actualizadoPorId") REFERENCES "administradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Las dos filas se crean aqui y no en el seed: la aplicacion asume que
-- existen, y un despliegue que corra migraciones sin seed dejaria el sitio
-- sin colores.
INSERT INTO "temas" (
  "id", "esquema",
  "colorMarca", "colorMarcaFuerte", "colorMarcaSuave", "colorMarcaTexto",
  "colorFondo", "colorSuperficie", "colorBorde",
  "colorTexto", "colorTextoSuave", "colorTitulo",
  "colorEncabezadoFondo", "colorEncabezadoTexto",
  "actualizadoEn"
) VALUES (
  'tema_claro', 'CLARO',
  '#1d4ed8', '#1e3a8a', '#eff6ff', '#ffffff',
  '#f8fafc', '#ffffff', '#e2e8f0',
  '#0f172a', '#64748b', '#0f172a',
  '#ffffff', '#0f172a',
  CURRENT_TIMESTAMP
), (
  'tema_oscuro', 'OSCURO',
  -- Marca menos saturada que en claro: el mismo azul sobre fondo oscuro
  -- deslumbra y los bordes del texto tiemblan.
  '#60a5fa', '#93c5fd', '#172554', '#0b1220',
  '#0b1220', '#131c2e', '#26324a',
  '#e8edf7', '#9aa8c0', '#f2f6ff',
  '#131c2e', '#e8edf7',
  CURRENT_TIMESTAMP
);

ALTER TABLE "marca"
  DROP COLUMN "colorMarca",
  DROP COLUMN "colorMarcaFuerte",
  DROP COLUMN "colorMarcaSuave",
  DROP COLUMN "colorMarcaTexto",
  ADD COLUMN "modoPorDefecto" "ModoPorDefecto" NOT NULL DEFAULT 'SISTEMA',
  ADD COLUMN "permitirCambioDeModo" BOOLEAN NOT NULL DEFAULT true;
