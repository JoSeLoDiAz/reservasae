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
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarAdminDto,
  ActualizarMarcaDto,
  ActualizarPerfilDto,
  ActualizarTemaDto,
  CrearAdminDto,
} from './dto';
import { generarClaveTemporal, hashearClave, verificarClave } from './claves';
import {
  COMPROBACIONES_CONTRASTE,
  conValoresPorDefecto,
  GRUPOS,
  TEMAS_POR_DEFECTO,
  TOKENS,
  type ColoresTema,
} from './temas';

const ID_MARCA = 'unica';

/** Lo que se puede devolver de un administrador. Nunca el hash. */
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

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Sesión
  // -------------------------------------------------------------------------

  async validarCredenciales(correo: string, clave: string): Promise<Admin> {
    const admin = await this.prisma.admin.findUnique({ where: { correo } });

    // Mismo error para correo inexistente y contraseña incorrecta: si se
    // distinguen, el formulario de acceso se convierte en un detector de qué
    // correos tienen cuenta.
    const generico = new UnauthorizedException('Correo o contraseña incorrectos.');
    if (!admin || !admin.activo) {
      // Se verifica igualmente contra un hash de descarte para que responder
      // "no existe" no sea perceptiblemente más rápido que "clave mala".
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

  // -------------------------------------------------------------------------
  // Perfil
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Usuarios
  // -------------------------------------------------------------------------

  async listarAdmins() {
    const admins = await this.prisma.admin.findMany({ orderBy: { creadoEn: 'asc' } });
    return admins.map(vistaAdmin);
  }

  /**
   * Crea la cuenta con una contraseña temporal que se devuelve UNA sola vez.
   * No se guarda en claro ni se puede volver a consultar: si se pierde, hay
   * que regenerarla.
   */
  async crearAdmin(dto: CrearAdminDto) {
    const claveTemporal = generarClaveTemporal();
    try {
      const creado = await this.prisma.admin.create({
        data: {
          correo: dto.correo,
          nombre: dto.nombre,
          rol: dto.rol,
          hashClave: await hashearClave(claveTemporal),
          debeCambiarClave: true,
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

    // Quitarse a uno mismo el rol o desactivarse deja el panel sin dueño y sin
    // forma de volver a entrar salvo tocando la base a mano.
    if (objetivo.id === quienEdita.id) {
      if (dto.activo === false) {
        throw new BadRequestException('No puede desactivar su propia cuenta.');
      }
      if (dto.rol && dto.rol !== RolAdmin.SUPERADMIN) {
        throw new BadRequestException('No puede quitarse a sí mismo el rol de superadmin.');
      }
    }

    await this.asegurarQuedaUnSuperadmin(objetivo, dto);

    const actualizado = await this.prisma.admin.update({
      where: { id },
      data: { rol: dto.rol ?? undefined, activo: dto.activo ?? undefined },
    });
    return vistaAdmin(actualizado);
  }

  /** Devuelve una contraseña temporal nueva para una cuenta ajena. */
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
    return { claveTemporal };
  }

  /**
   * Sin al menos un superadmin activo nadie puede volver a crear usuarios ni
   * recuperar el control del panel.
   */
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

  // -------------------------------------------------------------------------
  // Marca
  // -------------------------------------------------------------------------

  /** La fila de marca se crea sola la primera vez que alguien la pide. */
  async obtenerMarca() {
    const marca = await this.prisma.marca.upsert({
      where: { id: ID_MARCA },
      create: { id: ID_MARCA },
      update: {},
      select: {
        nombreApp: true,
        tituloPublico: true,
        subtituloPublico: true,
        piePagina: true,
        modoPorDefecto: true,
        permitirCambioDeModo: true,
        logoTipoMime: true,
        logoNombre: true,
        logoVersion: true,
        actualizadoEn: true,
      },
    });

    // Las dos paletas viajan siempre juntas con la marca: el navegador las
    // necesita a la vez para poder cambiar de modo sin volver a pedir nada.
    //
    // El catálogo de tokens también se envía, y con él el panel dibuja sus
    // formularios. Así añadir un color no obliga a tocar el frontend ni deja
    // las dos listas desincronizadas.
    const filas = await this.prisma.tema.findMany({ orderBy: { esquema: 'asc' } });
    const temas = Object.fromEntries(
      filas.map((t) => [t.esquema, conValoresPorDefecto(t.esquema, t.colores)]),
    ) as Record<EsquemaColor, ColoresTema>;

    return {
      ...marca,
      temas,
      catalogoColores: {
        grupos: GRUPOS,
        tokens: TOKENS,
        comprobacionesContraste: COMPROBACIONES_CONTRASTE,
      },
    };
  }

  async actualizarTema(admin: Admin, esquema: EsquemaColor, dto: ActualizarTemaDto) {
    const existe = await this.prisma.tema.findUnique({ where: { esquema } });
    if (!existe) throw new NotFoundException(`No existe el tema ${esquema}.`);

    // Se mezcla sobre lo que ya había en vez de reemplazar: si el panel envía
    // solo los colores que cambiaron, el resto no debe desaparecer.
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

  /** Devuelve un esquema a los colores con los que nació el sistema. */
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

  // Uint8Array y no Buffer: es lo que espera el campo `Bytes` de Prisma, y un
  // Buffer de multer no encaja en ese tipo aunque en ejecución sea lo mismo.
  async guardarLogo(admin: Admin, datos: Uint8Array, tipoMime: string, nombre: string) {
    const actual = await this.prisma.marca.upsert({
      where: { id: ID_MARCA },
      create: { id: ID_MARCA },
      update: {},
      select: { logoVersion: true },
    });

    await this.prisma.marca.update({
      where: { id: ID_MARCA },
      data: {
        // Copia a un Uint8Array respaldado por ArrayBuffer: el buffer que
        // entrega multer puede estar sobre un SharedArrayBuffer, que el campo
        // `Bytes` de Prisma no acepta.
        logoDatos: new Uint8Array(datos),
        logoTipoMime: tipoMime,
        logoNombre: nombre,
        // La versión va en la URL del logo: permite cachearlo para siempre y
        // que aun así el navegador vea el nuevo en cuanto se sube.
        logoVersion: actual.logoVersion + 1,
        actualizadoPorId: admin.id,
      },
    });
    return this.obtenerMarca();
  }

  async borrarLogo(admin: Admin) {
    await this.obtenerMarca();
    await this.prisma.marca.update({
      where: { id: ID_MARCA },
      data: {
        logoDatos: null,
        logoTipoMime: null,
        logoNombre: null,
        actualizadoPorId: admin.id,
      },
    });
    return this.obtenerMarca();
  }

  async leerLogo() {
    const marca = await this.prisma.marca.findUnique({
      where: { id: ID_MARCA },
      select: { logoDatos: true, logoTipoMime: true, logoVersion: true },
    });
    if (!marca?.logoDatos || !marca.logoTipoMime) {
      throw new NotFoundException('No hay logo cargado.');
    }
    return {
      logoDatos: Buffer.from(marca.logoDatos),
      logoTipoMime: marca.logoTipoMime,
      logoVersion: marca.logoVersion,
    };
  }

  // -------------------------------------------------------------------------
  // Acciones de formación
  // -------------------------------------------------------------------------

  /**
   * Los convenios con su identificador interno. El `/catalogo` público no lo
   * expone, y el panel lo necesita para crear formularios.
   */
  async listarConvenios() {
    return this.prisma.convenio.findMany({
      orderBy: { orden: 'asc' },
      select: { id: true, slug: true, nombre: true, sigla: true, activo: true },
    });
  }

  async listarAcciones() {
    const acciones = await this.prisma.accionFormacion.findMany({
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

  async publicarAccion(id: string, visible: boolean) {
    const accion = await this.prisma.accionFormacion.findUnique({ where: { id } });
    if (!accion) throw new NotFoundException('No existe esa acción de formación.');

    // Ocultar no cancela nada: las reservas ya hechas siguen vivas y contando.
    // Solo desaparece del sitio público.
    await this.prisma.accionFormacion.update({ where: { id }, data: { visible } });
    return { id, visible };
  }
}
