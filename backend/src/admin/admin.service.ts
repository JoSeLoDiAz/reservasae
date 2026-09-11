import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  Prisma,
  RolAdmin,
  type Admin,
  type EsquemaColor,
} from '../../generated/prisma';
import {
  MAXIMO_LOGOS,
  sinExtension,
  type LogoPublico,
  type OrigenLogos,
} from '../comun/logo';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarAdminDto,
  ActualizarLogoDto,
  ActualizarMarcaDto,
  ActualizarPerfilDto,
  ActualizarTemaDto,
  CrearAdminDto,
} from './dto';
import { generarClaveTemporal, hashearClave, verificarClave } from './claves';
import { fusionarColores, tokensSobreescritos } from './apariencia';
import {
  COMPROBACIONES_CONTRASTE,
  conValoresPorDefecto,
  GRUPOS,
  TEMAS_POR_DEFECTO,
  TOKENS,
  type ColoresTema,
} from './temas';
import { gremioDelHost } from './gremio-del-host';

const ID_MARCA = 'unica';

/** Lo que se puede devolver de un administrador. */
export function vistaAdmin(admin: Admin) {
  return {
    id: admin.id,
    correo: admin.correo,
    nombre: admin.nombre,
    rol: admin.rol,
    activo: admin.activo,
    debeCambiarClave: admin.debeCambiarClave,
    cargo: admin.cargo,
    celular: admin.celular,
    organizacion: admin.organizacion,
    ultimoAcceso: admin.ultimoAcceso,
    creadoEn: admin.creadoEn,
  };
}

