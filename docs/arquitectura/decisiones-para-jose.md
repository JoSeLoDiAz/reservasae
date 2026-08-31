# Decisiones que necesitan a José

**Ninguna de estas bloquea el trabajo.** Para cada una sigo adelante con el supuesto más
seguro, y aquí está escrito cuál es y qué habría que rehacer si la respuesta resulta ser otra.

Así funciona esto: **José valida y aprueba.** Si una decisión le parece mal, se cambia — y la
columna *"qué cuesta cambiarlo"* dice de antemano cuánto duele.

Las que solo puede contestar el SENA van marcadas 🏛️: hay que preguntárselas, pero mientras
tanto el trabajo no se detiene.

---

## 🏛️ 1 · Los valores de la columna `ESTADO` del cargue

**La que más rinde de toda la lista.**

Hoy `formato-cargue-sep.ts:171` escribe `'ACTIVO'` **a fuego, como literal**. Y
`sep.service.ts:188` filtra por `ETAPAS_DEL_REPORTE`, que solo tiene `INSCRITO`,
`EN_FORMACION` y `CERTIFICADO`. Consecuencia: **cuando alguien se retira, su fila
simplemente desaparece del siguiente cargue.** Nada dice por qué.

| | |
|---|---|
| **Sigo con** | La columna `ESTADO` admite al menos un valor para "ya no activo" |
| **Por qué** | El formato ya tiene la columna. Si admite `RETIRADO` o equivalente, avisar del retiro **no exige tocar ni un título ni una prueba** |
| **Si la respuesta es otra** | Si el SENA solo acepta `ACTIVO`, hace falta el formato aparte del [borrador de retiro](borradores/aviso-de-retiro-al-sena.md). Trabajo: mediano |
| **Coste de cambiarlo** | Bajo. Es un `switch` sobre la etapa en un solo sitio |

---

## 🏛️ 2 · ¿Existe ya un formato oficial del SENA para retiros?

| | |
|---|---|
| **Sigo con** | No existe, y por eso hay un borrador propio |
| **Si existe** | **Se tira el borrador y se copian sus columnas literales**, igual que se hizo con los otros tres formatos |
| **Coste de cambiarlo** | Bajo si se detecta pronto; **alto si se detecta después de implementarlo** |

---

## 🏛️ 3 · El motivo del retiro: ¿texto libre o causal cerrada?

Hoy es texto libre de 300 caracteres, capturado con un `prompt` del navegador.

| | |
|---|---|
| **Sigo con** | Texto libre, como está |
| **Si el SENA quiere causal codificada** | Hace falta un catálogo nuevo, migración, pantalla de selección, y **decidir qué se hace con los motivos ya escritos** |
| **Coste de cambiarlo** | Medio-alto: los datos viejos no se pueden reclasificar solos |

---

## 🏛️ 4 · ¿El SENA exige horas efectivamente cursadas?

**Esta decide el alcance, no el formato.**

| | |
|---|---|
| **Sigo con** | No las exige |
| **Por qué** | Porque **no existe ningún registro de asistencia**. `porcentajeAsistencia` tiene su columna y su CHECK, y **solo lo escribe la siembra de prueba**. Las columnas de horas del cargue van fijas en 0 |
| **Si las exige** | No es trabajo de formato: **es un módulo de asistencia que no existe**. Semanas, no días |
| **Coste** | El más caro de la lista |

---

## 🏛️ 5 · Un grupo `HIBRIDA`, ¿por qué camino va?

La decisión de partir el aviso en virtual y presencial asume dos modalidades. **El sistema
tiene tres**: `PRESENCIAL`, `VIRTUAL`, `HIBRIDA`.

| | |
|---|---|
| **Sigo con** | `HIBRIDA` va por el camino **presencial** |
| **Por qué** | Es el más exigente. Si luego resulta que basta el virtual, se relaja; al revés habría que rehacer avisos ya entregados |
| **Coste de cambiarlo** | Bajo |

---

## 🏛️ 6 · ¿Piden soporte firmado del retiro?

| | |
|---|---|
| **Sigo con** | No lo piden |
| **Por qué** | **La ficha del participante no admite adjuntos de ningún tipo.** Nada en el esquema los soporta |
| **Si lo piden** | Hace falta almacenamiento de ficheros, que hoy **no existe en ninguna forma** salvo los logos como `Bytes` en Postgres — que no es un patrón a repetir |
| **Coste** | Alto |

---

## 7 · `ABANDONO`: ¿lo pone el sistema solo, o lo firma una persona?

| | |
|---|---|
| **Sigo con** | **Siempre lo firma una persona** |
| **Por qué** | Ponerlo tiene dos efectos irreversibles de cara afuera: **libera la silla** y **saca a esa persona del reporte al SENA**. Un automatismo que se equivoca borra a alguien de un reporte contractual |
| **Si se quiere automático** | Necesita: umbral configurable, `ultimoAcceso` alimentado por el LMS (hoy es `NULL` para todos), aviso previo, y forma de deshacerlo |
| **Coste de cambiarlo** | Bajo. Añadir el automatismo después es fácil; quitarlo cuando ya borró a gente, no |

---

## 8 · ¿Qué LMS, con qué URL y token?

