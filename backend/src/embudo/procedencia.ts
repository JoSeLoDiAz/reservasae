/** De dónde venía una visita al formulario público. */

/**
 * SE LLAMA PROCEDENCIA Y NO CANAL, y no es manía.
 *
 * `/admin/control` ya tiene un bloque «De dónde vienen · Volumen
 * por canal», con filas «Correo», «WhatsApp», «Facebook» e
 * «Instagram» — sobre PERSONAS y con otra regla. Repetir esas
 * cuatro palabras sobre VISITAS dejaría dos pantallas del mismo
 * panel diciendo cosas distintas con el mismo nombre. Y `Canal`,
 * `CANALES` y `ETIQUETA_CANAL` ya existen en `crm-api.ts` con
 * otro significado.
 *
 * Tampoco es `origenDeLead`: aquella clasifica a una PERSONA por
 * la columna `origen` de su ficha. `preinscripcion.service`
 * escribe `AUTOGESTION` para todo el que entra por el formulario,
 * y eso es `ORGANICO` — o sea que reusarla dejaría la pauta en
 * CERO. Ver CLAUDE.md.
 */

import { Prisma } from '../../generated/prisma';

export const PROCEDENCIAS = [
  'FACEBOOK',
  'INSTAGRAM',
  'META',
  'CORREO',
  'WHATSAPP',
  'BUSQUEDA',
  'QR',
  'RESERVA',
  'INTERNO',
  'OTRA_WEB',
  'OTRO_DECLARADO',
  'SIN_REFERENCIA',
] as const;

export type Procedencia = (typeof PROCEDENCIAS)[number];

/// Separadas: no son el mismo anuncio ni el mismo publico, y la
/// pregunta que se hace con esto es cual de las dos funciona.
const DE_FACEBOOK = ['facebook.com', 'messenger.com', 'fb.me', 'fb.watch'];
const DE_INSTAGRAM = ['instagram.com'];
const WEBMAIL = [
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'mail.yahoo.com',
];
/**
 * WhatsApp en el computador, y su acortador.
 *
 * La app del celular no manda referente --por eso casi todo
 * WhatsApp llega sin rastro--, pero WhatsApp Web sí: llega como
 * `web.whatsapp.com`. Sin esta lista caía en «Otra página web»,
 * y el aviso de enlaces sin marcar lo contaba como un enlace
 * suelto cuando se sabía perfectamente de dónde venía (18 sep
 * 2026). `whatsapp.com` cubre `web.whatsapp.com` por el sufijo.
 */
const DE_WHATSAPP = ['whatsapp.com', 'wa.me'];

/**
 * El redirector de un envio masivo de correo.
 *
 * NO es webmail: nadie lo abre a mano. Es el host por el que el
 * proveedor pasa cada enlace del correo para poder contarlos, y
 * llega como referente. Sin esta lista cae en OTRA_WEB, que es
 * donde el 16 sep 2026 aterrizaron 565 de las 599 visitas del
 * dia -- un mailing entero contado como «otra pagina web».
 *
 * ESTA LISTA ES EL PARCHE, NO LA SOLUCION, y conviene no
 * confundirlas: lo que escala es que el enlace del correo lleve
 * `utm_source=correo`, que la rama de abajo ya resuelve y que no
 * necesita desplegar nada. La lista solo cubre lo que ya salio
 * sin etiqueta y el dia que a alguien se le olvide ponerla.
 *
 * Va el subdominio del redirector y NO el dominio de la casa:
 * `campusadecopria.com` es tambien el sitio del gremio, y un
 * enlace de verdad desde su web es OTRA_WEB, no correo.
 */
const REDIRECTORES_DE_CORREO = [
  /// ADECOPRIA, medido el 16 sep 2026
  'in.campusadecopria.com',
];

const BUSCADORES = [
  'google.com',
  'google.com.co',
  'bing.com',
  'duckduckgo.com',
  'search.yahoo.com',
  'ecosia.org',
  'yandex.com',
];

