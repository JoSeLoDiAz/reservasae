# Para José — la noche del 1 al 2 de octubre

**Corto a propósito.** `PARA-JOSE.md` tiene 1.050 renglones y es del 25 sep, sobre
`arq/crm-hardening`, que ya no es la rama. Esto es solo lo de anoche.

Rama: **`jose/dv-tecleado`**, encima de `dev` (`883d4da`).
Estado: **`tsc` limpio en backend y frontend · 2.424 pruebas en 217 suites, verde.**

---

## 1 · Las siete brechas de código están cerradas

De las nueve que daba el informe esta mañana quedan **dos**, y ninguna es código. Las
cerradas las da por cerradas **el propio informe**, que las comprueba contra el código.

| | Qué era |
|---|---|
| **EXPORT-UTC** | El Excel de leads sacaba las fechas en UTC y la pantalla en Bogotá. Cinco horas: todo lead que entrara después de las 7 de la noche salía con la fecha del **día siguiente**. Eran las tres columnas de fecha, no solo la de creación. |
| **B-01** | `PATCH crm/:id` aceptaba `asesorId` sin exigir `conveniosQueReparten`. Un gestor se pasaba fichas a sí mismo abriendo la ficha y guardando. |
| **A-08** | Entre el `findUnique` y el `create` de un lead caben dos reintentos de Meta. El segundo reventaba con un 500, y quien manda el webhook lee un 500 como «no llegó» y reintenta otra vez. |
| **B-03** | `asignar()` movía de acción de formación a alguien **ya certificado**. |
| **B-08** | La preinscripción pública era la única de ocho puertas que no validaba el documento contra su tipo. |
| **A-15** | La rama firme del cruce dejaba el lead en `CONVERTIDO` sin `procesadoEn`. Es el camino más recorrido de los cuatro. |
| **B-14** | De los dos sitios que crean un participante, solo `crm.crear()` dejaba huella — y el otro es el que más fichas crea. |

Cada una con sus casos, y varios **leen el código fuente** a propósito: prueban una copia de
la regla, y una copia miente en silencio cuando alguien afloja el original.

### Tres cosas que quiero que mires con ojo crítico

- **B-01 no exceptúa al superadministrador**, igual que `lote/asesor`. Comprobé en la base
  que los superadministradores llevan `LIDER_SISTEMAS`, así que pasan. Si crees que debe
  haber excepción, va en **las dos puertas a la vez** o vuelve el agujero.
- **B-03 bloquea las cuatro salidas y el certificado, pero NO `PERDIDO`.** Había una lista
  parecida ya hecha —`NO_RECIBEN_GRUPO`— que sí lo incluye, y usarla era lo cómodo: habría
  «arreglado» la brecha rompiendo la recaptación, que se usa todos los días.
- **B-08 mira el tipo de documento.** Una regla «solo dígitos» a secas habría cerrado la
  inscripción a quien usa pasaporte.

---

## 1 bis · Lo de esta mañana: el desplegable de asignar asesor

**Lo encontró el cliente el 2 oct.** Creó tres cuentas de Gestor de inscripciones y no le
salían para asignarles leads.

El desplegable «Asignar a» de la tabla y el **filtro** de la columna «Asesor» salían de la
misma consulta, y esa consulta agrupaba las fichas por asesor: **los que ya tienen leads**.
Un círculo sin salida — para salir en el desplegable había que tener un lead, y para tener
el primero había que salir en el desplegable. Una cuenta nueva no podía recibir ninguno
nunca desde esa pantalla.

Ahora son dos listas porque son dos preguntas. El filtro se queda igual ---filtrar por
alguien con cero filas no devuelve nada--- y la de asignar usa `llevanFichasEn`, la misma
fuente que el selector de la ficha individual, para que las dos pantallas no ofrezcan
gente distinta.

### Y un cambio de comportamiento que conviene que sepas

**El líder de sistemas sale de la lista de asesores ofrecibles**, por decisión del cliente:
«solo debe salir Gestor de Inscripciones y Líder de Inscripciones». Estaba porque tiene
`inscripciones · ESCRIBIR`, pero una cosa es poder escribir en las fichas y otra que la
gente le reparta leads.

- **No rompe lo ya asignado**, y hay una prueba que lo fija: esta lista decide a quién se
  OFRECE, no quién puede tener. `exigirAsesorDelConvenio` sigue aceptando a cualquiera con
  concesión, así que las fichas que ya lleva un líder de sistemas se quedan y se le pueden
  quitar.
- **Afecta al propio cliente**, que es `LIDER_SISTEMAS` en los dos convenios: va a dejar de
  aparecer en ese desplegable. Está avisado y es lo que pidió.
- El cambio va en `quien-lleva-fichas.ts` y no en cada pantalla, así que la mesa de entrada
  y el selector de la ficha lo heredan solos.

