/** Asignar grupo a varias personas de una vez. */

/**
 * La preinscripción pública guarda la acción y la oferta, pero NO el
 * grupo. Y `completitud.ts` lo exige para que la ficha entre al
 * reporte del SENA: «sin grupo asignado la fila no dice a qué cohorte
 * pertenece esa persona». Con volumen de pauta, eso es asignar
 * cientos a mano.
 *
 * LA UNIDAD ES LA OFERTA, NO EL GRUPO, y es lo que la revisión
 * adversarial cambió del diseño inicial. Varias celdas comparten
 * oferta —AF1 × BOGOTÁ la sirven el Grupo 1 y el Grupo 2—, así que
 * abriendo grupo por grupo se ven LOS MISMOS candidatos dos veces:
 * dos líderes marcan a la misma gente y cada uno cree que se la
 * llevó. Se elige la oferta, sale una lista, y se dice a qué celda
 * van.
 *
 * EL CANDADO VA SOBRE LA OFERTA, por lo mismo. Bloquear la celda
 * dejaría pasar a dos lotes de celdas hermanas contando cada uno por
 * su lado sobre el mismo montón de candidatos.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService, ENTIDADES } from '../comun/auditoria.service';
import { OCUPAN_SILLA, RETIENEN_ASIENTO } from './etapas';
import {
  cuantosCaben,
  elegiblesDelGrupo,
  porQueNoCuadraLaCelda,
} from './elegibles-del-grupo';

type Admin = { id: string; nombre: string };

/// Lo que aguanta una petición sin pasarse del corte de Cloudflare.
/// El mismo tope que el lote de leads, por lo mismo.
export const TOPE_DEL_LOTE_DE_GRUPO = 300;

/// Cuantos candidatos se traen para mirar.
///
/// Mas que el tope del lote a proposito: el asesor tiene que poder
/// VER que hay mas esperando de los que puede marcar de una vez. Si
/// los dos numeros fueran iguales, una lista llena se leeria como
/// «estos son todos».
export const CANDIDATOS_QUE_SE_TRAEN = 500;

@Injectable()
export class AsignarGrupo {
  private readonly log = new Logger('AsignarGrupo');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Las ofertas con gente sin grupo, y sus celdas. */
  async pendientes(ambito: string[]) {
    if (!ambito.length) return { ofertas: [] };

    const ofertas = await this.prisma.oferta.findMany({
      where: {
        accionFormacion: { convenioId: { in: ambito } },
        /// Solo las que tienen a alguien esperando: una lista de
        /// ofertas con cero pendientes es ruido que hay que
        /// atravesar para llegar a las que sí.
        ///
        /// Y «esperando» son los YA INSCRITOS, la misma regla que
        /// `elegiblesDelGrupo`. Si aquí se contara a los interesados,
        /// la fila diría «120 sin grupo» y al abrirla saldrían ocho.
        participantes: { some: { coberturaId: null, etapa: { in: OCUPAN_SILLA } } },
      },
      select: {
        id: true,
        modalidad: true,
        ubicacionId: true,
        ubicacion: { select: { nombre: true, tipo: true } },
        accionFormacion: {
          select: { id: true, codigo: true, nombre: true, convenioId: true },
        },
        _count: {
          select: {
            participantes: { where: { coberturaId: null, etapa: { in: OCUPAN_SILLA } } },
          },
        },
      },
      orderBy: [
        { accionFormacion: { codigo: 'asc' } },
        { ubicacion: { nombre: 'asc' } },
      ],
    });

    /// Las celdas de cada oferta, con sus DOS números.
    const celdas = await this.prisma.grupoCobertura.findMany({
      where: {
        grupo: { accionFormacion: { convenioId: { in: ambito } } },
        ubicacionId: { in: [...new Set(ofertas.map((o) => o.ubicacionId))] },
      },
      select: {
        id: true,
        modalidad: true,
        ubicacionId: true,
        cuposMaximos: true,
        cuposBase: true,
        grupo: {
          select: {
            numero: true,
            fechaInicio: true,
            horario: true,
            accionFormacionId: true,
          },
        },
        _count: {
          select: {
            participantes: { where: { etapa: { in: RETIENEN_ASIENTO } } },
          },
        },
      },
      orderBy: [{ grupo: { numero: 'asc' } }],
    });

    /// Las sillas ocupadas, que es OTRA pregunta.
    ///
    /// «Apuntados a la cohorte» y «consumieron el aula» no son lo
    /// mismo, y con un solo número o se sobrevende o parece lleno lo
    /// que está libre. Se enseñan los dos.
    const sillas = await this.prisma.participante.groupBy({
      by: ['coberturaId'],
      where: {
        coberturaId: { in: celdas.map((c) => c.id) },
        etapa: { in: OCUPAN_SILLA },
      },
      _count: { _all: true },
    });
    const porCelda = new Map(sillas.map((s) => [s.coberturaId, s._count._all]));

    return {
      ofertas: ofertas.map((o) => ({
        ofertaId: o.id,
        convenioId: o.accionFormacion.convenioId,
        accion: `${o.accionFormacion.codigo} · ${o.accionFormacion.nombre}`,
        sede: o.ubicacion.nombre,
        tipoDeSede: o.ubicacion.tipo,
        modalidad: o.modalidad,
        sinGrupo: o._count.participantes,
        /// Las celdas que le sirven a ESTA oferta: mismo curso, misma
        /// sede y misma modalidad. Son las hermanas que se reparten
        /// el mismo montón, y por eso van juntas.
        celdas: celdas
          .filter(
            (c) =>
              c.grupo.accionFormacionId === o.accionFormacion.id &&
              c.ubicacionId === o.ubicacionId &&
              c.modalidad === o.modalidad,
          )
          .map((c) => ({
            coberturaId: c.id,
            numero: c.grupo.numero,
            fechaInicio: c.grupo.fechaInicio,
            horario: c.grupo.horario,
            /// El TOPE, con el 30 % de sobrecupo ya dentro. Enseñar
            /// `cuposBase` haría que la pantalla midiera con una
            /// columna y el candado con otra.
            tope: c.cuposMaximos,
            comprometidos: c.cuposBase,
            apuntados: c._count.participantes,
            sillasOcupadas: porCelda.get(c.id) ?? 0,
            caben: cuantosCaben({
              cuposMaximos: c.cuposMaximos,
              apuntados: c._count.participantes,
            }),
          })),
      })),
    };
  }

  /** Los candidatos de una oferta: los que no tienen grupo. */
  async candidatos(ofertaId: string, ambito: string[]) {
    const oferta = await this.exigirOferta(ofertaId, ambito);

    const filas = await this.prisma.participante.findMany({
      where: elegiblesDelGrupo({ ofertaId, convenioId: oferta.accionFormacion.convenioId }),
      /// POR ORDEN DE LLEGADA, el más viejo primero.
      ///
      /// Al revés que la bandeja: aquí se reparte una cohorte, y quien
      /// lleva más tiempo esperando entra antes. Con `desc`, un lote
      /// de 300 sobre 600 candidatos se llevaría a los recién
      /// llegados y dejaría a los de hace un mes para siempre.
      orderBy: { creadoEn: 'asc' },
      take: CANDIDATOS_QUE_SE_TRAEN,
      select: {
        id: true,
        etapa: true,
        creadoEn: true,
        persona: {
          select: {
            primerNombre: true,
            primerApellido: true,
            numeroDocumento: true,
            correo: true,
            celular: true,
          },
        },
        asesor: { select: { nombre: true } },
      },
    });

    return {
      ofertaId,
      accion: `${oferta.accionFormacion.codigo} · ${oferta.accionFormacion.nombre}`,
      sede: oferta.ubicacion.nombre,
      modalidad: oferta.modalidad,
      total: filas.length,
      candidatos: filas,
    };
  }

  /** Asigna la celda a los que se marcaron. */
  async asignar(
    coberturaId: string,
    ids: string[],
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    if (ids.length > TOPE_DEL_LOTE_DE_GRUPO) {
      throw new BadRequestException(
        `Un lote admite hasta ${TOPE_DEL_LOTE_DE_GRUPO} personas.`,
      );
    }

    /// Fuera del ámbito la celda NO EXISTE: 404 y no 403. Un 403
    /// confirmaría que el grupo del otro gremio existe.
    const celda = await this.prisma.grupoCobertura.findFirst({
      where: {
        id: coberturaId,
        grupo: { accionFormacion: { convenioId: { in: ambito } } },
      },
      select: {
        id: true,
        ubicacionId: true,
        modalidad: true,
        cuposMaximos: true,
        ubicacion: { select: { nombre: true } },
        grupo: {
          select: {
            numero: true,
            accionFormacionId: true,
            accionFormacion: { select: { convenioId: true } },
          },
        },
      },
    });
    if (!celda) throw new NotFoundException('Ese grupo no existe.');

    const oferta = await this.prisma.oferta.findUnique({
      where: {
        accionFormacionId_ubicacionId: {
          accionFormacionId: celda.grupo.accionFormacionId,
          ubicacionId: celda.ubicacionId,
        },
      },
      select: { id: true, ubicacionId: true, modalidad: true },
    });

    const noCuadra = porQueNoCuadraLaCelda(
      {
        ubicacionId: celda.ubicacionId,
        modalidad: celda.modalidad,
        numero: celda.grupo.numero,
        sede: celda.ubicacion.nombre,
      },
      oferta,
    );
    if (noCuadra) throw new BadRequestException(noCuadra);

    const convenioId = celda.grupo.accionFormacion.convenioId;
    const resultado = await this.prisma.$transaction(async (tx) => {
      /// EL CANDADO VA SOBRE LA OFERTA, no sobre la celda.
      ///
      /// Dos celdas hermanas —Grupo 1 y Grupo 2 de la misma oferta—
      /// se reparten el MISMO montón de candidatos. Bloqueando la
      /// celda, los dos lotes correrían a la vez, los dos verían a la
      /// misma persona sin grupo, y el segundo le pisaría la cohorte
      /// al primero.
      ///
      /// Es el mismo `FOR UPDATE` que ya protege el aforo en
      /// `cambiarEtapa`, sobre la misma fila.
      await tx.$queryRaw`SELECT "id" FROM "ofertas" WHERE "id" = ${oferta!.id} FOR UPDATE`;

      /// Se relee la elegibilidad SOBRE LAS FILAS DE VERDAD, no sobre
      /// lo que vino en el cuerpo: un id pegado a mano de otra oferta,
      /// de otro convenio o de alguien que ya salió no entra.
      const suyos = await tx.participante.findMany({
        where: {
          id: { in: ids },
          ...elegiblesDelGrupo({ ofertaId: oferta!.id, convenioId }),
        },
        select: { id: true, etapa: true },
      });

      /// Cuántos caben AHORA, con la fila tomada.
      const apuntados = await tx.participante.count({
        where: { coberturaId: celda.id, etapa: { in: RETIENEN_ASIENTO } },
      });
      const caben = cuantosCaben({ cuposMaximos: celda.cuposMaximos, apuntados });

      const entran = suyos.slice(0, caben);
      const sinCupo = suyos.length - entran.length;

      if (entran.length) {
        await tx.participante.updateMany({
          where: {
            id: { in: entran.map((p) => p.id) },
            /// TAMBIÉN en la escritura, no solo en la lectura: lo que
            /// no se escribe con el candado puesto no está protegido.
            coberturaId: null,
          },
          data: { coberturaId: celda.id },
        });

        await tx.movimientoParticipante.createMany({
          data: entran.map((p) => ({
            participanteId: p.id,
            etapaAntes: p.etapa,
            etapaDespues: p.etapa,
            adminId: admin.id,
            nota: `Asignada al grupo ${celda.grupo.numero} · ${celda.ubicacion.nombre}`,
            ip: ip ?? null,
          })),
        });
      }

      return {
        asignadas: entran.length,
        /// Los TRES números y no un total: los que no pasan el ámbito
        /// o ya tenían grupo no se tocaron, y contarlos como
        /// asignados sería mentir sobre lo que pasó.
        fuera: ids.length - suyos.length,
        sinCupo,
        cabenAhora: Math.max(0, caben - entran.length),
      };
    });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'PARTICIPANTE_EDITADO',
      entidad: ENTIDADES.PARTICIPANTE,
      entidadId: coberturaId,
      convenioId,
      resumen:
        `${resultado.asignadas} al grupo ${celda.grupo.numero} de ` +
        `${celda.ubicacion.nombre}.`,
      ip,
    });

    this.log.log(
      `${resultado.asignadas} al grupo ${celda.grupo.numero} · ` +
        `${celda.ubicacion.nombre} por ${admin.nombre}.`,
    );
    return resultado;
  }

  private async exigirOferta(ofertaId: string, ambito: string[]) {
    const oferta = await this.prisma.oferta.findFirst({
      where: { id: ofertaId, accionFormacion: { convenioId: { in: ambito } } },
      select: {
        id: true,
        modalidad: true,
        ubicacion: { select: { nombre: true } },
        accionFormacion: { select: { codigo: true, nombre: true, convenioId: true } },
      },
    });
    if (!oferta) throw new NotFoundException('Esa oferta no existe.');
    return oferta;
  }
}