/// Lo que escribimos nosotros en el enlace. Son declaraciones,
/// y valen porque el enlace lo armamos aquí.
const DICE_CORREO = ['correo', 'email', 'mail'];
const DICE_WHATSAPP = ['whatsapp', 'wa'];
/// Con su lista, como los demas: estaba escrito como literal
/// dentro del SQL y por eso no salia en los parametros, que es
/// donde el spec del panel mira lo que el servidor reconoce.
const DICE_QR = ['qr'];
/// El enlace que una empresa con cupos apartados reparte a su
/// gente (18 sep 2026). El nombre de la empresa va en la
/// campana: `?reserva-transportes-el-condor`.
const DICE_RESERVA = ['reserva'];
/**
 * Las fuentes que escribimos NOSOTROS en el enlace del panel.
 *
 * Ninguna prueba pago, y eso vale aunque la visita llegue desde la
 * app de Instagram o Facebook: un `?mailing…` reenviado por un DM
 * sale procedencia INSTAGRAM --el navegador de la app se evalúa
 * antes que la etiqueta, y es correcto: llegó por ahí--, pero su
 * `utm_campaign` es el nombre de un envío nuestro, no una
 * campaña de Ads Manager. Lo cazó José el 18 sep 2026: con la
 * regla de antes, ese mailing contaba como pauta pagada.
 */
/**
 * El enlace del ANUNCIO sacado del panel: `?pauta0305202255`.
 *
 * Dice que el enlace es de Meta y trae el nombre de la campaña,
 * pero NO prueba pago por sí solo --José, 18 sep 2026--: pagada
 * solo cuando la visita ya lo prueba, con el `fbclid` o abierta
 * dentro de la app. Sin prueba cuenta como META y su nombre se
 * guarda igual; lo que no hace es volver pagada la ficha.
 */
const DICE_PAUTA = ['pauta'];

const DE_LOS_NUESTROS = [...DICE_CORREO, ...DICE_WHATSAPP, ...DICE_QR, ...DICE_RESERVA];

const DICE_FACEBOOK = ['fb', 'facebook', 'messenger'];
const DICE_INSTAGRAM = ['ig', 'instagram'];
/// Sabemos que es Meta pero no cual: no se inventa.
const DICE_META = ['meta', 'redes'];

/**
 * TODAS las palabras con las que este fichero reconoce a Meta.
 *
 * Existe para que se pueda comprobar desde fuera. Desde el 24 sep
 * 2026 el panel deja ESCRIBIR el canal a mano, y un campo libre
 * reabre por detras la puerta que el desplegable cierra: se teclea
 * «meta» y ese trafico se cuenta como pauta sin que nadie la haya
 * pagado. El panel las prohibe (`PALABRAS_DE_PAUTA`, en
 * `formulario-publico.tsx`) y `lo-que-el-panel-ofrece-se-clasifica`
 * ata que su lista cubra esta: si aqui se anade una y alla no, la
 * prueba se cae en vez de abrirse el agujero en silencio.
 */
export const DICEN_PAUTA = [
  ...DICE_FACEBOOK,
  ...DICE_INSTAGRAM,
  ...DICE_META,
  ...DICE_PAUTA,
];

/**
 * El host ES el dominio, o cuelga de él.
 *
 * Un `LIKE '%facebook.com'` a secas casa `notfacebook.com`, y un
 * `LIKE 'google.%'` NO casa `www.google.com`, que es justo lo que
 * manda el navegador. Las dos formas cortas estuvieron escritas y
 * las dos estaban mal, así que no queda ninguna: se pasa por aquí.
 */
function esDominio(col: string, dominio: string): Prisma.Sql {
  const c = Prisma.raw(col);
  return Prisma.sql`(${c} = ${dominio} OR ${c} LIKE ${'%.' + dominio})`;
}

const alguno = (col: string, dominios: string[]) =>
  Prisma.join(
    dominios.map((d) => esDominio(col, d)),
    ' OR ',
  );

/**
 * La cadena de decisión, y el ORDEN es el diseño.
 *
 * Primero lo que es más difícil de producir por accidente, salvo
 * en los canales donde no existe ninguna señal: un correo abierto
 * en Outlook de escritorio y un QR no dejan rastro ninguno, así
 * que ahí manda la etiqueta que pusimos nosotros.
 *
 * El webmail va ANTES que el buscador a propósito: son disjuntos
 * hoy, y así siguen siéndolo el día que alguien escriba el patrón
 * de Google de una forma más laxa.
 */
