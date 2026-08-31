# 01 · Auditoría por dominio

**Fase 1. Solo lectura: no se modificó ni una línea de código de producción.**

| | |
|---|---|
| Método | 7 auditores en paralelo (uno por dominio) + 7 refutadores, cada uno revisando un dominio que no auditó |
| Coste | 14 agentes, 0 fallos, 841 usos de herramienta |
| Resultado | **119 hallazgos**: 14 críticos, 50 altos, 49 medios, 6 bajos |
| Corrección | Los refutadores emitieron **97 correcciones**. Rebajaron 5 severidades, subieron 1, y detectaron **4 remediaciones que habrían roto cosas vivas** |

El registro completo, con impacto, remediación y esfuerzo por hallazgo, está en
[`01-riesgos.csv`](01-riesgos.csv). Este documento cuenta lo que el CSV no puede: qué
funciona, qué está roto y por qué.

---

## Dos correcciones a mi propia Fase 0

Antes de nada, porque afectan a cómo se lee el mapa anterior:

**1. `LeadEntrante` SÍ apunta al participante.** En Fase 0 escribí que la cadena de INV-7
estaba rota en el primer eslabón. **Era falso.** `schema.prisma:783` tiene
`participanteId String? @unique` con su FK en
`migrations/20260828090000_mesa_de_entrada_de_leads/`. Lo que le falta es la relación con
`Persona`, no con `Participante`. La cadena existe — y resulta que ese `@unique` es un
problema aún peor, ver **A-03**.

**2. La capa de inscripción está mejor de lo que dije.** Escribí que no tenía garantía en base.
`cambiarEtapa` **sí** abre transacción interactiva, toma `FOR UPDATE` sobre la oferta
(`crm.service.ts:2252-2277`) y recuenta dentro antes de escribir. El agujero está en otro
método, `asignar()`, no en toda la capa.

También: los `@@unique` de tabla son **22**, no 23.

---

## Lo que está bien y no hay que tocar

Esto importa tanto como los fallos. Hay decisiones aquí que son mejores de lo que se ve en
sistemas mucho más grandes, y un plan de mejora que las pisara sería un retroceso.

**Seguridad de la entrada**
- La firma de Meta es HMAC-SHA256 **sobre el `rawBody`**, no sobre el JSON reserializado, y se
  compara en tiempo constante (`leads/meta.ts:47-49`). El secreto es **por gremio**, sin
  respaldo a una variable global.
- La llave del orquestador va más allá: cuando los largos no coinciden ejecuta igualmente un
  `timingSafeEqual(b, b)` **para no salir antes y no filtrar el largo**
  (`llave-de-leads.guard.ts:29-40`).
- El backend **no arranca sin secretos**, y rechaza los valores de ejemplo publicados en el
  repositorio (`main.ts:19-57`).
- Si el `Host` y el cuerpo se contradicen, **400**, en vez de elegir uno en silencio
  (`leads.service.ts:74-79`). Es exactamente como un lead acabaría en el gremio equivocado.

**Autorización**
- El ámbito se recorta **una vez, en el guard** (`admin.guard.ts:118-145`), no en cada
  consulta. La cabecera `x-gremio` recorta y **nunca amplía**.
- `exigirParticipante` contesta **404 y no 403** para un id de otro convenio, con el motivo
  escrito: un 403 confirmaría que esa persona existe. Se llama en **las 17 rutas con `:id`**
  del CRM; se revisaron una a una y ninguna consulta la ficha sin filtrar.

**Aforo de reservas**
- El candado está en la base, no en un `if`: `FOR UPDATE` + `UPDATE` condicional que decide
  dentro de la propia sentencia (`reservas.service.ts:369-380`).
- **INV-9 se cumple en este dominio**: ningún `await` a un sistema externo dentro de
  `$transaction`. Todo lo caro se resuelve antes de abrirla.
- La cancelación **no borra**: cambia estado y conserva el historial.

**Datos personales**
- `CLASE_POR_CAMPO` es una lista blanca que **falla cerrada**: un campo que no esté no se
  historia, así que añadir un campo al formulario no empieza a copiar datos personales por
  accidente (`clase-de-dato.ts`).
- Los datos de población vulnerable guardan **la constancia del cambio y NUNCA el valor**, con
  el artículo 5 de la Ley 1581 citado en el código.
- El contacto **no sale** por la vista pública de reservas, y está razonado: devolver correo y
  celular a cambio de un NIT convertía la ruta en un directorio de empresas
  (`reservas.service.ts:570-581`).