`CLAUDE.md:2300-2306` ya decidió **Moodle, solo lectura**. Pero en el repo no hay ni URL, ni
token, ni variable de entorno, ni pantalla donde configurarlo.

| | |
|---|---|
| **Sigo con** | Moodle, solo lectura, y **el contrato escrito de forma agnóstica** |
| **Por qué** | El [borrador del LMS](borradores/llave-de-identidad-y-lms.md) vale para cualquier LMS: define la llave, la normalización y la idempotencia. Lo específico de Moodle es el adaptador, que es la última capa |
| **Si es otro LMS** | Cambia el adaptador. **El contrato no** |
| **Coste** | Bajo, y por eso el contrato se escribió antes que el código |

---

## 9 · Un curso del LMS, ¿equivale a una `AccionFormacion` o a un grupo?

| | |
|---|---|
| **Sigo con** | Un curso del LMS = una `AccionFormacion` |
| **Por qué** | `Actividad` cuelga de la acción y **no del grupo, a propósito**: *"el contenido es el mismo para todos sus grupos"*. Si el LMS parte por cohorte, hay que mapear N cursos a una acción |
| **Coste de cambiarlo** | Medio. Es un mapeo, no un cambio de modelo |

---

## 10 · La escala de la nota: ¿0-5 o 0-100?

**Hay que fijarla antes de la primera importación**, o la columna acaba con las dos mezcladas y
ya no se distinguen.

| | |
|---|---|
| **Sigo con** | **0 a 100** |
| **Por qué** | Es lo que permite el CHECK que ya está en la base: `calificacion IS NULL OR calificacion BETWEEN 0 AND 100`. La siembra escribe 3,5–5,0 y **también pasa**, que es justo el problema |
| **Si es 0-5** | El CHECK hay que estrecharlo, y **hay que decidir qué se hace con lo ya guardado** |
| **Coste de cambiarlo** | **Bajo hoy, alto después de la primera importación.** Es la más urgente de las de LMS |

---

## 11 · ¿Hay actividades cargadas en la base de producción?

No lo puedo mirar: aquí no hay base levantada.

| | |
|---|---|
| **Sigo con** | **No hay ninguna** |
| **Por qué** | Ninguna línea de producción escribe `Actividad`: los únicos `create` están en la siembra de prueba, y no hay ni un `@Post` de actividades en los 19 controladores |
| **Lo que implica** | **Hoy no se puede certificar a nadie.** `cambiarEtapa` lanza *"no hay contra qué medir si terminó"*. Y certificar es lo que paga el SENA |
| **Cómo comprobarlo** | `SELECT COUNT(*) FROM actividades;` — de solo lectura |

---

## 12 · ¿El sobrecupo autorizado se usa de verdad?

| | |
|---|---|
| **Sigo con** | **Sí se usa, y se respeta como funcionalidad deliberada** |
| **Por qué** | Está modelado con su CHECK propio, y el catálogo le suma un 30% por diseño. **Dos diseños se retiraron por proponer un CHECK duro que lo mataba** |
| **Si no se usara** | La estrategia anti-sobrecupo se simplifica bastante |
| **Coste** | Ninguno: el supuesto conservador es el correcto aunque no se use |

---

## 13 · Las once etapas, ¿están todas en uso?

| | |
|---|---|
| **Sigo con** | Las once están vivas |
| **Si algunas son historia** | La máquina de estados se simplifica |
| **Cómo comprobarlo** | `SELECT etapa, COUNT(*) FROM participantes GROUP BY etapa;` |
| **Coste** | Ninguno: sobra máquina de estados, no falta |

---

## Y tres cosas que no son preguntas: son cosas que le debo

Verificadas contra el código, con detalle en [`respuesta-a-jose.md`](respuesta-a-jose.md).

**1. El 4.797 lleva 1.107 de sobrecupo dentro.** La base contractual de los `.xlsx` es **3.690**;
`extraer-catalogo.py:14` le suma un 30% deliberado. Si ese número se usa como *"lo que le
prometimos al SENA"*, está inflado. **Y él mismo dice que el Excel es la fuente contractual**,
así que conviene que no se lean como lo mismo.

**2. El `firme` del cruce se calcula y nadie lo lee.** Su descripción del diseño es exacta, y el
diseño **está escrito en el código**. Pero `grep "firme"` sobre `leads/` solo lo encuentra
dentro de `cruzar-con-el-crm.ts`. `leads.service.ts:155` marca `CONVERTIDO` con cualquier
coincidencia. **Media hora de trabajo**: ramificar por `firme`.

**3. La preinscripción pública no normaliza el documento.** `preinscripcion.service.ts:236`
hace solo `.trim()`. Quien teclea `1.020.304.050` crea una `Persona` distinta de la del panel.
**La garantía del `@unique` es real por el panel y falsa por la puerta que más gente usa.**

---

## Cómo seguir sin esperar a nadie

Cada supuesto de arriba está **declarado en el entregable donde importa**, no solo aquí. Si
José corrige uno, se busca por su número y se ve exactamente qué hay que rehacer.

El trabajo continúa por las fases 3, 4 y 5. Lo único que **no** se hace sin una persona
delante: **ejecutar migraciones** y **cualquier borrado**.
