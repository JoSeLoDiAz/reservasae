# Respuesta a José · lo que confirma el código

Cuatro afirmaciones suyas, contrastadas una a una contra el repositorio. **Las cuatro salen
`CIERTO CON MATIZ`** — acierta en el mecanismo y hay cosas que da por hechas y no son así.

Lo digo de entrada porque importa: **el trabajo que describe está bien hecho**. Los matices no
son correcciones a su código, son cosas que nadie había mirado.

---

## 1 · El catálogo sale del Excel — CIERTO, y los cuatro números cuadran exactos

Conté el `catalogo.json` recorriéndolo, no leyendo el resumen del script:

| | Acciones | Grupos | Ofertas | Cupos |
|---|---|---|---|---|
| britcham-adee | 8 | 39 | 68 | 2.717 |
| adecopria | 7 | 28 | 38 | 2.080 |
| **TOTAL** | **15** | **67** | **106** | **4.797** |

**Los cuatro coinciden con lo que dice.** La cadena existe completa:
`docs/proyectos/*.xlsx` → `scripts/extraer-catalogo.py` → `backend/prisma/seed/catalogo.json`
→ `seed/index.ts` → base.

### ⚠️ Pero el 4.797 no es lo comprometido con el SENA

Y esto importa porque él mismo dice que *"el Excel es la fuente de verdad contractual con el
SENA"*.

```
extraer-catalogo.py:14    SOBRECUPO = 0.30
extraer-catalogo.py:51-73 repartir_sobrecupo()
```

**La base de los `.xlsx` es 3.690.** El script le suma el 30% deliberado y sale 4.797. La
diferencia son **1.107 cupos que son sobrecupo autorizado, no oferta contractual**.

> Si alguien lee 4.797 como *"lo que le prometimos al SENA"*, se equivoca por 1.107.

### Tres matices más

- **"Pasan por un script" suena automático y no lo es.** Nadie invoca `extraer-catalogo.py`: no
  hay CI, ni npm script, ni hook. `CLAUDE.md:3175` dice literal *"a mano, cuando cambien los
  proyectos"*. Hoy están sincronizados (mismo commit `17b494b`), pero **nada lo vigila**.
- **Y ahora mismo ese script no corre**: `openpyxl` no está instalado ni declarado en ningún
  sitio — no hay `requirements.txt` ni `pyproject.toml`. Quien tenga que regenerar el catálogo
  se topa con un `ModuleNotFoundError` y una dependencia que no está escrita en ninguna parte.
- **`catalogo.json` no es la verdad final.** Hay un parche en código entre medias:
  `seed/index.ts:111-116` pisa el NIT de ADECOPRIA porque **el proyecto oficial lo trae mal**.
  El comentario explica que vive ahí y no en el JSON precisamente porque regenerarlo borraría la
  corrección sin avisar.

Y las **106 ofertas** son un número derivado: en el JSON hay **114 coberturas**, y
`construir_ofertas` colapsa 8 agrupando por (ubicación, tipo). Contar ofertas y contar
coberturas da números distintos, y los dos son "del archivo".

---

## 2 · El sobrecupo ya está construido — CIERTO

Confirmado hasta el detalle:

```sql
-- migrations/20260814140000_crm_personas_y_participantes/migration.sql:222-225
-- «un sobrecupo sin motivo no es una autorización»
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_sobrecupo_justificado"
  CHECK (("sobrecupoPorId" IS NULL) = ("sobrecupoMotivo" IS NULL));
```

La fecha cuadra —14 de agosto—, está en la **base** y no en el código, y **ninguna migración
posterior lo elimina**: `grep "DROP CONSTRAINT"` sobre las 43 migraciones da cero.

Tiene razón también en lo de la pantalla: los dos únicos escritores están en `crm.service.ts`
(`crear` y `asignar`), y **no hay interfaz para autorizarlo cómodamente**. Falta la pantalla, no
la regla.

### El matiz: el CHECK es cierto, pero no garantiza lo que él cree

Su frase es *"es imposible guardar un sobrecupo sin decir quién lo autorizó y por qué"*. Eso es
verdad. **Pero la frase que se deduce —"es imposible meter a alguien de más sin dejar
constancia"— no lo es**, porque hay caminos que meten gente por encima del cupo **sin tocar esos
dos campos**, y entonces el CHECK ni se entera:

- **`POST /preinscripcion/:slug`** — público, sin guard, **cero comprobación de cupo**.
- **El cargue masivo de reservas** — escribe en un `for` sin candado.
- **`asignar()`** — no mide la cobertura.

El CHECK protege el **sobrecupo declarado**. No protege del **sobrecupo accidental**, que es el
que nadie firma porque nadie sabe que ocurrió.

### Y un efecto secundario que conviene conocer

`sobrecupoPorId` tiene `onDelete: SetNull`. Si se desactivara al admin que autorizó, quedaría
`(NULL, 'motivo')` — que **viola el CHECK** y haría fallar la operación. No es un fallo, pero
está sin documentar.

---

## 3 · Las tres distinciones — SÍ, las vemos igual

**Confirmado: son tres cosas distintas.** Tocan tres entidades y tres puertas HTTP diferentes,
no se solapan, y ningún arreglo de una cubre a las otras.

