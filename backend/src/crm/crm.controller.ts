import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import {
  conveniosQueCierran, conveniosQueMuevenInscrito,
  conveniosQueReparten,
} from '../admin/permisos';
import { PreinscripcionService } from '../preinscripcion/preinscripcion.service';
import { IpReal } from '../comun/ip-real';
import {
  libroDePlantilla,
  MAXIMO_ARCHIVO_CARGA,
  textoDelArchivo,
} from './carga-archivo';
import { enviarLibro } from '../tableros/exportar';
import { CrmService } from './crm.service';
import { DirectorioService } from './directorio.service';
import { PlantillasCorreoService } from '../correo/plantillas/plantillas-correo.service';
import { RuiService } from './rui/rui.service';
import {
  ContactoDeLaEmpresaDto,
  ActualizarParticipanteDto,
  AgregarNitDto,
  ResolverPropuestaDto,
  AsignarAsesorEnLoteDto,
  AsignarFormacionDto,
  CargaDto,
  CambiarEtapaDto,
  CrearNotaDto,
  RevocarAutorizacionDto,
  CrearParticipanteDto,
  FiltrosParticipantesDto,
  RegistrarAutorizacionDto,
} from './dto';
import { controlDeInscritos } from './control';
import { tableroPorAccion } from './tablero-af';
import { planeacionDePauta } from './planeacion-de-pauta';
import { tableroAcademico } from './tablero-academico';
import {
  compararDos,
  resolverVentana,
  type Comparacion,
  type Rango,
} from './ventana';
import { PrismaService } from '../prisma/prisma.service';

const RANGOS: Rango[] = [
  'HOY',
  'AYER',
  'SEMANA',
  'MES',
  'MES_PASADO',
  'TRIMESTRE',
  'ANO',
  'TODO',
  'PERSONALIZADO',
];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Lo que no es de la lista no es un rango. */
function rangoPedido(rango?: string): Rango | undefined {
  return RANGOS.includes(rango as Rango) ? (rango as Rango) : undefined;
}

/** Solo pasa lo que tiene forma de fecha. */
function fechaPedida(f?: string): string | undefined {
  return f && FECHA.test(f) ? f : undefined;
}

/** Resuelve la ventana pedida, sin fiarse del texto. */
function ventanaPedida(
  rango?: string,
  desde?: string,
  hasta?: string,
  contra?: string,
  contraDesde?: string,
  contraHasta?: string,
): Comparacion {
  const r = rangoPedido(rango);
  const d = fechaPedida(desde);
  const h = fechaPedida(hasta);
  const c = rangoPedido(contra);
  // sin segundo, el previo de siempre
  if (!c) return resolverVentana(r, d, h);
  return compararDos(
    r ?? 'TODO',
    c,
    d,
    h,
    fechaPedida(contraDesde),
    fechaPedida(contraHasta),
  );
}

