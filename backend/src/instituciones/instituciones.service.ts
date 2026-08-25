/** El maestro de organizaciones: consultar, corregir, verificar. */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { AuditoriaService } from '../comun/auditoria.service';
import { calcularDigitoVerificacion } from '../comun/nit';
import { PrismaService } from '../prisma/prisma.service';
import { AplicarPropuestaDto, EditarInstitucionDto } from './dto';

/// Lo obligatorio de una empresa. Si falta alguno, la ficha
/// no se puede dar por aprobada y hay que ir a buscarlo.
///
/// Fecha de fundación, correo, página web y número de
/// empleados quedan fuera a propósito: son útiles, pero no
/// bloquean.
const CAMPOS_OBLIGATORIOS = [
  'razonSocial',
  'nombreComercial',
  'direccion',
  'telefono',
  'ciudadNombre',
  'departamentoNombre',
  'sectorEconomico',
  'codigoCiiu',
  'clasificacion',
  'tamano',
] as const;

const POR_PAGINA = 50;

@Injectable()
export class InstitucionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * El listado, con lo que le falta a cada una.
   *
   * `verificada` no es cosmético: una ficha que nadie ha
   * mirado no debería salir en un reporte al SENA por muy
   * completa que se vea.
   */
  async listar(opciones: {
    buscar?: string;
    soloIncompletas?: boolean;
    soloSinVerificar?: boolean;
    soloSugeridos?: boolean;
    pagina?: number;
  }) {
    const pagina = Math.max(1, opciones.pagina ?? 1);
    const buscar = opciones.buscar?.trim();

    const where: Prisma.InstitucionWhereInput = { activo: true };

    if (buscar) {
      // por NIT si lo que teclearon son dígitos, por nombre si no
      const digitos = buscar.replace(/\D/g, '');
      where.OR = [
        { razonSocial: { contains: buscar, mode: 'insensitive' } },
        { nombreComercial: { contains: buscar, mode: 'insensitive' } },
        ...(digitos ? [{ nit: { startsWith: digitos } }] : []),
      ];
    }

    if (opciones.soloSinVerificar) where.verificadaEn = null;

    /// «Incompleta» y «sugerido» salen de mirar campo a campo
    /// y del JSON de procedencia: no son una columna que SQL
    /// pueda filtrar. Cuando se piden, se traen todas las que
    /// cumplen el `where` y se pagina despues -- si no, el
    /// total mentiria y habria paginas vacias en medio.
    const enMemoria = Boolean(opciones.soloIncompletas || opciones.soloSugeridos);

    const consulta = {
      where,
      orderBy: [{ razonSocial: 'asc' as const }],
      include: {
        verificadaPor: { select: { nombre: true } },
        _count: { select: { empresas: true, propuestas: true } },
      },
    };

    if (!enMemoria) {
      const [filas, total] = await this.prisma.$transaction([
        this.prisma.institucion.findMany({
          ...consulta,
          skip: (pagina - 1) * POR_PAGINA,
          take: POR_PAGINA,
        }),
        this.prisma.institucion.count({ where }),
      ]);

      return {
        instituciones: filas.map((f) => this.conFaltantes(f)),
        total,
        pagina,
        porPagina: POR_PAGINA,
      };
    }

    const todas = (await this.prisma.institucion.findMany(consulta)).map((f) =>
      this.conFaltantes(f),
    );

    const filtradas = todas.filter(
      (x) =>
        (!opciones.soloIncompletas || x.falta.length > 0) &&
        (!opciones.soloSugeridos || x.sinConfirmar.length > 0),
    );

    return {
      instituciones: filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
      total: filtradas.length,
      pagina,
      porPagina: POR_PAGINA,
    };
  }

  /**
   * Cuántas caen en cada filtro.
   *
   * «Incompleta» y «sugerido» salen de mirar campo a campo y
   * del JSON de procedencia, así que se cuentan en memoria.
   * Con unos cientos de filas no cuesta nada, y así la pantalla
   * puede decir al lado de cada casilla a cuántas afecta.
   */
  async resumen() {
    const [filas, propuestas] = await this.prisma.$transaction([
      this.prisma.institucion.findMany({
        where: { activo: true },
        select: {
          verificadaEn: true,
          fuentePorCampo: true,
          razonSocial: true,
          nombreComercial: true,
          direccion: true,
          telefono: true,
          ciudadNombre: true,
          departamentoNombre: true,
          sectorEconomico: true,
          codigoCiiu: true,
          clasificacion: true,
          tamano: true,
        },
      }),
      this.prisma.propuestaInstitucion.count({ where: { estado: 'PENDIENTE' } }),
    ]);

    const revisadas = filas.map((f) => this.conFaltantes(f));

    return {
      total: filas.length,
      verificadas: revisadas.filter((x) => x.verificadaEn !== null).length,
      sinVerificar: revisadas.filter((x) => x.verificadaEn === null).length,
      incompletas: revisadas.filter((x) => x.falta.length > 0).length,
      sugeridas: revisadas.filter((x) => x.sinConfirmar.length > 0).length,
      propuestas,
    };
  }

  /** Una ficha entera, con sus propuestas sin resolver. */
  async ver(id: string) {
    const f = await this.prisma.institucion.findUnique({
      where: { id },
      include: {
        verificadaPor: { select: { nombre: true } },
        empresas: {
          select: { id: true, razonSocial: true, _count: { select: { participantes: true } } },
        },
        propuestas: {
          where: { estado: 'PENDIENTE' },
          orderBy: { creadoEn: 'desc' },
          select: { id: true, campos: true, fuente: true, creadoEn: true },
        },
        consultas: {
          orderBy: { creadoEn: 'desc' },
          take: 5,
          select: { id: true, estado: true, ultimoError: true, resueltaEn: true, creadoEn: true },
        },
      },
    });
    if (!f) throw new NotFoundException('No hay ninguna institución con ese id.');

    const historial = await this.auditoria.historial('Institucion', id, 50);

    return {
      ...this.conFaltantes(f),
      historial,
      digitoVerificacion: calcularDigitoVerificacion(f.nit),
      empresas: f.empresas,
      propuestas: f.propuestas,
      consultas: f.consultas,
    };
  }

  /**
   * Corregir a mano.
   *
   * Lo que toca una persona queda con fuente HUMANO campo a
   * campo. No marca la ficha como verificada: corregir un
   * teléfono no es haber revisado los otros nueve datos.
   */
  async editar(
    id: string,
    dto: EditarInstitucionDto,
    admin: { id: string; nombre: string },
  ) {
    const antes = await this.prisma.institucion.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('No hay ninguna institución con ese id.');

    const puestos = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (puestos.length === 0) {
      throw new BadRequestException('No mandó ningún campo para cambiar.');
    }

    const fuentes: Record<string, string> = { ...this.aObjeto(antes.fuentePorCampo) };
    for (const [campo] of puestos) fuentes[campo] = 'HUMANO';

    const datos: Prisma.InstitucionUpdateInput = {
      ...Object.fromEntries(puestos),
      fuentePorCampo: fuentes,
    };
    if (dto.fechaFundacion) datos.fechaFundacion = new Date(dto.fechaFundacion);

    const f = await this.prisma.institucion.update({
      where: { id },
      data: datos,
      include: { verificadaPor: { select: { nombre: true } } },
    });

    /// Guardar es aprobar: quien corrige la ficha responde por
    /// ella. Pero solo si esta completa -- una ficha a la que
    /// le faltan datos no se puede dar por buena, y decirlo es
    /// mas util que apagar un boton sin explicar por que.
    /// Que cambio y desde que valor. Son datos de empresa,
    /// no de una persona: aqui si se puede guardar el valor,
    /// que es lo que hace util un control de cambios.
    const previo = antes as unknown as Record<string, unknown>;
    const cambios = puestos
      .filter(([campo, valor]) => String(previo[campo] ?? '') !== String(valor ?? ''))
      .map(([campo, valor]) => `${campo}: ${this.legible(previo[campo])} → ${this.legible(valor)}`);

    if (cambios.length > 0) {
      await this.auditoria.registrar({
        actor: { id: admin.id, nombre: admin.nombre },
        accion: 'EMPRESA_EDITADA',
        entidad: 'Institucion',
        entidadId: id,
        camposTocados: puestos.map(([campo]) => campo),
        resumen: cambios.join(' · ').slice(0, 900),
      });
    }

    const revisada = this.conFaltantes(f);
    if (revisada.falta.length > 0) return revisada;

    const aprobada = await this.prisma.institucion.update({
      where: { id },
      data: { verificadaPorId: admin.id, verificadaEn: new Date() },
      include: { verificadaPor: { select: { nombre: true } } },
    });

    return this.conFaltantes(aprobada);
  }

  /** Alguien la miró y responde por ella. */
  async verificar(id: string, adminId: string) {
    const f = await this.prisma.institucion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!f) throw new NotFoundException('No hay ninguna institución con ese id.');

    const puesta = await this.prisma.institucion.update({
      where: { id },
      data: { verificadaPorId: adminId, verificadaEn: new Date() },
      include: { verificadaPor: { select: { nombre: true } } },
    });

    return this.conFaltantes(puesta);
  }

  /** Se deja de verificar: lo que trajo el robot cambió. */
  async desverificar(id: string) {
    const f = await this.prisma.institucion.update({
      where: { id },
      data: { verificadaPorId: null, verificadaEn: null },
      include: { verificadaPor: { select: { nombre: true } } },
    });
    return this.conFaltantes(f);
  }

  /** Lo que un robot propuso, esperando que alguien decida. */
  async pendientes() {
    return this.prisma.propuestaInstitucion.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { creadoEn: 'asc' },
      select: {
        id: true,
        campos: true,
        fuente: true,
        creadoEn: true,
        institucion: { select: { id: true, nit: true, razonSocial: true } },
      },
    });
  }

  /**
   * El asesor deja entrar unos campos y descarta el resto.
   *
   * Cada campo aceptado se queda con la fuente de la propuesta
   * -- RUES o WEB -- no con HUMANO: la persona autorizó que
   * entrara, no verificó el dato uno por uno.
   */
  async aplicarPropuesta(id: string, dto: AplicarPropuestaDto, adminId: string) {
    const propuesta = await this.prisma.propuestaInstitucion.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        campos: true,
        fuente: true,
        institucion: { select: { id: true, fuentePorCampo: true } },
      },
    });
    if (!propuesta) throw new NotFoundException('Esa propuesta ya no existe.');
    if (propuesta.estado !== 'PENDIENTE') {
      throw new BadRequestException('Esa propuesta ya se resolvió.');
    }

    const traidos = this.aObjeto(propuesta.campos);
    const aceptados = dto.campos.filter((c) => c in traidos);

    if (aceptados.length > 0) {
      const fuentes: Record<string, string> = {
        ...this.aObjeto(propuesta.institucion.fuentePorCampo),
      };
      const datos: Record<string, unknown> = {};

      for (const campo of aceptados) {
        datos[campo] =
          campo === 'fechaFundacion' && typeof traidos[campo] === 'string'
            ? new Date(traidos[campo] as string)
            : traidos[campo];
        fuentes[campo] = propuesta.fuente;
      }

      await this.prisma.institucion.update({
        where: { id: propuesta.institucion.id },
        data: { ...datos, fuentePorCampo: fuentes } as Prisma.InstitucionUpdateInput,
      });
    }

    await this.prisma.propuestaInstitucion.update({
      where: { id },
      data: {
        estado: aceptados.length > 0 ? 'ACEPTADA' : 'DESCARTADA',
        camposAceptados: aceptados,
        resueltoPorId: adminId,
        resueltoEn: new Date(),
      },
    });

    /// Aceptar campos es un acto humano igual que guardar: si
    /// con ellos la ficha queda completa, queda aprobada. Sin
    /// esto habia que ir a reescribir cualquier campo a mano
    /// solo para poder darle a Guardar.
    if (aceptados.length > 0) {
      const puesta = await this.prisma.institucion.findUnique({
        where: { id: propuesta.institucion.id },
      });
      if (puesta && this.conFaltantes(puesta).falta.length === 0) {
        await this.prisma.institucion.update({
          where: { id: propuesta.institucion.id },
          data: { verificadaPorId: adminId, verificadaEn: new Date() },
        });
      }
    }

    return { aplicados: aceptados.length, descartados: Object.keys(traidos).length - aceptados.length };
  }

  // ---------------------------------------------------------

  /// Qué le falta a la ficha para poder reportarse, y de
  /// dónde salió cada dato que sí tiene.
  private conFaltantes<
    T extends Record<string, unknown> & { fuentePorCampo: Prisma.JsonValue | null },
  >(f: T) {
    const falta = CAMPOS_OBLIGATORIOS.filter((c) => {
      const v = f[c];
      return v === null || v === undefined || v === '';
    });

    const fuentes = this.aObjeto(f.fuentePorCampo);

    /// Lo que trajo un buscador y nadie ha confirmado. Es lo
    /// que no puede salir hacia el SENA.
    const sinConfirmar = Object.entries(fuentes)
      .filter(([, fuente]) => fuente === 'WEB')
      .map(([campo]) => campo);

    return { ...f, falta, sinConfirmar, reportable: falta.length === 0 && Boolean(f.verificadaEn) };
  }

  /// El JSON de la base, como objeto plano. Prisma lo
  /// entrega como JsonValue, que puede ser un array o un
  /// escalar: nada de eso sirve como mapa campo -> fuente.
  /// Como se ve un valor en el control de cambios. Vacio se
  /// escribe con raya: «— → Bogota» se lee mejor que un hueco.
  private legible(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  }

  private aObjeto(v: Prisma.JsonValue | null): Record<string, string> {
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, string>)
      : {};
  }
}
