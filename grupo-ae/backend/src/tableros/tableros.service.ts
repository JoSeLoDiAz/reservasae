import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { faltaEnF7 } from '../crm/sep/formato-f7';
import { DEPARTAMENTO_POR_ID, MUNICIPIO_POR_ID } from '../crm/catalogos-sep';

import { EstadoReserva, Prisma } from '../../generated/prisma';
import { semaforo } from '../catalogo/catalogo.service';
import { normalizarNit } from '../comun/nit';
import {
  coberturaDeConvenio,
  deConvenio,
  empresaDeConvenio,
  ofertaDeConvenio,
  reservaDeConvenio,
  respuestaDeConvenio,
  sqlDeConvenio,
} from './ambito';
import { PrismaService } from '../prisma/prisma.service';
import { aDiaDeCalendario, diaBogota } from '../comun/dia-bogota';
import { ventanaDe } from '../crm/calendario-inscripcion';
import { OCUPAN_SILLA, POR_DEPURAR } from '../crm/etapas';
import {
  TALLAS,
  TALLAS_MIPYME,
  tallaDeOrganizacion,
} from '../crm/catalogos-sep';
import { calcularProyeccion, cierreDeLaAccion, type PuntoNeto } from './proyeccion';

export type FiltrosReservas = {
  /// Lo pone el controlador desde el guard, no la peticion.
  ambito?: string[];
  buscar?: string;
  estado?: EstadoReserva;
  convenio?: string;
  accionId?: string;
  formulario?: string;
  pagina?: number;
  porPagina?: number;
};

const POR_PAGINA = 25;
/// Las organizaciones caben de a mas: la fila es corta.
const POR_PAGINA_EMPRESAS = 200;
const TOPE_EMPRESAS = 500;

/** Todas las acciones, publicadas o no. */
const UNIVERSO: Prisma.OfertaWhereInput = {};

const nombreDepartamento = (id: number | null) =>
  id ? (DEPARTAMENTO_POR_ID.get(id)?.etiqueta ?? null) : null;

// el municipio es una tupla [id, depto, nombre, ...]
const nombreMunicipio = (id: number | null) =>
  id ? (MUNICIPIO_POR_ID.get(id)?.[2] ?? null) : null;

@Injectable()
export class TablerosService {
  constructor(private readonly prisma: PrismaService) {}

  // resumen