/** Inscripciones: las personas detrás de los cupos. */
@Controller('admin/participantes')
@UseGuards(AdminGuard)
// aqui viven cedulas, celulares y correos de terceros:
// una cuenta de solo consulta no tiene nada que hacer
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly preinscripcion: PreinscripcionService,
    private readonly prisma: PrismaService,
    private readonly directorio: DirectorioService,
    private readonly rui: RuiService,
    private readonly plantillasCorreo: PlantillasCorreoService,
  ) {}

  /** Qué instituciones hay bajo ese NIT. */
  @Get('nit/:nit')
  buscarNit(@Param('nit') nit: string) {
    return this.directorio.buscar(nit);
  }

  /** Alta manual cuando el NIT no está o trae otro nombre. */
  @Post('nit')
  agregarNit(@Body() dto: AgregarNitDto) {
    return this.directorio.agregarManual(dto.nit, dto.razonSocial);
  }

  /** Cómo va la cola del RUI. */
  @Get('rui/resumen')
  resumenRui() {
    return this.rui.resumen();
  }

  /** Los que el RUI devolvió con otro nombre. */
  @Get('rui/discrepancias')
  discrepanciasRui(@AmbitoActual() ambito: Ambito) {
    return this.rui.discrepancias(ambito.convenios);
  }

  /** Contadores por etapa: las columnas del tablero. */
  /** Los repartos del tablero de Inscripciones. */
  @Get('metricas')
  metricas(
    @Query() filtros: FiltrosParticipantesDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.metricasInscripciones({
      ...filtros,
      ambito: ambito.convenios,
    });
  }

  @Get('resumen')
  resumen(
    @Query() filtros: FiltrosParticipantesDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.resumen({ ...filtros, ambito: ambito.convenios });
  }

  /** Cuantos inscritos hay y como se reparten. */
  @Get('control')
  @Requiere('inscritos')
  control(
    @AmbitoActual() ambito: Ambito,
    @Query('rango') rango?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('contra') contra?: string,
    @Query('contraDesde') contraDesde?: string,
    @Query('contraHasta') contraHasta?: string,
  ) {
    return controlDeInscritos(
      this.prisma,
      ambito.convenios,
      ventanaPedida(rango, desde, hasta, contra, contraDesde, contraHasta),
    );
  }

  /**
   * El informe por accion de formacion.
   *
   * Sin `accionFormacionId` devuelve solo el catalogo: es un
   * informe POR accion, y sumar las quince daria el tablero
   * general que ya esta dos pantallas mas arriba.
   */
  @Get('control/por-accion')
  @Requiere('inscritos')
  porAccion(
    @AmbitoActual() ambito: Ambito,
    @Query('accionFormacionId') accionFormacionId?: string,
    @Query('coberturaId') coberturaId?: string,
  ) {
    return tableroPorAccion(this.prisma, ambito.convenios, {
      accionFormacionId,
      coberturaId,
    });
  }

  /**
   * La tabla del Comité de Marketing.
   *
   * Va por la sede de la oferta y no por el domicilio de la
   * persona, que es lo que hace que la fila cuadre consigo
   * misma: los cupos tienen sede. `control/por-accion`
   * responde la otra pregunta —de dónde salió la gente— y por
   * eso son dos rutas y no una con bandera.
   */
  @Get('control/planeacion-de-pauta')
  @Requiere('inscritos')
  planeacionDePauta(
    @AmbitoActual() ambito: Ambito,
    @Query('accionFormacionId') accionFormacionId?: string,
    @Query('coberturaId') coberturaId?: string,
  ) {
    return planeacionDePauta(this.prisma, ambito.convenios, {
      accionFormacionId,
      coberturaId,
    });
  }

  /** Las listas del SEP que dibujan los formularios. */
  @Get('catalogos')
  catalogos() {
    return this.crm.catalogos();
  }

  /** Quién va al día y quién no, contra las fechas del grupo. */
  @Get('academico')
  @Requiere('academico')
  academico(
    @Query() filtros: FiltrosParticipantesDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.academico({ ...filtros, ambito: ambito.convenios });
  }

  /** El aula por accion, grupo y asesor. No por persona. */
  @Get('academico/tablero')
  @Requiere('academico')
  tablero(
    @AmbitoActual() ambito: Ambito,
    @Query('rango') rango?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('contra') contra?: string,
    @Query('contraDesde') contraDesde?: string,
    @Query('contraHasta') contraHasta?: string,
  ) {
    return tableroAcademico(
      this.prisma,
      ambito.convenios,
      ventanaPedida(rango, desde, hasta, contra, contraDesde, contraHasta),
    );
  }

  /** Ofertas y grupos donde se puede colocar a alguien. */
  @Get('opciones')
  opciones(
    @Query('convenioId') convenioId: string,
    @AmbitoActual() ambito: Ambito,
    /// A quien se le va a asignar. Con esto solo se ofrecen
    /// los grupos que cubren donde vive.
    @Query('participanteId') participanteId?: string,
  ) {
    return this.crm.opciones(convenioId, ambito.convenios, participanteId);
  }

  @Get()
  listar(
    @Query() filtros: FiltrosParticipantesDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.listar({ ...filtros, ambito: ambito.convenios });
  }

  @Post('carga/previsualizar')
  @Requiere('inscripciones', 'ESCRIBIR')
  previsualizarCarga(@Body() dto: CargaDto, @AmbitoActual() ambito: Ambito) {
    return this.crm.previsualizarCarga(dto, ambito.convenios);
  }

  @Get('carga/plantilla')
  @Requiere('inscripciones', 'ESCRIBIR')
  async plantillaDeCarga(@Res() res: Response) {
    enviarLibro(res, await libroDePlantilla(), 'plantilla-participantes');
  }

  @Post('carga/archivo')
  @Requiere('inscripciones', 'ESCRIBIR')
  /// El limite va en multer, no en una comprobacion de abajo:
  /// sin el, el archivo entero entra en memoria antes de que
  /// podamos rechazarlo.
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAXIMO_ARCHIVO_CARGA } }),
  )
  async cargaDesdeArchivo(@UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');

    const nombre = archivo.originalname ?? '';
    if (/\.xls$/i.test(nombre)) {
      throw new BadRequestException(
        'Ese es un Excel antiguo (.xls). Ábralo y vuelva a guardarlo como .xlsx, o como .csv.',
      );
    }
    if (!/\.(xlsx|csv)$/i.test(nombre)) {
      throw new BadRequestException('Solo se pueden subir archivos .xlsx o .csv.');
    }

    let texto: string;
    try {
      texto = await textoDelArchivo(archivo.buffer, nombre);
    } catch {
      throw new BadRequestException(
        'No se pudo leer el archivo. Compruebe que abre bien en Excel.',
      );
    }

    if (!texto) {
      throw new BadRequestException('El archivo no tiene ninguna fila con datos.');
    }
    if (texto.length > 200_000) {
      throw new BadRequestException(
        'El archivo trae demasiadas filas. Pártalo y súbalo por partes.',
      );
    }

    return { texto, filas: texto.split('\n').length };
  }

  @Get('carga/historico')
  /// VER y no ESCRIBIR: el historico es para consultarlo, y
  /// quien solo mira tiene que poder ver quien subio que.
  @Requiere('inscripciones', 'VER')
  cargas(
    @Query('convenioId') convenioId: string | undefined,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.cargas(ambito.convenios, convenioId);
  }

  @Post('carga/confirmar')
  @Requiere('inscripciones', 'ESCRIBIR')
  confirmarCarga(
    @Body() dto: CargaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.confirmarCarga(dto, admin, ambito.convenios, ip);
  }

  /** Un asesor para varias fichas de una vez. */
  @Patch('lote/asesor')
  @Requiere('inscripciones', 'ESCRIBIR')
  asignarAsesorEnLote(
    @Body() dto: AsignarAsesorEnLoteDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.asignarAsesorEnLote(
      dto,
      admin,
      ambito.convenios,
      ip,
      conveniosQueReparten(ambito.roles),
    );
  }

  @Get(':id')
  obtener(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.crm.obtener(id, ambito.convenios);
  }

  @Post()
  @Requiere('inscripciones', 'ESCRIBIR')
  crear(
    @Body() dto: CrearParticipanteDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.crear(dto, admin, ambito.convenios, ip);
  }

  @Patch(':id')
  @Requiere('inscripciones', 'ESCRIBIR')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarParticipanteDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.actualizar(id, dto, admin, ambito.convenios, ip);
  }

  /** Quita a la persona de este curso. No la borra. */
  @Delete(':id')
  @Roles(RolAdmin.SUPERADMIN)
  @Requiere('inscripciones', 'ESCRIBIR')
  borrarParticipacion(
    @Param('id') id: string,
    @AmbitoActual() ambito: Ambito,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.crm.borrarParticipacion(
      id,
      ambito.convenios,
      { id: admin.id, nombre: admin.nombre },
      ip,
    );
  }

  @Patch(':id/etapa')
  @Requiere(['inscripciones', 'academico'], 'ESCRIBIR')
  cambiarEtapa(
    @Param('id') id: string,
    @Body() dto: CambiarEtapaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.cambiarEtapa(
      id,
      dto,
      admin,
      ambito.convenios,
      ip,
      conveniosQueCierran(ambito.roles),
      conveniosQueMuevenInscrito(ambito.roles),
    );
  }

  @Patch(':id/formacion')
  @Requiere('inscripciones', 'ESCRIBIR')
  asignar(
    @Param('id') id: string,
    @Body() dto: AsignarFormacionDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.asignar(id, dto, admin, ambito.convenios, ip);
  }

  @Post(':id/autorizacion')
  @Requiere('inscripciones', 'ESCRIBIR')
  autorizacion(
    @Param('id') id: string,
    @Body() dto: RegistrarAutorizacionDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.registrarAutorizacion(id, dto, admin, ambito.convenios, ip);
  }

  /**
   * Las plantillas que se le pueden mandar, ya resueltas.
   *
   * La vista previa se pide con la plantilla elegida: se ve
   * el texto CON el nombre puesto y con los huecos que no se
   * pudieron llenar, antes de mandar nada. Nadie manda a
   * ciegas.
   */
  @Get(':id/correo/plantillas')
  plantillasParaEste(
    @Param('id') id: string,
    @AmbitoActual() ambito: Ambito,
  ) {
    /// Con el id de la ficha: la lista viene con el motivo
    /// por el que cada una no se le puede mandar a ESTA
    /// persona. Antes se devolvia el catalogo entero, igual
    /// para todos, y por eso ofrecia «confirmacion de
    /// inscripcion» a un interesado.
    return this.plantillasCorreo.paraLaFicha(id, ambito.convenios);
  }

  @Get(':id/correo/:plantillaId/vista-previa')
  vistaPreviaCorreo(
    @Param('id') id: string,
    @Param('plantillaId') plantillaId: string,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.plantillasCorreo.vistaPrevia(id, plantillaId, ambito.convenios);
  }

  /// Mandar exige ESCRIBIR: es algo que le llega a una
  /// persona de verdad y no se puede recoger.
  @Post(':id/correo/:plantillaId')
  @Requiere('inscripciones', 'ESCRIBIR')
  enviarCorreo(
    @Param('id') id: string,
    @Param('plantillaId') plantillaId: string,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.plantillasCorreo.enviar(id, plantillaId, ambito.convenios);
  }

  /// El «Historial Logs»: qué decía antes cada dato.
  ///
  /// Separado del historial de movimientos a propósito: son
  /// dos preguntas distintas. Aquel dice QUÉ HIZO alguien;
  /// este, QUÉ DECÍA EL DATO.
  @Get(':id/historico')
  historico(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.crm.historicoDeValores(id, ambito.convenios);
  }

  /// Devolver un campo a como estaba. Exige ESCRIBIR: es un
  /// cambio como cualquier otro, y deja su propia huella.
  @Post(':id/historico/:valorId/restablecer')
  @Requiere('inscripciones', 'ESCRIBIR')
  restablecer(
    @Param('id') id: string,
    @Param('valorId') valorId: string,
    @AmbitoActual() ambito: Ambito,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.crm.restablecerValor(id, valorId, ambito.convenios, admin, ip);
  }

  /// Los tres del jefe directo, desde la ficha.
  ///
  /// Antes había que ir a «Empresas registradas», que un
  /// gestor de inscripciones no tiene: el dato se quedaba sin
  /// poner. La razón social NO entra por aquí — la valida el
  /// código contra el registro.
  @Patch(':id/empresa-contacto')
  @Requiere('inscripciones', 'ESCRIBIR')
  contactoDeLaEmpresa(
    @Param('id') id: string,
    @Body() dto: ContactoDeLaEmpresaDto,
    @AmbitoActual() ambito: Ambito,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.crm.guardarContactoDeLaEmpresa(
      id,
      dto,
      ambito.convenios,
      { id: admin.id, nombre: admin.nombre },
      ip,
    );
  }

  /** Un enlace para que la persona complete su ficha. */
  @Post(':id/enlace')
  @Requiere('inscripciones', 'ESCRIBIR')
  async emitirEnlace(
    @Param('id') id: string,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    await this.crm.obtener(id, ambito.convenios);
    return this.preinscripcion.emitirEnlace(id, admin.id);
  }

  /**
   * Revocar la autorización de tratamiento de datos.
   *
   * Va con `inscripciones · ESCRIBIR` y no con superadmin: lo
   * pide la persona por teléfono y lo registra quien atiende la
   * llamada. Pedir un superadmin haría que la petición se
   * quedara sin registrar hasta que alguien con más permisos
   * tuviera un rato, y el derecho no espera.
   */
  @Post(':id/revocar-autorizacion')
  @Requiere('inscripciones', 'ESCRIBIR')
  revocarAutorizacion(
    @Param('id') id: string,
    @Body() dto: RevocarAutorizacionDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.revocarAutorizacion(id, dto, admin, ambito.convenios, ip);
  }

  @Post(':id/notas')
  @Requiere('inscripciones', 'ESCRIBIR')
  agregarNota(
    @Param('id') id: string,
    @Body() dto: CrearNotaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.agregarNota(id, dto, admin, ambito.convenios);
  }

  /// Lo que la ficha enseña mientras el RUI responde.
  /// Mirar la ficha sube esa consulta al frente de la cola:
  /// quien espera no debe quedar detrás del trabajo de fondo.
  @Get(':id/rui')
  async estadoRui(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    const personaId = await this.crm.personaDe(id, ambito.convenios);
    await this.rui.priorizar(personaId);
    return this.rui.estadoDe(personaId);
  }

  /** Vuelve a preguntarle al RUI por esta persona. */
  @Post(':id/rui')
  @Requiere('inscripciones', 'ESCRIBIR')
  async reconsultarRui(
    @Param('id') id: string,
    @AmbitoActual() ambito: Ambito,
  ) {
    const personaId = await this.crm.personaDe(id, ambito.convenios);
    await this.rui.encolar(personaId, 100);
    return this.rui.estadoDe(personaId);
  }

  /// Lo que mando el interesado y espera decision.
  /** Se queda con el nombre que devolvió el RUI. */
  @Post(':id/rui/tomar-nombre')
  @Requiere('inscripciones', 'ESCRIBIR')
  async tomarNombreDelRui(
    @Param('id') id: string,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    const personaId = await this.crm.personaDe(id, ambito.convenios);
    await this.rui.tomarElNombreDelRui(personaId, id, {
      id: admin.id,
      nombre: admin.nombre,
    });
    return this.crm.obtener(id, ambito.convenios);
  }

  @Get(':id/propuesta')
  propuesta(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.crm.propuestaDe(id, ambito.convenios);
  }

  /** El asesor decide qué campos entran. */
  @Post(':id/propuesta')
  @Requiere('inscripciones', 'ESCRIBIR')
  resolverPropuesta(
    @Param('id') id: string,
    @Body() dto: ResolverPropuestaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.resolverPropuesta(
      id,
      dto.aceptados,
      admin,
      ambito.convenios,
    );
  }

  /** Cuántas gestiones por combinación de canales. */
  @Get('metricas/canales')
  canales(@AmbitoActual() ambito: Ambito) {
    return this.crm.metricaDeCanales(ambito.convenios);
  }
}
