/** Los dos reportes al SEP, y quién no entra en ellos. */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { EtapaParticipante } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { construirLibro, type Hoja } from '../../tableros/exportar';
import { DEPARTAMENTO_POR_ID, MUNICIPIO_POR_ID } from '../catalogos-sep';
import { revisar } from '../completitud';
import { GENERO_EN_EL_REPORTE, type FilaSep } from './datos';
import * as cargue from './formato-cargue-sep';
import {
  COLUMNAS as COLUMNAS_F7,
  faltaEnF7,
  fila as filaF7,
  type FilaF7,
} from './formato-f7';
import * as usoDirecto from './formato-uso-directo';

export type Formato = 'uso-directo' | 'cargue-sep' | 'f7';

/// Solo quien ya tiene silla. Se dice cuáles entran, no
/// cuáles se excluyen: por descarte entraría INTERESADO, que es
/// un nombre que alguien tecleó y saldría como ACTIVO.
const ETAPAS_DEL_REPORTE: EtapaParticipante[] = [
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
];

type Excluido = { nombre: string; documento: string; etapa: string; motivo: string };

@Injectable()
export class SepService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cuántos entran, cuántos no y por qué. */
  async alistamiento(convenioId: string, ambito: string[]) {
    const { listos, excluidos, convenio } = await this.preparar(convenioId, ambito);

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

  async exportar(convenioId: string, formato: Formato, ano: number, ambito: string[]) {
    const { listos, excluidos } = await this.preparar(convenioId, ambito);

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

  /**
   * El F7 va por ORGANIZACIÓN, no por persona: una fila
   * es una empresa dentro de una acción, con cuántos de
   * los suyos se están formando.
   */
  async exportarF7(convenioId: string, ambito: string[]) {
    if (!ambito.includes(convenioId)) {
      throw new ForbiddenException('No tiene acceso a ese convenio.');
    }

    const participantes = await this.prisma.participante.findMany({
      where: {
        convenioId,
        etapa: { in: ETAPAS_DEL_REPORTE },
        reserva: { isNot: null },
      },
      select: {
        accionFormacion: { select: { nombre: true } },
        reserva: { select: { empresa: true } },
      },
    });

    // agrupadas por empresa Y accion: la misma empresa
    // puede tener gente en dos cursos distintos
    const grupos = new Map<string, FilaF7>();
    for (const p of participantes) {
      const e = p.reserva?.empresa;
      if (!e || !p.accionFormacion) continue;
      const clave = `${e.id}|${p.accionFormacion.nombre}`;
      const ya = grupos.get(clave);
      if (ya) {
        ya.beneficiarios += 1;
        continue;
      }
      grupos.set(clave, {
        accion: p.accionFormacion.nombre,
        beneficiarios: 1,
        empresa: {
          razonSocial: e.razonSocial,
          nit: e.nit,
          digitoVerificacion: e.digitoVerificacion,
          departamento: e.departamentoSepId
            ? (DEPARTAMENTO_POR_ID.get(e.departamentoSepId)?.etiqueta ?? null)
            : null,
          // el municipio es una tupla [id, depto, nombre, ...]
          municipio: e.municipioSepId
            ? (MUNICIPIO_POR_ID.get(e.municipioSepId)?.[2] ?? null)
            : null,
          direccion: e.direccion,
          telefono: e.telefono,
          contactoNombre: e.contactoNombre,
          contactoCargo: e.contactoCargo,
          contactoCorreo: e.contactoCorreo,
          tamanoSepId: e.tamanoSepId,
          numeroTrabajadores: e.numeroTrabajadores,
          papelEnConvenio: e.papelEnConvenio,
          sectorEconomico: e.sectorEconomico,
          clasificacion: e.clasificacion,
        },
      });
    }

    const todas = [...grupos.values()].sort((a, b) =>
      a.empresa.razonSocial.localeCompare(b.empresa.razonSocial, 'es'),
    );

    const listas: FilaF7[] = [];
    const incompletas: Array<{ empresa: string; nit: string; accion: string; motivo: string }> = [];
    for (const f of todas) {
      const falta = faltaEnF7(f.empresa);
      if (falta.length) {
        incompletas.push({
          empresa: f.empresa.razonSocial,
          nit: f.empresa.nit,
          accion: f.accion,
          motivo: falta[0],
        });
      } else {
        listas.push(f);
      }
    }

    const hojas: Hoja[] = [
      {
        nombre: 'F7',
        columnas: COLUMNAS_F7,
        filas: listas.map((f, i) => filaF7(f, i)),
        crudo: true,
      },
    ];

    if (incompletas.length) {
      hojas.push({
        nombre: 'No exportadas',
        columnas: [
          { titulo: 'Organización', clave: 'empresa', ancho: 40 },
          { titulo: 'NIT', clave: 'nit' },
          { titulo: 'Acción de formación', clave: 'accion', ancho: 50 },
          { titulo: 'Qué le falta', clave: 'motivo', ancho: 40 },
        ],
        filas: incompletas,
      });
    }

    return {
      libro: await construirLibro(hojas),
      listos: listas.length,
      excluidos: incompletas.length,
    };
  }

  /** Cuántas organizaciones entran en el F7 y cuántas no. */
  async alistamientoF7(convenioId: string, ambito: string[]) {
    const { listos, excluidos } = await this.exportarF7(convenioId, ambito);
    return { listos, noListos: excluidos };
  }

  /** Arma las filas y separa las que no están listas. */
  private async preparar(convenioId: string, ambito: string[]) {
    // el archivo lleva cedulas: sin concesion, ni el
    // alistamiento se puede ver
    if (!ambito.includes(convenioId)) {
      throw new ForbiddenException('No tiene acceso a ese convenio.');
    }

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

    // una sola consulta para todas las autorizaciones.
    // El filtro va por la relacion y NO con la lista de
    // personaId: Postgres admite 32.767 parametros en una
    // sentencia preparada, asi que un `in` con un id por
    // participante revienta el reporte entero pasada esa
    // cifra. Por la relacion no viaja ningun parametro que
    // crezca con las filas
    const autorizados = new Set(
      (
        await this.prisma.autorizacionDatos.findMany({
          where: {
            revocadaEn: null,
            politica: { destinatario: 'PARTICIPANTE', convenioId },
            persona: {
              participaciones: {
                some: { convenioId, etapa: { in: ETAPAS_DEL_REPORTE } },
              },
            },
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
