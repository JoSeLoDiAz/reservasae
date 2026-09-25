/** La marca del enlace, leída del ENVÍO y no de la baliza. */

/**
 * POR QUÉ EXISTE, y es una razón de dinero.
 *
 * `?mailing-ucc` dice de qué universidad viene quien se
 * preinscribe, y con eso se le paga a esa universidad por cada
 * persona que se inscriba y se certifique. Hasta el 24 sep 2026
 * esa palabra SOLO la leía la baliza (`visita.ts`), así que la
 * atribución dependía de que un `sendBeacon` llegara --y este
 * repositorio ya tiene medido que «los bloqueadores y el
 * navegador de Meta se comen los tags a una tasa que nadie puede
 * medir»--. Para saber cuánta gente vino eso está bien; para
 * liquidarle una factura a un tercero, no: la persona entró, la
 * universidad la trajo, y el sistema no lo sabía.
 *
 * Ahora la palabra viaja TAMBIÉN dentro del POST del formulario,
 * como ya hacía la del formulario personalizado, y el servidor la
 * valida. Es el mismo camino que la ficha: si llega el registro,
 * llega la atribución.
 *
 * NO SUSTITUYE A LA BALIZA, la respalda. La campaña de la visita
 * sigue mandando --dice por qué anuncio concreto llegó, que es
 * más preciso--; esto es el respaldo de cuando no hay ninguna.
 *
 * LA PAUTA NO ENTRA AQUÍ, y esa es la línea que no se cruza.
 * `leads.service.ts` lo tiene escrito: «pagado u orgánico lo
 * decide QUIÉN LO MANDA, no el cuerpo. Si viniera en el JSON,
 * quien llama podría marcarse sus propios leads como pauta y la
 * métrica de cuánto cuesta un inscrito dejaría de valer». Esta
 * palabra viene en el cuerpo, así que de `pauta` se toma el
 * NOMBRE y nunca el origen: que algo sea pagado lo sigue
 * probando `pagadaSql` con el `fbclid` o la app de Meta.
 */

import { OrigenParticipante } from '../../generated/prisma';

/**
 * Prefijo → el origen que sella en la ficha.
 *
 * COPIA CONSCIENTE de `PREFIJOS` de
 * `frontend/src/lib/enlace-corto.ts`, que el backend no puede
 * importar --su imagen no copia `frontend/src`--. Las ata
 * `enlace-del-envio.spec.ts`, como `la-escalera-no-se-separa`
 * ata la escalera del embudo.
 *
 * `pauta` está a propósito con origen NULO: ver el docblock.
 */
const DEL_PREFIJO: Readonly<Record<string, OrigenParticipante | null>> = {
  mailing: OrigenParticipante.CORREO,
  correo: OrigenParticipante.CORREO,
  whatsapp: OrigenParticipante.WHATSAPP,
  reserva: OrigenParticipante.EMPRESA,
  /// El QR no tiene palabra en el enum: se queda sin origen y
  /// solo deja su nombre, igual que hace hoy la baliza.
  qr: null,
  pauta: null,
};

/// El más largo primero, por si dos empiezan igual.
const PATRON = new RegExp(
  `^(${Object.keys(DEL_PREFIJO)
    .sort((a, b) => b.length - a.length)
    .join('|')})[a-z0-9._-]*$`,
);

export type MarcaDelEnlace = {
  /// El nombre del envío, tal cual viaja. Nunca vacío.
  campana: string;
  /// Qué sellar en la ficha, o null si ese canal no tiene palabra.
  origen: OrigenParticipante | null;
};

/**
 * Lo que dice la palabra del enlace, o null si no dice nada.
 *
 * Se valida aquí y no se cree lo que venga: solo pasan las
 * palabras que empiezan por un prefijo conocido y siguen con el
 * juego de caracteres del enlace corto.
 */
export function marcaDelEnlace(
  palabra: string | undefined | null,
): MarcaDelEnlace | null {
  if (!palabra) return null;
  const limpia = palabra.trim().toLowerCase().slice(0, 60);
  const m = PATRON.exec(limpia);
  if (!m) return null;

  /// `?mailing` a secas dice el canal y no el envío: sin nombre
  /// no hay nada que atribuirle a nadie.
  if (limpia === m[1]) return { campana: limpia, origen: DEL_PREFIJO[m[1]] };

  return { campana: limpia, origen: DEL_PREFIJO[m[1]] };
}
