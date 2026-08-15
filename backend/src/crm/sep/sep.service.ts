/** Los dos reportes al SEP, y quién no entra en ellos. */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { EtapaParticipante } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { construirLibro, type Hoja } from '../../tableros/exportar';
import { revisar } from '../completitud';
import { GENERO_EN_EL_REPORTE, type FilaSep } from './datos';
import * as cargue from './formato-cargue-sep';
import * as usoDirecto from './formato-uso-directo';

export type Formato = 'uso-directo' | 'cargue-sep';

/// Solo quien ya tiene silla. Se dice cuáles entran, no
/// cuáles se excluyen: por descarte entraría NUEVO, que es
/// un nombre que alguien tecleó y saldría como ACTIVO.
const ETAPAS_DEL_REPORTE: EtapaParticipante[] = [
  'MATRICULADO',
  'EN_FORMACION',
  'CERTIFICADO',
];

type Excluido = { nombre: string; documento: string; etapa: string; motivo: string };

@Injectable()
export class SepService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cuántos entran, cuántos no y por qué. */
  async alistamiento(convenioId: string) {
    const { listos, excluidos, convenio } = await this.preparar(convenioId);

    // agrupado por motivo: la lista accionable no es de
    // personas, es de "187 sin fecha de nacimiento"
    const porMotivo = new Map<string, number>();
    for (const e of excluidos) {
      porMotivo.set(e.motivo, (porMotivo.get(e.motivo) ?? 0) + 1);
    }

    return {
      convenio: { nombre: convenio.nombre, sigla: convenio.sigla },
      listos: listos.length,
      noListos: excluidos.length,
      motivos: [...porMotivo.entries()]
        .map(([motivo, total]) => ({ motivo, total }))
        .sort((a, b) => b.total - a.total),
      personas: excluidos.slice(0, 300),
    };
  }

  async exportar(convenioId: string, formato: Formato, ano: number) {
    const { listos, excluidos } = await this.preparar(convenioId);

    const definicion = formato === 'cargue-sep' ? cargue : usoDirecto;
    const filas =
      formato === 'cargue-sep'
        ? listos.map((p, i) => cargue.fila(p, i, ano))
        : listos.map((p) => usoDirecto.fila(p));

    const hojas: Hoja[] = [
      {
        nombre: formato === 'cargue-sep' ? 'SEP MASIVO' : 'SEP',
        columnas: definicion.COLUMNAS,
        filas,
        // se pega dentro de la plantilla del cliente
        crudo: true,
      },
    ];

    // los que no entraron van en el mismo libro: una lista
    // aparte que nadie abre es una lista que nadie mira
    if (excluidos.length > 0) {
      hojas.push({
        nombre: 'No exportados',
        columnas: [
          { titulo: 'Documento', clave: 'documento' },
          { titulo: 'Nombre', clave: 'nombre', ancho: 34 },
          { titulo: 'Etapa', clave: 'etapa' },
          { titulo: 'Por qué no entró', clave: 'motivo', ancho: 60 },
        ],
        filas: excluidos,
      });
    }

    return {
      libro: await construirLibro(hojas),
      listos: listos.length,
      excluidos: excluidos.length,
    };
  }

  /** Arma las filas y separa las que no están listas. */
  private async preparar(convenioId: string) {
    const convenio = await this.prisma.convenio.findUnique({
      where: { id: convenioId },
      select: {
        id: true,
        nombre: true,
        sigla: true,
        sepProyectoId: true,
        sepNombreConviniente: true,
      },
    });
    if (!convenio) throw new NotFoundException('Ese convenio no existe.');

    // esto no es "falta en una fila": sin ello no hay
    // archivo. Se aborta, no se entregan 800 filas menos
    if (convenio.sepProyectoId === null) {
      throw new BadRequestException(
        `${convenio.sigla ?? convenio.nombre} no tiene su id de proyecto del SEP. ` +
          'Póngalo en Formación antes de exportar.',
      );
    }

    const participantes = await this.prisma.participante.findMany({
      where: { convenioId, etapa: { in: ETAPAS_DEL_REPORTE } },
      orderBy: [{ accionFormacionId: 'asc' }, { creadoEn: 'asc' }],
      include: {
        persona: true,
        accionFormacion: {
          select: { codigo: true, nombre: true, sepAfId: true, horas: true },
        },
        cobertura: {
          select: {
            grupo: {
              select: {
                numero: true,
                sepGrupoId: true,
                fechaInicio: true,
                accionFormacionId: true,
              },
            },
          },
        },
        reserva: {
          select: {
            empresa: {
              select: {
                nit: true,
                digitoVerificacion: true,
                razonSocial: true,
                tamanoSepId: true,
                tipoDocumentoSepId: true,
              },
            },
          },
        },
      },
    });

    // una sola consulta para todas las autorizaciones
    const autorizados = new Set(
      (
        await this.prisma.autorizacionDatos.findMany({
          where: {
            revocadaEn: null,
            politica: { destinatario: 'PARTICIPANTE', convenioId },
            personaId: { in: participantes.map((p) => p.personaId) },
          },
          select: { personaId: true },
        })
      ).map((a) => a.personaId),
    );

    const listos: FilaSep[] = [];
    const excluidos: Excluido[] = [];

    for (const p of participantes) {
      const nombre = [p.persona.primerNombre, p.persona.primerApellido].join(' ');
      const documento = p.persona.numeroDocumento;

      const { reporte } = revisar({
        ofertaId: p.ofertaId,
        coberturaId: p.coberturaId,
        accionFormacionId: p.accionFormacionId,
        nivelOcupacionalSepId: p.nivelOcupacionalSepId,
        beneficiarioPrevio: p.beneficiarioPrevio,
        tieneAutorizacion: autorizados.has(p.personaId),
        grupoConFechas: Boolean(p.cobertura?.grupo.fechaInicio),
        grupoSepId: p.cobertura?.grupo.sepGrupoId ?? null,
        accionSepId: p.accionFormacion?.sepAfId ?? null,
        persona: p.persona,
      });

      const empresa = p.reserva?.empresa ?? null;
      if (!empresa) reporte.push('no tiene empresa donde labora');

      // el grupo tiene que ser de su misma acción, o el
      // archivo manda un AF y un grupo que se contradicen
      if (
        p.cobertura &&
        p.cobertura.grupo.accionFormacionId !== p.accionFormacionId
      ) {
        reporte.push('su grupo es de otra acción de formación');
      }

      if (reporte.length > 0) {
        excluidos.push({
          nombre,
          documento,
          etapa: p.etapa,
          motivo: reporte[0],
        });
        continue;
      }

      listos.push({
        participante: {
          id: p.id,
          etapa: p.etapa,
          cargoEnEmpresa: p.cargoEnEmpresa,
          nivelOcupacionalSepId: p.nivelOcupacionalSepId,
          beneficiarioPrevio: p.beneficiarioPrevio,
          fechaMatricula: p.fechaMatricula,
        },
        persona: p.persona,
        convenio,
        accion: p.accionFormacion!,
        grupo: {
          numero: p.cobertura!.grupo.numero,
          sepGrupoId: p.cobertura!.grupo.sepGrupoId,
        },
        empresa,
        genero: GENERO_EN_EL_REPORTE[p.persona.generoSepId ?? -1] ?? '',
        caracterizacionSepId: null,
      });
    }

    return { listos, excluidos, convenio };
  }
}
