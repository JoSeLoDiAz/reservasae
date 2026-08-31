# BORRADOR · Aviso de retiro al SENA

> **Esto es un borrador y el SENA manda sobre el formato final.** No hay código ni migración.
> Si existe ya un archivo oficial del SENA para reportar retiros —aunque sea un correo con una
> tabla pegada—, **este documento se tira y se copian sus columnas literales**, igual que se
> hizo con los tres formatos que ya existen.

---

## 1 · Lo primero: hoy al SENA no se le avisa. La persona desaparece

Esta es la respuesta a la pregunta que quedó abierta durante semanas, y es peor de lo que
parecía.

`sep.service.ts:188` filtra el cargue por `ETAPAS_DEL_REPORTE`, que es **exactamente
`OCUPAN_SILLA`**: `INSCRITO`, `EN_FORMACION` y `CERTIFICADO`. Las cuatro formas de salir del
aula —`RETIRADO`, `DESERTO`, `ABANDONO` y `NO_APROBO`— **no están en esa lista**.

Así que la secuencia real es esta:

| Cargue | Qué ve el SENA |
|---|---|
| Enero | Fila de Juan, con `ESTADO = 'ACTIVO'` |
| Febrero (Juan se retira) | **La fila de Juan ya no está.** Nada dice por qué |

Y `'ACTIVO'` está **escrito a mano en el código** (`formato-cargue-sep.ts:171`): es un valor
fijo, no un dato. Nunca hemos mandado otra cosa.

> **La consecuencia:** al SENA le consta que Juan estaba activo, y después Juan se evapora.
> Desde fuera es indistinguible de un error nuestro.

---

## 2 · La buena noticia: el enganche ya existe

**El formato de cargue ya tiene una columna `ESTADO`.** No hay que inventar vocabulario nuevo
ni un archivo paralelo: hay que **dejar de mandar `'ACTIVO'` fijo** y mandar el estado real.

Eso es lo primero y lo más barato, y probablemente resuelve el caso **virtual** entero — porque
si la fila sigue apareciendo con su estado correcto, el SENA ya está informado.

**El formato aparte solo hace falta para lo presencial**, y solo si el SENA pide datos que el
cargue no lleva: horas efectivamente cursadas, soporte firmado, causal codificada.

---

## 3 · Lo que ya está bien modelado

El retiro **existe** como concepto y su parte de estado está bien hecha:

- **Tres formas de salir**, y la distinción es real y útil:

  | Etapa | Qué significa |
  |---|---|
  | `RETIRADO` | Decisión formal. Lo pidió y quedó constancia |
  | `DESERTO` | Avisó que se iba |
  | `ABANDONO` | Dejó de venir sin decir nada |

- **Todas exigen motivo** (`ETAPAS_CON_MOTIVO`, `crm.service.ts:109-115`).
- **Todas dejan `MovimientoParticipante` y auditoría.**
- **Ninguna borra nada.** La regla que diste ya se cumple en este camino.
- La silla se libera en el conteo de inscripción, porque `OCUPAN_SILLA` no incluye las salidas.

---

## 4 · Los tres defectos que hay que arreglar antes del formato

Sin esto, cualquier formato que escribamos saldría con huecos.

**4.1 · `fechaRetiro` solo se escribe para `RETIRADO`.**
`crm.service.ts:2308`, respaldado por el CHECK `participantes_retiro_fechado`. **`DESERTO` y
`ABANDONO` se quedan sin fecha** — o sea dos de las tres formas de irse, que además son las más
frecuentes. Un formato con la fecha vacía en dos tercios de las filas no sirve.

**4.2 · `motivoSalida` se escribe y no lo lee nadie.** El dato está (`schema.prisma:919`), es
obligatorio, y no sale por ninguna parte.
⚠️ **Cuidado al usarlo como fuente:** también se escribe para `PERDIDO`, que es una salida
comercial, no académica. Filtrar por etapa, no por "tiene motivo".

**4.3 · El contador de reservas no se entera.** La silla se libera en el conteo vivo de
inscripción, pero **`Oferta.cuposOcupados` no se toca**. Es el descuadre estructural de INV-4
que ya salió en Fase 1 (G-01), y aquí reaparece: alguien se retira, la silla queda ocupada en el
lado de reservas.

---

## 5 · El borrador del formato — con la verdad sobre cada columna

Estilo copiado de los tres formatos existentes: títulos en mayúsculas, una fila por persona.

**Leyenda de la última columna, que es la que importa:**
🟢 el dato existe y es fiable · 🟡 existe pero puede venir vacío · 🔴 **no lo tenemos hoy**