**Apagar sin borrar — el patrón ya existe en cuatro sitios**
- `politicas.service.ts:179-198` se niega a borrar una política aceptada: *"es la prueba de lo
  que leyó"*.
- `revocarAutorizacion` apaga sin borrar, deja movimiento y auditoría, y **explica por qué la
  etapa no cambia**.
- `ValorAnterior.restauradoEn` con el comentario *"No se borra la fila: deshacer también es un
  cambio"*. **Ese es el molde de la papelera.**
- Y el único índice único parcial del repositorio, `politicas_datos_una_vigente`.

---

## A · Webhook → gestión de leads

**Cómo funciona hoy.** Dos puertas, autenticadas distinto a propósito. La del orquestador
resuelve convenio, normaliza, comprueba idempotencia por `(origenSistema, externoId)`, crea el
`LeadEntrante` y **después** cruza contra el CRM por documento, correo y celular en ese orden.
La de Meta solo guarda avisos, porque Meta no manda datos de la persona.

### 🔴 A-01 · El lead entra y nadie puede verlo

**No existe endpoint de lectura de `leads_entrantes`.** La única lectura en todo el backend es
el banco de pruebas. El único controlador bajo `admin/leads` es `ConversionController`, que
expone `POST :id/convertir` — **y exige un `id` que ninguna API devuelve**.

En Fase 0 lo anoté como "no hay pantalla". Es peor: **tampoco hay endpoint**, así que no es
trabajo de frontend pendiente sino un agujero de backend.

> Cada lead pagado de Meta se cobra, se guarda y se pierde. `POST /admin/leads/:id/convertir`
> está escrito, probado y es **código muerto**.

`INV-7` · prob. ALTA · esfuerzo M

### 🔴 A-03 · El segundo lead de la misma persona revienta con 500

`LeadEntrante.participanteId` es `String? @unique` (`schema.prisma:783`). **Solo un lead puede
apuntar a un participante.** La segunda vez que una persona ya fichada llega por el webhook, el
`update` viola el índice, sale un 500 crudo (no hay `ExceptionFilter`) y el lead **queda
atrapado en PENDIENTE para siempre**.

Y el fallo **se autooculta**: el reintento del emisor entra por la guarda de idempotencia y
devuelve **200 con `repetido: true`**. El emisor cree que quedó bien. Nadie se entera nunca.

> Que la misma persona llene el formulario dos veces es lo normal, no el caso raro.

`INV-5` · prob. ALTA · esfuerzo M

### Los que el refutador rebajó, y por qué

- **A-02** (cruce por correo marca CONVERTIDO contra ficha ajena): CRÍTICO → **ALTO**. El
  auditor decía *"los veinte leads se marcan contra la ficha de la secretaria"*. Imposible: el
  `@unique` de A-03 admite **un solo lead por participante**. Del segundo en adelante revientan
  antes. El fallo es real; el radio es 1, no 20.
- **A-04** (el webhook borra propuestas pendientes): CRÍTICO → **ALTO**. Lo que se destruye es
  la **tarea pendiente**, no el dato: `correo`, `celular` y `nombreCompleto` siguen enteros en
  la fila del lead.
- **A-05, A-07, A-10**: ALTO → **MEDIO**. En A-10 los dos mecanismos alegados eran falsos:
  nginx pone `CF-Connecting-IP` **siempre**, *"pise lo que pise el cliente"*.

---

## B · Estructura de gestión de leads

**Cómo funciona hoy.** Un lead vive como `Participante` con **once etapas**, colgado de una
`Persona` única por cédula. Entra por **cinco puertas**: webhook, preinscripción pública,
enlace `/completar/:token`, alta del panel y cargue masivo.

**El IDOR clásico está cerrado.** Se revisaron las 17 rutas con `:id` y ninguna consulta la
ficha sin filtrar. Los agujeros están un piso más arriba:

- **No hay máquina de estados.** De once etapas, **solo dos reglas prohíben algo**. Y
  `PATCH :id/formacion` mueve a alguien de acción de formación a un CERTIFICADO **sin mirar la
  etapa ni el rol**.
- **Los controles por rol están escritos una vez y aplicados a medias**: el reparto de fichas se
  salta por `PATCH :id`, y el sobrecupo lo firma cualquiera.
- **Ningún control optimista** en las tres puertas de escritura: leen fuera de la transacción.

