# Para Andrés — la entrega del 1 de octubre

**Lo que hace falta para poder fundirla hoy.** La respuesta a tu entrega va por aquí,
que es el mismo canal de `PARA-JOSE.md`.

Estado al revisarla: **compila, y pasan 2.363 pruebas en 208 suites.** No trae ninguna de
las minas conocidas — cero variables de entorno nuevas, cero dependencias movidas entre
`dependencies` y `devDependencies`, cero Dockerfile / compose / `.sh` / nginx tocados, cero
specs borrados y **doce specs nuevos**. Las tres migraciones son **100 % aditivas** y los
ocho índices que crean están los ocho declarados en `schema.prisma`: el defecto del índice
huérfano no se repite. Eso está bien hecho y se nota.

El problema no es la calidad. Es el **tamaño** y **lo que decide por José**.

---

## 1 · Congela la rama

Mientras se revisaba pasó de `bb71069` a `a7fa03c` — tres veces. **No se puede desplegar
algo que se mueve bajo los pies**: lo que se prueba tiene que ser lo que sale.

Di en qué commit queda y no empujes más hasta que esté fundida.

## 2 · Entrégala PARTIDA en funcional y forma

Son **51 commits, 125 ficheros y 15.048 líneas** — el doble del PR que hizo escribir la
regla del 24 sep. De eso, **26 commits y 2.531 líneas son forma pura** (cero backend,
comprobado uno a uno con `git show --numstat`).

Esto no es una queja sobre el trabajo: es que **una entrega partida se funde a medias el
mismo día, y una mezclada hay que desenredarla entera**. Ya costó una jornada el 23 sep.

Lo ideal: dos ramas desde `dev`, `…/funcional` y `…/forma`. Si es más fácil, dos tandas de
commits seguidas y nos dices dónde está el corte.

**Y una advertencia que sale de tu propia entrega**, porque es el argumento de por qué el
bloque de forma no es inofensivo: `cf9a638` —puramente estético— dejó el cartel «Todavía no
hay grupos con gente en el aula» **encima de una tabla con 167 personas**. Lo parcheaste dos
commits después, en `24fd446`. Midió el vacío sobre `aPintar.length === 0`, que ese mismo
commit acababa de vaciar a propósito. Un rótulo que dice lo contrario de lo que hay debajo,
nacido de retocar.

## 3 · Lo que ya decidió José, para que no lo rehagas

| | |
|---|---|
| Cobertura de un presencial: CIUDAD → DEPARTAMENTO | **entra como está** |
| La cédula del independiente al directorio maestro | **entra**, y el botón «validar web» se cierra después |
| Los 26 commits de forma | **no entran ahora**. Quedan para cuando él los mire |
| Borrar `/admin/ocupacion` | **no se borra** |

Lo de `/admin/ocupacion` conviene explicarlo, porque tú citaste al cliente y la cita es
cierta. La regla de la casa es que **una petición del cliente no es autorización: pasa por
José primero**, y esa pantalla la conservó él por escrito el 22 sep —el comentario que
`e156c11` reescribe lo decía en mayúsculas—. No es que tu commit esté mal hecho: es que esa
decisión no es del cliente ni tuya ni mía.

Como `e156c11` trae **mezclado** el filtro de fecha por columna que José **sí** pidió, hay
que separarlo: ese se queda, el borrado no.

## 4 · Cuatro cosas de tu entrega que hay que arreglar antes

Las cuatro son funcionales, así que entran en el bloque que sí sube.

- **`db:independientes` escribe en la base y no llama al guardia.** Hace
  `prisma.empresa.update` (líneas 170 y 203) y `prisma.institucion.upsert` (184), y no
  importa `exigirBaseSegura`. Es el **undécimo guion que escribe y el único que se lo
  salta**; su hermano directo, `poner-al-dia-datos-completos.ts`, sí lo llama en su línea
  123. Y el guardia existe por un motivo que toca a José en particular: el `.env` de su
  portátil apunta a producción por el túnel.

- **`propuestas-por-revisar.ts` se protege por el NOMBRE de la base.** Lleva
  `if (!/prueba/i.test(DATABASE_URL)) process.exit(1)` y el comentario dice «la misma
  guarda que el resto». No es la misma: el resto importan `guardia-de-base`, que es una
  regla de **puerto** precisamente porque aquí ya se concluyó que **ninguna regla sobre el
  nombre sirve** — una base `reservasae` alcanzada por el túnel no lleva «prueba» en la URL.
  Hoy no es alcanzable, pero es la guarda débil justo en la semana en que se toca producción.

- **`puedeCargarPlano()` repite el tercer agujero de `PATCH grupos/lote`.** Hace
  `const aMirar = elegido ? [porConvenio[elegido] ?? []] : Object.values(porConvenio)`, y en
  `admin.guard.ts:191` `gremioElegido` queda null sin subdominio y sin cabecera `x-gremio`:
  se miran **todas** las concesiones. Y `CargaDto.convenioId` es obligatorio y **viene del
  cuerpo**. El docblock cita la lección de `quien-asigna-grupo` y aun así deja la rama
  abierta; su spec tiene «mira el gremio elegido, no el montón» pero **ningún caso para la
  puerta general**.

- **Quitar `resultado` del DTO deja un 400 a las pestañas abiertas.** `main.ts` lleva
  `whitelist: true` + `forbidNonWhitelisted: true`, así que durante el despliegue quien tenga
  el panel abierto con el bundle viejo y pulse «registrar gestión» recibe un 400 que la
  pantalla pinta como «No se pudo completar la operación» —indistinguible de un fallo del
  sistema— **y la nota se pierde**. O se acepta el campo viejo una versión más, o hay que
  avisar al equipo de inscripciones de que recargue.

## 5 · Dos cosas que NO hay que separar

- **`e6547b7` y `ade4437` van juntas.** La migración `20260930170000` siembra las cuatro
  categorías y la `20260930203000` es la que les da su `resultado`. Lo dice tu propio SQL: si
  entrara sola la primera, **toda nota nueva se guardaría sin resultado y los informes
  dejarían de contar desde ese día sin que nada falle**.

- **`49143ac`**, que es donde tu rama y el trabajo de José se entrelazan. Al partir, cuidado
  con los cuatro commits de fusión —`ab36803`, `cae5984`, `330065a` y `49143ac`—: por eso el
  reparto no es un `cherry-pick` limpio.

## 6 · Lo que queda anotado y no se toca

Tres cosas que dejaste escritas como decisiones y no como defectos, y que están bien así:
quien se inscribió y luego se retiró no cuenta en ninguna de las tres columnas de gestión
—así que «Total lead gestionados» no llega a los leads recibidos—; el reparto diario dice
1.332 donde Proyección suma 3.965; y las cuatro columnas de gestión del Excel venían en la
hoja del cliente con letra blanca sin relleno, o sea invisibles, y supusiste un verde más
claro. Eso último es un color: lo decide José.

---

**Resumen:** congélala, pártela en funcional y forma, arregla las cuatro de arriba, y el
bloque funcional sube el mismo día. Lo de forma espera a que José lo mire — no se pierde,
solo no entra ahora.
