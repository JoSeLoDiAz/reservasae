# Formularios: por qué están en este orden

> Para quien vaya a reordenar pantallas. Casi todo lo de aquí se
> cambió después de ver que la versión anterior recogía datos malos
> o no recogía ninguno.

## El habeas data va PRIMERO

Preinscripción: `habeas → elección → datos → revisión`.

Estaba de tercera: se le pedía domicilio, cédula, estrato y acción de
formación, y **al final** se le pedía permiso para tratar sus datos.
Eso es pedir el permiso cuando los datos ya se tomaron.

Antes de eso era peor: una casilla al pie de una pantalla larga con
un enlace que casi nadie abría. Eso no alcanza para sostener que la
persona leyó lo que autorizó.

**En el formulario de completar es al revés**: a quien ya autorizó al
reservar se le pliega. Ya está registrado con su versión y su fecha;
volver a plantarle la muralla de texto no le suma ninguna garantía y
le empuja fuera de pantalla lo único que vino a hacer. Plegada, no
quitada: poder consultarla cuando quiera sí es parte de la ley.

## El enlace de completar se cerraba vacío

**El fallo:** los tres datos del jefe directo —nombre, cargo,
correo— eran opcionales. Se podía seguir de largo dejándolos en
blanco, el enlace se marcaba `usadoEn` y el panel decía «lo
completaron». La empresa se quedaba con los tres campos en `null`.
Justo los tres que el enlace existe para recoger.

Se encontró con LOGÍSTICA SUR EXPRESS S.A.S. (NIT 900130751): dos
participantes, dos enlaces usados, los tres campos en null.

El criterio anterior estaba escrito en el código —«el NIT es lo único
obligatorio; el resto lo completa quien atienda»— y era defendible en
abstracto. En la práctica dejaba al asesor persiguiendo por teléfono
exactamente lo que el enlace iba a traer solo.

**Ahora se exigen a quien tiene jefe.** Al independiente no: su
cédula es su RUT, y pedirle «el nombre de su jefe» es pedirle que se
invente a alguien.

## Situación laboral: tres opciones, y queda el rastro

Entra **«No estoy trabajando en este momento»**. Sin esa salida, el
desempleado caía en la rama del NIT y se le pedían los datos de un
trabajo que no tiene.

Cada declaración se apunta en la auditoría
(`SITUACION_LABORAL_DECLARADA`). **Se apunta siempre, no solo cuando
cambia**, porque el valor está en la secuencia: quien marca
desempleado, ve que ahí se le acaba el formulario, refresca y vuelve
a empezar diciendo «con vínculo laboral» deja dos entradas seguidas
que se contradicen. Con una sola no se ve nada.

No bloquea nada. Cambiar de respuesta puede ser perfectamente honesto
—se equivocó de botón, o consiguió trabajo—. Solo queda escrito para
que quien revise lo vea.

### Al desempleado sí se le puede reportar

Comprobado, porque no era obvio:

- `completitud.ts` **no** exige empresa para el reporte al SENA.
- Los formatos por persona (`formato-cargue-sep`, `formato-uso-directo`)
  lo incluyen con las columnas de empresa vacías.
- El **F7 lo omite**, y está bien: el F7 es un resumen *por empresa*,
  así que quien no tiene una no puede tener fila ahí.

## Población vulnerable: una sola, y buscando

Son **37** y están escritas en el idioma del SEP —«SOBREVIVIENTES
MINAS ANTIPERSONALES»—, no en el de la persona. En una rejilla de
casillas hay que leerlas todas para dar con la suya.

Ahora se escribe y van saliendo, sin tildes por los dos lados (quien
teclea «indigena» en un celular tiene que encontrar «INDÍGENA»). Y es
**una sola**, no varias.

Va **al final**, antes de los datos de empresa: es lo más íntimo que
se pregunta —ser víctima del conflicto, tener una discapacidad— y se
pide después de que la persona ya vio para qué es todo esto.
Preguntarlo de entrada, antes que el nombre, es otra conversación.

Y es **opcional de verdad**: hay un botón para no decirlo. Un dato
sensible que no se puede rehusar no está consentido.

## Formularios Activos: una vista, no dos

El corto y el largo son dos momentos de **una misma recolección** —lo
que se pregunta en el corto no se vuelve a pedir en el largo—, así
que se leen juntos o no se entienden. Estaban en dos pantallas y eso
obligaba a ir y volver para responder la pregunta que se hace todo el
tiempo: «¿esto en cuál de los dos se pide?».

Las rutas viejas (`/corto`, `/largo`) redirigen: estuvieron en el
menú y hay gente con el enlace guardado.
