# Lo que falta para que el formulario quede igual al canvas

Extraído del canvas guardado (versión `1787482459-ad9f`). El orden y los
anchos son los del bosquejo, no los que hay hoy en el código.

## Formulario corto — sección «Datos Personales»

Orden y ancho de rejilla (3 columnas en escritorio):

| # | Campo | Ancho |
|---|---|---|
| 1 | Nombres | fila completa |
| 2 | Primer apellido | 1 col |
| 3 | Segundo apellido | 1 col |
| 4 | Género | 1 col |
| 5 | Celular | 1 col |
| 6 | Correo electrónico | 2 cols |
| 7 | Tipo de documento | 1 col |
| 8 | Número de documento | 1 col |

**El documento va al FINAL, no al principio.** Hoy el código lo tiene primero.

Además:
- «Segundo apellido» **sin** el «(opcional)».

## Formulario largo — «Información complementaria»

Bajada: «Complete la siguiente información:»

| # | Campo | Ancho |
|---|---|---|
| 1 | Fecha de nacimiento | 1 col |
| 2 | Estrato | 1 col |
| 3 | Barrio o vereda | 1 col |
| 4 | Dirección | 2 cols |

**Nada más.** El canvas no repite nombres, apellidos, celular, correo ni
género: ya se dieron en el corto. Departamento y municipio tampoco — el
formulario corto ya los captura para la cobertura, así que hay que
guardarlos ahí y dejar de pedirlos aquí (hoy el código los pide otra vez).

## Formulario largo — «Información Laboral»

Bajada: «Completar según su vínculo laboral.»
Pregunta: «¿Cuál es su situación laboral actual?»

| # | Campo | Ancho |
|---|---|---|
| 1 | NIT de la empresa · (obligatorio) | 1 col |
| 2 | Nombre de la organización | 2 cols |
| 3 | ¿Cuál es su cargo actual? | 1 col |
| 4 | Nivel ocupacional | 1 col |
| 5 | Teléfono | 1 col |
| 6 | Sector económico | 1 col |
| 7 | Persona de contacto | 1 col |
| 8 | Cargo del contacto | 1 col |
| 9 | Correo de la persona de contacto | fila completa |

Diferencias con lo que hay hoy en el código:

- La etiqueta es **«NIT de la empresa»**, no «NIT (sin dígito de verificación)».
- La ayuda bajo el NIT dice **«Dígito de verificación: N — lo calculamos
  nosotros»**, no «Solo el número. El dígito lo calculamos nosotros».
- **«Número de trabajadores» no está** en el canvas. Hoy el código lo pide.
- El pie dice **«Finalice su inscripción presionando el botón de
  confirmación.»** Hoy dice «Si los deja para después, sus datos personales
  ya quedaron guardados…», que ya no aplica: se quitó el botón de posponer.
- Arriba de la sección tampoco va «Si no los tiene a mano, puede dejarlo
  para después».

## Ya hecho, no rehacer

- Ubicación y tarjetas fusionadas en la pantalla 1, con cobertura real.
- Banda de estado en las tres pantallas.
- Confirmación antes de enviar y Enter bloqueado.
- `resumenPublico` en la base, 15 textos sembrados y endpoints
  `GET/PATCH /admin/formularios/resumenes`.
- «Completar posteriormente» eliminado y `dejarParaDespues()` retirada.
- Fecha de nacimiento y estrato ya existen en el formulario largo.

## Falta además

- La pantalla de edición de los resúmenes en `/admin/formularios`
  (los endpoints ya responden).
