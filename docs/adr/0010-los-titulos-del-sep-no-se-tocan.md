# 0010 · Los títulos de los formatos SEP no se tocan

- **Estado:** aceptado (recoge por escrito un contrato ya fijado con pruebas)
- **Fecha:** 2026-08-31
- **Relacionado:** 0001 (el embudo tiene que alcanzar al SEP)

## Contexto

El reporte al SEP es **el entregable contractual con el SENA**.

Tres formatos, y sus títulos están **fijados con `toEqual`** en
`backend/src/crm/sep/formatos.spec.ts`:

- el de uso directo, 27 columnas — `:97`
- el de cargue al SEP, 54 columnas — `:112`
- el F7 de empresas, 18 columnas — `:153`

Las pruebas fijan hasta las rarezas del cliente, y a propósito. Son **tres**:

- *«conserva el espacio final de «Estrato socio-económico »»* (`:100-103`)
- *«conserva el espacio delante de la persona de contacto»* (`:156-158`)
- *«conserva el doble espacio de "DE LA  EMPRESA"»* (`:160-162`)

Esas tres pruebas existen porque los espacios **parecen erratas** y alguien iba a
"arreglarlos".

**El módulo es de solo lectura.**
`grep -rnE "\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(" backend/src/crm/sep/`
(excluyendo specs) → **cero**.

**Quién viaja lo decide otra cosa, y está bien separado.** `ETAPAS_DEL_REPORTE`
(`backend/src/crm/etapas.ts:45`) se deriva de `OCUPAN_SILLA` con el motivo escrito
(`:36-44`):

> *Hoy son los mismos que ocupan silla, y por eso esta lista se deriva de la otra en vez de
> repetirla. Pero son **DOS preguntas distintas** y conviene tenerlas separadas: «¿consumió
> el aula?» no es «¿se le reporta?». Quien curse y no apruebe consumió la silla; si además
> hay que reportarlo, **aquí es donde se añade, sin tocar los cupos**.*

Con una trampa, y hay que citarla en el sitio exacto: `ETAPAS_DEL_REPORTE` se usa **tres
veces** en `backend/src/crm/sep/sep.service.ts`. Dos están dentro de `preparar` (`:347`),
que arma el cargue: `:376` y `:434`. Pero la tercera, `:188`, está dentro de `prepararF7`
(`:161`) y es la que decide **qué personas cuentan como beneficiarias de cada empresa en el
F7**. Tocar la lista mueve el cargue **y** el F7, con su conteo de beneficiarios.

**Y una corrección al análisis anterior, que importa.** Se dijo que el formato de cargue no
tiene ninguna columna de estado. **Sí la tiene:** `'ESTADO'` es la última columna de
`COLUMNAS` en `backend/src/crm/sep/formato-cargue-sep.ts:81`, está fijada en
`formatos.spec.ts:92`, y `fila()` la escribe hoy con **una constante**:
`estado: 'ACTIVO'` (`formato-cargue-sep.ts:171`).

Eso disuelve el falso dilema. No hay que elegir entre romper el contrato y mandar a un
retirado indistinguible de un activo.

## Decisión

1. **Los títulos, su orden y sus espacios son el contrato con el SENA. No se corrigen, no se
   normalizan y no se "limpian".** Ni el espacio final de «Estrato socio-económico », ni el
   espacio delante de la persona de contacto, ni el doble espacio de «DE LA  EMPRESA».

2. **Añadir información al reporte se hace por el CONTENIDO, no por el encabezado.**

3. **En concreto: reportar a un retirado se hace calculando `estado`**, que hoy es la
   constante `'ACTIVO'` en `formato-cargue-sep.ts:171`. Ninguna columna nueva, ningún título
   tocado, ninguna prueba rota: `formatos.spec.ts:112` fija los títulos, no los valores.

4. **Cambiar QUIÉN viaja se hace en `backend/src/crm/etapas.ts`, no en el formato.** Y quien
   lo cambie mira antes `backend/src/crm/sep/sep.service.ts:188`, porque la misma lista
   decide qué empresas salen en el F7 y con cuántos beneficiarios.

5. **`backend/src/crm/sep/` se queda de solo lectura.** Ninguna escritura de Prisma. Genera
   un entregable; no cambia el estado del mundo.

6. **El embudo del ADR 0001 tiene que alcanzar al SEP.** Es la consulta que más importa y hoy
   arma su propio `where` (D-02). Sin eso, lo archivado sigue viajando al SENA.

## Alternativas evaluadas

**Añadir una columna al cargue para la etapa de salida.** Descartada. Rompe el `toEqual` de
`formatos.spec.ts:112` y, sobre todo, rompe el contrato con el cliente. Y es **innecesaria**:
la columna `ESTADO` ya existe y ya viaja.

**Normalizar los títulos, quitando los espacios raros.** Descartada. Son del formato del
cliente y hay **tres pruebas escritas exactamente para que nadie los quite**
(`formatos.spec.ts:100-103`, `:156-158`, `:160-162`). Si parecen un error, léase la prueba.

**Mandar al retirado indistinguible de un inscrito activo.** Descartada. Es lo que pasa
**hoy**, con `'ACTIVO'` fijo, y es peor que la ausencia: es una fila que le dice al SENA que
sigue matriculado alguien que se fue.

**Excluir al retirado del reporte, sin más.** Descartada sin consultar. Quitar filas de un
entregable contractual no es una decisión de arquitectura. Y `ETAPAS_DEL_REPORTE` mueve a la
vez el conteo de beneficiarios del F7 (`sep.service.ts:188`), así que el efecto es mayor de
lo que parece.

**Generar el `.xlsx` desde una plantilla que suba el cliente.** Descartada. Convierte un
contrato verificable con pruebas en un archivo que nadie valida, y el fallo aparecería en la
entrega, no en el repositorio.

## Consecuencias

**Lo bueno.** El entregable no se rompe por una mejora cosmética. Y hay sitio para reportar
las salidas **sin tocar el contrato**, que es lo que dos diseños anteriores dieron por
imposible.

**Lo malo, y lo aceptamos.** Los títulos con espacios raros seguirán pareciendo erratas, y
alguien volverá a intentar arreglarlos — por eso están las pruebas y por eso está este ADR.
Y el `.xlsx` sigue llevando cédulas en claro, que es otro problema y merece su propio ADR.

> **DECISIÓN ABIERTA.** Calcular `estado` obliga a acordar con el SENA **qué palabra
> corresponde a cada salida** (`RETIRADO`, `DESERTO`, `ABANDONO`, `NO_APROBO`). Eso no está
> acordado, y hasta que lo esté el punto 3 no se puede implementar: escribir una palabra
> inventada en el entregable contractual es peor que la constante que hay hoy.

---
