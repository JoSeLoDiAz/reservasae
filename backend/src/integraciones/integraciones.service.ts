/** Reconocer a quien escribe, sin abrir el CRM entero. */

import { BadRequestException, Injectable } from '@nestjs/common';

import { normalizarCelular } from '../comun/celular';
import { faltaDeLaPersona } from '../crm/completitud';
import { PrismaService } from '../prisma/prisma.service';
import { aQuienSePega, type Candidato } from '../lucid/a-quien-se-pega';

/** Lo que se devuelve de una persona, y nada mas. */
export type Reconocido = {
  existe: boolean;
  estado: 'FICHA' | 'LEAD' | 'NINGUNO' | 'AMBIGUO';
  primerNombre: string | null;
  etapa: string | null;
  accion: { codigo: string; nombre: string } | null;
  /// Lo que le falta para entrar al reporte, en palabras.
  falta: string[];
  autorizacionVigente: boolean;
  motivo: string | null;
};

const NADIE: Reconocido = {
  existe: false,
  estado: 'NINGUNO',
  primerNombre: null,
  etapa: null,
  accion: null,
  falta: [],
  autorizacionVigente: false,
  motivo: null,
};

@Injectable()
export class IntegracionesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quien es este telefono, dentro de un gremio.
   *
   * SIEMPRE 200, tambien cuando no es nadie. Un 404 aqui
   * convertiria la ruta en un oraculo de que numeros estan en
   * la base, que es la misma regla que ya gobierna
   * `/marca/formulario/:slug` y `/completar/:token`.
   *
   * REUSA `aQuienSePega`, la misma funcion que decide a quien se
   * le cuelga una conversacion. Con un segundo cruce por
   * telefono, el bot saludaria a alguien a quien la nota
   * despues no se le pega -- dos verdades sobre la misma
   * pregunta.
   */
  async reconocer(
    slug: string | null,
    telefono: string | undefined,
    documento: string | undefined,
  ): Promise<Reconocido> {
    if (!slug) {
      throw new BadRequestException(
        'Falta el convenio. Mándelo en la consulta, o llame al subdominio del gremio.',
      );
    }
    if (!telefono && !documento) {
      throw new BadRequestException('Mande un teléfono o un documento.');
    }

    const convenio = await this.prisma.convenio.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!convenio) throw new BadRequestException(`No existe el convenio «${slug}».`);

    const celular = telefono ? normalizarCelular(telefono) : '';
    const doc = documento ? documento.replace(/\D/g, '') : '';
    if (!celular && !doc) return NADIE;

    const candidatos = await this.candidatosDe(convenio.id, celular, doc);
    const donde = aQuienSePega(candidatos);

    if (donde.estado === 'SIN_DUENO') return NADIE;

    /// AMBIGUO se distingue de NINGUNO a proposito: quien llama
    /// ya tiene llave, y saber que hay que pasar a una persona
    /// es justo para lo que consulta. Lo que NO sale es de quien
    /// es: sin nombre, sin etapa y sin lo que le falta.
    if (donde.estado === 'AMBIGUA') {
      return { ...NADIE, existe: true, estado: 'AMBIGUO', motivo: donde.motivo };
    }

    return donde.destino.tipo === 'FICHA'
      ? this.deLaFicha(donde.destino.id)
      : this.delLead(donde.destino.id);
  }

  /// Los mismos dos lados que mira la puerta de notas, mas el
  /// documento cuando lo mandan.
  private async candidatosDe(
    convenioId: string,
    celular: string,
    documento: string,
  ): Promise<Candidato[]> {
    const dePersona = celular
      ? { OR: [{ celular }, ...(documento ? [{ numeroDocumento: documento }] : [])] }
      : { numeroDocumento: documento };

    const [fichas, leads] = await Promise.all([
      this.prisma.participante.findMany({
        where: { convenioId, persona: dePersona },
        select: { id: true, personaId: true, creadoEn: true },
        take: 20,
      }),
      this.prisma.leadEntrante.findMany({
        where: {
          convenioId,
          participanteId: null,
          ...(celular
            ? { OR: [{ celular }, ...(documento ? [{ numeroDocumento: documento }] : [])] }
            : { numeroDocumento: documento }),
        },
        select: { id: true, recibidoEn: true },
        take: 20,
      }),
    ]);

    return [
      ...fichas.map((f) => ({
        tipo: 'FICHA' as const,
        id: f.id,
        personaId: f.personaId,
        creadoEn: f.creadoEn,
      })),
      ...leads.map((l) => ({ tipo: 'LEAD' as const, id: l.id, creadoEn: l.recibidoEn })),
    ];
  }

  private async deLaFicha(id: string): Promise<Reconocido> {
    const f = await this.prisma.participante.findUnique({
      where: { id },
      select: {
        etapa: true,
        nivelOcupacionalSepId: true,
        accionFormacion: { select: { codigo: true, nombre: true } },
        persona: {
          select: {
            primerNombre: true,
            correo: true,
            celular: true,
            fechaNacimiento: true,
            generoSepId: true,
            estrato: true,
            departamentoSepId: true,
            municipioSepId: true,
            barrio: true,
            direccion: true,
            /// Cuelga de la PERSONA y no de la ficha: la misma
            /// cedula en los dos gremios es una sola persona.
            autorizaciones: {
              where: { revocadaEn: null },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!f) return NADIE;

    const viva = f.persona.autorizaciones.length > 0;

    return {
      existe: true,
      estado: 'FICHA',
      primerNombre: f.persona.primerNombre,
      etapa: f.etapa,
      accion: f.accionFormacion
        ? { codigo: f.accionFormacion.codigo, nombre: f.accionFormacion.nombre }
        : null,
      /// SIN LO QUE FALTA SI REVOCO. La lista existe para que el
      /// bot pida esos datos, y a quien pidio que no se usaran
      /// los suyos no se le piden mas. El resto se devuelve para
      /// que el agente sepa que la conversacion va a una persona
      /// que ya esta, y no la registre otra vez.
      falta: viva
        ? faltaDeLaPersona({
            persona: f.persona,
            nivelOcupacionalSepId: f.nivelOcupacionalSepId,
          })
        : [],
      autorizacionVigente: viva,
      motivo: null,
    };
  }

  private async delLead(id: string): Promise<Reconocido> {
    const l = await this.prisma.leadEntrante.findUnique({
      where: { id },
      select: {
        primerNombre: true,
        nombreCompleto: true,
        accionFormacion: { select: { codigo: true, nombre: true } },
      },
    });
    if (!l) return NADIE;

    /// Un lead no tiene etapa ni ficha: solo se dice que existe
    /// y por que curso preguntó. `falta` se queda vacio a
    /// proposito -- lo que le falte a un lead lo resuelve el
    /// asesor al convertirlo, no el bot.
    return {
      existe: true,
      estado: 'LEAD',
      primerNombre:
        l.primerNombre ?? ((l.nombreCompleto ?? '').trim().split(/\s+/)[0] || null),
      etapa: null,
      accion: l.accionFormacion
        ? { codigo: l.accionFormacion.codigo, nombre: l.accionFormacion.nombre }
        : null,
      falta: [],
      autorizacionVigente: false,
      motivo: 'Todavía es un lead: no tiene ficha.',
    };
  }
}
