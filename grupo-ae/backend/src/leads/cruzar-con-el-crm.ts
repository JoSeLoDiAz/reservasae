/** ¿Esta persona ya está en Gestión de leads? */

/// Es la mitad que le faltaba al webhook. Sin esto, un lead de
/// pauta entra a su buzón y se queda ahí: nadie lo cruza con
/// la base, nadie sabe si ya existía, y el asesor no se entera
/// de que llegó.
///
/// El orden de las llaves NO es un detalle. Va de la más firme
/// a la más floja, y se para en la primera que acierta:
///
///   1. El documento. Es LA llave del sistema: la misma cédula
///      es la misma persona, venga por donde venga.
///   2. El correo. Casi siempre acierta, pero una familia
///      comparte un buzón y una empresa pone el de la
///      secretaria en veinte formularios.
///   3. El celular. Igual, y además llega escrito de seis
///      formas distintas.
///
/// Por eso lo que encuentra el correo o el celular NO se da
/// por seguro: se deja como PROPUESTA para que un asesor
/// llame y confirme. Pisar una ficha porque dos personas
/// comparten el correo de la oficina es peor que no cruzar.

import type { PrismaService } from '../prisma/prisma.service';

export type Coincidencia = {
  participanteId: string;
  personaId: string;
  /// Por dónde se encontró. Se dice porque cambia cuánto se
  /// le cree, y el asesor tiene que saberlo al decidir.
  por: 'DOCUMENTO' | 'CORREO' | 'CELULAR';
  /// Si se puede dar por segura. Solo el documento lo es.
  firme: boolean;
};

export type LlavesDelLead = {
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  correo: string | null;
  celular: string | null;
  /// Qué curso pidió, si se reconoció.
  ///
  /// No sirve para ENCONTRARLA —una persona es la misma pida lo
  /// que pida— pero sí para elegir CUÁL de sus fichas. Hay una
  /// por curso (@@unique accionFormacionId, personaId), y quien
  /// ya está en AF1 y pide AF5 por un anuncio tiene que caer en
  /// la de AF5.
  accionFormacionId: string | null;
};

/**
 * Busca a esta persona en el convenio, y dice por dónde la
 * encontró.
 *
 * SIEMPRE dentro del convenio: la misma cédula puede estar en
 * los dos gremios y son dos fichas distintas, cada una con su
 * autorización. Cruzar entre gremios sería mezclar dos
 * tratamientos de datos que no se pueden mezclar.
 */
export async function cruzarConElCrm(
  prisma: PrismaService,
  convenioId: string,
  llaves: LlavesDelLead,
): Promise<Coincidencia | null> {
  /// 1. El documento. La única que es firme.
  if (llaves.tipoDocumentoSepId && llaves.numeroDocumento) {
    const porDoc = await elegirFicha(prisma, llaves, {
      convenioId,
      persona: {
        tipoDocumentoSepId: llaves.tipoDocumentoSepId,
        numeroDocumento: llaves.numeroDocumento,
      },
    });
    if (porDoc) {
      return {
        participanteId: porDoc.id,
        personaId: porDoc.personaId,
        por: 'DOCUMENTO',
        firme: true,
      };
    }
  }

  /// 2. El correo. Acierta casi siempre y falla feo cuando
  /// falla: una empresa que pone el correo de la secretaria en
  /// veinte formularios haría que los veinte fueran «la misma
  /// persona».
  if (llaves.correo) {
    const porCorreo = await elegirFicha(prisma, llaves, {
      convenioId,
      persona: { correo: llaves.correo },
    });
    if (porCorreo) {
      return {
        participanteId: porCorreo.id,
        personaId: porCorreo.personaId,
        por: 'CORREO',
        firme: false,
      };
    }
  }

  /// 3. El celular. La más floja, y aun así sirve: mucha gente
  /// no deja correo pero sí número.
  if (llaves.celular) {
    const porCelular = await elegirFicha(prisma, llaves, {
      convenioId,
      persona: { celular: llaves.celular },
    });
    if (porCelular) {
      return {
        participanteId: porCelular.id,
        personaId: porCelular.personaId,
        por: 'CELULAR',
        firme: false,
      };
    }
  }

  return null;
}

/// Cómo se le dice al asesor por dónde se encontró. Va en la
/// propuesta que le sale, y decide cuánta confianza le da.
export function porDondeSeEncontro(c: Coincidencia): string {
  if (c.por === 'DOCUMENTO') {
    return 'Coincide el documento, así que es la misma persona.';
  }
  if (c.por === 'CORREO') {
    return (
      'Coincide el CORREO, no el documento. Puede ser la misma persona ' +
      'o dos que comparten buzón —el de la oficina, el de la casa—. ' +
      'Confírmelo antes de aceptar.'
    );
  }
  return (
    'Coincide el CELULAR, no el documento. Puede ser la misma persona o ' +
    'un número que cambió de dueño. Confírmelo antes de aceptar.'
  );
}