**Corrección del refutador, y es grave:** el auditor dijo que cierta puerta era *"la única que
escribe datos de persona saltándose el mecanismo"*. Falso — **hay otras dos, y la peor es
pública**: `PATCH /completar/:token`, sin guard, ejecuta `persona.update` sobre nombre,
apellido, correo, celular y fecha de nacimiento.

23 hallazgos, ninguno crítico, 8 altos.

---

## C · Historial de cambios

**El recuento, contado y no estimado: 14 de 71 escrituras de negocio dejan huella. El 80% no.**

### 🔴 C-01 y C-14 · La bitácora solo ve la interfaz

`AuditoriaService` se inyecta en **5 módulos**. Los que escriben fuera de la UI tienen **cero**
referencias: leads (webhook), conversión, reservas, admin, cronograma, políticas. Los workers
tampoco: `matricula.ts:89` hace `participante.update` sin auditar.

Y **no hay ni un trigger en las 43 migraciones**, así que todo depende de que el programador se
acuerde de llamar a `registrar()`. **INV-3 pide justo lo contrario**: que escribir por SQL
directo también deje rastro.

`INV-3` · prob. ALTA · esfuerzo L

### 🔴 C-06 · La bitácora no es inalterable

Cero `REVOKE`, cero `GRANT`, cero RLS en las 43 migraciones. **La aplicación se conecta con el
rol dueño del esquema**, así que puede borrar `registros_auditoria` entera.

`INV-3` · prob. MEDIA · esfuerzo M

### 🔴 C-10 · Borrar un participante se lleva su propio historial

`valores_anteriores.participanteId` es `onDelete: Cascade`. El borrado físico arrastra **el
mecanismo para deshacer cambios**.

`INV-1` · prob. MEDIA · esfuerzo L

> **Lo que sí está bien resuelto:** `ValorAnterior` responde la otra pregunta —qué decía el
> dato— y está bien pensado: lista blanca de 20 campos que falla cerrada, valor nunca guardado
> para datos sensibles, y el histórico se calcula **antes** de escribir y entra en la **misma
> transacción**. O se guardan las dos cosas o ninguna.

---

## D · Papelera

**Hoy no hay papelera.** Un lead sale de la mesa de entrada solo hacia arriba.
`EstadoLeadEntrante.DESCARTADO` existe en el enum y **no lo escribe nadie**.

### 🔴 D-01 · El participante se borra de verdad

`crm.service.ts:1750-1755` borra la fila y **arrastra 8 tablas por cascada**. Además pone a
NULL `leads_entrantes.participanteId` por el `SetNull` de `schema.prisma:789`: **corta la cadena
de INV-7 en silencio**.

**Corrección del refutador:** el auditor dijo *"es el único borrado físico vivo de una entidad
de negocio"*. Falso, y se contradice a sí mismo dos hallazgos después: el censo son **18
borrados vivos**, y al menos cinco son de entidades de negocio distintas.

### 🔴 D-02 · Lo archivado seguiría viajando al SENA

Hay **72 consultas a `participante` en 14 archivos**, y solo cuatro pasan por el constructor de
filtros `donde()`. El resto arma su propio `where` — **incluido el reporte al SEP, que es el
entregable contractual**.

Un `archivadoEn` que solo se aplique en `donde()` dejaría fuera casi todo. Y el refutador añade
dos familias que el auditor no vio: **28 consultas en SQL crudo** contra `"participantes"`, en
cuatro ficheros que ni aparecen en la lista.

> Esto convierte la papelera en un trabajo mucho mayor de lo que parecía. **No es añadir una
> columna: es que no existe un embudo único de lectura.**

---

## E · Calendario y cronograma

**Aclaración conceptual, y responde tu pregunta:** hoy "cronograma" es **una sola cosa**, el
calendario **académico** de los grupos. Son 538 líneas que listan acciones, ponen fechas y
reparten cupos. **No conoce leads, ni asesores, ni citas, ni tareas.**

**La agenda comercial no existe en ninguna parte del repositorio.** No es que esté mal hecha:
no está.

El calendario toca al lead por dos puentes indirectos: `PanelDeCupos` traduce la fecha de
inicio en una ventana de inscripción, y `Matricula` pasa sola a `EN_FORMACION` a quien tenga
cobertura cuyo grupo ya arrancó.

### 🔴 E-01 · El cronograma no registra nada de lo que escribe

Cero referencias a auditoría en todo `backend/src/cronograma/`. `actualizarGrupo` escribe
fechas y horario; `actualizarCupos` escribe cupos. **Nadie sabe quién movió una fecha.**

