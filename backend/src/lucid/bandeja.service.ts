/** La bandeja: las conversaciones que no se pegaron solas. */

/**
 * «NO ESTÁ LLEGANDO LAS CONVERSACIONES DE LUCID; DICE QUE LLEGA 200
 * PERO NO QUEDA» (cliente, 5 oct 2026).
 *
 * Llegaban, y se guardaban. Lo que pasaba es que cuando el número no
 * casa con nadie del gremio ---o casa con más de uno--- la
 * conversación queda en estado `SIN_DUENO` o `AMBIGUA`, y NINGUNA
 * pantalla del CRM leía esa tabla. Guardado donde nadie lo ve es
 * indistinguible de perdido. Y encima el olvidador borra las sin dueño
 * a los 60 días, así que acababa siendo verdad.
 *
 * Esto es lo mínimo que quita la invisibilidad: verlas, y pegarlas a
 * mano a la ficha o al lead que les corresponda.
 *
 * LO QUE NO HACE, a propósito, para que esté hoy y no la semana que
 * viene: no filtra por fecha ni por asesor, no tiene acciones en lote,
 * y no se contesta desde el CRM. Eso es la bandeja completa, y son
 * otras horas.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CanalContacto,
  EstadoConversacion,
  type Prisma,
} from '../../generated/prisma';
import { firmaDe, type Proveedor } from '../integraciones/proveedores';
import { PrismaService } from '../prisma/prisma.service';

/// Cuántas se traen de una vez. Son las que nadie ha resuelto
/// todavía: si hay más de cien, el problema no es la paginación.
const POR_PAGINA = 100;

/** Una conversación esperando dueño, tal como se enseña. */
export type ConversacionEnEspera = {
  id: string;
  estado: EstadoConversacion;
  celular: string;
  resumen: string;
  /// Cuándo pasó, si Lucid lo dijo; si no, cuándo nos llegó.
  cuando: string;
  /// Si la fecha es la de Lucid o la nuestra. En pantalla cambia el
  /// rótulo: decir «ocurrió» de la hora en que nos llegó sería
  /// inventar un dato.
  cuandoEsDeLucid: boolean;
  convenioSigla: string | null;
  /// A quiénes podía tocar, cuando toca a más de uno. Con nombre y
  /// documento, que es lo que deja elegir sin abrir otra pantalla.
  candidatos: Array<{
    tipo: 'FICHA' | 'LEAD';
    id: string;
    nombre: string | null;
    documento: string | null;
    etapa: string | null;
  }>;
};

@Injectable()
export class BandejaDeConversaciones {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Las que esperan dueño, de los gremios que la cuenta alcanza.
   *
   * LAS PEGADAS NO SALEN: esas ya están en su ficha, y la bandeja es
   * una cola de trabajo, no un historial. Un historial con mil
   * conversaciones resueltas esconde las tres que hay que mirar.
   */
  async enEspera(convenios: string[]): Promise<ConversacionEnEspera[]> {
    if (convenios.length === 0) return [];

    const filas = await this.prisma.conversacionEntrante.findMany({
      where: {
        convenioId: { in: convenios },
        estado: {
          in: [EstadoConversacion.SIN_DUENO, EstadoConversacion.AMBIGUA],
        },
      },
      /// Las ambiguas primero: esas tienen a quién pegarlas y se
      /// resuelven en un clic. Las sin dueño piden buscar a la
      /// persona, que es más trabajo.
      orderBy: [{ estado: 'asc' }, { recibidoEn: 'desc' }],
      take: POR_PAGINA,
      select: {
        id: true,
        estado: true,
        celular: true,
        resumen: true,
        ocurridoEn: true,
        recibidoEn: true,
        candidatos: true,
        convenio: { select: { sigla: true } },
      },
    });

    /// Los candidatos se guardaron como ids. Se resuelven en UNA
    /// consulta por tipo: una por conversación serían cien.
    const ids = { FICHA: new Set<string>(), LEAD: new Set<string>() };
    for (const f of filas) {
      for (const c of leerCandidatos(f.candidatos)) ids[c.tipo].add(c.id);
    }

    const [fichas, leads] = await Promise.all([
      ids.FICHA.size
        ? this.prisma.participante.findMany({
            where: { id: { in: [...ids.FICHA] } },
            select: {
              id: true,
              etapa: true,
              persona: {
                select: {
                  primerNombre: true,
                  primerApellido: true,
                  numeroDocumento: true,
                },
              },
            },
          })
        : [],
      ids.LEAD.size
        ? this.prisma.leadEntrante.findMany({
            where: { id: { in: [...ids.LEAD] } },
            select: { id: true, nombreCompleto: true, numeroDocumento: true },
          })
        : [],
    ]);

    const porFicha = new Map(fichas.map((f) => [f.id, f]));
    const porLead = new Map(leads.map((l) => [l.id, l]));

    return filas.map((f) => ({
      id: f.id,
      estado: f.estado,
      celular: f.celular,
      resumen: f.resumen,
      cuando: (f.ocurridoEn ?? f.recibidoEn).toISOString(),
      cuandoEsDeLucid: f.ocurridoEn !== null,
      convenioSigla: f.convenio?.sigla ?? null,
      candidatos: leerCandidatos(f.candidatos).map((c) => {
        if (c.tipo === 'FICHA') {
          const ficha = porFicha.get(c.id);
          return {
            tipo: 'FICHA' as const,
            id: c.id,
            nombre: ficha
              ? `${ficha.persona.primerNombre} ${ficha.persona.primerApellido}`
              : null,
            documento: ficha?.persona.numeroDocumento ?? null,
            etapa: ficha?.etapa ?? null,
          };
        }
        const lead = porLead.get(c.id);
        return {
          tipo: 'LEAD' as const,
          id: c.id,
          nombre: lead?.nombreCompleto ?? null,
          documento: lead?.numeroDocumento ?? null,
          etapa: null,
        };
      }),
    }));
  }