/**
 * Parte un nombre completo en sus cuatro pedazos.
 *
 * Meta manda «full_name» de una pieza y el CRM guarda cuatro
 * campos. Sin partirlo, el lead entra con el nombre entero en
 * «primer nombre» y sale así en el reporte al SENA.
 *
 * En Colombia lo normal son dos nombres y dos apellidos, pero
 * hay de todo. La regla que menos se equivoca:
 *
 *   2 palabras  ->  nombre + apellido
 *   3 palabras  ->  nombre + dos apellidos
 *   4 o más     ->  dos nombres + los dos últimos como apellidos
 *
 * No es perfecta y no puede serlo: «María Fernanda» es un
 * nombre compuesto y «De la Hoz» un apellido de tres palabras.
 * Por eso lo que sale de aquí va a una PROPUESTA, no a la
 * ficha: lo confirma quien llama.
 */
export function partirNombreCompleto(completo: string): {
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
} {
  const partes = completo.trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) {
    return {
      primerNombre: '',
      segundoNombre: null,
      primerApellido: '',
      segundoApellido: null,
    };
  }
  if (partes.length === 1) {
    return {
      primerNombre: partes[0],
      segundoNombre: null,
      primerApellido: '',
      segundoApellido: null,
    };
  }
  if (partes.length === 2) {
    return {
      primerNombre: partes[0],
      segundoNombre: null,
      primerApellido: partes[1],
      segundoApellido: null,
    };
  }
  if (partes.length === 3) {
    return {
      primerNombre: partes[0],
      segundoNombre: null,
      primerApellido: partes[1],
      segundoApellido: partes[2],
    };
  }

  /// Cuatro o más: los dos ÚLTIMOS son los apellidos y lo de
  /// en medio se junta al segundo nombre. «Juan Carlos de la
  /// Hoz Peña» da «Juan» / «Carlos de la» / «Hoz» / «Peña»,
  /// que está mal — y por eso esto va a una propuesta.
  return {
    primerNombre: partes[0],
    segundoNombre: partes.slice(1, -2).join(' ') || null,
    primerApellido: partes[partes.length - 2],
    segundoApellido: partes[partes.length - 1],
  };
}

/**
 * Cuál de las fichas de esa persona, no una cualquiera.
 *
 * `findFirst` sin `orderBy` no es determinista en Postgres: la
 * misma consulta puede devolver filas distintas con el tiempo.
 * Mientras `LeadEntrante.participanteId` era @unique daba igual
 * —el segundo lead reventaba antes de llegar aquí— pero al
 * quitarlo, ese azar pasó a decidir a qué ficha se ata el lead.
 *
 * Y hay una ficha POR CURSO. Quien ya está en AF1 y pide AF5 por
 * un anuncio tiene que caer en la de AF5: si cae en la de AF1, a
 * esa ficha equivocada le llegan el toque de pauta, el origen del
 * lead y la propuesta de datos — y el comparativo enseña ese lead
 * colgando del curso que no era.
 *
 * Lo encontró Mauricio Andrés al revisar la migración 09, y lo
 * completó al barrer el patrón: la primera versión solo pasaba
 * por aquí la rama del DOCUMENTO, y las otras dos seguían con un
 * `findFirst` pelado.
 *
 * Y ahí importa MÁS, no menos. Buscar por documento devuelve una
 * ficha por curso de UNA persona; buscar por correo devuelve las
 * de VARIAS —la secretaria que puso el suyo en veinte
 * formularios— que es el caso del que avisa el comentario de
 * arriba. El daño se queda en el motivo y en el comparativo,
 * porque una coincidencia floja ya no escribe en la ficha, pero
 * seguía sin ser determinista: el mismo lead podía señalar a una
 * persona distinta según el día.
 */
async function elegirFicha(
  prisma: PrismaService,
  llaves: LlavesDelLead,
  donde: Record<string, unknown>,
): Promise<{ id: string; personaId: string } | null> {
  /// 1. La de SU curso, si pidió uno y la tiene.
  if (llaves.accionFormacionId) {
    const suya = await prisma.participante.findFirst({
      where: { ...donde, accionFormacionId: llaves.accionFormacionId },
      select: { id: true, personaId: true },
    });
    if (suya) return suya;
  }

  /// 2. Y si no, la MÁS RECIENTE.
  ///
  /// No es arbitrario aunque lo parezca: si pidió un curso que
  /// todavía no tiene, lo que está haciendo es nuevo, y la ficha
  /// que mejor lo representa es la última que abrió. Lo que no
  /// puede ser es «la que devuelva el motor».
  return prisma.participante.findFirst({
    where: donde,
    orderBy: { creadoEn: 'desc' },
    select: { id: true, personaId: true },
  });
}
