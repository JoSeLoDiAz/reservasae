# La caja · lo que trae `andres/pantallas-sobre-dev`

> **Esto es la descripción del PR, escrita dentro de la rama.**
>
> Vive aquí y no solo en GitHub por dos razones. La primera es
> práctica: `gh` no está instalado en el portátil donde se trabaja
> esta rama, así que la descripción no se puede editar desde ahí y
> acababa quedándose de hace veinte commits. La segunda es que un
> resumen que viaja con el código se revisa en el mismo sitio que el
> código.
>
> **Se actualiza en cada tanda.** Última: 25 sep 2026, 41 commits
> sobre `origin/dev`.

---

## Qué es esto

Las pantallas que Mauricio lleva aprobando en su local, portadas
sobre `dev` para que José pueda desplegarlas. La decisión de mantener
todo en un solo PR es suya: **«la A, porque hasta que tengamos todo
se cierra la caja, que es el deber ser de las cosas»** (24 sep 2026).

Parte de `origin/dev`, no de `arq/crm-hardening`.

---

## Lo grande: Seguimiento del aula

La pantalla nueva del módulo Académica. Las personas en filas y su
estado en columnas, con el mismo esquema de Gestión de leads:
buscador, filtros por columna, selector de columnas, ordenación,
vistas guardadas y descarga a Excel. Sin importar ni asignar masivo,
que él excluyó expresamente.

**Solo acciones VIRTUALES de tipo CURSO.** No presencial, no
bootcamp, no foro. La regla va por el campo `evento` y **nunca por
una lista de códigos AF**: los códigos se repiten entre convenios y
no significan lo mismo ---el foro es AF8 en Grupo AE y AF7 en
ADECOPRIA---. Una lista a mano sacaba el foro de un gremio y dejaba
el del otro dentro, sin que nada fallara.

**Las seis actividades del LMS** ---UT1 a UT5 y EVAL FINAL--- van
fijas, en orden y sin poder quitarse ni arrastrarse. El orden de las
columnas de esta tabla no es una preferencia, es el contrato:
`Tabla` aprendió `ordenFijo` para eso.

Se casan por TÍTULO normalizado y no por posición: el orden con el
que el LMS las devuelva no tiene por qué ser 1..6, y casar por
posición es lo que hace que un día UT3 enseñe lo de UT4.

**23 columnas**, en este orden:

| | | |
|---|---|---|
| 1 Acción de formación | 9 UT2 | 17 Último ingreso |
| 2 Grupo | 10 UT3 | 18 Asesor |
| 3 Correo | 11 UT4 | 19 Departamento |
| 4 Número de documento | 12 UT5 | 20 Cantidad notas |
| 5 Nombre completo | 13 EVAL FINAL | 21 Última actividad |
| 6 Sin ingreso | 14 Total actividades | 22 Días sin gestión |
| 7 Sin actividades | 15 % avance | 23 Antigüedad lead |
| 8 UT1 | 16 Estado | |

**Seis tarjetas de estado**, no diez, y no filtran: son el reparto
del aula. Para filtrar por estado está el filtro de esa columna, así
hay un solo sitio donde se filtra.

**Dos filtros de servidor** ---acción de formación y grupo---
fusionados en la fila del buscador. El grupo cuelga de la acción y
está apagado hasta elegir una, porque el número de grupo no es único:
hay un «Grupo 4» en AF1 y otro en AF2.

### La vista individual

`/admin/participantes/academico/[id]`, con el mismo armazón que el
lead individual de Gestión de leads: identidad, barra de contexto y
cuerpo en dos columnas. Enseña las seis actividades una por una,
**en qué unidad temática tocaría ir hoy** según el calendario del
grupo y si esa persona coincide, y su gestión.

No duplica la ficha de la persona: sus datos, su empresa y su
autorización siguen viviendo en un solo sitio.

---

## Seguimiento de asesores

Filtro por acción de formación y desglose al pulsar una fila: los
leads de ese asesor repartidos por acción, con los de más pendientes
arriba. La tabla de fuera responde «¿quién va mal?»; el cajón la
siguiente, «¿dónde?».

El filtro no toca el servidor: cada fila ya trae su reparto.

---

## Control de inscritos y Control de Reservas

Las tarjetas como él las pidió ---número primero y porcentaje
después, diciendo que son leads---, «Total leads reservados», las
tres cifras de ocupación con Descartados, y «Cupos reservados por
semana».

En «Grupos de AF», **una fila por departamento**: un grupo que cubre
Antioquia y Magdalena sale en dos filas y la suma sigue cuadrando.

---

## Menú

Dos pantallas que salían DOS VECES, con el mismo nombre y la misma
dirección: Tráfico del formulario (Tableros e Inscripciones) y
Reservas (Inscripciones y Sistemas). Cada una se queda en un solo
sitio. Se barrió el menú entero para comprobar que no quedaba
ninguna más.

Y todos los módulos de la cabecera despliegan, también los de una
sola pantalla: antes «Académica» era una palabra que llevaba a algún
sitio sin decir a cuál.

---

## Cosas del servidor que a José le interesan

- **`import 'dotenv/config'` en `main.ts`.** El 500 del login en
  local no lo trae esta rama: pasa igual en `dev` a pelo, porque hay
  once sitios que llaman a `JwtModule.register` y ninguno tenía el
  `.env` cargado. Está probado contra `dev` limpio.
- **Una migración, ninguna.** Esta rama no añade migraciones.
- **`db:actividades-del-aula`**, un guion con la guarda de pruebas
  que convierte las doce actividades genéricas de la siembra en las
  seis reales, sin perder los avances: renombra las seis primeras y
  despublica el resto. No borra nada.
- El campo `participanteId` de `academico()`, para la vista
  individual: la fila la calcula el mismo sitio que la lista, y no
  un cálculo aparte, para que no puedan discrepar.

---

## Lo que falta antes de cerrar la caja

1. **Matriculados por grupo**: resumen general y detalle al pulsar.
2. **El bloque de las seis actividades**: decidir si va al final,
   como en la lista original de 17 columnas, o se queda en 8–13.
3. **El LMS**: cuál es y su URL. Credenciales al `.env`.
4. **¿Cuándo entra alguien al aula?** Está en `PARA-JOSE.md` con las
   cuatro preguntas; lo concreta Diana Hernández.
