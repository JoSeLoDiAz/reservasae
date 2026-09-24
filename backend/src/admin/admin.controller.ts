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
  ESQUEMAS_DE_LOGO,
  MAXIMO_LOGO,
  TIPOS_LOGO,
  type EsquemaDeLogo,
} from '../comun/logo';
import { puedeAsignarGrupo } from '../crm/quien-asigna-grupo';
import { AdminActual, AmbitoActual } from './admin-actual.decorator';
import { esEditorDeMarca, SoloEditoresDeMarca } from './editores-de-marca';
import { rolQueSeEnsena } from './rol-que-se-ensena';
import { BienvenidaService } from '../correo/bienvenida.service';
import {
  AdminGuard,
  COOKIE_SESION,
  PermitidaSinCambiarClave,
  Publica,
  Requiere,
  Roles,
  type Ambito,
} from './admin.guard';
import {
  resumenDePermisos,
  conveniosQueReparten,
  conveniosQueMuevenInscrito,
} from './permisos';
import { AdminService, vistaAdmin } from './admin.service';
import { corregirContraste, derivarTemas } from './derivar';
import {
  ActualizarAdminDto,
  ActualizarAjustesDePantallaDto,
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
    private readonly bienvenida: BienvenidaService,
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

      /// Lo que esta cuenta puede hacer, además de las áreas.
      ///
      /// Hay cosas que un gestor y un líder NO comparten y que
      /// el par área/nivel no distingue: los dos tienen
      /// `inscripciones: ESCRIBIR`. Repartir fichas entre
      /// asesores y sacar a alguien de INSCRITO son de líder.
      ///
      /// Esto es para que la PANTALLA no ofrezca lo que el
      /// servidor va a rechazar. La cerradura sigue estando en
      /// el servidor: aquí solo se evita el botón que da un
      /// error y no se entiende.
      puede: {
        repartirFichas: conveniosQueReparten(ambito.roles).length > 0,
        sacarDeInscrito: conveniosQueMuevenInscrito(ambito.roles).length > 0,
        /// Logos, colores del sistema y textos: solo los correos de
        /// `EDITORES_DE_MARCA`. Para que Apariencia no le enseñe a
        /// nadie más un botón que el servidor va a rechazar.
        editarMarca: esEditorDeMarca(admin.correo),
        /// Poner a alguien en un grupo: analista --líder de sistemas--
        /// o administrador. Se manda para que el panel no le enseñe al
        /// asesor una pantalla que el servidor va a rechazar; la
        /// cerradura de verdad está en `quien-asigna-grupo.ts`.
        asignarGrupo: puedeAsignarGrupo({ admin, ambito } as never),
      },
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

      /// Su concesion, que es lo que de verdad gobierna.
      ///
      /// La cabecera pintaba `RolAdmin`, y ese solo dice si es
      /// superadmin: una cuenta de CONSULTA salia como
      /// «GESTOR», que es falso y ademas asusta.
      rolEnGremio: rolQueSeEnsena(admin.rol, ambito),
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

  /// LOS COLORES DE CADA PERSONA. Cualquier cuenta, sobre sí misma y
  /// solo sobre sí misma: por eso cuelgan de `perfil` y no llevan
  /// `@Roles` ni `@Requiere`. Ver `tema-propio.ts`.
  @Get('perfil/tema')
  miTema(@AdminActual() admin: Admin) {
    return this.admin.miTema(admin);
  }

  @Patch('perfil/tema/:esquema')
  guardarMiTema(
    @AdminActual() admin: Admin,
    @Param('esquema') esquema: string,
    @Body() dto: ActualizarTemaDto,
  ) {
    return this.admin.guardarMiTema(admin, this.exigirEsquema(esquema), dto);
  }

  @Post('perfil/tema/:esquema/restablecer')
  @HttpCode(200)
  restablecerMiTema(@AdminActual() admin: Admin, @Param('esquema') esquema: string) {
    return this.admin.restablecerMiTema(admin, this.exigirEsquema(esquema));
  }

  /// SUS AJUSTES DE PANTALLA. Como los colores propios: cualquier
  /// cuenta, sobre sí misma y solo sobre sí misma.
  @Get('perfil/ajustes')
  misAjustes(@AdminActual() admin: Admin) {
    return this.admin.misAjustesDePantalla(admin);
  }

  @Patch('perfil/ajustes')
  guardarMisAjustes(
    @AdminActual() admin: Admin,
    @Body() dto: ActualizarAjustesDePantallaDto,
  ) {
    return this.admin.guardarMisAjustesDePantalla(admin, dto);
  }
  // usuarios

  @Get('usuarios')
  @Roles(RolAdmin.SUPERADMIN)
  listarUsuarios() {
    return this.admin.listarAdmins();
  }

  @Post('usuarios')
  @Roles(RolAdmin.SUPERADMIN)
  async crearUsuario(@Body() dto: CrearAdminDto) {
    const creada = await this.admin.crearAdmin(dto);

    /// Avisar va DESPUES y no puede tumbar la creacion: la
    /// clave temporal se sigue viendo en pantalla.
    await this.bienvenida.enviar(
      creada.admin,
      creada.claveTemporal,
      await this.marcaDe(creada.admin.id),
    );
    return creada;
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
  async reiniciarClave(@AdminActual() admin: Admin, @Param('id') id: string) {
    const nueva = await this.admin.reiniciarClave(admin, id);

    /// Le llega igual que el alta, con su banda y su logo. Lo
    /// unico que cambia es que dice por que: se pidio.
    await this.bienvenida.enviar(
      nueva.admin,
      nueva.claveTemporal,
      await this.marcaDe(nueva.admin.id),
      'RECUPERACION',
    );
    return nueva;
  }

  /// De donde salen el logo y los colores de esa cuenta: de SU
  /// gremio si es de uno solo, y si no, la general.
  ///
  /// Con las mismas dos funciones que pintan el panel por Host.
  private async marcaDe(adminId: string) {
    const suyos = await this.admin.conveniosDe(adminId);
    return suyos.length === 1
      ? this.admin.obtenerMarcaDeGremio(suyos[0].slug)
      : this.admin.obtenerMarca();
  }

  // marca

  /// LA MARCA DE TODOS LA CAMBIAN SOLO LOS EDITORES DE MARCA.
  ///
  /// Logos, colores del sistema, textos y la marca de cada gremio
  /// piden estar en `EDITORES_DE_MARCA` (ver `editores-de-marca.ts`),
  /// y ya no el rol: «que nadie pueda modificar los logos, solo con
  /// el correo de José, Diana y la Sra. Catalina; ni yo puedo»
  /// (cliente, un superadministrador, 21 sep 2026). Los colores de
  /// CADA persona van por `perfil/tema` y los elige cualquiera.
  @Get('marca')
  verMarca() {
    return this.admin.obtenerMarca();
  }

  @Patch('marca')
  @SoloEditoresDeMarca()
  actualizarMarca(@AdminActual() admin: Admin, @Body() dto: ActualizarMarcaDto) {
    return this.admin.actualizarMarca(admin, dto);
  }

  /// De que formulario sale la marca de cada gremio.
  ///
  /// Vive aqui y no en la apariencia de cada formulario porque
  /// es una decision del gremio, no del formulario: hay que
  /// poder ver los dos a la vez para saber cual esta puesto.
  @Get('marca/gremios')
  @SoloEditoresDeMarca()
  marcaDeGremios(@AmbitoActual() ambito: Ambito) {
    return this.admin.listarMarcaDeGremios(ambito.convenios);
  }

  @Patch('marca/gremios/:convenioId')
  @SoloEditoresDeMarca()
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

  /// Previsualiza sin publicar, y por eso lleva ambito: sin
  /// el entregaba titulo, descripcion, paletas y logos de
  /// CUALQUIER formulario con solo saber su slug.
  @Get('marca/formulario/:slug')
  @Roles(RolAdmin.SUPERADMIN)
  async marcaDeFormulario(
    @AmbitoActual() ambito: Ambito,
    @Param('slug') slug: string,
  ) {
    await this.admin.exigirFormularioPorSlug(ambito.convenios, slug);
    return this.admin.obtenerMarcaDeFormulario(slug, true);
  }

  @Patch('marca/tema/:esquema')
  @SoloEditoresDeMarca()
  actualizarTema(
    @AdminActual() admin: Admin,
    @Param('esquema') esquema: string,
    @Body() dto: ActualizarTemaDto,
  ) {
    return this.admin.actualizarTema(admin, this.exigirEsquema(esquema), dto);
  }

  @Post('marca/tema/:esquema/restablecer')
  @SoloEditoresDeMarca()
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

  /// No tenia ambito, ni @Requiere, ni @Roles: la veia
  /// cualquier sesion de admin, y es la que entrega los ids
  /// que necesitan el PATCH y el DELETE de abajo.
  @Get('logos')
  @SoloEditoresDeMarca()
  listarLogos(
    @AmbitoActual() ambito: Ambito,
    @Query('formularioId') formularioId?: string,
  ) {
    return this.admin.listarLogosDelPanel(ambito, formularioId || null);
  }

  @Post('logos')
  @SoloEditoresDeMarca()
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: MAXIMO_LOGO } }))
  subirLogo(
    @AmbitoActual() ambito: Ambito,
    @Body()
    cuerpo: { formularioId?: string; etiqueta?: string; esquema?: EsquemaDeLogo },
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');
    if (!TIPOS_LOGO.includes(archivo.mimetype)) throw new BadRequestException(ERROR_TIPO_LOGO);
    if (archivo.size > MAXIMO_LOGO) throw new BadRequestException(ERROR_TAMANO_LOGO);

    return this.admin.agregarLogo(
      ambito,
      cuerpo.formularioId || null,
      new Uint8Array(archivo.buffer),
      archivo.mimetype,
      archivo.originalname,
      cuerpo.etiqueta,
      /// Viene de un `multipart`, o sea texto: si no es uno de los
      /// tres, se ignora y queda `AMBOS`.
      ESQUEMAS_DE_LOGO.includes(cuerpo.esquema as EsquemaDeLogo)
        ? cuerpo.esquema
        : undefined,
    );
  }

  @Patch('logos/:id')
  @SoloEditoresDeMarca()
  actualizarLogo(
    @AmbitoActual() ambito: Ambito,
    @Param('id') id: string,
    @Body() dto: ActualizarLogoDto,
  ) {
    return this.admin.actualizarLogo(ambito, id, dto);
  }

  @Delete('logos/:id')
  @SoloEditoresDeMarca()
  borrarLogo(@AmbitoActual() ambito: Ambito, @Param('id') id: string) {
    return this.admin.borrarLogo(ambito, id);
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

  /// Los formularios personalizados, para la pantalla que los
  /// reparte. Solo lectura: no hay PATCH ni POST, y es
  /// deliberado --lo que un formulario abre puede ser una accion
  /// sin publicar, y eso no se cambia desde una pantalla.
  @Get('formularios-personalizados')
  listarFormulariosPersonalizados(@AmbitoActual() ambito: Ambito) {
    return this.admin.listarFormulariosPersonalizados(ambito.convenios);
  }

  @Patch('acciones/:id')
  @Requiere('configuracion', 'ESCRIBIR')
  @Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
  publicarAccion(
    @AmbitoActual() ambito: Ambito,
    @Param('id') id: string,
    @Body() dto: PublicarAccionDto,
  ) {
    return this.admin.publicarAccion(ambito.convenios, id, dto.visible);
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