  /**
   * Pegarla a mano a una ficha o a un lead.
   *
   * Hace LO MISMO que el camino automático ---la misma nota, con la
   * misma firma y sin resultado--- para que una conversación pegada a
   * mano y otra pegada sola sean indistinguibles en la ficha. Si
   * aquí se escribiera distinto, el historial diría de dónde vino el
   * trabajo en vez de qué pasó con la persona.
   *
   * LA NOTA SIGUE SIENDO DE LUCID, no de quien la pega: el texto es el
   * resumen de la conversación, que la asesora no escribió. Por eso
   * `autorId` va nulo, igual que en el camino automático, y así
   * tampoco cuenta como gestión de nadie en el tablero de asesores.
   */
  async pegar(
    conversacionId: string,
    convenios: string[],
    destino: { participanteId?: string; leadId?: string },
  ) {
    if (!destino.participanteId && !destino.leadId) {
      throw new BadRequestException(
        'Diga a quién se pega: una ficha o un lead.',
      );
    }
    if (destino.participanteId && destino.leadId) {
      throw new BadRequestException(
        'A una ficha o a un lead, no a los dos: una conversación pasó con una persona.',
      );
    }

    const conversacion = await this.prisma.conversacionEntrante.findFirst({
      where: { id: conversacionId, convenioId: { in: convenios } },
      select: {
        id: true,
        convenioId: true,
        estado: true,
        resumen: true,
        origenSistema: true,
        notaId: true,
      },
    });
    if (!conversacion) {
      throw new NotFoundException('Esa conversación no existe, o no es suya.');
    }
    /// YA PEGADA, NO SE VUELVE A PEGAR. Dos notas con el mismo texto
    /// en dos fichas distintas es peor que una conversación sin
    /// dueño: parece que la persona escribió dos veces.
    if (conversacion.estado === EstadoConversacion.PEGADA) {
      throw new BadRequestException(
        'Esa conversación ya está pegada. Una conversación pasó con una sola persona.',
      );
    }

    /// EL DESTINO TIENE QUE SER DEL MISMO GREMIO. No es una
    /// formalidad: pegar una conversación de ADECOPRIA en una ficha
    /// de BRITCHAM mete el dato de una persona en el tratamiento de
    /// datos del otro convenio.
    if (destino.participanteId) {
      const ficha = await this.prisma.participante.findFirst({
        where: {
          id: destino.participanteId,
          convenioId: conversacion.convenioId,
        },
        select: { id: true },
      });
      if (!ficha) {
        throw new BadRequestException(
          'Esa ficha no es de este gremio. Las conversaciones no se mezclan entre convenios.',
        );
      }
    } else {
      const lead = await this.prisma.leadEntrante.findFirst({
        where: { id: destino.leadId, convenioId: conversacion.convenioId },
        select: { id: true },
      });
      if (!lead) {
        throw new BadRequestException(
          'Ese lead no es de este gremio. Las conversaciones no se mezclan entre convenios.',
        );
      }
    }

    const nota = await this.prisma.notaDeGestion.create({
      data: {
        participanteId: destino.participanteId ?? null,
        leadId: destino.leadId ?? null,
        autorId: null,
        autorNombre: firmaDe(conversacion.origenSistema as Proveedor),
        texto: conversacion.resumen,
        canales: [CanalContacto.WHATSAPP],
        /// SIN resultado, igual que en el camino automático: las notas
        /// del sistema no son intentos de contacto, y marcarlas así
        /// vaciaría sola la lista de a quién hay que insistirle.
        resultado: null,
      },
      select: { id: true },
    });

    await this.prisma.conversacionEntrante.update({
      where: { id: conversacion.id },
      data: { estado: EstadoConversacion.PEGADA, notaId: nota.id },
    });

    /// Si es de un lead, se mueve su última gestión: es verdad que se
    /// le tocó, y la cola del asesor se ordena por eso. Lo mismo que
    /// hace el camino automático.
    if (destino.leadId) {
      await this.prisma.leadEntrante.update({
        where: { id: destino.leadId },
        data: { ultimaGestionEn: new Date() },
      });
    }

    return { pegada: true, notaId: nota.id };
  }
}

/**
 * Los candidatos guardados, leídos sin confiar en su forma.
 *
 * Es una columna `Json` escrita por una versión anterior del
 * emparejador: lo que haya ahí puede no tener la forma de hoy, y una
 * bandeja que revienta por una fila vieja no enseña las demás.
 */
function leerCandidatos(
  valor: Prisma.JsonValue | null,
): Array<{ tipo: 'FICHA' | 'LEAD'; id: string }> {
  if (!Array.isArray(valor)) return [];
  const salida: Array<{ tipo: 'FICHA' | 'LEAD'; id: string }> = [];
  for (const c of valor) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    const fila = c as Record<string, unknown>;
    const tipo = fila.tipo;
    const id = fila.id;
    if ((tipo === 'FICHA' || tipo === 'LEAD') && typeof id === 'string') {
      salida.push({ tipo, id });
    }
  }
  return salida;
}
