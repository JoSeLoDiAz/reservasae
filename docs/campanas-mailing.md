# Campaña Mailing

> Para quien vaya a tocar este módulo. Lo que hace, por qué está
> hecho así, y las tres o cuatro cosas que si se cambian sin saber,
> se cae la cuenta de correo de la oficina.

## Qué es

Mandar un mismo correo a mucha gente sin que Google suspenda
`proyectosena@grupo-ae.com.co`, y poder decir después quién lo abrió
y quién pulsó.

Tres pantallas, bajo **Campaña Mailing**:

| | |
|---|---|
| **Campañas** | Se arma, se ve a cuántos va, se lanza, se pausa, se mira el informe |
| **Plantillas** | Lo que se escribe una vez y se manda muchas |
| **Cuenta de correo** | El SMTP desde el que sale |

## Lo que cambió tras la auditoría (agosto 2026)

Cinco cosas de este módulo salieron mal en la auditoría. Están
arregladas, pero conviene saber qué eran para no reintroducirlas.

**El ámbito es obligatorio para llegar a una campaña.** De once rutas,
solo `listar` comprobaba el gremio. Con una sesión de ADECOPRIA se
podía crear una campaña con el `convenioId` de BRITCHAM y lanzarla
—correos de verdad a sus ciudadanos—, y `destinatarios` devolvía su
lista entera de correos consultando por `campanaId` a secas.

`exigir(id, ambito)` ahora **pide el ámbito en su firma**: una ruta
nueva que se olvide de pasarlo no compila. Es a propósito, y por favor
no lo quite para «simplificar». Y una campaña ajena responde igual que
una que no existe: decir «no tiene permiso» confirmaría que ese id es
real.

**Revocar la autorización detiene el envío.** `revocadaEn` no se
miraba en ninguna parte. Se comprueba al armar la lista y también AL
MANDAR cada correo — el segundo es el que importa, porque la lista se
congela al lanzar y quien revoca después sigue dentro de ella.

**El enlace del correo llevaba a una dirección corrupta.** El texto se
escapa antes de buscar enlaces, así que una URL con `&` viajaba como
`&amp;`. Si toca `reescribirEnlaces`, el `url.replace(/&amp;/g, '&')`
no es cosmético.

**El destino del clic tiene que estar en el cuerpo de la campaña.**
Antes solo se comprobaba que empezara por `http`, y con eso el dominio
del gremio redirigía a donde le pidieran.

**Un solo escapado.** Había tres copias de la misma regla y no
coincidían. Vive en `src/correo/escapar.ts`; no haga una cuarta.

## Lo que NO se puede tocar sin entender

### 1. El worker manda correos de verdad

`backend/src/correo/campanas/campanas.worker.ts`

Está **apagado** salvo que `CAMPANAS_WORKER=1`. No es paranoia: un
`.env` de portátil puede estar apuntando a la base de producción, y
un worker que arranca solo se pone a escribirle a gente real.

Busca **destinatarios PENDIENTES de campañas ENVIANDO**. Cualquier
fila que cumpla esas dos cosas **va a salir**. Si alguna vez siembra
o migra datos de campañas, esa es la combinación que no puede dejar
suelta. La siembra de demo (`db:sembrar-campanas`) aborta con error
si se le queda una.

### 2. Los topes son el freno, no el ritmo

`backend/src/correo/campanas/ritmo.ts` — con pruebas en
`ritmo.spec.ts`. Si alguna de esas pruebas se cae, lo que se rompió
es lo que impide que suspendan la cuenta.

```
Entre correo y correo    1 a 3 segundos, con azar
Horario                  8 a 18, lunes a viernes, hora de Colombia
Tope diario              300
Por persona              2 al día
Tope por hora            250   (freno de emergencia, no ritmo)
```

**Lo que hunde una cuenta no es la velocidad.** Es pasarse del cupo
diario, que la marquen como spam, y que reboten correos. Por eso las
pausas son cortas —200 correos salen en unos siete minutos— y los
topes están donde de verdad está el riesgo.

