# Respuesta a Josse · 7 de octubre

Josse: gracias por montarlo y por correr los dos sondeos contra producción.
Te contesto por puntos, y el 3 ya está hecho.

---

## 3 · La prosa que se contradecía — **hecho**

Tenías toda la razón, y era el apunte más importante de los tres: tal cual
estaba, el siguiente que abriera ese fichero revertía el cambio **con el
comentario de su lado**.

Eran los tres sitios que dijiste:

| Dónde | Qué decía |
|---|---|
| `resumen-por-accion.ts`, docblock | Tres viñetas celebrando que una inscripción «no se borra del pasado» |
| `resumen-por-accion.ts`, SQL | «Sin mirar la etapa de hoy… aunque después desertara» |
| `resumen-por-grupo.ts`, SQL | Lo mismo |

Reescrito. El docblock ahora dice que **las dos primeras viñetas las arregla
el ancla y la tercera se queda a propósito**, con la cita del cliente del 7 de
octubre, el porqué —la pregunta que contesta esa tabla es cuánta gente tiene
**hoy** esa acción, que es lo que se responde ante el SENA y lo que cuadra con
los cupos de al lado— y un «si esto vuelve a parecer un fallo, no lo
revierta», apuntando al spec y a las cuatro ventanas comprobadas
(1292/1292, 1212/1212, 0/0, 1221/1221).

Los dos comentarios del SQL ahora dicen la fórmula corta: **el ancla pone la
fecha y la etapa de hoy decide si cuenta**.

## 1 y 2 · Los coges tú — de acuerdo, y con un matiz

**1 · `SIN_ORGANIZACION`**: de acuerdo, y el acotado que propones es el
correcto: para ese tipo, `faltaDeLaPersona` y nunca `faltaDeLaEmpresa`. Tu
separación del aviso es buena y mi envoltorio la estaba deshaciendo por
detrás.

**2 · `INSCRITO → INSCRITO`**: no lo podía ver, es verdad, y es grave: con los
traslados de esta semana el panel diría que inscribimos a esa gente ese día.
`etapaAntes: { not: 'INSCRITO' }` en las dos consultas. Si prefieres que lo
haga yo para no partir la rama, dímelo y lo hago en diez minutos.

---

## La llave de Google

La cuenta de servicio es **`automatizacioncronograma`**, y la variable es
`GOOGLE_CUENTA_DE_SERVICIO`.

**Dala por comprometida.** El JSON entero, con su clave privada, se pegó dos
veces en un chat. Tienes razón en que se rota y no se cambia: mientras siga
válida, sirve. Revócala al generar la nueva y que la nueva entre como variable
de entorno del servidor, nunca por un chat.

**Pero el cronograma no depende de eso para correr**, y esto conviene que lo
sepamos los dos porque yo mismo se lo había dicho mal al cliente: el script
toma el archivo de `CRONOGRAMA_ARCHIVO` **o** lo baja de Drive. Con el xlsx en
la mano se puede correr hoy:

```
pnpm db:cronograma                     # solo mira
pnpm db:cronograma --aplicar           # escribe
```

La llave solo sirve para que se baje solo.

---

## Los dos sondeos

**Cupos**: cero descuadres en 106, entendido, y no toco la disponibilidad del
formulario. Lo de que esa línea se quitó ayer a petición tuya no lo sabía; con
eso, el sondeo que escribí queda como herramienta de diagnóstico y no como
aviso de nada.

El **sobrecupo real de AF1 · ANTIOQUIA (188 dentro para 130 de tope)** lo paso
al cliente, porque es suyo decidir qué se hace con esas 58 personas.

**Jefe directo**: apuntado, y es un fallo del plan, no del script. Van los dos
pasos y en este orden:

```
pnpm db:jefe-directo --aplicar
pnpm db:datos-completos --aplicar
```

Sin el segundo, las 4 organizaciones quedan completas y las fichas siguen en
«Interesado», que es exactamente el síntoma del que venimos. Lo añado al
encabezado del propio script para que no dependa de que alguien lea esto.

Las 9 sin sector económico siguen sin arreglo posible desde aquí: el
formulario de reserva no lo pregunta. O se añade la pregunta, o lo pone un
asesor desde el panel. Es decisión del cliente y se la he planteado.

---

## La barra de filtros de BBDD Leads

De acuerdo en el fondo: una petición del cliente no es autorización para
reabrir algo que cerramos el 24 de septiembre, y lo de Tráfico del 21 ya nos
costó un día. Queda en tu tejado y yo no lo vuelvo a tocar.

**Pero tenías razón en lo otro, y eso sí lo he devuelto ya**: dentro de lo que
quité no todo era forma. La ayuda que explica que la tabla filtra sobre lo
cargado hace falta, porque sin ella hay una trampa que no se ve —se puede
buscar a alguien que **sí** está en la base y que la tabla diga que no hay
nadie—.

Lo he puesto como **un renglón** y no como el bloque de tres que el cliente
mandó quitar, con las dos cifras dentro, que es lo que lo hace entendible sin
explicar nada:

> El buscador de la tabla filtra solo las 50 filas traídas; el de arriba
> pregunta a las 1.252 de la base.

Y solo sale cuando de verdad hay más de lo traído: con 20 leads los dos
buscadores miran lo mismo y el aviso sobraría.

---

## El conteo de commits

Tienes razón y la culpa es mía por contar por el mensaje en vez de por el
`git log`: eran 8 cuando lo escribí y se movió mientras lo mirabas. El
documento ya va por el número real y lo he dejado de escribir a mano.

---

## Lo del foro

Gracias. Y hay una segunda mitad que entró después de que lo miraras, por si
la coges al revisar:

El formulario público prometía **de más**. Yo lo había atado a `esForo`, así
que a quien eligiera AF3 le decía que podría sumar el foro después —y el panel
se lo niega, porque AF3 no tiene `combinaConAccionId`—. En BRITCHAM era peor:
se lo prometía a todo el mundo y allí no hay ninguna pareja declarada.

Ahora la pantalla **lee la pareja del dato** y nombra los dos códigos («La
única excepción es AF7, que sí se puede sumar a AF1»), y rotula las **dos**
tarjetas, no solo el foro: rotular una sola se lee como que el foro se suma a
cualquiera.

**No he unificado las dos puertas**, que eso está decidido y es tuyo: la
pública sigue eximiendo por `evento` y la del panel sigue exigiendo la pareja
declarada. Lo único que se arregla es que la pública deje de prometer lo que la
otra niega.

---

Andrés