Y tú fuiste explícito: *"nadie puede modificar fechas de cronograma si no es administrador"*.
El permiso sí se exige — pero **no queda constancia de quién lo hizo**.

### 🔴 E-02 · Reprogramar deja una `fechaMatricula` falsa que sí viaja al SENA

No existe ninguna tabla de reprogramaciones. `Grupo` solo tiene `actualizadoEn`, que dice que
cambió pero no qué. Y si un grupo se reprograma después de que `Matricula` marcara a alguien,
**la fecha de matrícula queda mal y sale en el `.xlsx` del SEP**.

**Un hallazgo que el refutador SUBIÓ:** E-09, de MEDIO a **ALTO**, y de probabilidad BAJA a
**ALTA**. El auditor creía que hacía falta concurrencia; el refutador demostró que **el techo de
la cobertura se rebasa sin concurrencia ninguna**, por dos rutas de admin que no había abierto.

**Dos remediaciones retiradas por romper cosas vivas:** una habría **matado la lista de
espera**, que es deliberada.

---

## F · Reservas

**Cómo funciona hoy.** `POST /reservas` sin guard, con throttle 10/min. Valida oferta abierta y
acción visible, resuelve la empresa y la política **fuera** de la transacción, y dentro toma
`FOR UPDATE`, reparte `cuposSolicitados` entre confirmados y espera, y mueve el contador.

La reserva **no** crea participante, **no** toca el lead, **no** manda correo y **no** escribe
en la bitácora.

### 🔴 F-01 · No existe hold con TTL: un cupo confirmado se retiene para siempre

El enum solo tiene `CONFIRMADA / LISTA_ESPERA / CANCELADA`. **No hay `SOLICITADA` ni
`EXPIRADA`**, ni columna de vencimiento, ni job que libere.

> Una empresa reserva 20 cupos "por si acaso" y no vuelve. Esos 20 cupos no se liberan nunca.
> Los cupos se secan con reservas fantasma.

`INV-4` · prob. ALTA · esfuerzo L

### 🔴 F-02 · Cancelar lee la reserva ANTES de tomar el candado

En `cancelar()`, la reserva se lee en la línea 229 **sin `FOR UPDATE`**, y el candado no se toma
hasta la 234. La guarda de idempotencia opera sobre una lectura ya obsoleta: **dos
cancelaciones a la vez devuelven el cupo dos veces**.

`INV-4` · prob. MEDIA · esfuerzo M

**Corrección del refutador, importante para la remediación:** la plantilla de cargue masivo
tiene **cinco columnas escribibles, no una**. Además de `cuposSolicitados`, pisa
`contactoNombre`, `contactoCargo`, `contactoCorreo` y `contactoCelular` — o sea, **también
datos de contacto**.

---

## G · Control de cupos

**Hay dos aforos sobre las mismas sillas, y el código lo sabe.**

**La capa de reservas cumple INV-4** mientras los únicos escritores sean `crear`, `editar` y
`cancelar`. Pero **no son los únicos**.

### 🔴 G-01 · El cuarto camino, y el refutador lo agravó

`TablerosService.cancelarReserva` toma el candado **y no lo usa**: decide con la fila leída
fuera de la transacción y decrementa sin condición.

**Y el refutador encontró que es peor:** el defecto **no es exclusivo del tablero**. En
`editar`, la reserva se lee con un `findUnique` pelado sin `FOR UPDATE`, y el candado se toma
después. **Dos de los tres caminos "buenos" tienen el mismo fallo.**

> Esto reencuadra la remediación: hay que tocar `reservas.service.ts`, no solo el tablero.

### 🔴 G-03 · `asignar()` mueve gente sin candado y sin mirar el cupo del grupo

Cuenta las sillas **fuera de toda transacción**, compara contra `oferta.cuposMaximos` leído
también fuera, y **no mide la cobertura en absoluto**. Es el escritor de aforo más expuesto del
sistema.

`INV-4` · prob. ALTA para la rama de cobertura (**fallo determinista**, no carrera) · esfuerzo M

**Y el hueco estructural:** los cinco CHECK acotan `0..cuposMaximos` pero **jamás atan el
contador a `SUM(cuposConfirmados)`**. Ahí es donde INV-4 se escapa.