  async resumen(ambito: string[]) {
    const [ofertas, reservas, empresas, base] = await Promise.all([
      this.prisma.oferta.aggregate({
        where: ofertaDeConvenio(ambito),
        _sum: { cuposMaximos: true, cuposOcupados: true },
        _count: true,
      }),
      this.prisma.reserva.aggregate({
        where: {
          ...reservaDeConvenio(ambito),
          estado: { not: EstadoReserva.CANCELADA },
        },
        _sum: { cuposConfirmados: true, cuposEnEspera: true },
        _count: true,
      }),
      this.prisma.empresa.count({ where: empresaDeConvenio(ambito) }),
      // meta comprometida, sin sobrecupo
      this.prisma.grupoCobertura.aggregate({
        where: coberturaDeConvenio(ambito),
        _sum: { cuposBase: true },
      }),
    ]);

    const canceladas = await this.prisma.reserva.count({
      where: { ...reservaDeConvenio(ambito), estado: EstadoReserva.CANCELADA },
    });
    const publicadas = await this.prisma.accionFormacion.count({
      where: { ...deConvenio(ambito), visible: true },
    });
    const acciones = await this.prisma.accionFormacion.count({
      where: deConvenio(ambito),
    });
    const sinNingunaReserva = await this.prisma.oferta.count({
      where: { ...ofertaDeConvenio(ambito), ...UNIVERSO, cuposOcupados: 0 },
    });

    const cupos = ofertas._sum.cuposMaximos ?? 0;
    const ocupados = ofertas._sum.cuposOcupados ?? 0;
    const metaBase = base._sum.cuposBase ?? 0;
    const total = reservas._count + canceladas;

    return {
      cupos,
      ocupados,
      disponibles: cupos - ocupados,
      // avance contra el tope
      avance: pct(ocupados, cupos),

      // avance contra la meta
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

  /** Los cortes de gestión en una sola llamada. */
  async analisis(ambito: string[]) {
    const [ofertas, empresas] = await Promise.all([
      this.prisma.oferta.findMany({
        where: { ...ofertaDeConvenio(ambito), ...UNIVERSO },
        include: {
          ubicacion: true,
          accionFormacion: {
            select: { codigo: true, nombre: true, convenioId: true, visible: true },
          },
        },
      }),
      this.prisma.empresa.findMany({
        where: empresaDeConvenio(ambito),
        include: {
          reservas: {
            where: {
              ...reservaDeConvenio(ambito),
              estado: { not: EstadoReserva.CANCELADA },
            },
            select: { cuposConfirmados: true },
          },
        },
      }),
    ]);

    // territorio
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

    // modalidad
    const modalidad = new Map<string, { cupos: number; ocupados: number; ofertas: number }>();
    for (const o of ofertas) {
      const fila = modalidad.get(o.modalidad) ?? { cupos: 0, ocupados: 0, ofertas: 0 };
      fila.cupos += o.cuposMaximos;
      fila.ocupados += o.cuposOcupados;
      fila.ofertas += 1;
      modalidad.set(o.modalidad, fila);
    }

    // gremio y tamaño
    const gremio = new Map<string, { empresas: number; cupos: number }>();
    const tamano = new Map<string, { empresas: number; cupos: number }>();
    /// Con que criterio se clasifico cada una. Se DEVUELVE, no
    /// se guarda para nosotros: una cifra de mipymes mezclada
    /// con dos criterios sin decirlo es la peor clase de cifra,
    /// y los proyectos comprometen un numero de mipymes.
    const criterio = { DECRETO_957: 0, EMPLEADOS: 0, SIN_DATO: 0 };

    for (const e of empresas) {
      const cupos = e.reservas.reduce((s, r) => s + r.cuposConfirmados, 0);

      const nombreGremio =
        e.redAsociada === 'Otro' ? (e.redAsociadaOtra ?? 'Otro') : (e.redAsociada ?? 'Sin indicar');
      const g = gremio.get(nombreGremio) ?? { empresas: 0, cupos: 0 };
      g.empresas += 1;
      g.cupos += cupos;
      gremio.set(nombreGremio, g);

      /// La talla sale del id del SEP cuando esta, y del numero
      /// de empleados solo como respaldo. Ver
      /// `crm/catalogos-sep.ts`: son dos criterios distintos y
      /// el que manda es el del Decreto 957, que es el que
      /// viaja en el reporte.
      const { talla, origen } = tallaDeOrganizacion(e);
      criterio[origen] += 1;
      const nombreTalla = talla ?? 'Sin indicar';
      const t = tamano.get(nombreTalla) ?? { empresas: 0, cupos: 0 };
      t.empresas += 1;
      t.cupos += cupos;
      tamano.set(nombreTalla, t);
    }

    // concentración
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

      tamano: {
        filas: ORDEN_TAMANO.map((nombre) => ({
          nombre,
          empresas: tamano.get(nombre)?.empresas ?? 0,
          cupos: tamano.get(nombre)?.cupos ?? 0,
        })).filter((t) => t.empresas > 0),

        /// La cifra que los proyectos comprometen, aparte.
        ///
        /// Micro + pequena + mediana. Iba sin sumar, asi que
        /// para saber si se cumple el compromiso habia que
        /// sumar tres barras a ojo.
        mipymes: TALLAS_MIPYME.reduce(
          (acc, t) => ({
            empresas: acc.empresas + (tamano.get(t)?.empresas ?? 0),
            cupos: acc.cupos + (tamano.get(t)?.cupos ?? 0),
          }),
          { empresas: 0, cupos: 0 },
        ),

        criterio,
      },

      concentracion: {
        totalCupos,
        organizaciones: porEmpresa.length,
        diezMayores: diezMayores.map((e) => ({ ...e, porcentaje: pct(e.cupos, totalCupos) })),
        porcentajeDiezMayores: pct(
          diezMayores.reduce((s, e) => s + e.cupos, 0),
          totalCupos,
        ),
      },

      // donde no ha llegado nadie
      sinReservas: ofertas
        .filter((o) => o.cuposOcupados === 0)
        .map((o) => ({
          id: o.id,
          codigo: o.accionFormacion.codigo,
          accion: o.accionFormacion.nombre,
          ubicacion: o.ubicacion.nombre,
          modalidad: o.modalidad,
          cupos: o.cuposMaximos,
          // distingue sin reservas de sin abrir
          publicada: o.accionFormacion.visible,
        }))
        .sort((a, b) => b.cupos - a.cupos),
    };
  }

  /** Ocupación por acción de formación. */
  async porAccion(ambito: string[], hoy = new Date()) {
    const acciones = await this.prisma.accionFormacion.findMany({
      where: deConvenio(ambito),
      orderBy: [{ convenio: { orden: 'asc' } }, { orden: 'asc' }],
      include: {
        convenio: { select: { slug: true, sigla: true } },
        ofertas: { select: { cuposMaximos: true, cuposOcupados: true } },
        /// Los grupos viajan con la fila para que el tablero
        /// los abra sin otra vuelta al servidor: son pocos por
        /// accion y la pantalla ya se refresca sola.
        ///
        /// La gente de cada grupo NO se cuenta aqui: hace falta
        /// contarla dos veces --los que ocupan silla y los que
        /// todavia se pueden depurar-- y un `_count` anidado
        /// solo admite UN filtro por relacion. Va en el
        /// `groupBy` de abajo.
        grupos: {
          orderBy: { numero: 'asc' },
          include: {
            sede: { select: { nombre: true } },
            coberturas: {
              select: {
                id: true,
                cuposMaximos: true,
              },
            },
          },
        },
      },
    });

    /**
     * La gente de cada grupo, en UNA consulta.
     *
     * Dos recuentos de la MISMA relacion: los que ocupan silla
     * --inscritos-- y los que todavia se pueden trabajar para
     * llenar lo que falta. Un `groupBy` por cobertura y etapa
     * los trae los dos de un viaje, y el filtro por los ids ya
     * cargados lo deja acotado al ambito sin volver a decirlo.
     */
    const idsCobertura = acciones.flatMap((a) =>
      a.grupos.flatMap((g) => g.coberturas.map((c) => c.id)),
    );
    const porEtapa = idsCobertura.length
      ? await this.prisma.participante.groupBy({
          by: ['coberturaId', 'etapa'],
          where: { coberturaId: { in: idsCobertura } },
          _count: { _all: true },
        })
      : [];

    const inscritosDe = new Map<string, number>();
    const depurablesDe = new Map<string, number>();
    for (const fila of porEtapa) {
      if (!fila.coberturaId) continue;
      const donde = OCUPAN_SILLA.includes(fila.etapa)
        ? inscritosDe
        : POR_DEPURAR.includes(fila.etapa)
          ? depurablesDe
          : null;
      /// Las perdidas y las salidas no caen en ninguno de los
      /// dos, y eso es a proposito: ni ocupan silla ni se
      /// pueden depurar.
      if (!donde) continue;
      donde.set(fila.coberturaId, (donde.get(fila.coberturaId) ?? 0) + fila._count._all);
    }

    // la espera vive en las reservas
    const espera = await this.prisma.reserva.groupBy({
      by: ['ofertaId'],
      where: {
        ...reservaDeConvenio(ambito),
        cuposEnEspera: { gt: 0 },
        estado: { not: EstadoReserva.CANCELADA },
      },
      _sum: { cuposEnEspera: true },
    });
    const esperaPorOferta = new Map(espera.map((e) => [e.ofertaId, e._sum.cuposEnEspera ?? 0]));

    const ofertas = await this.prisma.oferta.findMany({
      where: ofertaDeConvenio(ambito),
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
        /// COMO VA cada grupo, no como esta repartido.
        ///
        /// El reparto por ubicaciones --«Medellin 78, Bogota
        /// 65...»-- es la estructura del proyecto y ya vive en
        /// la pantalla de la accion. Aqui lo que se pregunta es
        /// cuanta gente lleva dentro y cuanto le queda de
        /// ventana.
        ///
        /// `inscritos` cuenta participantes de sus coberturas
        /// en etapa de OCUPAN_SILLA, que es la misma definicion
        /// que gobierna la inscripcion en `panel-de-cupos`.
        /// `porDepurar` son los leads con los que todavia se
        /// puede llenar lo que falta.
        grupos: a.grupos.map((g) => {
          const ventana = ventanaDe(g.fechaInicio, hoy);
          const cuposMaximos = g.coberturas.reduce((s, c) => s + c.cuposMaximos, 0);
          const inscritos = g.coberturas.reduce(
            (s, c) => s + (inscritosDe.get(c.id) ?? 0),
            0,
          );
          return {
            numero: g.numero,
            modalidad: g.modalidad,
            sede: g.sede?.nombre ?? null,
            inscritos,
            cuposMaximos,
            faltan: Math.max(0, cuposMaximos - inscritos),
            porDepurar: g.coberturas.reduce(
              (s, c) => s + (depurablesDe.get(c.id) ?? 0),
              0,
            ),
            fechaInicio: g.fechaInicio ? aDiaDeCalendario(g.fechaInicio) : null,
            /// Cinco habiles antes del arranque. Es la fecha que
            /// manda sobre el ritmo.
            cierre: ventana.cierre ? aDiaDeCalendario(ventana.cierre) : null,
            diasHabilesRestantes: ventana.diasHabilesRestantes,
            estadoVentana: ventana.estado,
          };
        }),
      };
    });
  }

