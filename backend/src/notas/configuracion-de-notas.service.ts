/** El catálogo de categorías y subcategorías de una nota. */

/**
 * Lo pidió el cliente el 30 sep 2026, textual: «necesito que las
 * notas sean como las plantillas personalizables. Ejemplo: No
 * contactado. Pero una subclasificación de No contactado como: Sin
 * respuesta. O algo así como su categoría y su subcategoría más lo
 * que coloque el asesor. Esto blinda el proceso y se sabe realmente
 * qué pasó, no solo con inscripciones sino con todas las gestiones».
 *
 * DOS COSAS DISTINTAS VIVEN AQUÍ y conviene no confundirlas:
 *
 *  1. Configurar el catálogo. Lo hace UNA persona, de vez en cuando,
 *     y exige `configuracion` con nivel ESCRIBIR.
 *  2. Validar la clasificación de una nota —`exigirClasificacion`—.
 *     Eso lo llama quien escribe la nota, que es el asesor, y no
 *     exige nada más de lo que ya exigía anotar.
 *
 * Están en el mismo servicio porque las dos responden a la misma
 * pregunta —«qué es una categoría válida»— y tenerla escrita dos
 * veces es la forma segura de que un día digan cosas distintas.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService, ENTIDADES } from '../comun/auditoria.service';
import type {
  ActualizarCategoriaDto,
  ActualizarSubcategoriaDto,
  CrearCategoriaDto,
  CrearSubcategoriaDto,
} from './dto';

type Admin = { id: string; nombre: string };

/// Lo que la nota trae clasificado, tal cual llega del DTO.
export type Clasificacion = {
  categoriaId?: string | null;
  subcategoriaId?: string | null;
};

@Injectable()
export class ConfiguracionDeNotasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * El catálogo entero, o solo lo que se puede ofrecer.
   *
   * `soloVisibles` es lo que piden los desplegables del asesor; sin
   * él sale todo, que es lo que necesita la pantalla de
   * configuración: ahí lo oculto tiene que VERSE para poder volverlo
   * a ofrecer. Una pantalla de configuración que esconde lo oculto
   * no deja desocultar nada.
   */
  async listar(soloVisibles = false) {
    const categorias = await this.prisma.categoriaDeNota.findMany({
      where: soloVisibles ? { ocultaEn: null } : undefined,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        subcategorias: {
          where: soloVisibles ? { ocultaEn: null } : undefined,
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        },
        /// Cuántas notas la nombran. Es el número que explica por qué
        /// esta fila no se puede borrar, dicho en la propia pantalla
        /// donde alguien buscaría el botón de borrar.
        _count: { select: { notas: true } },
      },
    });

    /// Cuántas notas cuelgan de cada subcategoría, en UNA consulta y
    /// no una por fila: con veinte subcategorías eso serían veinte
    /// viajes a la base para pintar una pantalla de configuración.
    const porSub = await this.prisma.notaDeGestion.groupBy({
      by: ['subcategoriaId'],
      where: { subcategoriaId: { not: null } },
      _count: { _all: true },
    });
    const usos = new Map(
      porSub.map((f) => [f.subcategoriaId as string, f._count._all]),
    );

    return categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      orden: c.orden,
      oculta: c.ocultaEn !== null,
      ocultaEn: c.ocultaEn,
      notas: c._count.notas,
      subcategorias: c.subcategorias.map((s) => ({
        id: s.id,
        categoriaId: s.categoriaId,
        nombre: s.nombre,
        orden: s.orden,
        oculta: s.ocultaEn !== null,
        ocultaEn: s.ocultaEn,
        notas: usos.get(s.id) ?? 0,
      })),
    }));
  }

  async crearCategoria(dto: CrearCategoriaDto, admin: Admin, ip?: string) {
    await this.exigirNombreLibre(dto.nombre);

    const categoria = await this.prisma.categoriaDeNota.create({
      data: {
        nombre: dto.nombre,
        orden: dto.orden ?? (await this.siguienteOrdenDeCategoria()),
      },
    });

    await this.anotar(
      admin,
      categoria.id,
      `Categoría creada: «${categoria.nombre}».`,
      ip,
    );
    return this.unaCategoria(categoria.id);
  }

  async actualizarCategoria(
    id: string,
    dto: ActualizarCategoriaDto,
    admin: Admin,
    ip?: string,
  ) {
    const antes = await this.prisma.categoriaDeNota.findUnique({
      where: { id },
    });
    if (!antes) throw new NotFoundException('Esa categoría no existe.');

    if (dto.nombre !== undefined && dto.nombre !== antes.nombre) {
      await this.exigirNombreLibre(dto.nombre);
    }

    /// Reocultar algo ya oculto NO mueve la fecha: la pregunta que
    /// `ocultaEn` contesta es «desde cuándo dejó de ofrecerse», y un
    /// segundo clic la perdería.
    const yaEstaba = antes.ocultaEn !== null;
    const tocaOcultar = dto.oculta !== undefined && dto.oculta !== yaEstaba;

    await this.prisma.categoriaDeNota.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        orden: dto.orden,
        /// La fecha la pone el servidor. No hay forma de mandarla
        /// desde el panel: así nadie puede inventarse cuándo se
        /// ocultó algo.
        ocultaEn: tocaOcultar ? (dto.oculta ? new Date() : null) : undefined,
      },
    });

    const que: string[] = [];
    if (dto.nombre !== undefined && dto.nombre !== antes.nombre) {
      que.push(`renombrada de «${antes.nombre}» a «${dto.nombre}»`);
    }
    if (dto.orden !== undefined && dto.orden !== antes.orden) {
      que.push('reordenada');
    }
    if (tocaOcultar) que.push(dto.oculta ? 'OCULTADA' : 'vuelta a ofrecer');

    if (que.length) {
      await this.anotar(
        admin,
        id,
        `Categoría «${antes.nombre}»: ${que.join(', ')}.`,
        ip,
      );
    }

    return this.unaCategoria(id);
  }

  async crearSubcategoria(
    categoriaId: string,
    dto: CrearSubcategoriaDto,
    admin: Admin,
    ip?: string,
  ) {
    const categoria = await this.prisma.categoriaDeNota.findUnique({
      where: { id: categoriaId },
      select: { id: true, nombre: true, ocultaEn: true },
    });
    if (!categoria) throw new NotFoundException('Esa categoría no existe.');

    /// No se cuelga nada nuevo de una categoría oculta.
    ///
    /// No es purismo: una subcategoría visible dentro de una
    /// categoría oculta no aparece en ningún desplegable, así que
    /// quien la creó se queda esperando a que salga.
    if (categoria.ocultaEn) {
      throw new ConflictException(
        `«${categoria.nombre}» está oculta, así que nada de lo que cuelgue de ` +
          'ella se va a ofrecer. Vuelva a ofrecer la categoría primero.',
      );
    }

    const repetida = await this.prisma.subcategoriaDeNota.findFirst({
      where: {
        categoriaId,
        nombre: { equals: dto.nombre, mode: 'insensitive' },
      },
      select: { nombre: true, ocultaEn: true },
    });
    if (repetida) {
      throw new ConflictException(
        repetida.ocultaEn
          ? `«${repetida.nombre}» ya existe en «${categoria.nombre}», oculta. ` +
              'Vuelva a ofrecerla en vez de crearla otra vez: hay notas que la ' +
              'nombran.'
          : `«${repetida.nombre}» ya está en «${categoria.nombre}».`,
      );
    }

    const sub = await this.prisma.subcategoriaDeNota.create({
      data: {
        categoriaId,
        nombre: dto.nombre,
        orden:
          dto.orden ?? (await this.siguienteOrdenDeSubcategoria(categoriaId)),
      },
    });

    await this.anotar(
      admin,
      sub.id,
      `Subcategoría creada: «${categoria.nombre}» › «${sub.nombre}».`,
      ip,
    );
    return this.unaCategoria(categoriaId);
  }

  async actualizarSubcategoria(
    id: string,
    dto: ActualizarSubcategoriaDto,
    admin: Admin,
    ip?: string,
  ) {
    const antes = await this.prisma.subcategoriaDeNota.findUnique({
      where: { id },
      include: { categoria: { select: { nombre: true } } },
    });
    if (!antes) throw new NotFoundException('Esa subcategoría no existe.');

    if (dto.nombre !== undefined && dto.nombre !== antes.nombre) {
      const repetida = await this.prisma.subcategoriaDeNota.findFirst({
        where: {
          categoriaId: antes.categoriaId,
          nombre: { equals: dto.nombre, mode: 'insensitive' },
          id: { not: id },
        },
        select: { nombre: true },
      });
      if (repetida) {
        throw new ConflictException(
          `«${repetida.nombre}» ya está en «${antes.categoria.nombre}».`,
        );
      }
    }

    const yaEstaba = antes.ocultaEn !== null;
    const tocaOcultar = dto.oculta !== undefined && dto.oculta !== yaEstaba;

    await this.prisma.subcategoriaDeNota.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        orden: dto.orden,
        ocultaEn: tocaOcultar ? (dto.oculta ? new Date() : null) : undefined,
      },
    });

    const que: string[] = [];
    if (dto.nombre !== undefined && dto.nombre !== antes.nombre) {
      que.push(`renombrada de «${antes.nombre}» a «${dto.nombre}»`);
    }
    if (dto.orden !== undefined && dto.orden !== antes.orden) {
      que.push('reordenada');
    }
    if (tocaOcultar) que.push(dto.oculta ? 'OCULTADA' : 'vuelta a ofrecer');

    if (que.length) {
      await this.anotar(
        admin,
        id,
        `Subcategoría «${antes.categoria.nombre}» › «${antes.nombre}»: ` +
          `${que.join(', ')}.`,
        ip,
      );
    }

    return this.unaCategoria(antes.categoriaId);
  }

  /**
   * Comprueba la clasificación de una nota ANTES de escribirla.
   *
   * La llaman los dos sitios que crean notas —la ficha y el lead— y
   * devuelve lo que va a la base. No vale comprobarlo solo en la
   * pantalla: estas rutas se llaman directo, y es la misma razón por
   * la que `puedoContactar` vive en el servidor.
   *
   * Lo que rechaza, y por qué cada cosa:
   *
   *  - Subcategoría sin categoría: «Sin respuesta» a secas no dice de
   *    qué. Y la base no puede impedirlo: la coherencia entre dos
   *    claves ajenas no se expresa con una clave ajena.
   *  - Subcategoría de OTRA categoría: es el error que vuelve el
   *    informe mentira sin que nada falle. Pasa de verdad —el asesor
   *    cambia la categoría y el segundo desplegable se queda con lo
   *    de antes—, así que se para aquí y no solo en el navegador.
   *  - Categoría o subcategoría OCULTA: dejó de ofrecerse, así que no
   *    se anota más. Leer las notas viejas que la nombran sigue
   *    funcionando, y eso es ocultar y no borrar.
   *  - Una que no existe: 400 y no 404, porque lo que no existe es lo
   *    que mandó quien llama, no la ruta.
   */
  async exigirClasificacion(
    c: Clasificacion,
  ): Promise<{ categoriaId: string | null; subcategoriaId: string | null }> {
    const categoriaId = c.categoriaId ?? null;
    const subcategoriaId = c.subcategoriaId ?? null;

    /// Sin clasificar sigue siendo válido, y tiene que serlo: así
    /// quedan las notas que escribe el sistema —la de la autorización
    /// de datos, p. ej.— y las que ya estaban antes de esto.
    if (!categoriaId && !subcategoriaId) {
      return { categoriaId: null, subcategoriaId: null };
    }

    if (!categoriaId) {
      throw new BadRequestException(
        'Llegó una subcategoría sin categoría. La subcategoría sola no dice ' +
          'de qué.',
      );
    }

    const categoria = await this.prisma.categoriaDeNota.findUnique({
      where: { id: categoriaId },
      select: { id: true, nombre: true, ocultaEn: true },
    });
    if (!categoria) {
      throw new BadRequestException('Esa categoría de nota no existe.');
    }
    if (categoria.ocultaEn) {
      throw new BadRequestException(
        `«${categoria.nombre}» ya no se ofrece. Elija otra categoría.`,
      );
    }

    if (!subcategoriaId) return { categoriaId, subcategoriaId: null };

    const sub = await this.prisma.subcategoriaDeNota.findUnique({
      where: { id: subcategoriaId },
      select: { id: true, nombre: true, ocultaEn: true, categoriaId: true },
    });
    if (!sub) {
      throw new BadRequestException('Esa subcategoría de nota no existe.');
    }
    if (sub.categoriaId !== categoriaId) {
      throw new BadRequestException(
        `«${sub.nombre}» no es una subcategoría de «${categoria.nombre}».`,
      );
    }
    if (sub.ocultaEn) {
      throw new BadRequestException(
        `«${sub.nombre}» ya no se ofrece. Elija otra subcategoría.`,
      );
    }

    return { categoriaId, subcategoriaId };
  }

  /// El nombre se compara SIN distinguir mayúsculas.
  ///
  /// El `@unique` de la base solo para «No contactado» exacto, y
  /// «no contactado» pasaría: dos filas que se leen igual en el
  /// desplegable parten en dos el informe que cuelga de esa
  /// categoría, y nadie se daría cuenta hasta cuadrar cifras.
  private async exigirNombreLibre(nombre: string) {
    const ya = await this.prisma.categoriaDeNota.findFirst({
      where: { nombre: { equals: nombre, mode: 'insensitive' } },
      select: { nombre: true, ocultaEn: true },
    });
    if (!ya) return;

    throw new ConflictException(
      ya.ocultaEn
        ? `«${ya.nombre}» ya existe, oculta. Vuelva a ofrecerla en vez de ` +
            'crearla otra vez: hay notas que la nombran, y dos filas con el ' +
            'mismo nombre parten el informe en dos.'
        : `«${ya.nombre}» ya existe.`,
    );
  }

  /// De diez en diez: deja sitio para meter una en medio sin
  /// renumerar las demás.
  private async siguienteOrdenDeCategoria(): Promise<number> {
    const ultima = await this.prisma.categoriaDeNota.findFirst({
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });
    return (ultima?.orden ?? 0) + 10;
  }

  private async siguienteOrdenDeSubcategoria(
    categoriaId: string,
  ): Promise<number> {
    const ultima = await this.prisma.subcategoriaDeNota.findFirst({
      where: { categoriaId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });
    return (ultima?.orden ?? 0) + 10;
  }

  /// La categoría recién tocada, con sus subcategorías y sus cuentas,
  /// armada por el MISMO `listar` que pinta la pantalla: así lo que
  /// responde un POST no puede tener otra forma que lo que se pidió
  /// al cargar.
  private async unaCategoria(id: string) {
    const todas = await this.listar();
    const una = todas.find((c) => c.id === id);
    if (!una) throw new NotFoundException('Esa categoría no existe.');
    return una;
  }

  private anotar(admin: Admin, id: string, resumen: string, ip?: string) {
    return this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'CATALOGO_DE_NOTAS_EDITADO',
      entidad: ENTIDADES.CATEGORIA_DE_NOTA,
      entidadId: id,
      resumen,
      ip,
    });
  }
}
