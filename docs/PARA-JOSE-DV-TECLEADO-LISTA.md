# `jose/dv-tecleado` · las seis cerradas, y qué entra

Josse: van tus seis, con cómo se comprobó cada una. Y detrás, dos cosas que
conviene mirar **antes** de desplegar, no después.

| | |
|---|---|
| Rama | `jose/dv-tecleado`, subida a origin |
| Sobre `main` | 34 commits |
| Sobre `dev` | 15 commits |
| De lo tuyo que falte traer | **nada**: `e574054`, `1636346` y las dos de forma ya están dentro |
| Línea base | `tsc` limpio en backend y frontend · **229 suites, 2.522 pruebas, verde** |

---

## Tus seis

### 1 · `tsx` → `ts-node` — tenías razón, y no compilaba el problema

Cambiado en `backend/package.json:52`. Y **comprobado como pediste, ejecutando**:

```
pnpm db:nit-pegado
  organizaciones: 31
  partidas por el dígito pegado, con algo pendiente: 0
  Nada que unir: ninguna pareja tiene gente, reservas ni huecos pendientes.
```

Arranca y termina. No se tocó el lockfile.

### 2 · El DV fuera de `RELLENABLES`

Fuera, no recalculado. Tu argumento es el correcto y además es el que mi propio
docblock ya enunciaba para `institucionId`: el DV **no es una propiedad de la
organización, es una función del NIT**, y las dos filas tienen NIT distinto.
Copiarlo no es rellenar un hueco, es inventarse un número que se va al cargue.

El porqué quedó escrito en el sitio, con tus dos cifras —`DV('8001837677')=1`
contra `DV('800183767')=7`— para que a nadie le parezca un olvido y lo devuelva.

### 3 · B-03 ya distingue cambiar de poner

El error era mío y era de bulto: la comprobación no separaba **cambiar** de
acción de **ponerla por primera vez**, así que un certificado no podía recibir su
primer grupo. Ahora va detrás de la carga de la oferta y colgando de
`cambiaDeAccion` (`crm.service.ts:6436`).

Y **la prueba que tenía escrita fijaba el orden viejo**: no describía el sistema,
describía mi error, y habría peleado contra quien intentara arreglarlo. Rehecha.

### 4 · El `updateMany` de reservas

Cerrado dentro de transacción.

### 5 · El filtro de fecha que pidió el cliente

Respetado en la fusión.

### 6 · `asesoresAsignables`

Resuelto. `asesoresAsignables` son los que **pueden** llevar fichas, y va aparte
de la lista de los que ya tienen (`crm.service.ts:1340`), que era el círculo del
desplegable: para aparecer había que tener un lead, y para tener el primero había
que aparecer.

---

## ⚠ Dos cosas antes de desplegar

### A · Hay dos commits de SOLO frontend, y uno importa

```
996e33f  Reservas: cupos reservados, el total de inscritos, y fuera el punto
ef4be0c  El Excel de leads sale en hora de Bogota, no en UTC
```

El segundo lleva días arreglado y **en producción sigue mal**, porque los de solo
pantalla se quedan fuera. Cinco horas de desfase: todo lead que entre entre las 7
de la noche y medianoche sale en el Excel con la fecha del **día siguiente**,
mientras la pantalla lo enseña bien. Cualquier conteo por día o corte de mes
hecho desde ese archivo trae esas filas corridas. Lo reportó el cliente el 25 sep
creyendo que fallaba el filtro «Hoy».

Si el despliegue vuelve a dejar fuera lo de pantalla, ese arreglo no llega.

### B · El informe de brechas da EXPORT-UTC por abierta, y no lo está

El detector busca que `valor` devuelva la fecha de Bogotá; el arreglo está en
`exporta` (`columnas-participante.tsx:225`). Es el detector el que mira mal, como
el que ya corregimos. Lo apunto para arreglarlo, pero que no te frene: la brecha
está cerrada.

---

## Lo que entra, por si quieres partirlo

**Al SENA** — lo que se entrega y por tanto lo que más riesgo tiene:

- Se podía **reportar a un menor de edad**: la compuerta miraba la edad de hoy y
  el archivo la del arranque del curso. Dos fechas para el mismo dato.
- El **NIT perdía los ceros de la izquierda** en los tres formatos: Excel se los
  come y el cargue se va contra otra organización, o contra ninguna.
- La **caracterización salía al azar**: las marcas de un envío se escriben en un
  `createMany` dentro de una transacción, y `creadoEn` es la hora de la
  transacción, idéntica para todas. `orderBy: creadoEn` no desempataba nada.
  Quien marcó dos cosas podía salir el lunes con una y el martes con la otra.

**Cupos y organizaciones:**

- El sitio público **prometía plazas que no existían**: `cuposOcupados` solo
  cuenta lo que aparta una empresa, y quien se inscribe por su cuenta no estaba
  en ningún contador. La cuenta estaba copiada en siete sitios; ahora vive en
  `comun/plazas-de-la-oferta.ts`.
- Las organizaciones que **el dígito pegado partió en dos** —Benedictino entre
  ellas—: cerrada la entrada y escrito el guion que une las de antes.

**Seguridad:**

- Cancelar una reserva pedía **solo el NIT**, que es público. Ahora pide también
  el correo, con el mismo mensaje para los tres fallos.

**Gestión de leads:** NIT, nombre de empresa y formulario de entrada.

**El cronograma (lo nuevo, 3 commits):** lee la hoja del cliente y lleva a cada
grupo su fecha de inicio, de fin y **su propia fecha de cierre**. Una AF no
cierra entera —seis de las siete cierran en dos o más fechas, AF3 en cinco— y
hasta ahora la pantalla enseñaba una sola por acción, de donde salían los días
para el cierre y la meta diaria de los asesores.

Trae migración: `Grupo.cierreInscripciones`, nulo por defecto. **Nulo = la regla
derivada de siempre**, así que sin importar nada el comportamiento no cambia.

El importador (`pnpm db:cronograma`) **no escribe sin `--aplicar`**, no crea
grupos, no borra lo que la hoja no menciona, y comprueba la ciudad además del
código y el número —ADECOPRIA y BRITCHAM-ADEE tienen los dos un AF1 con ocho
grupos numerados igual—. Corrido contra la base de pruebas: 26 escritos, 2 con
reparo, y la segunda pasada no reescribe nada.

Los 2 con reparo son un hallazgo de verdad: **AF2.G5 y AF2.G6 están cruzados**
entre el cronograma y el sistema. No se tocan; eso lo decide Mauricio.

---

## Lo que sigue bloqueado, y no es código

- **El LMS.** Nadie escribe el avance del aula y sin él `cambiarEtapa` impide
  certificar a cualquiera. La pregunta es una: ¿pueden mandar, por persona y
  actividad, si está completada y cuándo?
- **El SENA.** Quien se retira desaparece del cargue en vez de reportarse. Son
  minutos de código; falta saber qué valor espera la columna ESTADO para un
  retiro.