  /** Todo lo de una acción, para su pantalla. */
  async accion(id: string, ambito: string[]) {
    const accion = await this.prisma.accionFormacion.findFirst({
      // findFirst con el ambito dentro: con findUnique por
      // id se veria la accion del otro convenio
      where: { id, ...deConvenio(ambito) },
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
        ? this.prisma.$queryRaw<Array<{ dia: string; cupos: bigint }>>`
            SELECT ${diaBogota(Prisma.sql`"creadoEn"`)} AS dia,
                   COALESCE(SUM("cuposConfirmados"), 0) AS cupos
              FROM "reservas"
             WHERE "ofertaId" = ANY(${idsOferta})
               AND "estado" <> 'CANCELADA'
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

    const suyo = await this.serieNeta(ambito, 14, accion.id);
    const proyeccion = calcularProyeccion({
      serie: suyo.serie,
      ocupados,
      meta: base,
      dias: 14,
      hoy: new Date(),
      origen: suyo.origen,
      diasDeHistoria: await this.diasDeHistoria(ambito),
      cierre: cierreDeLaAccion(accion.grupos.map((g) => g.fechaInicio)),
    });

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
      /// El texto de la tarjeta publica, que se edita aqui mismo.
      ///
      /// La ruta que lo guarda existia desde hace tiempo y no la
      /// llamaba nadie: una API sin pantalla. Asi que en el
      /// formulario publico salia lo que dejo la siembra.
      resumenPublico: accion.resumenPublico,
      visible: accion.visible,
      convenio: accion.convenio,

      cupos,
      ocupados,
      disponibles: cupos - ocupados,
      metaBase: base,
      proyeccion,
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

      // los grupos son el plan, no llevan contador
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
        dia: s.dia,
        cupos: Number(s.cupos),
      })),
    };
  }

  /** Detalle acción × ubicación. */
  async porUbicacion(ambito: string[], convenio?: string) {
    const ofertas = await this.prisma.oferta.findMany({
      /// `AND` y no dos spreads, y no es estilo.
      ///
      /// `ofertaDeConvenio` devuelve `{ accionFormacion: ... }`
      /// y el filtro pedido tambien: el segundo spread PISABA
      /// la clave del ambito y se quedaba solo el slug. O sea
      /// que `?convenio=britcham-adee` desde una cuenta que
      /// solo tiene ADECOPRIA devolvia las ofertas de BRITCHAM.
      ///
      /// Es la regla que ya vale en las politicas: el filtro
      /// pedido se INTERSECA con el ambito, nunca lo sustituye.
      /// Pedir uno de fuera devuelve vacio, no todo.
      where: {
        AND: [
          ofertaDeConvenio(ambito),
          ...(convenio
            ? [{ accionFormacion: { convenio: { slug: convenio } } }]
            : []),
        ],
      },
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

  /** Cuántos cupos lleva cada empresa. */
  /**
   * Si el texto no trae digitos, la condicion del NIT se
   * omite. Antes iba un byte NUL como centinela, que volvia
   * el fichero binario para grep; con cadena vacia,
   * `contains` coincidiria con TODAS las filas.
   */
  private dondeEmpresa(ambito: string[], buscar?: string): Prisma.EmpresaWhereInput {
    return {
      ...empresaDeConvenio(ambito),
      ...(buscar
        ? {
            OR: [
              ...(soloDigitos(buscar) ? [{ nit: { contains: soloDigitos(buscar) } }] : []),
              { razonSocial: { contains: buscar, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  /**
   * Sin `trozo` las devuelve TODAS, que es lo que necesita
   * la descarga en Excel: un informe recortado en silencio
   * a la primera pagina seria peor que no tenerlo.
   */
  async porEmpresa(ambito: string[], buscar?: string, trozo?: { skip: number; take: number }) {
    const empresas = await this.prisma.empresa.findMany({
      ...(trozo ?? {}),
      // alfabetico y en la base. Ordenar por cupos exigiria
      // sumar una relacion, y hacerlo en memoria despues de
      // paginar reparte mal las filas: alguna se veria dos
      // veces y otra ninguna. La tabla ya deja ordenar por
      // la columna que se quiera
      orderBy: [{ razonSocial: 'asc' }],
      where: this.dondeEmpresa(ambito, buscar),
      include: {
        reservas: {
          /// El ambito tambien AQUI, no solo en la empresa.
          ///
          /// La empresa se comparte entre convenios, asi que
          /// acotar solo la fila de arriba dejaba las columnas
          /// -- reservas, confirmados, en espera y cursos --
          /// sumando las del otro gremio, y la de Cursos
          /// pintando sus codigos de accion.
          where: {
            estado: { not: EstadoReserva.CANCELADA },
            oferta: { accionFormacion: { convenioId: { in: ambito } } },
          },
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
        departamento: nombreDepartamento(e.departamentoSepId),
        municipio: nombreMunicipio(e.municipioSepId),
        direccion: e.direccion,
        telefono: e.telefono,
        contactoNombre: e.contactoNombre,
        contactoCargo: e.contactoCargo,
        contactoCorreo: e.contactoCorreo,
        sectorEconomico: e.sectorEconomico,
        clasificacion: e.clasificacion,
        numeroTrabajadores: e.numeroTrabajadores,
        tamanoSepId: e.tamanoSepId,
        // que le falta para poder ir en el F7
        faltaF7: faltaEnF7({
          ...e,
          departamento: nombreDepartamento(e.departamentoSepId),
          municipio: nombreMunicipio(e.municipioSepId),
        }),
        reservas: e.reservas.length,
        confirmados: e.reservas.reduce((s, r) => s + r.cuposConfirmados, 0),
        enEspera: e.reservas.reduce((s, r) => s + r.cuposEnEspera, 0),
        cursos: [...new Set(e.reservas.map((r) => r.oferta.accionFormacion.codigo))].sort(),
        creadoEn: e.creadoEn,
      }));
  }

  /** Las de la página, más cuántas hay en total. */
  async paginaDeEmpresas(
    ambito: string[],
    buscar?: string,
    pagina?: number,
    porPagina?: number,
  ) {
    const tamano = Math.min(porPagina ?? POR_PAGINA_EMPRESAS, TOPE_EMPRESAS);
    const pag = Math.max(1, pagina ?? 1);
    const [filas, total] = await Promise.all([
      this.porEmpresa(ambito, buscar, { skip: (pag - 1) * tamano, take: tamano }),
      this.prisma.empresa.count({ where: this.dondeEmpresa(ambito, buscar) }),
    ]);
    return {
      total,
      pagina: pag,
      porPagina: tamano,
      paginas: Math.max(1, Math.ceil(total / tamano)),
      filas,
    };
  }

  /** Reservas por día, agrupadas en SQL. */
  async serie(ambito: string[], dias = 30) {
    const filas = await this.prisma.$queryRaw<
      Array<{ dia: string; reservas: bigint; cupos: bigint }>
    >`
      SELECT ${diaBogota(Prisma.sql`r."creadoEn"`)} AS dia,
             COUNT(*)                        AS reservas,
             COALESCE(SUM(r."cuposConfirmados"), 0) AS cupos
        FROM "reservas" r
       WHERE r."creadoEn" >= NOW() - (${dias} || ' days')::interval
         AND r."estado" <> 'CANCELADA'
         AND ${sqlDeConvenio(ambito)}
       GROUP BY 1
       ORDER BY 1`;

    return filas.map((f) => ({
      dia: f.dia,
      reservas: Number(f.reservas),
      cupos: Number(f.cupos),
    }));
  }

  // ritmo y proyección

  /** Cupos netos por día, desde `movimientos_reserva`. */
  private async netoPorDia(
    ambito: string[],
    dias: number,
    accionId?: string,
  ): Promise<PuntoNeto[]> {
    const condicionAccion = accionId
      ? Prisma.sql`AND r."ofertaId" IN (SELECT id FROM "ofertas" WHERE "accionFormacionId" = ${accionId})`
      : Prisma.empty;

    const filas = await this.prisma.$queryRaw<Array<{ dia: string; neto: bigint }>>`
      SELECT ${diaBogota(Prisma.sql`m."creadoEn"`)} AS dia,
             COALESCE(SUM(m."confirmadosDespues" - m."confirmadosAntes"), 0) AS neto
        FROM "movimientos_reserva" m
        JOIN "reservas" r ON r.id = m."reservaId"
       WHERE m."creadoEn" >= NOW() - (${dias} || ' days')::interval
         AND ${sqlDeConvenio(ambito)}
         ${condicionAccion}
       GROUP BY 1
       ORDER BY 1`;

    return filas.map((f) => ({
      dia: f.dia,
      neto: Number(f.neto),
    }));
  }

  /** Neto por fecha de alta, sin movimientos. */
  private async netoAproximado(
    ambito: string[],
    dias: number,
    accionId?: string,
  ): Promise<PuntoNeto[]> {
    const condicionAccion = accionId
      ? Prisma.sql`AND r."ofertaId" IN (SELECT id FROM "ofertas" WHERE "accionFormacionId" = ${accionId})`
      : Prisma.empty;

    const filas = await this.prisma.$queryRaw<Array<{ dia: string; neto: bigint }>>`
      SELECT ${diaBogota(Prisma.sql`r."creadoEn"`)} AS dia,
             COALESCE(SUM(r."cuposConfirmados"), 0) AS neto
        FROM "reservas" r
       WHERE r."creadoEn" >= NOW() - (${dias} || ' days')::interval
         AND r."estado" <> 'CANCELADA'
         AND ${sqlDeConvenio(ambito)}
         ${condicionAccion}
       GROUP BY 1
       ORDER BY 1`;

    return filas.map((f) => ({
      dia: f.dia,
      neto: Number(f.neto),
    }));
  }

  private async serieNeta(ambito: string[], dias: number, accionId?: string) {
    const movimientos = await this.netoPorDia(ambito, dias, accionId);
    if (movimientos.length) {
      return { serie: movimientos, origen: 'MOVIMIENTOS' as const };
    }

    // sin movimientos: se aproxima
    const aproximada = await this.netoAproximado(ambito, dias, accionId);
    return aproximada.length
      ? { serie: aproximada, origen: 'APROXIMADO' as const }
      : { serie: [], origen: 'MOVIMIENTOS' as const };
  }

  /** Días de historia de movimientos. */
  private async diasDeHistoria(ambito: string[]): Promise<number> {
    const primero = await this.prisma.movimientoReserva.findFirst({
      where: { reserva: reservaDeConvenio(ambito) },
      orderBy: { creadoEn: 'asc' },
      select: { creadoEn: true },
    });
    if (!primero) return 0;
    return Math.max(
      1,
      Math.ceil((Date.now() - primero.creadoEn.getTime()) / (24 * 60 * 60 * 1000)),
    );
  }

  /** Ritmo global y por acción, con fecha estimada. */
  async proyeccion(ambito: string[], dias = 14) {
    const hoy = new Date();
    const [{ serie, origen }, historia, base, ofertas, acciones] = await Promise.all([
      this.serieNeta(ambito, dias),
      this.diasDeHistoria(ambito),
      this.prisma.grupoCobertura.aggregate({
        where: coberturaDeConvenio(ambito),
        _sum: { cuposBase: true },
      }),
      this.prisma.oferta.aggregate({
        where: ofertaDeConvenio(ambito),
        _sum: { cuposOcupados: true },
      }),
      this.prisma.accionFormacion.findMany({
        where: deConvenio(ambito),
        select: {
          id: true,
          codigo: true,
          nombre: true,
          visible: true,
          convenio: { select: { sigla: true, slug: true } },
          ofertas: { select: { cuposOcupados: true } },
          grupos: { select: { fechaInicio: true, coberturas: { select: { cuposBase: true } } } },
        },
        orderBy: { codigo: 'asc' },
      }),
    ]);

    const total = calcularProyeccion({
      serie,
      ocupados: ofertas._sum.cuposOcupados ?? 0,
      meta: base._sum.cuposBase ?? 0,
      dias,
      hoy,
      origen,
      diasDeHistoria: historia,
      // el plazo del cronograma: el ultimo grupo que cierra
      cierre: cierreDeLaAccion(acciones.flatMap((a) => a.grupos.map((g) => g.fechaInicio))),
    });

    // la serie de cada acción
    const porAccion = await Promise.all(
      acciones.map(async (accion) => {
        const suyo = await this.serieNeta(ambito, dias, accion.id);
        const ocupados = accion.ofertas.reduce((s, o) => s + o.cuposOcupados, 0);
        const meta = accion.grupos.reduce(
          (s, g) => s + g.coberturas.reduce((t, c) => t + c.cuposBase, 0),
          0,
        );
        return {
          id: accion.id,
          codigo: accion.codigo,
          nombre: accion.nombre,
          publicada: accion.visible,
          convenio: accion.convenio.sigla ?? accion.convenio.slug,
          ...calcularProyeccion({
            serie: suyo.serie,
            ocupados,
            meta,
            dias,
            hoy,
            origen: suyo.origen,
            diasDeHistoria: historia,
            cierre: cierreDeLaAccion(accion.grupos.map((g) => g.fechaInicio)),
          }),
        };
      }),
    );

    return {
      dias,
      total,
      // las más lentas primero
      acciones: porAccion.sort((a, b) => a.ritmoDiario - b.ritmoDiario),
    };
  }

  // respuestas del formulario

  /** Qué contestó la gente, agregado por pregunta. */
  async respuestasDeFormulario(formularioId: string, ambito: string[]) {
    const formulario = await this.prisma.formulario.findFirst({
      // el formulario cuelga del convenio: por id suelto se
      // veria el del otro
      where: { id: formularioId, convenioId: { in: ambito } },
      select: {
        id: true,
        slug: true,
        titulo: true,
        preguntas: {
          orderBy: { orden: 'asc' },
          select: {
            id: true,
            etiqueta: true,
            tipo: true,
            archivada: true,
            campoNucleo: true,
            opciones: {
              orderBy: { orden: 'asc' },
              select: { valor: true, etiqueta: true, archivada: true },
            },
          },
        },
      },
    });
    if (!formulario) throw new NotFoundException('No existe ese formulario.');

    // denominador: reservas vivas
    const totalReservas = await this.prisma.reserva.count({
      where: {
        ...reservaDeConvenio(ambito),
        formularioId,
        estado: { not: EstadoReserva.CANCELADA },
      },
    });

    const preguntas = formulario.preguntas.filter(
      (p) => !p.campoNucleo && p.tipo !== 'PARRAFO',
    );

    const informe = await Promise.all(
      preguntas.map(async (pregunta) => {
        const respuestas = await this.prisma.respuesta.findMany({
          /// `AND`, por lo mismo que en `porUbicacion`.
          ///
          /// `respuestaDeConvenio` devuelve `{ reserva: ... }` y
          /// la linea de abajo trae la MISMA clave, asi que el
          /// spread se pisaba y el ambito desaparecia entero:
          /// este informe contaba las respuestas de los dos
          /// gremios. Era alcanzable mientras se pudo reservar
          /// con el `formularioSlug` del otro convenio.
          ///
          /// El filtro pedido se INTERSECA, nunca sustituye.
          where: {
            AND: [
              respuestaDeConvenio(ambito),
              { preguntaId: pregunta.id },
              { reserva: { estado: { not: EstadoReserva.CANCELADA } } },
            ],
          },
          select: {
            valorTexto: true,
            valorNumero: true,
            valorBooleano: true,
            valoresSeleccion: true,
            etiquetasSeleccion: true,
          },
          orderBy: { creadoEn: 'desc' },
        });

        const comun = {
          id: pregunta.id,
          etiqueta: pregunta.etiqueta,
          tipo: pregunta.tipo,
          archivada: pregunta.archivada,
          respondidas: respuestas.length,
          tasaRespuesta: pct(respuestas.length, totalReservas),
        };

        if (pregunta.tipo === 'CASILLA') {
          const sies = respuestas.filter((r) => r.valorBooleano).length;
          return { ...comun, casilla: { si: sies, no: respuestas.length - sies } };
        }

        if (pregunta.tipo === 'NUMERO') {
          const valores = respuestas
            .map((r) => r.valorNumero)
            .filter((v): v is number => v !== null)
            .sort((a, b) => a - b);
          return { ...comun, numero: resumenNumerico(valores) };
        }

        if (pregunta.opciones.length) {
          return { ...comun, opciones: contarOpciones(pregunta.opciones, respuestas) };
        }

        // el texto libre no se agrega
        return {
          ...comun,
          texto: respuestas
            .slice(0, 20)
            .map((r) => r.valorTexto)
            .filter((t): t is string => Boolean(t)),
        };
      }),
    );

    return {
      formulario: { id: formulario.id, slug: formulario.slug, titulo: formulario.titulo },
      totalReservas,
      preguntas: informe,
    };
  }

  // tabla de reservas

  private donde(filtros: FiltrosReservas): Prisma.ReservaWhereInput {
    const porAmbito: Prisma.ReservaWhereInput[] = filtros.ambito
      ? [reservaDeConvenio(filtros.ambito)]
      : [];
    const y: Prisma.ReservaWhereInput[] = [...porAmbito];

    if (filtros.estado) y.push({ estado: filtros.estado });
    if (filtros.convenio) {
      y.push({ oferta: { accionFormacion: { convenio: { slug: filtros.convenio } } } });
    }
    if (filtros.accionId) y.push({ oferta: { accionFormacionId: filtros.accionId } });
    // por que enlace entro
    if (filtros.formulario) y.push({ formulario: { slug: filtros.formulario } });

    if (filtros.buscar?.trim()) {
      const texto = filtros.buscar.trim();
      const digitos = soloDigitos(texto);
      y.push({
        OR: [
          { contactoNombre: { contains: texto, mode: 'insensitive' } },
          { contactoCorreo: { contains: texto, mode: 'insensitive' } },
          { empresa: { razonSocial: { contains: texto, mode: 'insensitive' } } },
          // el NIT se busca por dígitos
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
          formulario: { select: { slug: true, titulo: true } },
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
        // por que enlace entro
        formulario: r.formulario
          ? { slug: r.formulario.slug, titulo: r.formulario.titulo }
          : null,
        respuestas: r.respuestas.map((x) => ({
          pregunta: x.etiquetaPregunta,
          valor: valorLegible(x),
        })),
      })),
    };
  }

  /** Cuántas reservas trajo cada enlace. */
  async porFormulario(ambito: string[]) {
    const formularios = await this.prisma.formulario.findMany({
      where: { convenioId: { in: ambito } },
      orderBy: [{ convenio: { orden: 'asc' } }, { titulo: 'asc' }],
      select: {
        id: true,
        slug: true,
        titulo: true,
        publicado: true,
        convenio: { select: { sigla: true, slug: true } },
      },
    });

    const conteo = await this.prisma.reserva.groupBy({
      by: ['formularioId'],
      where: { ...reservaDeConvenio(ambito), estado: 'CONFIRMADA' },
      _count: { _all: true },
      _sum: { cuposConfirmados: true },
    });
    const porId = new Map(conteo.map((c) => [c.formularioId, c]));

    const filas = formularios.map((f) => {
      const c = porId.get(f.id);
      return {
        slug: f.slug,
        titulo: f.titulo,
        publicado: f.publicado,
        convenio: f.convenio.sigla ?? f.convenio.slug,
        reservas: c?._count._all ?? 0,
        cupos: c?._sum.cuposConfirmados ?? 0,
      };
    });

    // las de antes del constructor no tienen formulario
    const huerfanas = porId.get(null);
    if (huerfanas) {
      filas.push({
        slug: '',
        titulo: 'Sin formulario (antes del constructor)',
        publicado: false,
        convenio: '',
        reservas: huerfanas._count._all,
        cupos: huerfanas._sum.cuposConfirmados ?? 0,
      });
    }

    return filas;
  }

  /**
   * Borra una reserva y devuelve sus cupos. Si la
   * organización se queda sin ninguna, se va con ella:
   * una empresa sin reservas no es nada.
   */
  async cancelarReserva(id: string, ambito: string[]) {
    const reserva = await this.prisma.reserva.findFirst({
      where: { id, ...reservaDeConvenio(ambito) },
      include: {
        empresa: { select: { id: true, nit: true, razonSocial: true } },
        _count: { select: { participantes: true } },
      },
    });
    if (!reserva) throw new NotFoundException('Esa reserva no existe.');

    // con gente inscrita detrás, borrarla los dejaría
    // colgando. Lo impide también la base
    if (reserva._count.participantes > 0) {
      throw new ConflictException(
        `Esta reserva tiene ${reserva._count.participantes} personas inscritas. ` +
          'Quítelas de la reserva antes de cancelarla: si no, se quedan ocupando un cupo que ya nadie apartó.',
      );
    }

    /**
     * Se CANCELA, no se borra.
     *
     * Borrarla se llevaba por delante tres cosas que no son suyas: sus
     * `MovimientoReserva` --que son la auditoría de cada cambio de
     * cupos, y con ella se reescribían gráficas ya publicadas--, sus
     * respuestas del formulario, y, si era la última de esa empresa,
     * la EMPRESA ENTERA. Con la empresa se iba el empleador de los
     * inscritos que llegaron por su cuenta y nunca vinieron de esa
     * reserva. Todo eso sin dejar una línea en la auditoría.
     *
     * `CANCELADA` ya existía, ya devuelve los cupos y conserva la fila
     * con su historial. Es lo mismo que hace la pantalla pública.
     */
    const devueltos = await this.prisma.$transaction(async (tx) => {
      if (reserva.estado === 'CANCELADA') return { cupos: 0, yaEstaba: true };

      /// La fila de la oferta, tomada antes de mover su contador: es el
      /// mismo candado que usan crear, editar y cancelar en reservas.
      await tx.$queryRaw`SELECT "id" FROM "ofertas" WHERE "id" = ${reserva.ofertaId} FOR UPDATE`;

      const cupos = reserva.cuposConfirmados;
      if (cupos > 0) {
        await tx.oferta.update({
          where: { id: reserva.ofertaId },
          data: { cuposOcupados: { decrement: cupos } },
        });
      }

      await tx.reserva.update({
        where: { id },
        data: {
          cuposConfirmados: 0,
          cuposEnEspera: 0,
          estado: 'CANCELADA',
          canceladaEn: new Date(),
        },
      });

      await tx.movimientoReserva.create({
        data: {
          reservaId: id,
          accion: 'CANCELACION',
          confirmadosAntes: reserva.cuposConfirmados,
          confirmadosDespues: 0,
          enEsperaAntes: reserva.cuposEnEspera,
          enEsperaDespues: 0,
        },
      });

      return { cupos, yaEstaba: false };
    });

    return {
      cancelada: true,
      yaEstaba: devueltos.yaEstaba,
      cuposDevueltos: devueltos.cupos,
      organizacion: reserva.empresa.razonSocial,
    };
  }

  /** Reservas del filtro sin paginar, para exportar. */
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
        formulario: { select: { slug: true, titulo: true } },
        respuestas: { orderBy: { pregunta: { orden: 'asc' } } },
      },
    });
  }
}

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Porcentaje con un decimal. */
function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

/// El orden de menor a mayor, con el hueco al final.
///
/// La clasificacion vive en `crm/catalogos-sep.ts` porque sale
/// del catalogo del SEP; aqui solo se ordena para pintar.
const ORDEN_TAMANO = [...TALLAS, 'Sin indicar'];

/** Media, mediana y extremos de una lista ordenada. */
export function resumenNumerico(valores: number[]) {
  if (!valores.length) {
    return { media: null, mediana: null, minimo: null, maximo: null, suma: 0 };
  }
  const suma = valores.reduce((a, b) => a + b, 0);
  const medio = Math.floor(valores.length / 2);
  return {
    media: Math.round((suma / valores.length) * 10) / 10,
    mediana:
      valores.length % 2 ? valores[medio] : (valores[medio - 1] + valores[medio]) / 2,
    minimo: valores[0],
    maximo: valores[valores.length - 1],
    suma,
  };
}

/** Cuenta por opción, con la etiqueta de hoy. */
export function contarOpciones(
  opciones: Array<{ valor: string; etiqueta: string; archivada: boolean }>,
  respuestas: Array<{ valoresSeleccion: string[]; etiquetasSeleccion: string[] }>,
) {
  const cuenta = new Map<string, number>();
  const etiquetaCongelada = new Map<string, string>();

  for (const respuesta of respuestas) {
    respuesta.valoresSeleccion.forEach((valor, i) => {
      cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1);
      const congelada = respuesta.etiquetasSeleccion[i];
      if (congelada && !etiquetaCongelada.has(valor)) {
        etiquetaCongelada.set(valor, congelada);
      }
    });
  }

  const total = [...cuenta.values()].reduce((a, b) => a + b, 0);
  const conocidas = opciones.map((o) => ({
    valor: o.valor,
    etiqueta: o.etiqueta,
    archivada: o.archivada,
    veces: cuenta.get(o.valor) ?? 0,
    porcentaje: pct(cuenta.get(o.valor) ?? 0, total),
  }));

  // valores fuera del catálogo
  const catalogo = new Set(opciones.map((o) => o.valor));
  const huerfanas = [...cuenta.entries()]
    .filter(([valor]) => !catalogo.has(valor))
    .map(([valor, veces]) => ({
      valor,
      etiqueta: etiquetaCongelada.get(valor) ?? valor,
      archivada: true,
      veces,
      porcentaje: pct(veces, total),
    }));

  return [...conocidas, ...huerfanas].sort((a, b) => b.veces - a.veces);
}

/** Valor de la respuesta según su tipo. */
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
