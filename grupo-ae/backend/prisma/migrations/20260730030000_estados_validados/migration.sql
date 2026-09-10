-- Escalones de estado revalidados con el verificador de paletas.
--
-- Los anteriores (#b45309 ambar y #b91c1c rojo) quedaban a ΔE 4,9 bajo
-- deuteranopia y a solo 9,1 con vision normal: "Ultimos cupos" y "Completo"
-- son justo la distincion que mas importa de un vistazo en el tablero, y no se
-- distinguian. Los nuevos pasan el suelo de vision normal (15,6).
--
-- Rojo y ambar son hues adyacentes y bajo deuteranopia nunca separan del todo;
-- por eso cada estado se muestra SIEMPRE con icono y texto, no solo color.

UPDATE "temas" SET "colores" = "colores" || '{
  "exito": "#047857",
  "exitoSuave": "#ecfdf5",
  "aviso": "#a16207",
  "avisoSuave": "#fffbeb",
  "error": "#be123c",
  "errorSuave": "#fff1f2"
}'::jsonb
WHERE "esquema" = 'CLARO';

-- En oscuro los estados suben de luminosidad para llegar al contraste minimo
-- sobre el fondo. Verificado: CVD 10,6 / vision normal 21,2 / contraste OK.
UPDATE "temas" SET "colores" = "colores" || '{
  "exito": "#34d399",
  "exitoSuave": "#053225",
  "aviso": "#fbbf24",
  "avisoSuave": "#2e1f03",
  "error": "#fb7185",
  "errorSuave": "#3f0d16"
}'::jsonb
WHERE "esquema" = 'OSCURO';
