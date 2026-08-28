# Formularios: por qué están en este orden

> Para quien vaya a reordenar pantallas. Casi todo lo de aquí se
> cambió después de ver que la versión anterior recogía datos malos
> o no recogía ninguno.

## Lo que encontró la auditoría (agosto 2026)

Dos cosas de este flujo salieron **críticas**. Están arregladas; van
aquí para que no vuelvan por descuido.

### Con una cédula ajena se abría la ficha completa

`registrar()` devolvía SIEMPRE un token de enlace, también cuando la
cédula ya existía. Ese enlace abre `abrir()`, que hace
`persona: { include: {...} }` —o sea TODOS los campos— más las
caracterizaciones de población vulnerable.

Dos peticiones sin sesión, sabiéndose una cédula, y salía si alguien
es víctima del conflicto o tiene una discapacidad. Artículo 5 de la
Ley 1581.

**La regla ahora:** si la cédula ya estaba, el token NO viaja en la
respuesta. El enlace se manda al correo QUE YA ESTÁ EN LA BASE, nunca
al que vino en el formulario — quien controla ese buzón es la dueña de
la ficha. Hay una prueba sobre la respuesta ENTERA serializada, por si
mañana alguien añade un campo y se lleva el token de vuelta.

**Cuidado con `include`.** Ese `include` sin `select` es lo que
convirtió un enlace en una fuga: devuelve columnas que nadie decidió
devolver. Si añade un campo sensible a `Persona`, sale por ahí solo.

### El registro público machacaba el correo de una persona existente

`dto.correo ?? undefined` solo protege si el campo NO viene. Si el
desconocido sí lo mandaba, Prisma lo escribía encima: todo lo que el
sistema le enviara después a esa persona se iba al buzón del atacante,
y ella no notaba nada.

Ahora manda lo guardado: `yaHabiaPersona?.correo ?? dto.correo`. El
formulario público **rellena huecos, no corrige**. Corregir es trabajo
del asesor, que sí sabe con quién está hablando.

### Y una de habeas data que no era del formulario

Revocar la autorización **no detenía los correos**. Ahora se comprueba
en los tres caminos de envío; está contado en
[campanas-mailing.md](campanas-mailing.md).

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

## Al nominado no se le pregunta dónde trabaja

Si vino por una reserva, la empresa que lo inscribió ya está en la
ficha con su NIT y su razón social. Ofrecerle las tres opciones de
situación laboral es hacerle escoger entre tres de las que dos son
falsas, y darle la ocasión de contradecir a su propia empresa.

La regla: **los datos de una empresa se le piden a la empresa**, o los
trae la consulta al RUES por el NIT. Al empleado solo se le pregunta
lo poco que solo él puede saber, y solo si no lo tenemos ya.

Para eso la ficha trae `faltaDeLaEmpresa`. Antes solo devolvía NIT y
razón social, así que la pantalla no tenía cómo distinguir «no lo
tenemos» de «no lo pedimos». Si la lista viene vacía, ese paso no
tiene nada que llenar.

## Formularios Activos: una vista, no dos

El corto y el largo son dos momentos de **una misma recolección** —lo
que se pregunta en el corto no se vuelve a pedir en el largo—, así
que se leen juntos o no se entienden. Estaban en dos pantallas y eso
obligaba a ir y volver para responder la pregunta que se hace todo el
tiempo: «¿esto en cuál de los dos se pide?».

Las rutas viejas (`/corto`, `/largo`) redirigen: estuvieron en el
menú y hay gente con el enlace guardado.