| # | Columna | De dónde sale | ¿Tenemos el dato? |
|---|---|---|---|
| 1 | TIPO IDENTIFICACION | `Persona.tipoDocumentoSepId` | 🟢 |
| 2 | NUMERODEIDENTIFICACION | `Persona.numeroDocumento` | 🟢 |
| 3 | NOMBRES Y APELLIDOS | `Persona` (cuatro campos) | 🟢 |
| 4 | CODIGO DE LA ACCION | `AccionFormacion.codigo` | 🟢 |
| 5 | NOMBRE DE LA ACCION | `AccionFormacion.nombre` | 🟢 |
| 6 | GRUPO | `GrupoCobertura → Grupo.numero` | 🟡 `coberturaId` es opcional |
| 7 | MODALIDAD | `oferta.modalidad` o `cobertura.grupo.modalidad` | 🟡 **no está en `Participante`** |
| 8 | FECHA DE MATRICULA | `Participante.fechaMatricula` | 🟡 nullable, y `revisar()` no la exige |
| 9 | **ESTADO** | la etapa real | 🔴 **falta el catálogo de valores del SENA** |
| 10 | **FECHA DE RETIRO** | `Participante.fechaRetiro` | 🔴 **solo existe para `RETIRADO`** |
| 11 | MOTIVO DEL RETIRO | `Participante.motivoSalida` | 🟡 texto libre, no causal codificada |
| 12 | QUIEN REPORTA | `MovimientoParticipante.adminId` | 🟡 nullable; los automáticos van sin admin |
| 13 | TOTAL HORAS DEL EVENTO | `AccionFormacion.horas` | 🟡 `Int?`, no obligatorio |
| 14 | **HORAS EFECTIVAMENTE CURSADAS** | — | 🔴 **NO EXISTE.** No hay registro de asistencia |
| 15 | **PORCENTAJE DE AVANCE** | `actividades` / `avances_actividad` | 🔴 **hoy siempre 0**: las tablas están vacías |
| 16 | **PORCENTAJE DE ASISTENCIA** | `Participante.porcentajeAsistencia` | 🔴 la columna existe con su CHECK; **nadie la escribe** |
| 17 | SEDE | `Ubicacion.nombre` | 🟡 solo nombre: no hay dirección ni campus |
| 18 | **SOPORTE FIRMADO** | — | 🔴 **la ficha no admite adjuntos de ningún tipo** |

**Cinco columnas en rojo, y las tres primeras son las que un aviso de retiro necesita de
verdad.** Si el SENA pide horas cursadas o asistencia, **no es trabajo de formato: es un módulo
de asistencia que no existe.**

---

## 6 · Y una cosa que te va a doler más que el retiro

Al mirar el aula para esto salió algo que no buscábamos:

**`actividades` y `avances_actividad` no las escribe nadie en producción.** Los únicos `create`
están en la siembra de prueba. No hay ni un `@Post` ni un `@Patch` de actividades en los 19
controladores.

Consecuencia, dicha por el propio código en `crm.service.ts:2178-2181`:

> *"Esta acción de formación no tiene actividades obligatorias cargadas: no hay contra qué medir
> si terminó"*

**Con las tablas vacías, hoy nadie se puede certificar desde la aplicación.** Y la pantalla dice
*"hay que hacerlo a mano"* … pero **la ruta para hacerlo a mano no existe**.

Lo que José dice del 80% **es cierto y está construido**: `MINIMO_PARA_CERTIFICAR = 0.8`, con el
denominador bien puesto —actividades publicadas y obligatorias de esa acción— y un comentario
que explica un fallo real que ya corrigieron. La regla está. **Lo que falta son los datos.**

---

## 7 · Preguntas que solo el SENA o tú podéis contestar

1. **¿Existe ya un archivo oficial del SENA para reportar retiros?** Si sí, esto se tira y se
   copian sus columnas literales.
2. **¿Qué valores admite la columna `ESTADO`?** Hoy mandamos `'ACTIVO'` fijo y no hay catálogo.
   Es lo que desbloquea la solución barata del §2.
3. **¿Las tres formas de irse se reportan igual, o el SENA distingue?** Nosotros distinguimos
   retiro formal, deserción avisada y abandono silencioso.
4. **¿El motivo va como texto libre o como causal de lista cerrada?** Hoy es texto libre de 300
   caracteres.
5. **¿Exige horas efectivamente cursadas?** Es la pregunta que decide el alcance: si sí, hace
   falta un módulo de asistencia.
6. **¿Y la modalidad `HIBRIDA`?** El sistema tiene **tres** modalidades, no dos. Tu decisión
   parte el aviso en virtual y presencial. ¿Un grupo híbrido por cuál va?
7. **¿Se entrega por persona en el momento, o acumulado por grupo?** Cambia si el archivo lleva
   una fila o muchas.
8. **¿Piden soporte firmado?** La ficha no admite adjuntos.
9. **¿`ABANDONO` lo puede poner el sistema solo** tras N días sin entrar al aula, o siempre lo
   firma una persona? Ponerlo libera la silla y **saca a esa persona del reporte**.

---

## 8 · Lo que yo propondría hacer, en orden

1. **Mandar el estado real en la columna `ESTADO`** en vez de `'ACTIVO'` fijo. Es un cambio
   pequeño y probablemente resuelve el caso virtual entero. **Bloqueado** por la pregunta 2.
2. **Escribir `fechaRetiro` para las tres salidas**, no solo para `RETIRADO`. Sin eso, ningún
   formato sale completo.
3. **Cerrar el descuadre del contador** cuando alguien sale (§4.3). Va junto con G-01 de Fase 1.
4. **Solo entonces**, el formato aparte para presencial — y solo si el SENA pide algo que el
   cargue no lleve.

Relacionado: [`llave-de-identidad-y-lms.md`](llave-de-identidad-y-lms.md) ·
[`01-auditoria.md`](../01-auditoria.md), dominios C y G.
