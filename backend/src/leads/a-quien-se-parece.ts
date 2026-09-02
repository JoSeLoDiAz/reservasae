/** Las personas a las que un lead se parece, para juzgar su revocación. */

/**
 * `revocoDespuesDe` buscaba SOLO por documento y devolvía `false`
 * sin mirar cuando el lead no traía cédula. O sea que para el
 * caso que este encargo existe para habilitar —el lead de pauta
 * sin documento— la comprobación de revocación era un no-op.
 *
 * Es el mismo patrón que la casilla de habeas data que se
 * guardaba y no leía nadie: un control en pie y vacío de efecto.
 *
 * Aquí se cruza por lo que el lead SÍ trae. Las tres llaves son
 * las mismas con las que `cruzarConElCrm` reconoce a alguien, y a
 * propósito: si allá se considera que este lead «se parece» a esa
 * persona, aquí también tiene que parecerse. Dos criterios
 * distintos para la misma pregunta acaban discrepando.
 *
 * SE PECA DE MÁS, Y ES DELIBERADO. Por correo y por celular la
 * coincidencia no es firme —la secretaria que puso el suyo en
 * veinte formularios—, así que se puede bloquear una llamada
 * legítima. Se acepta: no llamar a quien sí se podía es una
 * llamada perdida; llamar a quien revocó es incumplir el artículo
 * 8. Los dos errores no cuestan lo mismo.
 *
 * El ámbito NO se aplica aquí, y es correcto: `Persona` no tiene
 * convenio —la misma cédula en los dos gremios es una persona con
 * dos participaciones— y la revocación se pide sobre la persona.
 * Es el mismo criterio que ya usa el candado del RUI.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { normalizarCelular } from '../comun/celular';
import { normalizarDocumento } from '../comun/documento';

/// Lo que el lead trae con que buscar.
export type SenasDelLead = {
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  correo: string | null;
  celular: string | null;
};

@Injectable()
export class AQuienSeParece {
  constructor(private readonly prisma: PrismaService) {}

  /** ¿Alguna de las personas a las que se parece revocó? */
  async revoco(senas: SenasDelLead, desde?: Date): Promise<boolean> {
    const personas = await this.personas(senas);
    if (!personas.length) return false;

    const revocada = await this.prisma.autorizacionDatos.findFirst({
      where: {
        personaId: { in: personas },
        /// Sin `desde` es «revocó alguna vez»; con `desde`, «revocó
        /// DESPUÉS de esto». La segunda la usa la conversión: la
        /// autorización del lead es un hecho del pasado y solo la
        /// revocación posterior la anula.
        revocadaEn: desde ? { gt: desde } : { not: null },
      },
      select: { id: true },
    });
    return Boolean(revocada);
  }

  /**
   * Cuáles de estos leads tocan a alguien que revocó.
   *
   * UNA consulta para la página entera, no una por fila.
   * Preguntando lead a lead, una mesa de 200 haría 400 viajes a la
   * base para pintar una tabla — y con volumen de pauta la mesa es
   * la pantalla que más se abre.
   *
   * Devuelve el conjunto de ids que NO se pueden contactar.
   */
  async cualesRevocaron(
    leads: Array<{ id: string } & SenasDelLead>,
  ): Promise<Set<string>> {
    const fuera = new Set<string>();
    if (!leads.length) return fuera;

    /// Todo lo que hay que buscar, de una vez.
    const correos = new Set<string>();
    const celulares = new Set<string>();
    const docs: Array<{ tipoDocumentoSepId: number; numeroDocumento: string }> = [];

    for (const l of leads) {
      const c = (l.correo ?? '').trim().toLowerCase();
      if (c) correos.add(c);
      const cel = l.celular ? normalizarCelular(l.celular) : '';
      if (cel) celulares.add(cel);
      const num = l.numeroDocumento ? normalizarDocumento(l.numeroDocumento) : null;
      if (num && l.tipoDocumentoSepId !== null) {
        docs.push({ tipoDocumentoSepId: l.tipoDocumentoSepId, numeroDocumento: num });
      }
    }

    const donde: Array<Record<string, unknown>> = [];
    if (correos.size) donde.push({ correo: { in: [...correos] } });
    if (celulares.size) donde.push({ celular: { in: [...celulares] } });
    if (docs.length) donde.push({ OR: docs });
    if (!donde.length) return fuera;

    /// Solo las que TIENEN una revocación: el filtro va en la
    /// consulta y no en Node. Traer todas las personas que
    /// coinciden para después mirar quién revocó sería traer la
    /// tabla entera en el caso normal, donde casi nadie revoca.
    const revocadas = await this.prisma.persona.findMany({
      where: {
        AND: [
          { OR: donde },
          { autorizaciones: { some: { revocadaEn: { not: null } } } },
        ],
      },
      select: {
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        correo: true,
        celular: true,
      },
    });
    if (!revocadas.length) return fuera;

    const correosMalos = new Set(
      revocadas.map((r) => (r.correo ?? '').trim().toLowerCase()).filter(Boolean),
    );
    const celularesMalos = new Set(
      revocadas.map((r) => (r.celular ? normalizarCelular(r.celular) : '')).filter(Boolean),
    );
    const docsMalos = new Set(
      revocadas.map((r) => `${r.tipoDocumentoSepId}-${r.numeroDocumento}`),
    );

    for (const l of leads) {
      const c = (l.correo ?? '').trim().toLowerCase();
      const cel = l.celular ? normalizarCelular(l.celular) : '';
      const num = l.numeroDocumento ? normalizarDocumento(l.numeroDocumento) : null;
      const doc =
        num && l.tipoDocumentoSepId !== null
          ? `${l.tipoDocumentoSepId}-${num}`
          : null;

      if ((c && correosMalos.has(c)) || (cel && celularesMalos.has(cel)) || (doc && docsMalos.has(doc))) {
        fuera.add(l.id);
      }
    }
    return fuera;
  }

  /// Los ids de las personas a las que se parece.
  private async personas(s: SenasDelLead): Promise<string[]> {
    const donde: Array<Record<string, unknown>> = [];

    const numero = s.numeroDocumento ? normalizarDocumento(s.numeroDocumento) : null;
    if (numero && s.tipoDocumentoSepId !== null) {
      donde.push({ tipoDocumentoSepId: s.tipoDocumentoSepId, numeroDocumento: numero });
    }

    const correo = (s.correo ?? '').trim().toLowerCase();
    if (correo) donde.push({ correo: { equals: correo, mode: 'insensitive' } });

    /// El MISMO normalizador que el resto del sistema: sin él,
    /// `+57 300 111 2222` y `3001112222` serían dos personas.
    const celular = s.celular ? normalizarCelular(s.celular) : '';
    if (celular) donde.push({ celular });

    /// Sin nada con que buscar, nadie. No es lo mismo que «no
    /// revocó»: es que no hay a quien preguntar, y `revoco`
    /// devuelve false, que es lo correcto -- un lead anonimo no
    /// puede haber revocado nada.
    if (!donde.length) return [];

    const filas = await this.prisma.persona.findMany({
      where: { OR: donde },
      select: { id: true },
      /// Un correo compartido puede tocar a mucha gente; con que
      /// una haya revocado basta, y mas de 50 no cambia la
      /// respuesta.
      take: 50,
    });
    return filas.map((f) => f.id);
  }
}
