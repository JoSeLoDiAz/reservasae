import { Injectable, NotFoundException } from '@nestjs/common';

import { EstadoReserva, Prisma } from '../../generated/prisma';
import { semaforo } from '../catalogo/catalogo.service';
import { normalizarNit } from '../comun/nit';
import { PrismaService } from '../prisma/prisma.service';

export type FiltrosReservas = {
  buscar?: string;
  estado?: EstadoReserva;
  convenio?: string;
  accionId?: string;
  pagina?: number;
  porPagina?: number;
};

const POR_PAGINA = 25;

@Injectable()
export class TablerosService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Resumen
  // -------------------------------------------------------------------------

  async resumen() {
    const [ofertas, reservas, empresas, base] = await Promise.all([
      this.prisma.oferta.aggregate({
        _sum: { cuposMaximos: true, cuposOcupados: true },
        _count: true,
      }),
      this.prisma.reserva.aggregate({
        where: { estado: { not: EstadoReserva.CANCELADA } },
        _sum: { cuposConfirmados: true, cuposEnEspera: true },
        _count: true,
      }),
      this.prisma.empresa.count(),
      // La meta comprometida en los proyectos, sin el 30 % de sobrecupo.
      this.prisma.grupoCobertura.aggregate({ _sum: { cuposBase: true } }),
    ]);

    const canceladas = await this.prisma.reserva.count({
      where: { estado: EstadoReserva.CANCELADA },
    });
    const publicadas = await this.prisma.accionFormacion.count({ where: { visible: true } });
    const acciones = await this.prisma.accionFormacion.count();
    const sinNingunaReserva = await this.prisma.oferta.count({
      where: { cuposOcupados: 0, accionFormacion: { visible: true } },
    });

    const cupos = ofertas._sum.cuposMaximos ?? 0;
    const ocupados = ofertas._sum.cuposOcupados ?? 0;
    const metaBase = base._sum.cuposBase ?? 0;
    const total = reservas._count + canceladas;

    return {
      cupos,
      ocupados,
      disponibles: cupos - ocupados,
      // Redondeado a un decimal: presentar "34,7 %" y no "34,69999" es parte de
      // que el número se pueda leer de un vistazo.
      avance: pct(ocupados, cupos),

      /*
       * Dos lecturas distintas del mismo avance, y las dos importan:
       *
       * - `avance` va contra el tope de inscripciones (base + 30 %), que es
       *   hasta dónde se puede aceptar gente.
       * - `avanceMeta` va contra la META COMPROMETIDA en los proyectos, que es
       *   lo que hay que cumplir. Llegar al 100 % del tope no es el objetivo;
       *   llegar al 100 % de la meta sí.
       */
      metaBase,
      avanceMeta: pct(ocupados, metaBase),

      enEspera: reservas._sum.cuposEnEspera ?? 0,
      reservas: reservas._count,
      canceladas,
      tasaCancelacion: pct(canceladas, total),
      cuposPorReserva: reservas._count
        ? Math.round(((reservas._sum.cuposConfirmados ?? 0) / reservas._count) * 10) / 10
        : 0,
      empresas,
      acciones,
      accionesPublicadas: publicadas,
      ofertasSinReservas: sinNingunaReserva,
    };
  }

  /**
   * Los cortes que responden preguntas de gestión: dónde no está llegando la
   * convocatoria, si se está cumpliendo con las mipymes, si unos pocos están
   * copando la oferta.
   *
   * Va todo en una llamada porque el tablero los muestra juntos: seis
   * peticiones para pintar una pantalla es desperdiciar seis viajes.
   */
  async analisis() {
    const [ofertas, empresas] = await Promise.all([
      this.prisma.oferta.findMany({
        where: { accionFormacion: { visible: true } },
        include: {
          ubicacion: true,
          accionFormacion: { select: { codigo: true, nombre: true, convenioId: true } },
        },
      }),
      this.prisma.empresa.findMany({
        include: {
          reservas: {
            where: { estado: { not: EstadoReserva.CANCELADA } },
            select: { cuposConfirmados: true },
          },
        },
      }),
    ]);

    // --- Territorio -------------------------------------------------------
    const territorio = new Map<
      string,
      { nombre: string; tipo: string; cupos: number; ocupados: number; acciones: number }
    >();
    for (const o of ofertas) {
      const clave = `${o.ubicacion.tipo}:${o.ubicacion.nombre}`;
      const fila = territorio.get(clave) ?? {
        nombre: o.ubicacion.nombre,
        tipo: o.ubicacion.tipo,
        cupos: 0,
        ocupados: 0,
        acciones: 0,
      };
      fila.cupos += o.cuposMaximos;
      fila.ocupados += o.cuposOcupados;
      fila.acciones += 1;
      territorio.set(clave, fila);
    }

    // --- Modalidad --------------------------------------------------------
    const modalidad = new Map<string, { cupos: number; ocupados: number; ofertas: number }>();
    for (const o of ofertas) {
      const fila = modalidad.get(o.modalidad) ?? { cupos: 0, ocupados: 0, ofertas: 0 };
      fila.cupos += o.cuposMaximos;
      fila.ocupados += o.cuposOcupados;
      fila.ofertas += 1;
      modalidad.set(o.modalidad, fila);
    }

    // --- Gremio y tamaño --------------------------------------------------
    const gremio = new Map<string, { empresas: number; cupos: number }>();
    const tamano = new Map<string, { empresas: number; cupos: number }>();

    for (const e of empresas) {
      const cupos = e.reservas.reduce((s, r) => s + r.cuposConfirmados, 0);

      const nombreGremio =
        e.redAsociada === 'Otro' ? (e.redAsociadaOtra ?? 'Otro') : (e.redAsociada ?? 'Sin indicar');
      const g = gremio.get(nombreGremio) ?? { empresas: 0, cupos: 0 };
      g.empresas += 1;
      g.cupos += cupos;
      gremio.set(nombreGremio, g);

      const t = tamano.get(clasificarTamano(e.numeroColaboradores)) ?? { empresas: 0, cupos: 0 };
      t.empresas += 1;
      t.cupos += cupos;
      tamano.set(clasificarTamano(e.numeroColaboradores), t);
    }

    // --- Concentración ----------------------------------------------------
    // Si tres organizaciones se llevan la mitad de los cupos, la convocatoria
    // no está repartida y conviene saberlo antes de que sea tarde.
    const porEmpresa = empresas
      .map((e) => ({
        razonSocial: e.razonSocial,
        nit: e.nit,
        cupos: e.reservas.reduce((s, r) => s + r.cuposConfirmados, 0),
      }))
      .filter((e) => e.cupos > 0)
      .sort((a, b) => b.cupos - a.cupos);

    const totalCupos = porEmpresa.reduce((s, e) => s + e.cupos, 0);
    const diezMayores = porEmpresa.slice(0, 10);

    return {
      territorio: [...territorio.values()]
        .map((t) => ({ ...t, disponibles: t.cupos - t.ocupados, avance: pct(t.ocupados, t.cupos) }))
        .sort((a, b) => b.ocupados - a.ocupados || a.nombre.localeCompare(b.nombre)),

      modalidad: [...modalidad.entries()]
        .map(([nombre, v]) => ({ nombre, ...v, avance: pct(v.ocupados, v.cupos) }))
        .sort((a, b) => b.cupos - a.cupos),

      gremio: [...gremio.entries()]
        .map(([nombre, v]) => ({ nombre, ...v }))
        .sort((a, b) => b.cupos - a.cupos),

      tamano: ORDEN_TAMANO.map((nombre) => ({
        nombre,
        empresas: tamano.get(nombre)?.empresas ?? 0,
        cupos: tamano.get(nombre)?.cupos ?? 0,
      })).filter((t) => t.empresas > 0),

      concentracion: {
        totalCupos,
        organizaciones: porEmpresa.length,
        diezMayores: diezMayores.map((e) => ({ ...e, porcentaje: pct(e.cupos, totalCupos) })),
        porcentajeDiezMayores: pct(
          diezMayores.reduce((s, e) => s + e.cupos, 0),
          totalCupos,
        ),
      },

      // Dónde no ha llegado nadie: es la lista accionable del tablero.
      sinReservas: ofertas
        .filter((o) => o.cuposOcupados === 0)
        .map((o) => ({
          id: o.id,
          codigo: o.accionFormacion.codigo,
          accion: o.accionFormacion.nombre,
          ubicacion: o.ubicacion.nombre,
          modalidad: o.modalidad,
          cupos: o.cuposMaximos,
        }))
        .sort((a, b) => b.cupos - a.cupos),
    };
  }

  /** Ocupación por acción de formación: es la barra de avance del tablero. */
  async porAccion() {
    const acciones = await this.prisma.accionFormacion.findMany({
      orderBy: [{ convenio: { orden: 'asc' } }, { orden: 'asc' }],
      include: {
        convenio: { select: { slug: true, sigla: true } },
        ofertas: { select: { cuposMaximos: true, cuposOcupados: true } },
      },
    });

    // La lista de espera no está en la oferta sino en las reservas, así que se
    // agrupa aparte y se cruza.
    const espera = await this.prisma.reserva.groupBy({
      by: ['ofertaId'],
      where: { cuposEnEspera: { gt: 0 }, estado: { not: EstadoReserva.CANCELADA } },
      _sum: { cuposEnEspera: true },
    });
    const esperaPorOferta = new Map(espera.map((e) => [e.ofertaId, e._sum.cuposEnEspera ?? 0]));

    const ofertas = await this.prisma.oferta.findMany({
      select: { id: true, accionFormacionId: true },
    });
    const esperaPorAccion = new Map<string, number>();
    for (const o of ofertas) {
      const n = esperaPorOferta.get(o.id) ?? 0;
      if (n) {
        esperaPorAccion.set(o.accionFormacionId, (esperaPorAccion.get(o.accionFormacionId) ?? 0) + n);
      }
    }

    return acciones.map((a) => {
      const cupos = a.ofertas.reduce((s, o) => s + o.cuposMaximos, 0);
      const ocupados = a.ofertas.reduce((s, o) => s + o.cuposOcupados, 0);
      return {
        id: a.id,
        codigo: a.codigo,
        nombre: a.nombre,
        evento: a.evento,
        modalidad: a.modalidad,
        horas: a.horas,
        visible: a.visible,
        convenio: a.convenio.slug,
        convenioSigla: a.convenio.sigla,
        ubicaciones: a.ofertas.length,
        cupos,
        ocupados,
        disponibles: cupos - ocupados,
        enEspera: esperaPorAccion.get(a.id) ?? 0,
        avance: cupos ? Math.round((ocupados / cupos) * 1000) / 10 : 0,
        estado: semaforo(cupos, ocupados),
      };
    });
  }

  /**
   * Todo lo que se sabe de UNA acción de formación: su oferta por ubicación,
   * sus grupos tal como están comprometidos en el proyecto, quién ha
   * reservado y a qué ritmo.
   *
   * Existe como pantalla propia porque el tablero general responde «cómo va
   * todo» y esta responde «qué pasa con este curso», que es la pregunta que se
   * hace cuando uno va mal.
   */
  async accion(id: string) {
    const accion = await this.prisma.accionFormacion.findUnique({
      where: { id },
      include: {
        convenio: { select: { slug: true, sigla: true, nombre: true } },
        ofertas: {
          include: {
            ubicacion: true,
            reservas: {
              where: { estado: { not: EstadoReserva.CANCELADA } },
              select: { cuposConfirmados: true, cuposEnEspera: true },
            },
          },
          orderBy: { ubicacion: { nombre: 'asc' } },
        },
        grupos: {
          include: {
            sede: true,
            coberturas: { include: { ubicacion: true } },
          },
          orderBy: { numero: 'asc' },
        },
      },
    });
    if (!accion) throw new NotFoundException('No existe esa acción de formación.');

    const idsOferta = accion.ofertas.map((o) => o.id);

    const [reservas, serie] = await Promise.all([
      this.prisma.reserva.findMany({
        where: { ofertaId: { in: idsOferta } },
        orderBy: { creadoEn: 'desc' },
        include: { empresa: true, oferta: { include: { ubicacion: true } } },
      }),
      idsOferta.length
        ? this.prisma.$queryRaw<Array<{ dia: Date; cupos: bigint }>>`
            SELECT date_trunc('day', "creadoEn") AS dia,
                   COALESCE(SUM("cuposConfirmados"), 0) AS cupos
              FROM "reservas"
             WHERE "ofertaId" = ANY(${idsOferta})
               AND "creadoEn" >= NOW() - interval '60 days'
             GROUP BY 1 ORDER BY 1`
        : Promise.resolve([]),
    ]);

    const cupos = accion.ofertas.reduce((s, o) => s + o.cuposMaximos, 0);
    const ocupados = accion.ofertas.reduce((s, o) => s + o.cuposOcupados, 0);
    const base = accion.grupos.reduce(
      (s, g) => s + g.coberturas.reduce((t, c) => t + c.cuposBase, 0),
      0,
    );

    return {
      id: accion.id,
      codigo: accion.codigo,
      nombre: accion.nombre,
      evento: accion.evento,
      modalidad: accion.modalidad,
      metodologia: accion.metodologia,
      enfoque: accion.enfoque,
      horas: accion.horas,
      objetivo: accion.objetivo,
      ambiente: accion.ambiente,
      visible: accion.visible,
      convenio: accion.convenio,

      cupos,
      ocupados,
      disponibles: cupos - ocupados,
      metaBase: base,
      avance: pct(ocupados, cupos),
      avanceMeta: pct(ocupados, base),
      enEspera: accion.ofertas.reduce(
        (s, o) => s + o.reservas.reduce((t, r) => t + r.cuposEnEspera, 0),
        0,
      ),
      organizaciones: new Set(reservas.filter((r) => r.estado !== 'CANCELADA').map((r) => r.empresa.nit))
        .size,

      ofertas: accion.ofertas.map((o) => ({
        id: o.id,
        ubicacion: o.ubicacion.nombre,
        tipoUbicacion: o.ubicacion.tipo,
        departamento: o.ubicacion.departamento,
        modalidad: o.modalidad,
        cupos: o.cuposMaximos,
        ocupados: o.cuposOcupados,
        disponibles: o.cuposMaximos - o.cuposOcupados,
        enEspera: o.reservas.reduce((s, r) => s + r.cuposEnEspera, 0),
        avance: pct(o.cuposOcupados, o.cuposMaximos),
        estado: semaforo(o.cuposMaximos, o.cuposOcupados),
        abierta: o.abierta,
      })),

      // Los grupos son el compromiso con el SENA: cuántas cohortes y con qué
      // reparto territorial. No llevan contador propio, se muestran como plan.
      grupos: accion.grupos.map((g) => ({
        numero: g.numero,
        modalidad: g.modalidad,
        sede: g.sede?.nombre ?? null,
        fechaInicio: g.fechaInicio,
        horario: g.horario,
        cuposBase: g.coberturas.reduce((s, c) => s + c.cuposBase, 0),
        cuposMaximos: g.coberturas.reduce((s, c) => s + c.cuposMaximos, 0),
        coberturas: g.coberturas.map((c) => ({
          ubicacion: c.ubicacion.nombre,
          modalidad: c.modalidad,
          cuposBase: c.cuposBase,
          cuposMaximos: c.cuposMaximos,
        })),
      })),

      reservas: reservas.map((r) => ({
        id: r.id,
        estado: r.estado,
        creadoEn: r.creadoEn,
        cuposConfirmados: r.cuposConfirmados,
        cuposEnEspera: r.cuposEnEspera,
        ubicacion: r.oferta.ubicacion.nombre,
        empresa: r.empresa.razonSocial,
        nit: r.empresa.nit,
        contacto: r.contactoNombre,
        correo: r.contactoCorreo,
      })),

      serie: serie.map((s) => ({
        dia: s.dia.toISOString().slice(0, 10),
        cupos: Number(s.cupos),
      })),
    };
  }

  /** El detalle acción × ubicación: la tabla con semáforo del Excel original. */
  async porUbicacion(convenio?: string) {
    const ofertas = await this.prisma.oferta.findMany({
      where: convenio ? { accionFormacion: { convenio: { slug: convenio } } } : undefined,
      orderBy: [
        { accionFormacion: { convenio: { orden: 'asc' } } },
        { accionFormacion: { orden: 'asc' } },
        { ubicacion: { nombre: 'asc' } },
      ],
      include: {
        ubicacion: true,
        accionFormacion: { include: { convenio: { select: { slug: true, sigla: true } } } },
      },
    });

    return ofertas.map((o) => ({
      id: o.id,
      convenio: o.accionFormacion.convenio.slug,
      convenioSigla: o.accionFormacion.convenio.sigla,
      codigo: o.accionFormacion.codigo,
      accion: o.accionFormacion.nombre,
      ubicacion: o.ubicacion.nombre,
      tipoUbicacion: o.ubicacion.tipo,
      modalidad: o.modalidad,
      cupos: o.cuposMaximos,
      ocupados: o.cuposOcupados,
      disponibles: o.cuposMaximos - o.cuposOcupados,
      avance: o.cuposMaximos ? Math.round((o.cuposOcupados / o.cuposMaximos) * 1000) / 10 : 0,
      estado: semaforo(o.cuposMaximos, o.cuposOcupados),
      abierta: o.abierta,
    }));
  }

  /** Cuántos cupos lleva cada empresa. Lo pidió el cliente explícitamente. */
  async porEmpresa(buscar?: string) {
    const empresas = await this.prisma.empresa.findMany({
      where: buscar
        ? {
            OR: [
              { nit: { contains: soloDigitos(buscar) || ' ' } },
              { razonSocial: { contains: buscar, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        reservas: {
          where: { estado: { not: EstadoReserva.CANCELADA } },
          include: {
            oferta: { include: { accionFormacion: { select: { codigo: true } } } },
          },
        },
      },
    });

    return empresas
      .map((e) => ({
        id: e.id,
        nit: e.nit,
        digitoVerificacion: e.digitoVerificacion,
        razonSocial: e.razonSocial,
        numeroColaboradores: e.numeroColaboradores,
        redAsociada: e.redAsociada,
        redAsociadaOtra: e.redAsociadaOtra,
        reservas: e.reservas.length,
        confirmados: e.reservas.reduce((s, r) => s + r.cuposConfirmados, 0),
        enEspera: e.reservas.reduce((s, r) => s + r.cuposEnEspera, 0),
        cursos: [...new Set(e.reservas.map((r) => r.oferta.accionFormacion.codigo))].sort(),
        creadoEn: e.creadoEn,
      }))
      // Quien más cupos lleva arriba: es lo primero que se quiere mirar.
      .sort((a, b) => b.confirmados - a.confirmados || a.razonSocial.localeCompare(b.razonSocial));
  }

  /**
   * Reservas por día. Se agrupa en SQL y no en Node porque la tabla puede
   * crecer a decenas de miles de filas y traerlas todas para contarlas sería
   * absurdo.
   */
  async serie(dias = 30) {
    const filas = await this.prisma.$queryRaw<
      Array<{ dia: Date; reservas: bigint; cupos: bigint }>
    >`
      SELECT date_trunc('day', "creadoEn") AS dia,
             COUNT(*)                      AS reservas,
             COALESCE(SUM("cuposConfirmados"), 0) AS cupos
        FROM "reservas"
       WHERE "creadoEn" >= NOW() - (${dias} || ' days')::interval
       GROUP BY 1
       ORDER BY 1`;

    return filas.map((f) => ({
      dia: f.dia.toISOString().slice(0, 10),
      reservas: Number(f.reservas),
      cupos: Number(f.cupos),
    }));
  }

  // -------------------------------------------------------------------------
  // Tabla de reservas
  // -------------------------------------------------------------------------

  private donde(filtros: FiltrosReservas): Prisma.ReservaWhereInput {
    const y: Prisma.ReservaWhereInput[] = [];

    if (filtros.estado) y.push({ estado: filtros.estado });
    if (filtros.convenio) {
      y.push({ oferta: { accionFormacion: { convenio: { slug: filtros.convenio } } } });
    }
    if (filtros.accionId) y.push({ oferta: { accionFormacionId: filtros.accionId } });

    if (filtros.buscar?.trim()) {
      const texto = filtros.buscar.trim();
      const digitos = soloDigitos(texto);
      y.push({
        OR: [
          { contactoNombre: { contains: texto, mode: 'insensitive' } },
          { contactoCorreo: { contains: texto, mode: 'insensitive' } },
          { empresa: { razonSocial: { contains: texto, mode: 'insensitive' } } },
          // El NIT se busca por dígitos: quien lo escribe con puntos no
          // encontraría nada comparando la cadena tal cual.
          ...(digitos ? [{ empresa: { nit: { contains: digitos } } }] : []),
        ],
      });
    }

    return y.length ? { AND: y } : {};
  }

  async reservas(filtros: FiltrosReservas) {
    const porPagina = Math.min(filtros.porPagina ?? POR_PAGINA, 200);
    const pagina = Math.max(filtros.pagina ?? 1, 1);
    const where = this.donde(filtros);

    const [total, filas] = await Promise.all([
      this.prisma.reserva.count({ where }),
      this.prisma.reserva.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          empresa: true,
          oferta: {
            include: {
              ubicacion: true,
              accionFormacion: { include: { convenio: { select: { slug: true, sigla: true } } } },
            },
          },
          respuestas: { orderBy: { pregunta: { orden: 'asc' } } },
        },
      }),
    ]);

    return {
      total,
      pagina,
      porPagina,
      paginas: Math.max(Math.ceil(total / porPagina), 1),
      filas: filas.map((r) => ({
        id: r.id,
        estado: r.estado,
        cuposSolicitados: r.cuposSolicitados,
        cuposConfirmados: r.cuposConfirmados,
        cuposEnEspera: r.cuposEnEspera,
        creadoEn: r.creadoEn,
        canceladaEn: r.canceladaEn,
        empresa: {
          nit: r.empresa.nit,
          digitoVerificacion: r.empresa.digitoVerificacion,
          razonSocial: r.empresa.razonSocial,
          numeroColaboradores: r.empresa.numeroColaboradores,
          redAsociada: r.empresa.redAsociada,
          redAsociadaOtra: r.empresa.redAsociadaOtra,
        },
        contacto: {
          nombre: r.contactoNombre,
          correo: r.contactoCorreo,
          celular: r.contactoCelular,
          cargo: r.contactoCargo,
        },
        oferta: {
          codigo: r.oferta.accionFormacion.codigo,
          accion: r.oferta.accionFormacion.nombre,
          ubicacion: r.oferta.ubicacion.nombre,
          modalidad: r.oferta.modalidad,
          convenio: r.oferta.accionFormacion.convenio.slug,
          convenioSigla: r.oferta.accionFormacion.convenio.sigla,
        },
        respuestas: r.respuestas.map((x) => ({
          pregunta: x.etiquetaPregunta,
          valor: valorLegible(x),
        })),
      })),
    };
  }

  /** Todas las reservas del filtro, sin paginar. Solo para exportar. */
  async reservasParaExportar(filtros: FiltrosReservas) {
    return this.prisma.reserva.findMany({
      where: this.donde(filtros),
      orderBy: { creadoEn: 'desc' },
      include: {
        empresa: true,
        oferta: {
          include: {
            ubicacion: true,
            accionFormacion: { include: { convenio: { select: { slug: true, sigla: true } } } },
          },
        },
        respuestas: { orderBy: { pregunta: { orden: 'asc' } } },
      },
    });
  }
}

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Un decimal: "34,7 %" se lee de un vistazo, "34,69999" no. */
function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