**Remediación retirada por el refutador:** el auditor proponía un CHECK duro
`sillasOcupadas <= cuposMaximos`. **Eso mataría el sobrecupo autorizado**, que es una
funcionalidad deliberada y modelada (`Participante.sobrecupoPorId`/`sobrecupoMotivo`, con su
propio CHECK de coherencia).

---

## HALLAZGOS CRÍTICOS

Los 14 que sobrevivieron al contraste, por dominio:

| Id | Qué | INV | Prob. | Esf. |
|---|---|---|---|---|
| **A-01** | El lead entra y no existe endpoint para verlo | 7 | ALTA | M |
| **A-03** | El segundo lead de la misma persona da 500 y queda atrapado | 5 | ALTA | M |
| **C-01** | La bitácora solo ve la UI: workers y webhook no dejan rastro | 3 | ALTA | L |
| **C-06** | La bitácora es borrable: la app es dueña de la tabla | 3 | MEDIA | M |
| **C-10** | Borrar un participante se lleva su historial por cascada | 1 | MEDIA | L |
| **C-14** | 14 de 71 escrituras auditan. El 80% no | 3 | ALTA | L |
| **D-01** | El participante se borra de verdad y arrastra 8 tablas | 1,2,3 | MEDIA | L |
| **D-02** | Sin embudo único, lo archivado seguiría viajando al SENA | 2 | ALTA | L |
| **E-01** | El cronograma no registra quién movió una fecha | 3 | ALTA | M |
| **E-02** | Reprogramar deja una `fechaMatricula` falsa que va al SEP | 3 | MEDIA | L |
| **F-01** | Sin hold con TTL: el cupo se retiene para siempre | 4 | ALTA | L |
| **F-02** | Cancelar lee antes del candado: fuga de cupos | 4 | MEDIA | M |
| **G-01** | Cuarto camino al contador, y dos de los tres "buenos" fallan igual | 4 | MEDIA | M |
| **G-03** | `asignar()` sin candado y sin mirar el cupo del grupo | 4 | ALTA | M |

**Concentración por invariante:** INV-3 (auditoría) tiene 4 críticos; INV-4 (sobrecupo) tiene 4;
INV-1/INV-2 (no perder, papelera) tienen 3.

---

## SUPUESTOS

1. **`SUPUESTO`: nadie usa hoy `POST /admin/leads/:id/convertir`.** No hay forma de obtener el
   `id`, así que o no se usa, o alguien lo llama desde fuera con ids sacados de la base.
   *Comprobable con la consulta de `registros_auditoria`.*
2. **`SUPUESTO`: la agenda comercial se lleva fuera del sistema** (WhatsApp, un Excel, la
   cabeza del asesor). No hay nada en el repo. *Necesito saber cómo se hace hoy para no diseñar
   contra el aire.*
3. **`SUPUESTO`: el sobrecupo autorizado se usa de verdad.** Está modelado con su CHECK de
   coherencia, y por eso el refutador vetó el CHECK duro de cupos. *Si en la práctica no se
   usa, la remediación de G-05 se simplifica mucho.*
4. **`SUPUESTO`: las once etapas están todas en uso.** Si algunas son historia, la máquina de
   estados de Fase 2 se puede simplificar.

---

## SIGUIENTE PASO

**Fase 2 — arquitectura objetivo.** Es la primera que toca diseño, y necesita tu aprobación
explícita.

Lo que entregaría:

1. Diagrama de contexto y flujo end-to-end.
2. ER objetivo + `schema.prisma` propuesto, con campos de auditoría estándar e índices únicos
   **parciales**.
3. **Las cuatro máquinas de estado** (Lead, Reserva, Inscripción, Evento de agenda) como tabla
   de transiciones + guardias + efectos.
4. Contratos de API con errores tipados e idempotency-key.
5. Los patrones transversales: outbox, auditoría por trigger, soft-delete uniforme, bloqueo.
6. Matriz de permisos rol × entidad × acción.
7. **Los ADRs** — mínimo siete.

**Lo que propongo priorizar dentro de Fase 2**, por lo que salió aquí:

- **La auditoría por trigger va primero.** Cuatro críticos dependen de ella, y sin ella
  cualquier otra cosa que hagamos tampoco dejará rastro.
- **El embudo único de lectura antes que la papelera.** D-02 demuestra que sin él la papelera no
  funciona: 72 consultas se la saltarían.
- **G-01 y G-03 juntos**, porque comparten causa: leer fuera del candado.

**Sigo sin tocar código de producción.** Todo lo de Fase 0 y Fase 1 vive en `docs/` y
`.claude/`.