/** Lo mínimo para saber de quién es un logo. */
export type AmbitoDeLogos = { convenios: string[]; gremioFijo: boolean };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // sesión

  /**
   * Si esa cuenta puede entrar por esa dirección.
   *
   * Se comprueba AQUÍ y no solo en el guard porque el login
   * es público: sin esto se entraría bien y luego toda
   * pantalla contestaría que no, que parece un sistema roto
   * en vez de una puerta equivocada.
   */
  async motivoParaNoEntrarPor(
    admin: Admin,
    host?: string | null,
  ): Promise<string | null> {
    const activos = await this.prisma.convenio.findMany({
      where: { activo: true },
      select: { id: true, slug: true },
    });
    const delHost = gremioDelHost(host, activos);

    if (delHost) {
      const tiene = await this.prisma.adminConvenio.count({
        where: { adminId: admin.id, convenioId: delHost.id },
      });
      if (tiene === 0) {
        return (
          `Su cuenta no trabaja en ${delHost.slug}. Entre por la dirección ` +
          'del gremio que le corresponde.'
        );
      }
      return null;
    }

    if (
      process.env.PANEL_GENERAL_SOLO_SUPERADMIN === 'si' &&
      admin.rol !== 'SUPERADMIN'
    ) {
      return (
        'Esta dirección es solo para administración general. Entre por la ' +
        'dirección de su gremio.'
      );
    }

    return null;
  }

  async validarCredenciales(correo: string, clave: string): Promise<Admin> {
    const admin = await this.prisma.admin.findUnique({ where: { correo } });

    // mismo error: no decir que correos existen
    const generico = new UnauthorizedException('Correo o contraseña incorrectos.');
    if (!admin || !admin.activo) {
      // hash de descarte: que tarde lo mismo
      await verificarClave(clave, 'scrypt$AAAA$AAAA');
      throw generico;
    }
    if (!(await verificarClave(clave, admin.hashClave))) throw generico;

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { ultimoAcceso: new Date() },
    });
    return admin;
  }

  async cambiarClave(admin: Admin, claveActual: string, claveNueva: string) {
    if (!(await verificarClave(claveActual, admin.hashClave))) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    if (await verificarClave(claveNueva, admin.hashClave)) {
      throw new BadRequestException('La contraseña nueva debe ser distinta de la actual.');
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { hashClave: await hashearClave(claveNueva), debeCambiarClave: false },
    });
    return { cambiada: true };
  }

  // perfil

  async actualizarPerfil(admin: Admin, dto: ActualizarPerfilDto) {
    const actualizado = await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        nombre: dto.nombre ?? undefined,
        cargo: dto.cargo ?? undefined,
        celular: dto.celular ?? undefined,
        organizacion: dto.organizacion ?? undefined,
      },
    });
    return vistaAdmin(actualizado);
  }

  // usuarios

  async listarAdmins() {
    const admins = await this.prisma.admin.findMany({
      orderBy: { creadoEn: 'asc' },
      include: {
        convenios: {
          select: {
            convenioId: true,
            rol: true,
            convenio: { select: { slug: true, sigla: true, nombre: true } },
          },
        },
      },
    });
    return admins.map((a) => ({
      ...vistaAdmin(a),
      concesiones: a.convenios.map((c) => ({
        convenioId: c.convenioId,
        rol: c.rol,
        slug: c.convenio.slug,
        sigla: c.convenio.sigla ?? c.convenio.nombre,
      })),
    }));
  }

  /** Los gremios de una cuenta, con lo que se lee de ellos. */
  /** Los gremios de una cuenta, por su id. */
  async conveniosDe(adminId: string) {
    const filas = await this.prisma.adminConvenio.findMany({
      where: { adminId },
      select: { convenio: { select: { slug: true, sigla: true } } },
    });
    // una cuenta puede tener dos filas en el mismo convenio
    const vistos = new Map<string, { slug: string; sigla: string | null }>();
    for (const f of filas) vistos.set(f.convenio.slug, f.convenio);
    return [...vistos.values()];
  }

  async gremiosDe(convenioIds: string[]) {
    if (convenioIds.length === 0) return [];
    const cs = await this.prisma.convenio.findMany({
      where: { id: { in: convenioIds }, activo: true },
      select: { id: true, slug: true, sigla: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return cs.map((c) => ({
      convenioId: c.id,
      slug: c.slug,
      // la sigla es lo que cabe en el desplegable; sin ella,
      // el nombre entero antes que un hueco
      sigla: c.sigla ?? c.nombre,
    }));
  }

  /// Sin fila no ve nada, así que se validan de verdad.
  private async exigirConveniosReales(concesiones: { convenioId: string }[]) {
    const ids = [...new Set(concesiones.map((c) => c.convenioId))];
    const existen = await this.prisma.convenio.count({
      where: { id: { in: ids }, activo: true },
    });
    if (existen !== ids.length) {
      throw new BadRequestException('Alguno de los convenios indicados no existe.');
    }
  }

  /** Crea la cuenta; la clave temporal se ve una vez. */
  async crearAdmin(dto: CrearAdminDto) {
    const claveTemporal = generarClaveTemporal();
    await this.exigirConveniosReales(dto.concesiones);
    try {
      const creado = await this.prisma.admin.create({
        data: {
          correo: dto.correo,
          nombre: dto.nombre,
          rol: dto.rol,
          hashClave: await hashearClave(claveTemporal),
          debeCambiarClave: true,
          // en el mismo acto: una cuenta sin concesion
          // entra al panel y no ve una sola pantalla
          convenios: {
            create: dto.concesiones.map((c) => ({
              convenioId: c.convenioId,
              rol: c.rol,
            })),
          },
        },
      });
      return { admin: vistaAdmin(creado), claveTemporal };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una cuenta con ese correo.');
      }
      throw error;
    }
  }

  async actualizarAdmin(quienEdita: Admin, id: string, dto: ActualizarAdminDto) {
    const objetivo = await this.prisma.admin.findUnique({ where: { id } });
    if (!objetivo) throw new NotFoundException('No existe esa cuenta.');

    // no dejarse a uno mismo fuera del panel
    if (objetivo.id === quienEdita.id) {
      if (dto.activo === false) {
        throw new BadRequestException('No puede desactivar su propia cuenta.');
      }
      if (dto.rol && dto.rol !== RolAdmin.SUPERADMIN) {
        throw new BadRequestException('No puede quitarse a sí mismo el rol de superadmin.');
      }
    }

    await this.asegurarQuedaUnSuperadmin(objetivo, dto);

    if (dto.concesiones) {
      // quedarse sin ninguna es quedarse sin panel
      if (dto.concesiones.length === 0) {
        throw new BadRequestException(
          'Una cuenta sin ningún convenio no vería nada. Desactívela en vez de dejarla sin acceso.',
        );
      }
      await this.exigirConveniosReales(dto.concesiones);
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      if (dto.concesiones) {
        // se reemplazan enteras: upsert solo añade, y
        // entonces quitar un convenio no quitaría nada
        await tx.adminConvenio.deleteMany({ where: { adminId: id } });
        await tx.adminConvenio.createMany({
          data: dto.concesiones.map((c) => ({
            adminId: id,
            convenioId: c.convenioId,
            rol: c.rol,
          })),
        });
      }
      return tx.admin.update({
        where: { id },
        data: { rol: dto.rol ?? undefined, activo: dto.activo ?? undefined },
      });
    });
    return vistaAdmin(actualizado);
  }

  /** Contraseña temporal nueva para otra cuenta. */
  async reiniciarClave(quienEdita: Admin, id: string) {
    if (id === quienEdita.id) {
      throw new BadRequestException(
        'Para cambiar su propia contraseña use la opción de su perfil.',
      );
    }
    const objetivo = await this.prisma.admin.findUnique({ where: { id } });
    if (!objetivo) throw new NotFoundException('No existe esa cuenta.');

    const claveTemporal = generarClaveTemporal();
    await this.prisma.admin.update({
      where: { id },
      data: { hashClave: await hashearClave(claveTemporal), debeCambiarClave: true },
    });
    /// Sale tambien a quien, para poder escribirle. Va la
    /// VISTA y no la fila: aquella no lleva el hash.
    return { claveTemporal, admin: vistaAdmin(objetivo) };
  }

  /** Tiene que quedar al menos un superadmin activo. */
  private async asegurarQuedaUnSuperadmin(objetivo: Admin, dto: ActualizarAdminDto) {
    const dejaDeSerlo =
      objetivo.rol === RolAdmin.SUPERADMIN &&
      ((dto.rol && dto.rol !== RolAdmin.SUPERADMIN) || dto.activo === false);
    if (!dejaDeSerlo) return;

    const otros = await this.prisma.admin.count({
      where: { rol: RolAdmin.SUPERADMIN, activo: true, id: { not: objetivo.id } },
    });
    if (otros === 0) {
      throw new ForbiddenException(
        'Debe quedar al menos un superadministrador activo. Cree otro antes de hacer este cambio.',
      );
    }
  }

  // marca

  /** Lee la marca, creándola si no existe. */
  async obtenerMarca() {
    const marca = await this.prisma.marca.upsert({
      where: { id: ID_MARCA },
      create: { id: ID_MARCA },
      update: {},
      select: {
        nombreApp: true,
        tituloPublico: true,
        subtituloPublico: true,
        mensajeEncabezado: true,
        piePagina: true,
        modoPorDefecto: true,
        permitirCambioDeModo: true,
        actualizadoEn: true,
      },
    });

    // las dos paletas y el catalogo viajan juntos
    const filas = await this.prisma.tema.findMany({ orderBy: { esquema: 'asc' } });
    const temas = Object.fromEntries(
      filas.map((t) => [t.esquema, conValoresPorDefecto(t.esquema, t.colores)]),
    ) as Record<EsquemaColor, ColoresTema>;

    return {
      ...marca,
      ambito: 'GENERAL' as const,
      formularioSlug: null as string | null,
      logos: await this.listarLogos(null),
      origenLogos: 'GENERAL' as OrigenLogos,
      temas,
      catalogoColores: {
        grupos: GRUPOS,
        tokens: TOKENS,
        comprobacionesContraste: COMPROBACIONES_CONTRASTE,
      },
    };
  }

  /** La general con lo del formulario encima. */
  async obtenerMarcaDeFormulario(slug: string, incluirNoPublicado = false) {
    const general = await this.obtenerMarca();

    const formulario = await this.prisma.formulario.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        titulo: true,
        descripcion: true,
        publicado: true,
        coloresClaro: true,
        coloresOscuro: true,
      },
    });

    if (!formulario) return general;
    if (!formulario.publicado && !incluirNoPublicado) return general;

    const propios: Record<EsquemaColor, unknown> = {
      CLARO: formulario.coloresClaro,
      OSCURO: formulario.coloresOscuro,
    };

    // o los suyos o los generales, sin mezclar
    const suyos = await this.listarLogos(formulario.id);

    return {
      ...general,
      ambito: 'FORMULARIO' as const,
      formularioSlug: formulario.slug,
      // el titulo del formulario manda; el resto hereda
      tituloPublico: formulario.titulo,
      subtituloPublico: formulario.descripcion ?? general.subtituloPublico,
      logos: suyos.length ? suyos : general.logos,
      origenLogos: (suyos.length ? 'FORMULARIO' : 'GENERAL') as OrigenLogos,
      temas: Object.fromEntries(
        (Object.keys(general.temas) as EsquemaColor[]).map((esquema) => [
          esquema,
          fusionarColores(esquema, general.temas[esquema], propios[esquema]),
        ]),
      ) as Record<EsquemaColor, ColoresTema>,
      sobreescritos: {
        CLARO: tokensSobreescritos(formulario.coloresClaro),
        OSCURO: tokensSobreescritos(formulario.coloresOscuro),
      },
    };
  }

  /** Qué formulario da la marca de cada gremio. */
  async listarMarcaDeGremios(ambito: string[]) {
    const convenios = await this.prisma.convenio.findMany({
      where: { activo: true, id: { in: ambito } },
      orderBy: { orden: 'asc' },
      select: {
        id: true,
        slug: true,
        sigla: true,
        nombre: true,
        formularioMarcaId: true,
        formularios: {
          orderBy: { titulo: 'asc' },
          select: { id: true, slug: true, titulo: true, publicado: true },
        },
      },
    });

    return convenios.map((c) => ({
      ...c,
      /// La direccion por la que entra ese gremio. Se manda
      /// hecha porque es el dato que explica para que sirve
      /// esto, y calcularla en la pantalla la duplicaria.
      direccion: `${c.slug}.reservasae.com`,
    }));
  }

  /** Elegir de qué formulario sale la marca del gremio. */
  async fijarMarcaDeGremio(
    ambito: string[],
    convenioId: string,
    formularioId: string | null,
  ) {
    if (!ambito.includes(convenioId)) {
      throw new NotFoundException('Ese convenio no existe.');
    }
    const convenio = await this.prisma.convenio.findFirst({
      where: { id: convenioId, activo: true },
      select: { id: true },
    });
    if (!convenio) throw new NotFoundException('Ese convenio no existe.');

    // el formulario tiene que ser SUYO
    if (formularioId) {
      const suyo = await this.prisma.formulario.findFirst({
        where: { id: formularioId, convenioId },
        select: { id: true },
      });
      if (!suyo) {
        throw new BadRequestException(
          'Ese formulario no es de este convenio, así que no puede darle su marca.',
        );
      }
    }

    await this.prisma.convenio.update({
      where: { id: convenioId },
      data: { formularioMarcaId: formularioId },
    });

    return this.listarMarcaDeGremios(ambito);
  }

  /** Ese formulario es de un convenio del ámbito. */
  async exigirFormularioPorSlug(ambito: string[], slug: string) {
    const suyo = await this.prisma.formulario.findFirst({
      where: { slug, convenioId: { in: ambito } },
      select: { id: true },
    });
    if (!suyo) throw new NotFoundException('No existe ese formulario.');
  }

  /** La marca de un gremio: la de su formulario. */
  async obtenerMarcaDeGremio(slugConvenio: string) {
    const convenio = await this.prisma.convenio.findFirst({
      where: { slug: slugConvenio, activo: true },
      select: { formularioMarca: { select: { slug: true } } },
    });
    if (!convenio?.formularioMarca) return this.obtenerMarca();

    // sin publicar tambien: son dos decisiones
    return this.obtenerMarcaDeFormulario(convenio.formularioMarca.slug, true);
  }

  /** La marca que le toca a esa direccion. */
  async obtenerMarcaDelHost(host?: string | null) {
    const activos = await this.prisma.convenio.findMany({
      where: { activo: true },
      select: { id: true, slug: true },
    });
    const gremio = gremioDelHost(host, activos);
    return gremio ? this.obtenerMarcaDeGremio(gremio.slug) : this.obtenerMarca();
  }

  async actualizarTema(admin: Admin, esquema: EsquemaColor, dto: ActualizarTemaDto) {
    const existe = await this.prisma.tema.findUnique({ where: { esquema } });
    if (!existe) throw new NotFoundException(`No existe el tema ${esquema}.`);

    // mezcla con lo ya guardado
    const fusionado = {
      ...conValoresPorDefecto(esquema, existe.colores),
      ...dto.colores,
    };

    await this.prisma.tema.update({
      where: { esquema },
      data: { colores: fusionado, actualizadoPorId: admin.id },
    });
    return this.obtenerMarca();
  }

  /** Restablece los colores iniciales. */
  async restablecerTema(admin: Admin, esquema: EsquemaColor) {
    await this.prisma.tema.update({
      where: { esquema },
      data: { colores: TEMAS_POR_DEFECTO[esquema], actualizadoPorId: admin.id },
    });
    return this.obtenerMarca();
  }

  async actualizarMarca(admin: Admin, dto: ActualizarMarcaDto) {
    await this.obtenerMarca();
    await this.prisma.marca.update({
      where: { id: ID_MARCA },
      data: { ...dto, actualizadoPorId: admin.id },
    });
    return this.obtenerMarca();
  }

  // logos

  /// Lo que hace falta para saber de quien es un logo.
  ///
  /// `gremioFijo` importa tanto como el ambito: los logos
  /// generales tienen `formularioId = null` y no pertenecen a
  /// ningun convenio, asi que `{ in: ambito }` no los cubre.
  /// Sin mirar la puerta, el candado se salta mandando el
  /// campo vacio -- que es lo que hace la pantalla hoy.
  private async exigirLogoDelAmbito(
    a: AmbitoDeLogos,
    formularioId: string | null,
  ) {
    // lo general, solo por la puerta general
    if (!formularioId) {
      if (a.gremioFijo) throw new NotFoundException('No existe ese formulario.');
      return;
    }

    const suyo = await this.prisma.formulario.findFirst({
      where: { id: formularioId, convenioId: { in: a.convenios } },
      select: { id: true },
    });
    if (!suyo) throw new NotFoundException('No existe ese formulario.');
  }

  /// De que formulario es ese logo, comprobando el ambito.
  ///
  /// PATCH y DELETE solo reciben el id del logo, asi que
  /// validar el formularioId de entrada los dejaria abiertos:
  /// hay que resolver logo -> formulario -> convenio aqui.
  private async formularioDeLogo(a: AmbitoDeLogos, id: string) {
    const logo = await this.prisma.logo.findUnique({
      where: { id },
      select: { formularioId: true },
    });
    if (!logo) throw new NotFoundException('No existe ese logo.');
    await this.exigirLogoDelAmbito(a, logo.formularioId);
    return logo.formularioId;
  }

  /** Los del panel, comprobando de quién son. */
  async listarLogosDelPanel(
    a: AmbitoDeLogos,
    formularioId: string | null,
  ): Promise<LogoPublico[]> {
    await this.exigirLogoDelAmbito(a, formularioId);
    return this.listarLogos(formularioId);
  }

  /// Sin comprobar nada: la usa el camino PUBLICO de la marca.
  ///
  /// Privada a proposito. La leccion de `vista()` en
  /// formularios: un helper sin candado al que llega un
  /// controlador es la puerta de servicio por la que entra
  /// todo lo que nunca comprobo.
  private async listarLogos(formularioId: string | null): Promise<LogoPublico[]> {
    const filas = await this.prisma.logo.findMany({
      where: { formularioId },
      orderBy: [{ orden: 'asc' }, { creadoEn: 'asc' }],
      select: {
        id: true,
        etiqueta: true,
        tipoMime: true,
        nombre: true,
        version: true,
        orden: true,
      },
    });
    return filas;
  }

  // Uint8Array: es lo que espera el campo Bytes
  async agregarLogo(
    a: AmbitoDeLogos,
    formularioId: string | null,
    datos: Uint8Array,
    tipoMime: string,
    nombre: string,
    etiqueta?: string,
  ) {
    await this.exigirLogoDelAmbito(a, formularioId);

    const cuantos = await this.prisma.logo.count({ where: { formularioId } });
    if (cuantos >= MAXIMO_LOGOS) {
      throw new ConflictException(
        `Ya hay ${MAXIMO_LOGOS} logos. Quite uno antes de añadir otro.`,
      );
    }

    await this.prisma.logo.create({
      data: {
        formularioId,
        orden: cuantos,
        etiqueta: (etiqueta?.trim() || sinExtension(nombre)).slice(0, 60),
        // copia: multer puede dar un SharedArrayBuffer
        datos: new Uint8Array(datos),
        tipoMime,
        nombre,
      },
    });
    return this.listarLogos(formularioId);
  }

  /** Cambia la etiqueta o mueve el logo en el banner. */
  async actualizarLogo(a: AmbitoDeLogos, id: string, dto: ActualizarLogoDto) {
    await this.formularioDeLogo(a, id);

    const logo = await this.prisma.logo.findUnique({
      where: { id },
      select: { id: true, formularioId: true, orden: true },
    });
    if (!logo) throw new NotFoundException('No existe ese logo.');

    if (dto.etiqueta !== undefined) {
      await this.prisma.logo.update({
        where: { id },
        data: { etiqueta: dto.etiqueta.trim().slice(0, 60) },
      });
    }

    if (dto.direccion) {
      const hermanos = await this.prisma.logo.findMany({
        where: { formularioId: logo.formularioId },
        orderBy: [{ orden: 'asc' }, { creadoEn: 'asc' }],
        select: { id: true },
      });
      const desde = hermanos.findIndex((l) => l.id === id);
      const hasta = desde + (dto.direccion === 'IZQUIERDA' ? -1 : 1);
      if (hasta >= 0 && hasta < hermanos.length) {
        const [movido] = hermanos.splice(desde, 1);
        hermanos.splice(hasta, 0, movido);
        // orden entero: sin huecos ni empates
        await this.prisma.$transaction(
          hermanos.map((l, i) =>
            this.prisma.logo.update({ where: { id: l.id }, data: { orden: i } }),
          ),
        );
      }
    }

    return this.listarLogos(logo.formularioId);
  }

  async borrarLogo(a: AmbitoDeLogos, id: string) {
    await this.formularioDeLogo(a, id);

    const logo = await this.prisma.logo.findUnique({
      where: { id },
      select: { formularioId: true },
    });
    if (!logo) throw new NotFoundException('No existe ese logo.');

    await this.prisma.logo.delete({ where: { id } });

    // se compacta el orden para que no queden saltos
    const quedan = await this.prisma.logo.findMany({
      where: { formularioId: logo.formularioId },
      orderBy: [{ orden: 'asc' }, { creadoEn: 'asc' }],
      select: { id: true },
    });
    await this.prisma.$transaction(
      quedan.map((l, i) =>
        this.prisma.logo.update({ where: { id: l.id }, data: { orden: i } }),
      ),
    );

    return this.listarLogos(logo.formularioId);
  }

  /** Los bytes de un logo, para servirlo. */
  async leerLogo(id: string) {
    const logo = await this.prisma.logo.findUnique({
      where: { id },
      // `select` explicito: el omit global no aplica aqui
      select: { datos: true, tipoMime: true },
    });
    if (!logo) throw new NotFoundException('No existe ese logo.');
    return { datos: Buffer.from(logo.datos), tipoMime: logo.tipoMime };
  }

  private async exigirFormulario(formularioId: string | null) {
    if (!formularioId) return;
    const existe = await this.prisma.formulario.count({ where: { id: formularioId } });
    if (!existe) throw new NotFoundException('No existe ese formulario.');
  }

  // acciones de formación

  /** Los convenios con su id interno, para el panel. */
  /// Solo los concedidos: el desplegable no debe delatar
  /// que existe el otro convenio.
  async listarConvenios(ambito: string[]) {
    return this.prisma.convenio.findMany({
      where: { id: { in: ambito } },
      orderBy: { orden: 'asc' },
      select: { id: true, slug: true, nombre: true, sigla: true, activo: true },
    });
  }

  async listarAcciones(ambito: string[]) {
    const acciones = await this.prisma.accionFormacion.findMany({
      where: { convenioId: { in: ambito } },
      orderBy: [{ convenio: { orden: 'asc' } }, { orden: 'asc' }],
      include: {
        convenio: { select: { slug: true, sigla: true } },
        ofertas: { select: { cuposMaximos: true, cuposOcupados: true } },
      },
    });

    return acciones.map((a) => ({
      id: a.id,
      codigo: a.codigo,
      nombre: a.nombre,
      evento: a.evento,
      modalidad: a.modalidad,
      horas: a.horas,
      visible: a.visible,
      convenio: a.convenio.slug,
      convenioSigla: a.convenio.sigla,
      ofertas: a.ofertas.length,
      cuposMaximos: a.ofertas.reduce((s, o) => s + o.cuposMaximos, 0),
      cuposOcupados: a.ofertas.reduce((s, o) => s + o.cuposOcupados, 0),
    }));
  }

  async publicarAccion(ambito: string[], id: string, visible: boolean) {
    const accion = await this.prisma.accionFormacion.findUnique({ where: { id } });
    // fuera del ambito no existe: publicar u ocultar la
    // accion del otro gremio la saca del sitio publico
    if (!accion || !ambito.includes(accion.convenioId)) {
      throw new NotFoundException('No existe esa acción de formación.');
    }

    // publicar sin texto legal seria pedir que acepten
    // una casilla que no apunta a ninguna parte
    if (visible) {
      const politica = await this.prisma.politicaDatos.findFirst({
        where: {
          convenioId: accion.convenioId,
          destinatario: 'RESERVA',
          vigenteHasta: null,
        },
        select: { id: true },
      });

      if (!politica) {
        throw new ConflictException(
          'Este convenio no tiene una política de tratamiento de datos vigente. ' +
            'Publique la política antes de abrir la acción al público.',
        );
      }
    }

    // ocultar no cancela: solo sale del sitio publico
    await this.prisma.accionFormacion.update({ where: { id }, data: { visible } });
    return { id, visible };
  }
}
