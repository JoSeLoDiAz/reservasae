# `jose/dv-tecleado` · qué entra y qué hay que mirar al desplegar

Josse: esto sustituye al documento anterior. Tus seis están cerradas, tu
`v0.19.0` ya está fundida aquí, y lo que queda son **20 commits** que el corte de
la 0.19.0 dejó fuera. Ahí está casi todo lo que el cliente lleva pidiendo.

| | |
|---|---|
| Rama | `jose/dv-tecleado`, subida |
| Desplegado hoy | `v0.19.0-JD` |
| Sin desplegar | **20 commits** |
| De lo tuyo que falte traer | **nada** — `9abe344` está fundido y verde aquí |
| Línea base | `tsc` limpio en backend y frontend · **232 suites, 2.534 pruebas** |
| Migraciones nuevas | **1** — `20261002160000_cierre_de_inscripciones_por_grupo` |

---

## 1 · Antes de nada: el bloqueante que encontraste era mío

`crear()` dejó de deducir el asesor y pasó a recibirlo con valor por defecto
`false`; actualicé el llamador del panel y **no los otros dos**, así que al
convertir un lead y al subir una lista la ficha nacía sin dueño. Tenías razón en
las tres partes: en el diagnóstico, en que no lo cazaba nada, y en que el
`spec` que escribí leía la llamada del panel y de las otras dos no decía nada.

Tu `quien-crea-se-queda-la-ficha` ---que recorre la superficie y exige que cada
llamada lo diga explícitamente--- está fundido aquí y en verde. No lo he tocado.

---

## 2 · ⚠ Lo que hay que mirar al desplegar

### a) Una migración, y es compatible hacia atrás

`Grupo.cierreInscripciones DateTime?`, nulo por defecto. **Nulo = el
comportamiento de siempre**: el cierre se sigue derivando de `fechaInicio` con
la regla de 14 días / 5 hábiles. Nada cambia hasta que alguien importe el
cronograma, y eso es un comando aparte que no corre solo.

### b) Hay UN commit de solo frontend

```
996e33f  Reservas: cupos reservados, el total de inscritos, y fuera el punto
```

Lo digo porque el del Excel en hora de Bogotá era igual y se quedó fuera dos
veces. Este es menos grave ---una etiqueta, una tarjeta y un placeholder--- pero
el cliente lo pidió hoy y lo va a buscar.

### c) El informe de brechas da `EXPORT-UTC` por abierta y **no lo está**

El detector busca que `valor` devuelva la fecha de Bogotá; el arreglo vive en
`exporta` (`columnas-participante.tsx`). Es el detector el que mira donde no es.
Pendiente de corregir; que no te frene.

---

## 3 · Qué entra, por riesgo

### Al SENA — lo que se entrega, y por tanto lo que más cuesta si sale mal

- **Se podía reportar a un menor de edad.** La compuerta miraba la edad de hoy y
  el archivo la del arranque del curso: dos fechas para el mismo dato. Una
  nacida en may-2008 con el grupo arrancando en ene-2026 salía con rango 1, que
  es el de los menores de 18, y el programa no admite menores.
- **El NIT perdía los ceros de la izquierda** en los tres formatos. Excel se los
  come, el F7 se arma concatenando celdas y por eso el error no se ve en casa:
  sale un cargue contra otra organización, o contra ninguna.
- **La caracterización salía al azar.** Las marcas de un envío se escriben en un
  `createMany` dentro de una transacción y `creadoEn` es la hora de la
  transacción, idéntica para todas: `orderBy: creadoEn` no desempataba nada.
  Quien marcó dos cosas podía salir el lunes con una y el martes con la otra, y
  es un dato sensible. El segundo criterio es el id del catálogo: arbitrario
  pero **estable**, que es lo único que hace falta.

### Cupos y organizaciones

- **El sitio público prometía plazas que no existían.** `cuposOcupados` solo lo
  mueve `reservas.service.ts`: quien se inscribe por su cuenta no estaba en
  ningún contador. La cuenta estaba copiada en **siete** sitios; ahora vive en
  `comun/plazas-de-la-oferta.ts`. Lo vio el cliente comparando dos pantallas:
  520 − 98 = 422, exacto en las cuatro acciones.
- **Las organizaciones que el dígito pegado partió en dos** ---Benedictino entre
  ellas---: cerradas las tres puertas que no llamaban a `normalizarNit`, y el
  guion `db:nit-pegado` para las de antes. Sin el DV en `RELLENABLES`, como
  dijiste.
