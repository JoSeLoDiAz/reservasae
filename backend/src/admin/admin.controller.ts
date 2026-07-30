import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { RolAdmin, type Admin, type EsquemaColor } from '../../generated/prisma';
import { AdminActual } from './admin-actual.decorator';
import {
  AdminGuard,
  COOKIE_SESION,
  PermitidaSinCambiarClave,
  Publica,
  Roles,
} from './admin.guard';
import { AdminService, vistaAdmin } from './admin.service';
import {
  ActualizarAdminDto,
  ActualizarMarcaDto,
  ActualizarPerfilDto,
  ActualizarTemaDto,
  CambiarClaveDto,
  CrearAdminDto,
  IniciarSesionDto,
  PublicarAccionDto,
} from './dto';

const HORAS_SESION = 8;

/** SVG incluido a propósito: es lo que mejor escala en el encabezado. */
const TIPOS_LOGO = ['image/svg+xml', 'image/png', 'image/webp'];
const MAXIMO_LOGO = 1024 * 1024;

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly jwt: JwtService,
  ) {}

  // -------------------------------------------------------------------------
  // Sesión
  // -------------------------------------------------------------------------

  @Post('sesion')
  @Publica()
  @HttpCode(200)
  // Límite estrecho: es el único sitio donde se pueden probar contraseñas.
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async iniciarSesion(
    @Body() dto: IniciarSesionDto,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const admin = await this.admin.validarCredenciales(dto.correo, dto.clave);
    const token = this.jwt.sign({ sub: admin.id });

    respuesta.cookie(COOKIE_SESION, token, {
      // httpOnly: el token no es accesible desde JavaScript, así que un XSS no
      // se lo puede llevar.
      httpOnly: true,
      // lax basta: las peticiones del panel salen del mismo sitio, y evita que
      // un formulario de otra web dispare acciones con la sesión abierta.
      sameSite: 'lax',
      // En producción todo va por HTTPS detrás de Cloudflare; en local no hay
      // TLS y con `secure` el navegador descartaría la cookie.
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: HORAS_SESION * 60 * 60 * 1000,
    });

    return vistaAdmin(admin);
  }

  @Delete('sesion')
  @Publica()
  @HttpCode(200)
  cerrarSesion(@Res({ passthrough: true }) respuesta: Response) {
    respuesta.clearCookie(COOKIE_SESION, { path: '/' });
    return { cerrada: true };
  }

  @Get('yo')
  @PermitidaSinCambiarClave()
  yo(@AdminActual() admin: Admin) {
    return vistaAdmin(admin);
  }

  @Post('clave')
  @PermitidaSinCambiarClave()
  @HttpCode(200)
  cambiarClave(@AdminActual() admin: Admin, @Body() dto: CambiarClaveDto) {
    return this.admin.cambiarClave(admin, dto.claveActual, dto.claveNueva);
  }

  @Patch('perfil')
  actualizarPerfil(@AdminActual() admin: Admin, @Body() dto: ActualizarPerfilDto) {
    return this.admin.actualizarPerfil(admin, dto);
  }

  // -------------------------------------------------------------------------
  // Usuarios
  // -------------------------------------------------------------------------

  @Get('usuarios')
  @Roles(RolAdmin.SUPERADMIN)
  listarUsuarios() {
    return this.admin.listarAdmins();
  }

  @Post('usuarios')
  @Roles(RolAdmin.SUPERADMIN)
  crearUsuario(@Body() dto: CrearAdminDto) {
    return this.admin.crearAdmin(dto);
  }

  @Patch('usuarios/:id')
  @Roles(RolAdmin.SUPERADMIN)
  actualizarUsuario(
    @AdminActual() admin: Admin,
    @Param('id') id: string,
    @Body() dto: ActualizarAdminDto,
  ) {
    return this.admin.actualizarAdmin(admin, id, dto);
  }

  @Post('usuarios/:id/clave')
  @Roles(RolAdmin.SUPERADMIN)
  @HttpCode(200)
  reiniciarClave(@AdminActual() admin: Admin, @Param('id') id: string) {
    return this.admin.reiniciarClave(admin, id);
  }

  // -------------------------------------------------------------------------
  // Marca
  // -------------------------------------------------------------------------

  @Get('marca')
  verMarca() {
    return this.admin.obtenerMarca();
  }

  @Patch('marca')
  actualizarMarca(@AdminActual() admin: Admin, @Body() dto: ActualizarMarcaDto) {
    return this.admin.actualizarMarca(admin, dto);
  }

  @Patch('marca/tema/:esquema')
  actualizarTema(
    @AdminActual() admin: Admin,
    @Param('esquema') esquema: string,
    @Body() dto: ActualizarTemaDto,
  ) {
    return this.admin.actualizarTema(admin, this.exigirEsquema(esquema), dto);
  }

  @Post('marca/tema/:esquema/restablecer')
  @HttpCode(200)
  restablecerTema(@AdminActual() admin: Admin, @Param('esquema') esquema: string) {
    return this.admin.restablecerTema(admin, this.exigirEsquema(esquema));
  }

  // El esquema llega en la ruta, donde no hay DTO que lo valide; sin esta
  // comprobación un valor cualquiera acabaría en un `where` de Prisma.
  private exigirEsquema(valor: string): EsquemaColor {
    const arriba = valor.toUpperCase();
    if (arriba !== 'CLARO' && arriba !== 'OSCURO') {
      throw new BadRequestException('El esquema debe ser CLARO u OSCURO.');
    }
    return arriba as EsquemaColor;
  }

  @Post('marca/logo')
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: MAXIMO_LOGO } }))
  subirLogo(@AdminActual() admin: Admin, @UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');

    if (!TIPOS_LOGO.includes(archivo.mimetype)) {
      throw new BadRequestException(
        'El logo debe ser SVG, PNG o WebP. JPG no sirve: no tiene transparencia ' +
          'y deja un recuadro blanco sobre el color de marca.',
      );
    }
    if (archivo.size > MAXIMO_LOGO) {
      throw new BadRequestException('El logo no puede pesar más de 1 MB.');
    }

    return this.admin.guardarLogo(
      admin,
      new Uint8Array(archivo.buffer),
      archivo.mimetype,
      archivo.originalname,
    );
  }

  @Delete('marca/logo')
  borrarLogo(@AdminActual() admin: Admin) {
    return this.admin.borrarLogo(admin);
  }

  // -------------------------------------------------------------------------
  // Acciones de formación
  // -------------------------------------------------------------------------

  @Get('convenios')
  listarConvenios() {
    return this.admin.listarConvenios();
  }

  @Get('acciones')
  listarAcciones() {
    return this.admin.listarAcciones();
  }

  @Patch('acciones/:id')
  publicarAccion(@Param('id') id: string, @Body() dto: PublicarAccionDto) {
    return this.admin.publicarAccion(id, dto.visible);
  }
}

/**
 * Lo que el sitio público necesita de la marca: colores, textos y logo. Sin
 * sesión, porque lo pide cualquiera que abra el formulario.
 */
@Controller('marca')
export class MarcaPublicaController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  marca() {
    return this.admin.obtenerMarca();
  }

  @Get('logo')
  async logo(@Res() respuesta: Response) {
    const { logoDatos, logoTipoMime } = await this.admin.leerLogo();
    respuesta.type(logoTipoMime);
    // Cacheable para siempre porque la URL lleva `?v=<logoVersion>`: al subir
    // otro logo cambia la URL y el navegador vuelve a pedirlo.
    respuesta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    respuesta.send(logoDatos);
  }
}
