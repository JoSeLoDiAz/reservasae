-- Los colores del tema pasan de una columna por color a un unico JSON.
--
-- El administrador va a personalizar la interfaz entera, asi que el catalogo
-- de colores va a seguir creciendo (tablas, campos, estados...). Con una
-- columna por color, cada anadido seria una migracion; con JSON basta con
-- tocar `src/admin/temas.ts`. El backend valida clave por clave contra ese
-- catalogo, asi que no entra nada arbitrario.

ALTER TABLE "temas"
  DROP COLUMN "colorMarca",
  DROP COLUMN "colorMarcaFuerte",
  DROP COLUMN "colorMarcaSuave",
  DROP COLUMN "colorMarcaTexto",
  DROP COLUMN "colorFondo",
  DROP COLUMN "colorSuperficie",
  DROP COLUMN "colorBorde",
  DROP COLUMN "colorTexto",
  DROP COLUMN "colorTextoSuave",
  DROP COLUMN "colorTitulo",
  DROP COLUMN "colorEncabezadoFondo",
  DROP COLUMN "colorEncabezadoTexto",
  ADD COLUMN "colores" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Paletas completas. Lo que falte se completa en el backend con
-- TEMAS_POR_DEFECTO, pero se dejan escritas para que la base sea legible sola.
UPDATE "temas" SET "colores" = '{
  "marca": "#1d4ed8",
  "marcaFuerte": "#1e3a8a",
  "marcaSuave": "#eff6ff",
  "marcaTexto": "#ffffff",
  "fondo": "#f8fafc",
  "superficie": "#ffffff",
  "superficieAlterna": "#f1f5f9",
  "borde": "#e2e8f0",
  "titulo": "#0f172a",
  "texto": "#0f172a",
  "textoSuave": "#64748b",
  "encabezadoFondo": "#ffffff",
  "encabezadoTexto": "#0f172a",
  "encabezadoBorde": "#e2e8f0",
  "tablaCabeceraFondo": "#f1f5f9",
  "tablaCabeceraTexto": "#334155",
  "tablaFilaAlterna": "#f8fafc",
  "tablaFilaResaltada": "#eff6ff",
  "tablaBorde": "#e2e8f0",
  "campoFondo": "#ffffff",
  "campoBorde": "#cbd5e1",
  "campoFoco": "#1d4ed8",
  "exito": "#15803d",
  "exitoSuave": "#f0fdf4",
  "aviso": "#b45309",
  "avisoSuave": "#fffbeb",
  "error": "#b91c1c",
  "errorSuave": "#fef2f2"
}'::jsonb
WHERE "esquema" = 'CLARO';

-- El oscuro no es el claro invertido: la marca baja de saturacion porque un
-- azul intenso sobre fondo oscuro deslumbra, y los estados se aclaran porque
-- el verde y el rojo del claro no llegan al contraste minimo sobre oscuro.
UPDATE "temas" SET "colores" = '{
  "marca": "#60a5fa",
  "marcaFuerte": "#93c5fd",
  "marcaSuave": "#172554",
  "marcaTexto": "#0b1220",
  "fondo": "#0b1220",
  "superficie": "#131c2e",
  "superficieAlterna": "#1a2439",
  "borde": "#26324a",
  "titulo": "#f2f6ff",
  "texto": "#e8edf7",
  "textoSuave": "#9aa8c0",
  "encabezadoFondo": "#131c2e",
  "encabezadoTexto": "#e8edf7",
  "encabezadoBorde": "#26324a",
  "tablaCabeceraFondo": "#1a2439",
  "tablaCabeceraTexto": "#c3cee0",
  "tablaFilaAlterna": "#101a2b",
  "tablaFilaResaltada": "#172554",
  "tablaBorde": "#26324a",
  "campoFondo": "#0f1829",
  "campoBorde": "#33405c",
  "campoFoco": "#60a5fa",
  "exito": "#4ade80",
  "exitoSuave": "#052e16",
  "aviso": "#fbbf24",
  "avisoSuave": "#2c1a02",
  "error": "#f87171",
  "errorSuave": "#2d0b0b"
}'::jsonb
WHERE "esquema" = 'OSCURO';
