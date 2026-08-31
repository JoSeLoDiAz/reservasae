# BORRADOR · La llave de identidad y el contrato con el LMS

> **Esto es un borrador.** No hay código escrito ni migración creada. Sirve para acordar el
> contrato **antes** de que exista la API del LMS, porque la llave de identidad es la decisión
> que más cuesta cambiar después: de ella cuelga cómo se casan los dos sistemas, y cambiarla
> más tarde significa revisar ficha por ficha.
>
> **Decidido por el dueño del proyecto el 2026-08-31:** la llave es el documento, la conexión
> será por API, y el LMS es de **solo seguimiento** — nunca crea participantes ni toca cupos.

---

## 1 · La llave: el par, no el número

La llave de identidad de una persona en reservasae es:

```
(tipoDocumentoSepId, numeroDocumento)
```

**No el número suelto.** El catálogo del SEP tiene varios tipos —cédula, tarjeta de identidad,
cédula de extranjería, PEP, pasaporte— y dos personas distintas pueden compartir número con
tipos distintos. Es raro; cuando pasa, mezclas a dos seres humanos y no hay forma limpia de
deshacerlo.

**Buena noticia: ya está así.** `Persona` tiene la clave compuesta
`tipoDocumentoSepId_numeroDocumento`, y los dos creadores de personas la usan como clave de
`upsert`. No hay que migrar nada para esto.

---

## 2 · El blindaje: qué está hecho y qué falta

Aquí está lo importante, porque **el blindaje está a medias y el hueco es de hoy, no del LMS**.

### Lo que ya existe y funciona

`backend/src/comun/documento.ts:7` tiene el normalizador, y hace exactamente lo que hace falta:

```ts
/// Sin puntos, sin espacios y en mayúsculas: la unicidad
/// depende de que "1.019.456.782" y "1019456782" sean uno.
export function normalizarDocumento(valor: string): string | null {
  const limpio = valor.replace(/[\s.\-_]/g, '').trim().toUpperCase();
  if (!limpio) return null;
  if (!/^[A-Z0-9]{4,20}$/.test(limpio)) return null;
  return limpio;
}
```

Y hay una segunda función, `documentoValido(tipoSepId, numero)`, que valida **según el tipo**:
solo dígitos si el tipo es numérico, alfanumérico si es pasaporte o PEP.

Lo llaman cinco sitios: el cargue masivo, el alta del panel, la búsqueda, la conversión de lead
y el webhook.

### El hueco, confirmado

**`preinscripcion.service.ts:236` no lo llama.**

```ts
const documento = dto.numeroDocumento.trim();   // ← solo recorta espacios
```

Y el DTO tampoco: solo lleva `@Transform(recortar)`, que es el mismo `trim`.

Así que **la ruta pública de preinscripción crea personas con el documento tal como se teclea**.
Consecuencia, hoy, sin que intervenga ningún LMS:

| Por dónde entra | Teclea | Se guarda como |
|---|---|---|
| Panel de admin | `1.020.304.050` | `1020304050` |
| **Preinscripción pública** | `1.020.304.050` | `1.020.304.050` |

**Son dos `Persona` distintas para el mismo ser humano.** El `@@unique` no las detecta porque
las cadenas difieren. Y como la preinscripción es la puerta que más gente usa —se inscribe
sola, sin asesor delante—, es justo donde más se teclea con puntos.

### Cómo se blinda de verdad

El problema de fondo no es que falte una llamada: es que **cualquier puerta nueva puede
olvidarla otra vez**. Tres capas, de fuera adentro:

**Capa 1 · La frontera.** Que ninguna ruta reciba un documento sin normalizar. La forma que ya
usa la casa es un `@Transform` en el DTO, igual que `recortar`:

```ts
@Transform(({ value }) => normalizarDocumento(String(value ?? '')) ?? value)
@IsString() @IsNotEmpty() @MaxLength(30)
numeroDocumento!: string;
```

Ponerlo en el DTO y no en cada servicio significa que **una ruta nueva lo hereda sin
acordarse**. Es la diferencia entre una convención y una garantía.

**Capa 2 · Una sola puerta de escritura.** Que `Persona` no se cree ni se actualice desde cinco
sitios distintos, sino desde una función —`resolverPersona(tipo, numero, datos)`— que normaliza
y hace el `upsert`. Hoy hay dos creadores y **cada uno normaliza distinto**; ahí es donde entra
la divergencia.

**Capa 3 · La base, que es la única que no se olvida.** Un `CHECK` que rechace lo que no esté
normalizado:

```sql
ALTER TABLE "personas"
  ADD CONSTRAINT "personas_documento_normalizado"
  CHECK ("numeroDocumento" ~ '^[A-Z0-9]{4,20}$');
```

Con esto, una fila con puntos **no entra**, venga por donde venga: por una ruta nueva, por un
guion suelto, por un `psql` a mano. Es el mismo razonamiento que ya se usó con los 17 CHECK de
cupos.

> ⚠️ **Antes de poner ese CHECK hay que limpiar lo que ya está.** Si hay filas con puntos, la
> migración falla al aplicarse — y las migraciones corren solas en cada arranque del contenedor
> (`arrancar.sh:29`), así que fallaría el despliegue entero. El orden correcto es
> **expand → migrate → contract**:
> 1. Contar cuántas filas no cumplen el patrón (consulta de solo lectura).
> 2. Normalizarlas, **fusionando a mano** las que colisionen — porque dos filas pueden pasar a
>    ser la misma persona, y eso lo decide un humano, no un `UPDATE`.
> 3. Solo entonces, añadir el CHECK.

---

## 3 · Idempotencia — y otra buena noticia

**Ya está resuelta en el esquema.** `AvanceActividad` tiene:

