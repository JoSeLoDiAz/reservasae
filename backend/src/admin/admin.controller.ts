import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { RolAdmin, type Admin, type EsquemaColor } from '../../generated/prisma';
import {
  ERROR_TAMANO_LOGO,
  ERROR_TIPO_LOGO,
  MAXIMO_LOGO,
  TIPOS_LOGO,
} from '../comun/logo';
import { AdminActual, AmbitoActual } from './admin-actual.decorator';
import {
  AdminGuard,
  COOKIE_SESION,
  PermitidaSinCambiarClave,
  Publica,
  Requiere,
  Roles,
  type Ambito,
} from './admin.guard';
import { resumenDePermisos } from './permisos';
import { AdminService, vistaAdmin } from './admin.service';
import { corregirContraste, derivarTemas } from './derivar';
import {
  ActualizarAdminDto,
  ActualizarLogoDto,
  ActualizarMarcaDto,
  ActualizarPerfilDto,
  ActualizarTemaDto,
  CambiarClaveDto,
  CrearAdminDto,
  DerivarTemaDto,
  IniciarSesionDto,
  PublicarAccionDto,
  MarcaDeGremioDto,
} from './dto';
import { plantillasResueltas } from './plantillas-tema';

const HORAS_SESION = 8;

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly jwt: JwtService,
  ) {}

  // sesión

  @Post('sesion')
  @Publica()
  @HttpCode(200)
  // límite estrecho de intentos
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async iniciarSesion(
    @Body() dto: IniciarSesionDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const admin = await this.admin.validarCredenciales(dto.correo, dto.clave);

    // la dirección decide en qué gremio se trabaja, así que
    // una cuenta que no lo tiene no llega a tener sesión
    const motivo = await this.admin.motivoParaNoEntrarPor(admin, peticion.headers.host);
    if (motivo) throw new ForbiddenException(motivo);

    const token = this.jwt.sign({ sub: admin.id });

    respuesta.cookie(COOKIE_SESION, token, {
      // httpOnly: un XSS no se lleva el token
      httpOnly: true,
      // lax: el panel es del mismo sitio
      sameSite: 'lax',
      // en local no hay TLS: `secure` la descartaria
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
  async yo(@AdminActual() admin: Admin, @AmbitoActual() ambito: Ambito) {
    return {
      ...vistaAdmin(admin),
      convenios: ambito.convenios,
      /// Solo los roles del gremio que fija la direccion.
      ///
      /// Con todos, el menu ofrecia secciones que el guard
      /// rechaza en ese gremio: se entra y se recibe un no,
      /// que es peor que no verlas.
      permisos: resumenDePermisos(
        ambito.gremioFijo && ambito.gremioElegido
          ? { [ambito.gremioElegido]: ambito.roles[ambito.gremioElegido] ?? [] }
          : ambito.roles,
      ),
      /// Los gremios de esta cuenta CON su sigla: es lo que
      /// llena el desplegable de arriba. Van los concedidos,
      /// no los del ámbito, porque el ámbito ya viene
      /// recortado por el que se eligió y entonces el
      /// desplegable se quedaría con una sola opción: la que
      /// ya está puesta.
      /// Con el gremio fijado por la dirección va SOLO ese, y
      /// entonces el desplegable se pinta como etiqueta. No
      /// es recortar información: en esa dirección de verdad
      /// no hay otra opción, y ofrecerla dejaría elegir un
      /// gremio que el servidor va a ignorar.
      gremios: await this.admin.gremiosDe(
        ambito.gremioFijo && ambito.gremioElegido
          ? [ambito.gremioElegido]
          : ambito.concedidos,
      ),
      gremioElegido: ambito.gremioElegido,
      gremioFijo: ambito.gremioFijo,
    };
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

  // usuarios

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

  // marca

  @Get('marca')
  verMarca() {
    return this.admin.obtenerMarca();
  }

  @Patch('marca')
  @Requiere('configuracion', 'ESCRIBIR')
  @Roles(RolAdmin.SUPERADMIN)
  actualizarMarca(@AdminActual() admin: Admin, @Body() dto: ActualizarMarcaDto) {
    return this.admin.actualizarMarca(admin, dto);
  }

  /// De que formulario sale la marca de cada gremio.
  ///
  /// Vive aqui y no en la apariencia de cada formulario porque
  /// es una decision del gremio, no del formulario: hay que
  /// poder ver los dos a la vez para saber cual esta puesto.
  @Get('marca/gremios')
  @Roles(RolAdmin.SUPERADMIN)
  marcaDeGremios(@AmbitoActual() ambito: Ambito) {
    return this.admin.listarMarcaDeGremios(ambito.convenios);
  }

  @Patch('marca/gremios/:convenioId')
  @Roles(RolAdmin.SUPERADMIN)
  fijarMarcaDeGremio(
    @AmbitoActual() ambito: Ambito,
    @Param('convenioId') convenioId: string,
    @Body() dto: MarcaDeGremioDto,
  ) {
    return this.admin.fijarMarcaDeGremio(
      ambito.convenios,
      convenioId,
      dto.formularioId ?? null,
    );
  }

  // previsualiza sin publicar
  @Get('marca/formulario/:slug')
  marcaDeFormulario(@Param('slug') slug: string) {
    return this.admin.obtenerMarcaDeFormulario(slug, true);
  }

  @Patch('marca/tema/:esquema')
  @Requiere('configuracion', 'ESCRIBIR')
  @Roles(RolAdmin.SUPERADMIN)
  actualizarTema(
    @AdminActual() admin: Admin,
    @Param('esquema') esquema: string,
    @Body() dto: ActualizarTemaDto,
  ) {
    return this.admin.actualizarTema(admin, this.exigirEsquema(esquema), dto);
  }

  @Post('marca/tema/:esquema/restablecer')
  @Requiere('configuracion', 'ESCRIBIR')
  @Roles(RolAdmin.SUPERADMIN)
  @HttpCode(200)
  restablecerTema(@AdminActual() admin: Admin, @Param('esquema') esquema: string) {
    return this.admin.restablecerTema(admin, this.exigirEsquema(esquema));
  }

  // en la ruta no hay DTO: se valida a mano
  private exigirEsquema(valor: string): EsquemaColor {
    const arriba = valor.toUpperCase();
    if (arriba !== 'CLARO' && arriba !== 'OSCURO') {
      throw new BadRequestException('El esquema debe ser CLARO u OSCURO.');
    }
    return arriba as EsquemaColor;
  }

  // logos: las mismas rutas para los dos ambitos

  @Get('logos')
  listarLogos(@Query('formularioId') formularioId?: string) {
    return this.admin.listarLogos(formularioId || null);
  }

  @Post('logos')
  @Requiere('configuracion', 'ESCRIBIR')
  @Roles(RolAdmin.SUPERADMIN)
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: MAXIMO_LOGO } }))
  subirLogo(
    @Body() cuerpo: { formularioId?: string; etiqueta?: string },
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');
    if (!TIPOS_LOGO.includes(archivo.mimetype)) throw new BadRequestException(ERROR_TIPO_LOGO);
    if (archivo.size > MAXIMO_LOGO) throw new BadRequestException(ERROR_TAMANO_LOGO);

    return this.admin.agregarLogo(
      cuerpo.formularioId || null,
      new Uint8Array(archivo.buffer),
      archivo.mimetype,
      archivo.originalname,
      cuerpo.etiqueta,
    );
  }

  @Patch('logos/:id')
  @Requiere('configuracion', 'ESCRIBIR')
  @Roles(RolAdmin.SUPERADMIN)
  actualizarLogo(@Param('id') id: string, @Body() dto: ActualizarLogoDto) {
    return this.admin.actualizarLogo(id, dto);
  }

  @Delete('logos/:id')
  @Requiere('configuracion', 'ESCRIBIR')
  @Roles(RolAdmin.SUPERADMIN)
  borrarLogo(@Param('id') id: string) {
    return this.admin.borrarLogo(id);
  }

  // apariencia asistida

  // plantillas de tema
  @Get('apariencia/plantillas')
  plantillas() {
    return plantillasResueltas();
  }

  @Post('apariencia/derivar')
  @HttpCode(200)
  derivar(@Body() dto: DerivarTemaDto) {
    return derivarTemas({
      principal: dto.principal,
      encabezadoDeColor: dto.encabezadoDeColor,
    });
  }

  // arregla solo los pares que no se leen
  @Post('apariencia/corregir')
  @HttpCode(200)
  corregir(@Body() dto: ActualizarTemaDto) {
    return corregirContraste(dto.colores);
  }

  // acciones de formación

  @Get('convenios')
  listarConvenios(@AmbitoActual() ambito: Ambito) {
    return this.admin.listarConvenios(ambito.convenios);
  }

  @Get('acciones')
  listarAcciones(@AmbitoActual() ambito: Ambito) {
    return this.admin.listarAcciones(ambito.convenios);
  }

  @Patch('acciones/:id')
  @Requiere('configuracion', 'ESCRIBIR')
  @Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
  publicarAccion(@Param('id') id: string, @Body() dto: PublicarAccionDto) {
    return this.admin.publicarAccion(id, dto.visible);
  }
}

