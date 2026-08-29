/** Hablar con Meta en su idioma. */

/// Meta no se adapta a nadie: manda lo que manda, firmado como
/// lo firma, y si no le contestas como espera, apaga el
/// webhook. Así que la traducción va aquí.
///
/// Lo que hay que saber antes de tocar esto:
///
/// 1. Meta NO manda los datos de la persona. Manda un
///    `leadgen_id` y ya. Para saber cómo se llama hay que
///    volver a llamar a la Graph API con un token de la
///    página. Eso es de Meta, no una limitación nuestra.
///
/// 2. Por eso el aviso se guarda SIEMPRE, aunque no haya
///    token: un lead pagado que se pierde porque a nosotros
///    nos faltaba una credencial es plata tirada. Se guarda el
///    `leadgen_id`, y cuando haya token se completa.
///
/// 3. La firma se calcula sobre el cuerpo CRUDO. Sobre el JSON
///    parseado y vuelto a serializar nunca cuadra.

import { createHmac, timingSafeEqual } from 'node:crypto';

/// Lo que Meta pone en la cabecera cuando firma.
export const CABECERA_FIRMA = 'x-hub-signature-256';

/**
 * ¿La firma es de Meta?
 *
 * `timingSafeEqual` y no `===`: comparar cadenas con `===` se
 * corta en el primer byte distinto, y de cuánto tarda en
 * cortarse se puede deducir la firma byte a byte. Aquí eso
 * daría la llave para escribir leads falsos en el CRM.
 */
export function firmaDeMeta(
  cuerpoCrudo: Buffer | undefined,
  cabecera: string | undefined,
  secreto: string | undefined,
): boolean {
  if (!cuerpoCrudo || !cabecera || !secreto) return false;

  /// Llega como «sha256=abc123…». Sin el prefijo no es de
  /// Meta, y compararlo entero fallaría siempre.
  const [algoritmo, viene] = cabecera.split('=');
  if (algoritmo !== 'sha256' || !viene) return false;

  const nuestra = createHmac('sha256', secreto)
    .update(cuerpoCrudo)
    .digest('hex');

  const a = Buffer.from(nuestra, 'hex');
  const b = Buffer.from(viene, 'hex');

  /// Largos distintos: `timingSafeEqual` revienta si no
  /// coinciden, así que se descarta antes. Y saberlo no
  /// filtra nada: el largo de un sha256 es público.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/** Un aviso de lead, ya traducido a lo nuestro. */
export type AvisoDeMeta = {
  /// El id del lead en Meta. Es con lo que se piden sus datos.
  leadgenId: string;
  /// De qué formulario y de qué página vino.
  formularioId: string | null;
  paginaId: string | null;
  /// El anuncio, para poder medir qué pauta trae qué.
  anuncioId: string | null;
  /// Cuándo lo llenó la persona, según Meta.
  creadoEn: Date | null;
};

/// La forma que manda Meta. Se declara suelta y se lee con
/// cuidado: viene de fuera y no se le cree la forma.
type CuerpoDeMeta = {
  object?: unknown;
  entry?: Array<{
    id?: unknown;
    time?: unknown;
    changes?: Array<{
      field?: unknown;
      value?: {
        leadgen_id?: unknown;
        form_id?: unknown;
        page_id?: unknown;
        ad_id?: unknown;
        created_time?: unknown;
      };
    }>;
  }>;
};

const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;

/**
 * Saca los avisos de lead de lo que mandó Meta.
 *
 * Un solo POST puede traer VARIOS: Meta agrupa. Devolver solo
 * el primero perdería los demás en silencio, que es
 * exactamente el fallo que nadie nota hasta que faltan leads.
 *
 * Lo que no sea `leadgen` se ignora sin ruido: Meta manda por
 * el mismo webhook cambios de la página que no nos importan.
 */
export function avisosDeLead(cuerpo: unknown): AvisoDeMeta[] {
  const c = cuerpo as CuerpoDeMeta;
  if (!c || !Array.isArray(c.entry)) return [];

  const avisos: AvisoDeMeta[] = [];

  for (const entrada of c.entry) {
    if (!Array.isArray(entrada?.changes)) continue;

    for (const cambio of entrada.changes) {
      if (cambio?.field !== 'leadgen') continue;

      const leadgenId = texto(cambio.value?.leadgen_id);
      /// Sin el id no hay nada que pedir después. Se descarta,
      /// pero quien llama lo cuenta y lo deja en el log: un
      /// aviso que llega y no se puede usar hay que verlo.
      if (!leadgenId) continue;

      /// Meta manda segundos, JavaScript quiere milisegundos.
      /// Sin el ×1000 todos los leads quedan en 1970.
      const seg = cambio.value?.created_time;
      const creadoEn =
        typeof seg === 'number' && seg > 0 ? new Date(seg * 1000) : null;

      avisos.push({
        leadgenId,
        formularioId: texto(cambio.value?.form_id),
        paginaId: texto(cambio.value?.page_id) ?? texto(entrada.id),
        anuncioId: texto(cambio.value?.ad_id),
        creadoEn,
      });
    }
  }

  return avisos;
}

/**
 * La respuesta a la verificación de Meta.
 *
 * Antes de mandar nada, Meta llama con un GET y espera que le
 * devuelvan su `hub.challenge` TAL CUAL, en texto plano. Si se
 * le contesta un JSON, o con comillas, o con un salto de
 * línea, no valida el webhook y no lo enciende. No hay mensaje
 * de error: simplemente no funciona.
 */
export function respuestaDeVerificacion(
  modo: string | undefined,
  token: string | undefined,
  reto: string | undefined,
  esperado: string | undefined,
): string | null {
  if (modo !== 'subscribe') return null;
  if (!esperado || !token || token !== esperado) return null;
  return reto ?? null;
}