**(b) El candado de aforo (`4bc6995`) — tiene toda la razón y se queda.** Es TOCTOU, no regla de
negocio. Convirtió la escritura de `$transaction([array])` a interactiva, y dentro toma
`FOR UPDATE` sobre la oferta y **recuenta las sillas excluyéndose a sí mismo**. No cambió ni una
condición de admisión: solo cerró la ventana entre mirar y escribir. La regla de negocio sigue
siendo `exigirQueQuepa`, que corre antes y da los mensajes buenos.

**(a) Bloquear un grupo a mano — abierto**, como dice Josse.

### ⚠️ (c) La oferta cerrada (`d3c61d1`): la premisa es medio falsa

El mensaje del commit dice que `abierta` se leía *"cuatro veces, las cuatro en un `select`,
ninguna en un `where`"* y *"únicamente para pintarlo en pantalla, nunca para bloquear"*.

**Literalmente cierto sobre la forma de las consultas Prisma. Prácticamente falso.**

`panel-de-cupos.ts:147-149` **ya hacía** `if (!oferta.abierta) { motivo = 'OFERTA_CERRADA' }`,
eso alimenta `admiteInscripciones`, y `exigirQueQuepa` lanzaba sobre él. La comprobación no
estaba en un `where` de Prisma: estaba en un `if` de TypeScript aguas abajo, **y bloqueaba de
verdad**. La había puesto `69904e5` cuatro días antes.

Así que *"se cerraba al público y se seguía metiendo gente por dentro"* **no era cierto para
inscribir** (`PATCH :id/etapa`), que ya se negaba.

**El commit se queda igual** — cerrar el hueco en el `where` es correcto y más robusto que
depender de un `if` aguas abajo. Solo conviene que la historia quede bien contada.

**Y el apunte que sigue en pie:** Fase 0 no encontró **ninguna ruta de escritura para
`Oferta.abierta`**. Si no se puede cerrar una oferta desde la aplicación, el arreglo protege
contra algo que nadie puede provocar todavía.

---

## 4 · Académico y el 80% — CIERTO en el esquema y en la regla

**El enum es exacto**, los siete valores en ese orden (`schema.prisma:510-518`). `obligatoria`
existe, es `Boolean @default(true)`, y su comentario dice literal *"cuenta para el porcentaje de
avance"*.

**Y el 80% no lo da por hecho: está escrito, en tres sitios.**

```ts
// crm.service.ts:196
export const MINIMO_PARA_CERTIFICAR = 0.8;   // «Lo que hay que aprobar para poder certificar»
```

Con la compuerta dura en `cambiarEtapa`, y bien construida: el numerador repite las tres
condiciones del denominador, con un comentario que explica el fallo real que corrigieron —quien
aprobó 10/10 en una acción y se reasignaba a otra se certificaba con 10/12 sin tocar la nueva.

José tampoco mencionó un segundo enum que es el que de verdad mueve el 80%:
`EstadoAvance { EN_CURSO, ENTREGADA, APROBADA, NO_APROBADA }`.

### ⚠️ El matiz: acierta en todo menos en el verbo

Dice *"lo presencial **se puede llevar** desde el CRM ya"*. **No se puede llevar. Solo se puede
leer.**

**No hay una sola ruta ni pantalla que cree una `Actividad` ni que marque un `AvanceActividad`.**
Cero `@Post` de actividades en los 19 controladores. Lo único que llena esas tablas es la
siembra de prueba.

**Y eso convierte la compuerta en un muro.** Con la base real, `obligatorias` da 0 y
`cambiarEtapa` lanza:

> *"Esta acción de formación no tiene actividades obligatorias cargadas: no hay contra qué medir
> si terminó"*

**Hoy no se puede certificar a nadie por la vía normal. Y certificar es lo que paga el SENA.**

No falta la regla: **faltan los datos**. Por eso el LMS deja de ser una mejora y pasa a ser el
desbloqueo de Gestión Académica entera.

---

## Y dos cosas que le debo a él

Verificadas por mí, no por agentes.

**1. El `firme` del cruce se calcula y nadie lo lee.** Su descripción del diseño es exacta —va de
la llave más firme a la más floja, y lo que encuentra el correo debería quedar como propuesta—.
**Ese diseño está escrito en el código**: `firme: true` para documento, `false` para correo y
celular. Pero `grep "firme"` sobre todo `leads/` solo lo encuentra dentro de
`cruzar-con-el-crm.ts`. `leads.service.ts:155` llama a `avisarQueYaEstaba` con cualquier
coincidencia, y ahí se escribe `estado: 'CONVERTIDO'` y `participanteId` **sin mirarla**.

La propuesta sí se crea. Pero **el lead ya quedó atado a la ficha**: no espera confirmación.

Es media hora de trabajo — ramificar por `firme`. El diseño ya está pensado, solo falta
cablearlo.

**2. La preinscripción pública no normaliza el documento.** Dice que no hay pantalla de fusionar
duplicados porque el `@unique` los hace imposibles. La garantía es real **por el panel**, pero
`preinscripcion.service.ts:236` hace solo `.trim()` — ni el DTO ni el servicio llaman a
`normalizarDocumento`. Quien teclea `1.020.304.050` en la preinscripción pública crea una
`Persona` **distinta** de la que crearía el panel.

Es la puerta que más gente usa, y es donde más se teclea con puntos.

---

Ver [`00-mapa-actual.md`](00-mapa-actual.md), [`01-auditoria.md`](01-auditoria.md) y los dos
borradores en [`borradores/`](borradores/).