```prisma
@@unique([participanteId, actividadId])
```

Eso significa que de un participante, en una actividad, **solo puede haber una fila**. Si el
LMS nos manda el mismo avance dos veces —porque se cortó la llamada, porque alguien pulsó dos
veces, porque el servidor se reinició a mitad—, el segundo intento **actualiza la que ya
existe** en vez de crear otra.

Sin eso, Juan aparecería con la actividad 3 terminada dos veces, y si el avance se calcula
sumando, con 200% de progreso — que acabaría en el informe del SENA.

**Lo que la garantía cubre y lo que no:**

| Cubierto | No cubierto |
|---|---|
| El mismo avance recibido N veces → una fila | Que el LMS mande **datos contradictorios** en dos envíos |
| Reintento tras un corte de red | Saber **cuál de los dos** es el bueno |

Para lo segundo hace falta que el LMS mande **cuándo ocurrió el avance** (no cuándo nos lo
cuenta), y que solo se acepte si es más reciente que lo guardado. Eso sí hay que acordarlo.

Y el patrón está probado en la casa: el webhook de Meta usa `@@unique(origenSistema, externoId)`
y por eso Meta puede reintentar cincuenta veces sin duplicar nada.

---

## 4 · Lo que hay que acordar con el LMS

**Esta es la parte que hay que cerrar antes de escribir una línea de la integración.** Si no se
acuerda, el fallo se manifiesta como *"el LMS no encuentra a nadie"*, que despista muchísimo:
parece un problema de conexión y es de formato.

### 4.1 · El documento

| Punto | Lo que pedimos | Por qué |
|---|---|---|
| Formato del número | **Solo dígitos o letras. Sin puntos, guiones, espacios ni comas** | `1.020.304.050` y `1020304050` no casan |
| Mayúsculas | En mayúsculas para pasaporte y PEP | `ab12345` ≠ `AB12345` |
| Ceros a la izquierda | **Que se conserven, y que viaje como texto, nunca como número** | Excel y JSON convierten `0012345` en `12345` y se pierde la ficha |
| Tipo de documento | Un **código acordado**, no el nombre | "Cédula", "CC" y "Cedula de ciudadanía" son la misma cosa escrita de tres formas |

**El mapa de tipos hay que escribirlo, columna a columna**, entre los códigos del LMS y los
`tipoDocumentoSepId` del catálogo del SEP. No se puede inferir por el nombre.

> **Y aunque el LMS cumpla, normalizamos igual al recibir.** No por desconfianza: porque un
> contrato que solo se cumple si la otra parte se porta bien no es una garantía. Es la misma
> razón por la que nginx pone `CF-Connecting-IP` *"siempre, pise lo que pise el cliente"*.

### 4.2 · Qué pedimos y qué devolvemos

Como el LMS es **de solo seguimiento**, el contrato es corto:

**Lo que necesitamos de él, por alumno:**
- tipo y número de documento (la llave)
- identificador del curso en el LMS, y cómo se casa con nuestra `AccionFormacion`
- por actividad: si está terminada, cuándo, y la nota si la hay
- **la fecha en que ocurrió**, no la fecha en que nos lo cuenta

**Lo que NO debe poder hacer nunca:**
- crear un participante que no exista aquí
- cambiar la etapa de nadie
- tocar cupos, ofertas o grupos

### 4.3 · Qué pasa cuando un alumno no casa

Va a pasar: alguien se matriculó en el LMS y no está en reservasae, o al revés.

**La regla es que nunca se crea nada.** Se apunta en una lista de "no casan" que alguien revisa,
con el documento, el curso y el motivo. Crear la ficha automáticamente convertiría el LMS en
una puerta de alta de personas, que es justo lo que dijiste que no debe ser.

### 4.4 · El ritmo

Como llamamos nosotros, mandamos sobre el ritmo — eso es bueno, no nos pueden inundar. Pero
hace falta algo que llame cada cierto tiempo, y ahí un aviso que sale de la Fase 0:

> **El reloj del LMS no debe nacer con el defecto de los que ya hay.** `Matricula` y
> `VigiaDeCupos` arrancan **siempre y sin interruptor**, y por eso se duplican en la ventana de
> split-brain entre sedes. El del LMS lleva su variable de entorno, como los tres workers que sí
> la tienen (`LMS_WORKER`), y **no arranca en una réplica**.

---

## 5 · Lo que falta decidir, y no lo puedo decidir yo

1. **¿Qué LMS es?** Todo lo de arriba vale para cualquiera, pero el mapa de tipos de documento y
   la forma concreta de la API dependen de cuál sea.
2. **¿Cómo se casa un curso del LMS con una `AccionFormacion`?** Con la llave de la persona no
   basta: hace falta saber *de qué curso* es el avance. ¿Un código que pongamos nosotros en el
   LMS? ¿Uno que él nos dé?
3. **¿Qué es "terminado"?** ¿Un porcentaje, una nota mínima, una marca del LMS? De esto depende
   qué se le reporta al SENA.
4. **¿Cada cuánto?** Una vez al día es probablemente suficiente para un avance académico, y
   mucho más barato que cada hora. Pero depende de con qué frecuencia se mira.

---

## Lo que este borrador NO es

- **No es un diseño de la integración.** Es el contrato de identidad y el acuerdo de formato,
  que es lo que hay que cerrar primero.
- **No hay migración escrita.** El CHECK de la capa 3 necesita antes contar y limpiar lo que
  hay, y eso solo se puede hacer contra la base real.
- **No toca código.** Todo lo de aquí está por aprobar.

Relacionado: [`00-mapa-actual.md`](../00-mapa-actual.md) ·
[`01-auditoria.md`](../01-auditoria.md) — dominios B (identidad y duplicados) y C (historial).