Hubo una versión con pausas de 20 a 45 segundos. Eso convertía una
campaña de 200 en **dos días de espera**, y no compraba ninguna
seguridad a cambio. Está escrito en la prueba «una campaña de 200
sale en minutos, no en días» para que no vuelva.

El tope diario es 300 de los ~2.000 que Google admite. El resto se
deja libre a propósito: por esa misma cuenta sale el correo normal de
la oficina, y gastárselo en una campaña deja a la gente sin poder
escribir.

### 3. La hora es la de Bogotá, no la del servidor

Colombia es UTC−5 y no tiene horario de verano. `enColombia()` y
`inicioDelDiaColombiano()` existen porque contar el día por UTC pone
el contador a cero a las 7 de la noche y deja salir el doble.

## Cómo se decide a quiénes

`segmento.ts`. Se guardan **las reglas, no la lista**: si se arma el
lunes y se lanza el jueves, entra quien llegó el miércoles.

Al **lanzar** sí se congela en `DestinatarioCampana`. Es lo que
permite saber después a quién le tocaba, aunque hoy ya no cumpla la
regla.

Cinco segmentos hechos. Todos añaden siempre `convenioId` y
`correo != null` — un segmento no puede escaparse a otro gremio.

## Las métricas, y qué vale cada una

- **Clics: firmes.** Pasan por nuestro servidor. Los enlaces del
  cuerpo se reescriben solos al armar el correo.
- **Aperturas: estimadas, y tiran para arriba.** Es un pixel. Gmail
  descarga las imágenes él mismo y Apple Mail marca abierto a todo el
  mundo. El aviso va **pegado al número**, no en letra chica: quien
  lea «112 aperturas» sin eso toma una decisión con un dato que no
  existe. Zoho tiene el mismo problema y su tablero no lo dice.
- **Omitidos y fallidos**, cada uno con su motivo escrito.

Las rutas del pixel y del clic son **públicas sin sesión**
(`CampanasPublicoController`) — tienen que serlo, las abre el cliente
de correo de otra persona.

El destino del clic se valida **contra los enlaces que la campaña
escribió**, leídos de su propio cuerpo (`destinoPermitido`). Antes solo
se comprobaba que empezara por `http`, y con eso el dominio del gremio
llevaba a donde le pidieran: quien recibe el correo ya confía en ese
remitente, así que un enlace que sale de aquí y termina en una página
de estafa no le resulta raro a nadie.

## Antes de encenderlo

```
CAMPANAS_WORKER=1
URL_PUBLICA=https://prueba.reservasae.com
```

Sin `URL_PUBLICA` los enlaces del correo apuntan a `localhost`, que
en el computador de quien lo recibe no lleva a ninguna parte.

## Para verlo lleno

```
pnpm run db:sembrar-campanas
```

Solo corre con `ENTORNO=prueba` y una base con «prueba» en el nombre.
Deja cinco campañas por gremio con aperturas y clics repartidos como
se reparten de verdad, y cinco plantillas de ejemplo. Se reconocen
por `[demo]` en el nombre y se pueden volver a sembrar sin duplicar.

**Ninguna puede enviar nada**: todos sus destinatarios nacen
resueltos.

## Bases subidas

> **Ojo con el consentimiento.** Una lista subida no trae autorización
> de tratamiento de datos: esas personas no llenaron ningún formulario
> nuestro. `puedeRecibir()` devuelve `null` para ellas —no es que la
> hayan revocado, es que nunca hubo una— y hoy se les manda igual.
> Está señalado en la auditoría como riesgo abierto; decidirlo es del
> dueño del producto, no del código.


`base-cargada.ts` revisa un archivo con correo y primer nombre antes
de que salga nada: qué se cae y por qué, los repetidos, y los errores
de dedo (`gmail.con`, `hotmial.com`) **señalados pero no corregidos**
— corregirlos por nuestra cuenta es mandarle el correo a otra persona
si resulta que sí era así.

Una lista subida es la única fuente de destinatarios que nadie
revisó. Cada rebote le baja reputación a la cuenta, y la reputación
es lo que decide si los correos BUENOS caen en la bandeja o en spam.
Diez basuras en una lista de doscientos arruinan los ciento noventa.
