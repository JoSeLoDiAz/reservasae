/** De qué canal llegó una visita al formulario público. */

/**
 * NO es `origenDeLead`, y conviene decir por qué antes de que
 * alguien las junte.
 *
 * Aquella clasifica a una PERSONA por la columna `origen` de su
 * ficha, un enum del CRM. Ésta clasifica una VISITA por cómo el
 * navegador llegó a la página, que es un hecho de la web.
 *
 * Y hoy dicen cosas distintas a propósito: `preinscripcion.service`
 * escribe `origen: 'AUTOGESTION'` para todo el que se registra por
 * el formulario, y `origenDeLead('AUTOGESTION')` es `ORGANICO`. O
 * sea que quien viene de un anuncio pagado consta como orgánico en
 * la ficha. Reusar aquella regla aquí haría que la pauta saliera en
 * CERO — que es exactamente el defecto que su propio docblock
 * cuenta que ya pasó una vez.
 */

import { Prisma } from '../../generated/prisma';

export const CANALES = [
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

export type Canal = (typeof CANALES)[number];

/// Los dominios desde los que Meta suelta a la gente.
const DE_META = ['facebook.com', 'instagram.com', 'messenger.com', 'fb.me', 'fb.watch'];
/// Correos web que sí dejan referente.
const WEBMAIL = ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'mail.yahoo.com'];
const BUSCADORES = ['google.', 'bing.com', 'duckduckgo.com', 'search.yahoo.com', 'ecosia.org', 'yandex.'];

/// Lo que nosotros escribimos en los enlaces. Son declaraciones,
/// no hechos: valen porque el enlace lo armamos aquí.
const DICE_CORREO = ['correo', 'email', 'mail'];
const DICE_WHATSAPP = ['whatsapp', 'wa'];
const DICE_META = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'messenger'];

const acaba = (col: string, dominios: string[]) =>
  Prisma.join(
    dominios.map((d) => Prisma.sql`${Prisma.raw(col)} LIKE ${'%' + d}`),
    ' OR ',
  );

const empieza = (col: string, trozos: string[]) =>
  Prisma.join(
    trozos.map((d) => Prisma.sql`${Prisma.raw(col)} LIKE ${d + '%'}`),
    ' OR ',
  );

/**
 * La cadena de decisión, y el ORDEN es el diseño.
 *
 * De arriba abajo, gana la primera que acierta. Los hechos del
 * navegador van antes que lo que declara una etiqueta, salvo
 * cuando la etiqueta la ponemos nosotros y el hecho no existiría:
 * un correo o un QR no dejan rastro ninguno.
 */
export function canalSql(): Prisma.Sql {
  const ref = `lower(coalesce("referente",''))`;
  const utm = `lower(coalesce("utmFuente",''))`;
  return Prisma.sql`
    CASE
      WHEN "navegador" = 'APP_META' THEN 'META'
      WHEN ${acaba(ref, DE_META)} THEN 'META'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_CORREO)}) THEN 'CORREO'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_WHATSAPP)}) THEN 'WHATSAPP'
      WHEN ${Prisma.raw(utm)} = 'qr' THEN 'QR'
      WHEN ${Prisma.raw(ref)} LIKE '%reservasae.com' THEN 'INTERNO'
      WHEN ${acaba(ref, WEBMAIL)} THEN 'CORREO'
      WHEN "huboFbclid" IS TRUE THEN 'META'
      WHEN ${Prisma.raw(utm)} IN (${Prisma.join(DICE_META)}) THEN 'META'
      WHEN ${empieza(ref, BUSCADORES)} THEN 'BUSQUEDA'
      WHEN ${Prisma.raw(utm)} <> '' THEN 'OTRO_DECLARADO'
      WHEN ${Prisma.raw(ref)} <> '' THEN 'OTRA_WEB'
      ELSE 'SIN_REFERENCIA'
    END`;
}

/// «Directa» sería mentira: lo cierto es que no llegó referencia,
/// no que la persona tecleara la dirección.
export const ETIQUETA_CANAL: Record<Canal, string> = {
  META: 'Facebook o Instagram',
  CORREO: 'Correo',
  WHATSAPP: 'WhatsApp',
  BUSQUEDA: 'Buscador',
  QR: 'Código QR',
  INTERNO: 'Otra página nuestra',
  OTRA_WEB: 'Otra página web',
  OTRO_DECLARADO: 'Otro canal etiquetado',
  SIN_REFERENCIA: 'No dejó rastro',
};