/**
 * Si la visita PRUEBA que se pagó: la etiqueta de campaña de Ads
 * Manager, o el `fbclid` que cuelga el redirector de Meta.
 *
 * Vive aquí, al lado del `CASE`, y no escrita en la consulta de
 * quien la usa: las dos preguntan por las mismas columnas y el
 * spec las ejecuta juntas contra un Postgres en memoria.
 */
export function pagadaSql(): Prisma.Sql {
  const utm = `lower(coalesce("utmFuente",''))`;
  return Prisma.sql`
    CASE
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DE_LOS_NUESTROS)}) THEN FALSE
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_PAUTA)})
        THEN ("huboFbclid" IS TRUE
              OR "navegador" IN ('APP_INSTAGRAM', 'APP_FACEBOOK', 'APP_META'))
      ELSE (coalesce("utmCampana", '') <> '' OR "huboFbclid" IS TRUE)
    END`;
}

/**
 * @param conSuNombre pega la palabra declarada al cajón de «otro».
 *
 * Desde el 24 sep 2026 el panel deja ESCRIBIR el canal. Sin esto,
 * tres enlaces marcados «volante», «emisora» y «feria» salen los
 * tres como «Otro canal etiquetado» y no hay forma de saber cuál
 * rindió: sería dar la función y no lo que se pedía con ella.
 *
 * Va como PARÁMETRO y no como función aparte para que el `CASE` sea
 * uno solo. Dos copias del mismo árbol de decisiones acaban
 * discrepando, y el día que discrepen la pantalla dirá una cosa y
 * el sello del lead otra.
 *
 * Lo piden solo los cortes que se PINTAN. Quien clasifica una
 * visita para sellar el lead (`procedenciaDe`) lo llama sin
 * parámetro: ahí hace falta el cajón, no la palabra.
 */
export function procedenciaSql(conSuNombre = false): Prisma.Sql {
  const ref = `lower(coalesce("referente",''))`;
  const utm = `lower(coalesce("utmFuente",''))`;
  /// `OTRO_DECLARADO:volante`. El separador es `:`, y no puede
  /// partir la palabra en dos: `comoViaja()` convierte en guion
  /// todo lo que no sea letra o número, así que nunca llega uno.
  const otro = conSuNombre
    ? Prisma.raw(`'OTRO_DECLARADO:' || ${utm}`)
    : Prisma.raw(`'OTRO_DECLARADO'`);
  return Prisma.sql`
    CASE
      WHEN "navegador" = 'APP_INSTAGRAM' THEN 'INSTAGRAM'
      WHEN "navegador" = 'APP_FACEBOOK' THEN 'FACEBOOK'
      WHEN ${alguno(ref, DE_INSTAGRAM)} THEN 'INSTAGRAM'
      WHEN ${alguno(ref, DE_FACEBOOK)} THEN 'FACEBOOK'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_CORREO)}) THEN 'CORREO'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_WHATSAPP)}) THEN 'WHATSAPP'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_QR)}) THEN 'QR'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_RESERVA)}) THEN 'RESERVA'
      WHEN ${esDominio(ref, 'reservasae.com')} THEN 'INTERNO'
      WHEN ${alguno(ref, WEBMAIL)} THEN 'CORREO'
      WHEN ${alguno(ref, REDIRECTORES_DE_CORREO)} THEN 'CORREO'
      WHEN ${alguno(ref, DE_WHATSAPP)} THEN 'WHATSAPP'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_INSTAGRAM)}) THEN 'INSTAGRAM'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_FACEBOOK)}) THEN 'FACEBOOK'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_META)}) THEN 'META'
      -- fbclid dice que es Meta, no cual de las dos
      WHEN "navegador" = 'APP_META' OR "huboFbclid" IS TRUE THEN 'META'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_PAUTA)}) THEN 'META'
      WHEN ${alguno(ref, BUSCADORES)} THEN 'BUSQUEDA'
      WHEN ${Prisma.raw(utm)} <> '' THEN ${otro}
      WHEN ${Prisma.raw(ref)} <> '' THEN 'OTRA_WEB'
      ELSE 'SIN_REFERENCIA'
    END`;
}
