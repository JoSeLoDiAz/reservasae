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

/**
 * Un libro cuya hoja principal esta vacia no se entrega.
 *
 * El precio de entregarlo es un archivo indistinguible del
 * reporte de verdad; el de negarse, un mensaje. Y dice cuantas
 * hay pendientes, porque "no hay nada listo" y "hay 40 y les
 * falta un dato" se arreglan de formas distintas.
 */
function exigirQueHayaFilas(listos: number, fuera: number, que: string) {
  if (listos > 0) return;
  const cola =
    fuera > 0
      ? `Hay ${fuera} que no ${fuera === 1 ? 'entra' : 'entran'} todavia: mire ` +
        'el alistamiento para saber que les falta.'
      : 'Todavia no hay a quien reportar.';
  throw new BadRequestException(
    `Ninguna ${que} esta lista, asi que el archivo saldria vacio. ${cola}`,
  );
}

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

    /// Lo mismo que el F7: un archivo con cero personas no se
    /// baja. La pantalla ya lo impedia, pero el que manda es
    /// el servidor -- la descarga va por navegacion y basta
    /// pegar la URL.
    exigirQueHayaFilas(listos.length, excluidos.length, 'persona');

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
  private async prepararF7(convenioId: string, ambito: string[]) {
    if (!ambito.includes(convenioId)) {
      throw new ForbiddenException('No tiene acceso a ese convenio.');
    }

    /// Sin exigir reserva.
    ///
    /// Antes el filtro era `reserva: { isNot: null }`, y
    /// `Participante.reservaId` no lo escribe NADIE en
    /// produccion: solo lo pone la siembra de prueba. O sea
    /// que el F7 exportaba cero filas y nadie lo veia, porque
    /// en local la siembra tapaba el hueco.
    ///
    /// La empresa se resuelve de las dos: la propia del lead
    /// primero, y si no, la de la reserva que lo trajo.
    /// Quien revocó NO cuenta como beneficiario suyo.
    ///
    /// El F7 no miraba la autorización y los dos reportes de
    /// personas sí, así que los DOS archivos que se le entregan
    /// al mismo cliente se contradecían: el del SEP con 40
    /// personas de una empresa y el F7 diciendo 41. Y da igual
    /// que aquí la persona solo salga como un número: seguir
    /// reportándola al SENA como beneficiaria es seguir tratando
    /// su participación después de que pidió que no.
    const participantes = await this.prisma.participante.findMany({
      where: {
        convenioId,
        etapa: { in: ETAPAS_DEL_REPORTE },
        persona: {
          autorizaciones: {
            some: { revocadaEn: null, politica: { convenioId } },
          },
        },
      },
      select: {
        accionFormacion: { select: { nombre: true } },
        empresa: true,
        reserva: { select: { empresa: true } },
      },
    });

    // agrupadas por empresa Y accion: la misma empresa
    // puede tener gente en dos cursos distintos
    const grupos = new Map<string, FilaF7>();
    for (const p of participantes) {
      // la suya manda sobre la de la reserva: si alguien
      // llego por una reserva pero despues dijo donde trabaja
      // de verdad, vale lo que dijo
      const e = p.empresa ?? p.reserva?.empresa;
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

    return { listas, incompletas };
  }

  async exportarF7(convenioId: string, ambito: string[]) {
    const { listas, incompletas } = await this.prepararF7(convenioId, ambito);

    /// Un F7 sin una sola organizacion NO se baja.
    ///
    /// Se bajaba: un .xlsx con la cabecera, cero filas y la
    /// hoja de las incompletas al lado. Eso es un archivo que
    /// PARECE el reporte, y el cliente arma sus INSERT
    /// concatenando celdas -- de ahi no sale un error, sale un
    /// cargue de cero registros que nadie nota. La pantalla
    /// tenia el candado en los dos reportes de personas y no
    /// en este, asi que el boton estaba siempre activo.
    exigirQueHayaFilas(listas.length, incompletas.length, 'organización');

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

  /**
   * Cuántas organizaciones entran en el F7 y cuántas no.
   *
   * Contaba construyendo el libro entero y quedandose con dos
   * numeros, y ademas no tenia ruta: la pantalla no podia
   * pedirlo, asi que el F7 era el unico de los tres sin su
   * cifra a la vista.
   */
  async alistamientoF7(convenioId: string, ambito: string[]) {
    const { listas, incompletas } = await this.prepararF7(convenioId, ambito);

    // agrupado por motivo, igual que el de personas: la lista
    // accionable no es de empresas, es de "12 sin telefono"
    const porMotivo = new Map<string, number>();
    for (const i of incompletas) {
      porMotivo.set(i.motivo, (porMotivo.get(i.motivo) ?? 0) + 1);
    }

    return {
      listos: listas.length,
      noListos: incompletas.length,
      motivos: [...porMotivo.entries()]
        .map(([motivo, total]) => ({ motivo, total }))
        .sort((a, b) => b.total - a.total),
      empresas: incompletas.slice(0, 300),
    };
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
        // la empresa propia del lead: `include` no la trae
        // sola por ser una relacion, y sin nombrarla aqui la
        // linea de abajo mira siempre null
        empresa: true,
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

      // igual que en el F7: la suya primero, la de la
      // reserva despues. Mirando solo la de la reserva, TODO
      // el mundo salia «sin empresa», incluidos los que si
      // tenian una propia
      const empresa = p.empresa ?? p.reserva?.empresa ?? null;
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
