/** Qué le falta a un lead para poder ser ficha. */

/**
 * Una sola regla, y por el motivo de siempre.
 *
 * La pantalla necesita saber qué casillas puede encender y el
 * lote necesita saber qué convertir. Escribirlo dos veces —una en
 * el navegador y otra aquí— es garantizar que discrepen: la
 * pantalla diría «listo» y el servidor lo rechazaría, o al revés,
 * que es peor. Ya pasó con `faltaDeLaPersona` y el enlace de
 * completado.
 *
 * Y esta versión no es la que manda sobre la conversión: la que
 * manda sigue siendo `conversion.service`, que valida otra vez.
 * Esta responde una pregunta distinta —«¿lo intento siquiera?»—
 * usando las MISMAS funciones, que es lo que impide que se
 * separen.
 */

import { DOCUMENTOS_DE_PERSONA } from '../crm/catalogos-sep';
import { documentoValido, normalizarDocumento } from '../comun/documento';
import { origenDeLead } from '../crm/origen-del-lead';
import { partirNombreCompleto } from './cruzar-con-el-crm';

import type { OrigenParticipante } from '../../generated/prisma';

/// Lo mínimo del lead que hace falta para juzgarlo.
export type LeadJuzgable = {
  estado: string;
  participanteId: string | null;
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  nombreCompleto: string | null;
  primerNombre: string | null;
  primerApellido: string | null;
  accionFormacionId: string | null;
  origen: OrigenParticipante;
};

/**
 * Qué le falta. Vacío quiere decir que está listo.
 *
 * Las frases son las que ve el asesor al lado de la casilla
 * apagada: un lead que no se puede marcar y no dice por qué es un
 * lead que alguien va a dar por perdido.
 */
export function loQueLeFaltaAlLead(lead: LeadJuzgable): string[] {
  const falta: string[] = [];

  if (lead.participanteId || lead.estado !== 'PENDIENTE') {
    falta.push('ya se atendió');
    /// No se sigue: lo demás no importa si ya no está en la mesa.
    return falta;
  }

  const numero = lead.numeroDocumento
    ? normalizarDocumento(lead.numeroDocumento)
    : null;
  const tipo = lead.tipoDocumentoSepId;

  if (tipo === null || tipo === undefined || !numero) {
    falta.push('el documento');
  } else if (!DOCUMENTOS_DE_PERSONA.some((t) => t.id === tipo)) {
    falta.push('un tipo de documento que sirva para una persona');
  } else if (!documentoValido(tipo, numero)) {
    falta.push('un documento con forma de documento');
  }

  /// La misma partición que hace la conversión, no una propia.
  const nombre = lead.primerApellido
    ? { primerNombre: lead.primerNombre ?? '', primerApellido: lead.primerApellido }
    : partirNombreCompleto(lead.nombreCompleto ?? '');
  if (!nombre.primerNombre) falta.push('el nombre');
  if (!nombre.primerApellido) falta.push('el apellido');

  /// El curso.
  ///
  /// La conversión NO lo exige —un asesor puede convertir uno y
  /// preguntárselo por teléfono—, pero el lote sí: es lo que el
  /// cliente pidió y, sobre todo, es lo que hace morder al unique
  /// (accionFormacionId, personaId). Sin curso, dos leads de la
  /// misma persona darían dos fichas y nada lo pararía.
  if (!lead.accionFormacionId) falta.push('el curso (no se reconoció cuál pidió)');

  return falta;
}

/**
 * ¿Autorizó al registrarse?
 *
 * Solo quien llenó un FORMULARIO. En el de una pauta de Meta y en
 * el nuestro, la persona no puede enviar sin aceptar la política:
 * ahí hay una autorización de verdad, y su prueba es el propio
 * registro que quedó guardado.
 *
 * En lo demás no la hay, y la diferencia importa: a quien escribió
 * por WhatsApp nadie le enseñó un texto, y a quien subió el equipo
 * en una lista, menos. Estampárselo sería inventarse la prueba, y
 * una prueba falsa es peor que ninguna — la que falta BLOQUEA el
 * reporte al SENA; la falsa lo ABRE.
 *
 * Y LO QUE DIJO LA PERSONA MANDA SOBRE LA PUERTA POR LA QUE ENTRÓ.
 *
 * `LeadEntrante.aceptaHabeasData` existía, se guardaba desde el
 * webhook y no lo leía nadie: la constancia salía del origen y de
 * nada más. O sea que un lead de Facebook con la casilla SIN
 * marcar recibía igualmente una `AutorizacionDatos` con canal
 * FORMULARIO_WEB y evidencia apuntando a una carga que decía lo
 * contrario. Indistinguible de una buena salvo abriendo el JSON.
 *
 * Los tres valores NO son dos:
 *
 *   true   marcó la casilla. Autorización de verdad.
 *   false  se le preguntó y dijo que NO. Nunca hay constancia,
 *          venga de donde venga.
 *   null   el emisor no manda ese campo. Vale el argumento de
 *          arriba —el formulario no se puede enviar sin aceptar—
 *          y la constancia se mantiene, que es como funcionaba
 *          antes de que existiera la columna.
 */
export function autorizoAlRegistrarse(
  origen: OrigenParticipante,
  /// Lo que la persona marcó, si el emisor lo manda.
  aceptaHabeasData?: boolean | null,
): boolean {
  if (aceptaHabeasData === false) return false;
  const puerta = origenDeLead(origen);
  return puerta === 'PAUTA' || puerta === 'ORGANICO';
}

/**
 * La prueba de ESE lead, no una frase tecleada para todos.
 *
 * Esto es lo que separa esta constancia de un invento. No se le
 * pide al asesor que afirme nada sobre 392 personas: cada fila
 * apunta al registro concreto que la origina —el id que le dio el
 * emisor, cuándo llegó y por dónde—, y el cuerpo entero de esa
 * petición sigue guardado en `LeadEntrante.carga`, que es
 * justamente para lo que se guarda.
 */
export function evidenciaDelLead(lead: {
  id: string;
  externoId: string;
  origenSistema: string;
  origen: OrigenParticipante;
  recibidoEn: Date;
}): string {
  const dia = lead.recibidoEn.toISOString().slice(0, 16).replace('T', ' ');
  return (
    `Registro en formulario de ${lead.origen} vía ${lead.origenSistema}, ` +
    `${dia} UTC. Lead ${lead.externoId} (${lead.id}); ` +
    `la petición completa queda en su carga.`
  );
}