---

## 2 · El informe de brechas me mintió tres veces, y eso te toca a ti más que a mí

Tú te apoyas en `db:brechas` para saber qué queda. Anoche me dio **tres falsos «sigue
abierta»**, y en los tres casos **arreglar la brecha no apagaba el aviso**:

1. **Finales de línea.** Los ficheros están en CRLF y un detector buscaba una aguja con
   `\n` dentro. Nunca la encontraba. Se normaliza ahora **al leer**, no en cada detector,
   porque la próxima aguja con un salto de línea la escribirá alguien que no sepa esto.
2. **Aguja ambigua.** El detector de A-15 buscaba `coincide.firme`, que sale **seis veces**
   en su fichero; la primera es un mensaje de registro cincuenta líneas antes del sitio
   real. Ahora busca `data: coincide.firme`, que es único.
3. **Ventana corta.** El de A-15 miraba 20 renglones y el arreglo quedaba en el 22.

Y para que no vuelva a pasar, **el informe avisa solo cuando la aguja de una comprobación
sale varias veces en su fichero**. No puede arreglarlo —no se adivina cuál aparición es la
buena— pero lo dice, que es lo que me faltó: lo encontré a mano y por casualidad. Al
correrlo ya caza otra: `ETAPAS_DEL_REPORTE`, la del SENA.

Lo digo claro porque es lo que más riesgo tiene de todo lo de anoche: **un aviso que no se
apaga cuando el trabajo ya se hizo deja de leerse**, y entonces no avisa el día que importe.

---

## 3 · Lo de antes de las brechas, en la misma rama

- **`digitoDeclarado`** — tenías razón, y va más allá del guion: el guion copió el patrón de
  `directorio.service.ts:99`, que hace lo mismo en el alta manual, que es por donde entra
  gente todos los días. Ahora guarda `lectura.digitoTecleado`.
  **Las filas ya escritas no hay que tocarlas**: la lectura enmascara igual el calculado que
  el nulo. Ningún `UPDATE` sobre producción.
- **`pnpm db:nit-pegado`** — tu `/tmp/unir-nit-pegado.sql` convertido en guion: mira primero,
  escribe solo con `--aplicar`, guardia por **puerto**, y **no borra ninguna fila** (la
  pegada queda en su sitio y vacía, que es lo reversible). Ejercitado montando el caso en la
  base de pruebas, incluido correrlo dos veces.
- **El sondeo vigila dos cosas nuevas**: las ciudades sin departamento —sin eso, el parche de
  AF6 podía estar sin efecto en producción y nadie enterarse, porque falla con el **mismo
  mensaje** que el caso legítimo— y cuánta gente no se puede matricular por su departamento.

---

## 4 · Lo que necesito de ti

1. **Fundir `jose/dv-tecleado`.** No trae migraciones ni variables de entorno. Un fichero de
   frontend —`columnas-participante.tsx`, lo del Excel en UTC— va ahí a propósito: no es
   cómo se ve algo, es un dato equivocado en un archivo que alguien usa para contar.
   **Ojo:** ese mismo fichero lo toca `jose/forma-arregla`. Si entran los dos, choca.
2. **La fecha de lo visual.** `jose/forma-arregla` (12 commits, 21 ficheros) y
   `jose/forma-apariencia` (1 commit, 43). La primera quedamos que viaja gratis en el
   próximo despliegue. Y lo de `24bc2b4` **ya está esquivado**: en `forma-arregla` la
   pantalla de Ocupación está entera, con sus tres ficheros y su entrada de menú — me llevé
   el borrado y su marcha atrás a la misma rama y se cancelan. No retengas la fusión por eso.
3. **Quitar `resultado` del DTO** en la siguiente versión. Entró solo por la ventana del
   despliegue.

---

## 5 · Las dos que no son código, y una decisión del cliente

- **LMS** — nadie escribe el avance del aula, y sin él **`cambiarEtapa` no deja certificar a
  nadie**. La pregunta exacta: *¿pueden mandar, por persona y actividad, si está completada
  y cuándo?* El modelo ya está y las pantallas ya saben leerlo.
- **SENA** — quien se retira desaparece del cargue. El código ya dice dónde se añade, son
  minutos; falta que digan **qué valor espera la columna `ESTADO` para un retiro**. Poner
  cualquier cosa arriesga el rechazo del cargue entero.
- **Y una que no es técnica:** `cobertura.ts` **no mira la modalidad**, así que aplica la
  misma frontera de departamento a un curso **virtual** que a un taller presencial. El
  sondeo ya cuenta a quién bloquea. Si la lista de departamentos de una acción virtual es un
  compromiso con el SENA, esos bloqueos son correctos; si solo está porque el F7 pide un
  lugar, es gente que se pierde todos los días. **No lo toqué**: decidirlo mal rompe el
  reporte, que es el entregable.