/** La marca del sitio público. Sin sesión. */
@Controller('marca')
export class MarcaPublicaController {
  constructor(private readonly admin: AdminService) {}

  /// Varia por Host: en el subdominio de un gremio devuelve
  /// SU marca. Con esto el login y el panel entero salen con
  /// su logo y sus colores sin tocar el frontend.
  @Get()
  marca(@Req() peticion: Request) {
    return this.admin.obtenerMarcaDelHost(peticion.headers.host);
  }

  // segmento literal antes del slug
  @Get('formulario/:slug')
  marcaDeFormulario(@Param('slug') slug: string) {
    return this.admin.obtenerMarcaDeFormulario(slug);
  }

  /// Por slug de CONVENIO, no de formulario. La pide el
  /// servidor de Next, que no tiene el Host a mano en el
  /// sitio donde arma el CSS.
  @Get('gremio/:slug')
  marcaDeGremio(@Param('slug') slug: string) {
    return this.admin.obtenerMarcaDeGremio(slug);
  }

  /** Cada logo por su id, cacheable un año. */
  @Get('logos/:id')
  async logo(@Param('id') id: string, @Res() respuesta: Response) {
    const { datos, tipoMime } = await this.admin.leerLogo(id);
    respuesta.type(tipoMime);
    // cacheable para siempre: la URL lleva ?v=version
    respuesta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    respuesta.send(datos);
  }
}