- **El listado de organizaciones no enseñaba las que no han reservado.** Filtraba
  por «tiene al menos una reserva», y quien entra por el formulario ---una
  persona natural con RUT, por ejemplo--- no reserva: se inscribe. En pruebas,
  ADECOPRIA pasa de 13 a 18. No toqué `empresaDeConvenio`: sus otros dos usos
  viven entre cifras de reservas. Va en `organizacionDeConvenio`, aparte.
  - Y el filtro de búsqueda pasó a `AND`: la regla nueva trae un `OR` suyo y con
    el spread de antes el del buscador lo **pisaba**, así que al escribir en la
    barra el listado habría enseñado los dos gremios. Fallo de ámbito que solo
    aparecía al buscar.

### Seguridad

- **Cancelar una reserva pedía solo el NIT**, que es público y está impreso en
  la propia pantalla. Ahora pide también el correo, con el mismo mensaje para
  los tres modos de fallo.

### Gestión de leads

- **NIT, nombre de empresa y formulario de entrada.** El cliente las pidió
  varias veces. Van **encendidas** (`nueva: true`) para quien ya tenga vistas
  guardadas.
  - Aviso honesto: hoy se llenan poco ---84 de 1.480 para empresa, 79 para
    formulario--- porque **el formulario público no pregunta la empresa**: se
    pide en el segundo paso, el del enlace de completado, y de esos solo se han
    emitido 116 y usado 55. El cliente sabe el dato y aun así las quiere
    visibles, que es lo correcto: una columna vacía se llena, una que no existe
    no se puede llenar nunca.

### El cronograma — lo nuevo

Lee la hoja de Drive del cliente ---colores incluidos--- y lleva a cada grupo su
fecha de inicio, de fin y **su propia fecha de cierre**.

Una AF no cierra entera: seis de las siete cierran en dos o más fechas y AF3 en
cinco, una por grupo. La pantalla enseñaba una sola por acción, y de ella salen
«días para el cierre» y la meta diaria de los asesores. Ahora sigue mandando la
más próxima ---que es lo correcto, es la primera puerta que se cierra--- pero
debajo avisa «cierra por partes: 8 oct · 16 oct». Con una sola fecha se calla.

`pnpm db:cronograma` **no escribe sin `--aplicar`**, no crea grupos, no borra lo
que la hoja no menciona, y además del código y el número comprueba la ciudad
---ADECOPRIA y BRITCHAM-ADEE tienen los dos un AF1 con ocho grupos numerados
igual---. La guardia de base solo muerde al escribir: pedirla para una vista
previa haría que se saltara por costumbre.

---

## 4 · Tres decisiones, y las dejo para ti

El cliente dijo explícitamente que las decida quien tenga que decidirlas y que
mañana se ven. No las he tocado.

### a) `AF2.G5` y `AF2.G6` están cruzados

El cronograma dice que el G5 es **Córdoba y Huila** y el G6 **Cauca y
Santander**; la base los tiene al revés. El importador los detectó y **no los
escribió** ---es justo para lo que está el control de ciudad---. O se renumeran
los dos grupos, o se corrige la hoja. No es trabajo de un guion.

### b) El formulario público deja sumar el foro a las presenciales

Hay **dos reglas para la misma pregunta**:

- el panel exige que las dos acciones estén emparejadas en
  `combinaConAccionId` ---solo AF1 y AF2 con AF7---;
- la puerta pública solo mira si el evento dice `FORO`, así que deja que alguien
  de AF3, AF4, AF5 o AF6 ---las presenciales, que no combinan con nada--- se
  sume al foro.

Catalina dijo «**si es de las virtuales** se puede inscribir al foro… para las
demás solamente que escoja una». Lo cerré, vi que `segunda-inscripcion.ts` dice
que la puerta pública «se decide aparte porque es un cambio para el ciudadano»,
y **lo deshice**. Queda como está hasta que alguien lo decida.

### c) La credencial del cronograma

Para que se lea solo hace falta `GOOGLE_CUENTA_DE_SERVICIO` y
`CRONOGRAMA_DRIVE_ID` en el servidor. Sin ellas funciona igual pasando
`CRONOGRAMA_ARCHIVO` con el .xlsx. El archivo **no está en el repositorio** a
propósito: es el documento del cliente, con sus sedes y sus fechas de
desembolso.

---

## 5 · Lo que sigue bloqueado, y no es código

- **El LMS.** Nadie escribe el avance del aula y sin él `cambiarEtapa` impide
  certificar a cualquiera ---que es lo que paga el SENA---. Una sola pregunta:
  ¿pueden mandar, por persona y actividad, si está completada y cuándo?
- **El SENA.** Quien se retira desaparece del cargue en vez de reportarse. El
  código ya dice dónde se añade; falta saber qué valor espera la columna ESTADO
  para un retiro. Poner cualquier cosa arriesga el rechazo del cargue entero.
