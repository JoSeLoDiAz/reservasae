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
const DICE_FACEBOOK = ['fb', 'facebook', 'messenger'];
const DICE_INSTAGRAM = ['ig', 'instagram'];
/// Sabemos que es Meta pero no cual: no se inventa.
const DICE_META = ['meta', 'redes'];

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
export function procedenciaSql(): Prisma.Sql {
  const ref = `lower(coalesce("referente",''))`;
  const utm = `lower(coalesce("utmFuente",''))`;
  return Prisma.sql`
    CASE
      WHEN "navegador" = 'APP_INSTAGRAM' THEN 'INSTAGRAM'
      WHEN "navegador" = 'APP_FACEBOOK' THEN 'FACEBOOK'
      WHEN ${alguno(ref, DE_INSTAGRAM)} THEN 'INSTAGRAM'
      WHEN ${alguno(ref, DE_FACEBOOK)} THEN 'FACEBOOK'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_CORREO)}) THEN 'CORREO'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_WHATSAPP)}) THEN 'WHATSAPP'
      WHEN ${Prisma.raw(utm)} = 'qr' THEN 'QR'
      WHEN ${esDominio(ref, 'reservasae.com')} THEN 'INTERNO'
      WHEN ${alguno(ref, WEBMAIL)} THEN 'CORREO'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_INSTAGRAM)}) THEN 'INSTAGRAM'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_FACEBOOK)}) THEN 'FACEBOOK'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_META)}) THEN 'META'
      -- fbclid dice que es Meta, no cual de las dos
      WHEN "navegador" = 'APP_META' OR "huboFbclid" IS TRUE THEN 'META'
      WHEN ${alguno(ref, BUSCADORES)} THEN 'BUSQUEDA'
      WHEN ${Prisma.raw(utm)} <> '' THEN 'OTRO_DECLARADO'
      WHEN ${Prisma.raw(ref)} <> '' THEN 'OTRA_WEB'
      ELSE 'SIN_REFERENCIA'
    END`;
}