/**
 * Clasificación por número de empleados según la Ley 590 de 2000. Importa
 * porque los proyectos comprometen un número concreto de mipymes
 * beneficiadas, y sin este corte no hay forma de saber si se está cumpliendo.
 */
const ORDEN_TAMANO = ['Microempresa', 'Pequeña', 'Mediana', 'Grande', 'Sin indicar'];

function clasificarTamano(colaboradores: number | null): string {
  if (colaboradores === null) return 'Sin indicar';
  if (colaboradores <= 10) return 'Microempresa';
  if (colaboradores <= 50) return 'Pequeña';
  if (colaboradores <= 200) return 'Mediana';
  return 'Grande';
}

/** Una respuesta guarda su valor en la columna que le toca según el tipo. */
export function valorLegible(respuesta: {
  valorTexto: string | null;
  valorNumero: number | null;
  valorBooleano: boolean | null;
  etiquetasSeleccion: string[];
  valoresSeleccion: string[];
}): string {
  if (respuesta.etiquetasSeleccion.length) return respuesta.etiquetasSeleccion.join(', ');
  if (respuesta.valoresSeleccion.length) return respuesta.valoresSeleccion.join(', ');
  if (respuesta.valorBooleano !== null) return respuesta.valorBooleano ? 'Sí' : 'No';
  if (respuesta.valorNumero !== null) return String(respuesta.valorNumero);
  return respuesta.valorTexto ?? '';
}
