/** Campañas, desde el panel; y lo que abre el destinatario. */

import {
  BadRequestException,
  Body,
  Controller,
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

import type { Admin } from '../../../generated/prisma';
import { AdminActual, AmbitoActual } from '../../admin/admin-actual.decorator';
import { AdminGuard, Requiere, type Ambito } from '../../admin/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CampanasService } from './campanas.service';
import { CrearCampanaDto, EditarCampanaDto, SegmentoDto } from './dto';

/// Los tipos que un cliente de correo dibuja sin pelear. SVG
/// no: Gmail y Outlook no lo pintan, así que el banner
/// quedaría en blanco justo donde más se ve.
const TIPOS_BANNER = ['image/png', 'image/jpeg', 'image/webp'];
const MAXIMO_BANNER = 2 * 1024 * 1024;

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/// Una base es texto: si pesa mas de esto, o no es una base o
/// viene con medio Excel pegado dentro.
const MAXIMO_BASE = 5 * 1024 * 1024;

@Controller('admin/campanas')
@UseGuards(AdminGuard)
@Requiere('inscripciones', 'ESCRIBIR')
export class CampanasController {
  constructor(private readonly campanas: CampanasService) {}

  @Get('segmentos')
  segmentos() {
    return this.campanas.segmentosListos();
  }

  @Get('variables')
  variables() {
    return this.campanas.variables();
  }

  @Get()
  listar(@AmbitoActual() ambito: Ambito) {
    return this.campanas.listar(ambito.convenios);
  }

  /// Cuántos le tocarían hoy, sin mandar nada. Lanzar sin
  /// saber a cuántos va es como se le escribe a cuatrocientas
  /// personas por error.
  @Post('a-cuantos')
  aCuantos(
    @Body() dto: { convenioId: string; segmento: SegmentoDto },
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.campanas.aCuantos(
      dto.convenioId,
      dto.segmento,
      ambito.convenios,
    );
  }

  @Post()
  crear(
    @Body() dto: CrearCampanaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.campanas.crear(
      ambito.convenios,
      dto.convenioId,
      {
        nombre: dto.nombre,
        asunto: dto.asunto,
        cuerpo: dto.cuerpo,
        origen: dto.origen,
        segmento: dto.segmento,
      },
      admin.id,
    );
  }

  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body() dto: EditarCampanaDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.campanas.editar(ambito.convenios, id, dto);
  }

  @Post(':id/banner')
  /// El límite va AQUÍ, en multer, no solo en la comprobación
  /// de abajo.
  ///
  /// Sin él, multer se traga el archivo entero en memoria y
  /// solo después miramos `archivo.size` para rechazarlo: un
  /// .png de dos gigas tumba el servidor antes de que le
  /// digamos que no. Con el límite, la conexión se corta
  /// mientras sube.
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAXIMO_BANNER } }),
  )
  async banner(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @AmbitoActual() ambito: Ambito,
  ) {
    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');
    if (!TIPOS_BANNER.includes(archivo.mimetype)) {
      throw new BadRequestException(
        'El banner debe ser PNG, JPG o WebP. El SVG no sirve: Gmail y Outlook ' +
          'no lo dibujan, y quedaría un hueco blanco justo arriba del correo.',
      );
    }
    if (archivo.size > MAXIMO_BANNER) {
      throw new BadRequestException(
        'El banner no puede pesar más de 2 MB: un correo pesado se tarda en ' +
          'abrir y algunos clientes lo recortan.',
      );
    }

    return this.campanas.guardarBanner(
      id,
      archivo.buffer,
      archivo.mimetype,
      archivo.originalname,
      ambito.convenios,
    );
  }

  /// El formato para llenar. Va antes que la subida en el
  /// archivo porque es antes en el orden de las cosas: nadie
  /// sube una base sin haber descargado primero el formato.
  ///
  /// `@Res()` SIN `passthrough`: la respuesta se escribe a
  /// mano. Con passthrough, Nest intenta serializar lo que se
  /// devuelva, y aqui lo que se devuelve es un binario.
  @Get('formato-base')
  async formatoBase(@Res() respuesta: Response) {
    const libro = await this.campanas.formatoDeBase();
    respuesta.setHeader('Content-Type', XLSX);
    respuesta.setHeader(
      'Content-Disposition',
      'attachment; filename="base-para-campana.xlsx"',
    );
    respuesta.setHeader('Cache-Control', 'no-store');
    respuesta.end(libro);
  }

  @Post(':id/base')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAXIMO_BASE } }),
  )
  async cargarBase(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @AmbitoActual() ambito: Ambito,
  ) {
    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');
    if (archivo.mimetype !== XLSX) {
      throw new BadRequestException(
        'Tiene que ser un .xlsx. Un .csv se abre con el separador del sistema ' +
          'y en Colombia eso parte las celdas por la coma.',
      );
    }
    if (archivo.size > MAXIMO_BASE) {
      throw new BadRequestException(
        'Ese archivo pesa demasiado para ser una lista de correos. ' +
          'Revise que no traiga hojas ni imágenes de más.',
      );
    }
    return this.campanas.cargarBase(id, archivo.buffer, ambito.convenios);
  }

  @Post(':id/lanzar')
  lanzar(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.campanas.lanzar(id, ambito.convenios);
  }

  @Post(':id/pausar')
  pausar(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.campanas.pausar(id, ambito.convenios);
  }

  @Post(':id/reanudar')
  reanudar(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.campanas.reanudar(id, ambito.convenios);
  }

  @Get(':id/resultados')
  resultados(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.campanas.resultados(id, ambito.convenios);
  }

  @Get(':id/destinatarios')
  destinatarios(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.campanas.destinatarios(id, ambito.convenios);
  }
}

/**
 * Lo que abre quien recibe el correo. SIN sesión.
 *
 * Tiene que ser público: quien pide estas URL es el cliente de
 * correo de otra persona, que no tiene ni sesión ni por qué
 * tenerla. Por eso los identificadores son cuid -- no se
 * adivinan -- y por eso aquí no se devuelve NADA de la
 * persona: ni su nombre, ni su correo, ni la campaña. Solo se
 * anota y se responde una imagen o una redirección.
 */
@Controller('campanas')
export class CampanasPublicoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campanas: CampanasService,
  ) {}

  @Get(':id/banner')
  async verBanner(@Param('id') id: string, @Res() res: Response) {
    const c = await this.prisma.campana.findUnique({
      where: { id },
      select: { bannerDatos: true, bannerMime: true },
    });

    if (!c?.bannerDatos || !c.bannerMime) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', c.bannerMime);
    // el contenido de una campaña no cambia: se cachea fuerte
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(Buffer.from(c.bannerDatos));
  }

  /**
   * El pixel. Mide APROXIMADO y hay que decirlo.
   *
   * Gmail descarga la imagen él mismo antes de que nadie lea
   * nada, y Apple Mail la pide por todos sus usuarios. Así que
   * esto cuenta hacia arriba: sirve para comparar campañas
   * entre sí, no para afirmar que alguien leyó algo.
   */
  @Get(':id/abierto/:destinatarioId')
  async abierto(
    @Param('destinatarioId') destinatarioId: string,
    @Res() res: Response,
  ) {
    await this.campanas.anotarApertura(destinatarioId).catch(() => undefined);

    /// Un PNG transparente de 1x1, escrito aquí. Pedirlo a un
    /// archivo sería una dependencia más para algo que ocupa
    /// una línea.
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    res.setHeader('Content-Type', 'image/png');
    // que no se cachee: si se cachea, la segunda apertura no llega
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(pixel);
  }

  /**
   * El clic. Este SÍ es firme.
   *
   * Pasa por aquí de verdad, con una persona detrás pulsando.
   * No depende de que el cliente de correo cargue imágenes.
   */
  @Get(':id/clic/:destinatarioId')
  async clic(
    @Param('id') campanaId: string,
    @Param('destinatarioId') destinatarioId: string,
    @Query('a') destino: string | undefined,
    @Res() res: Response,
  ) {
    await this.campanas.anotarClic(destinatarioId).catch(() => undefined);

    /// El destino tiene que ser UNO DE LOS DE ESTA CAMPAÑA.
    ///
    /// Antes solo se comprobaba que empezara por http, y con
    /// eso el dominio del gremio redirigía a donde le
    /// pidieran. Quien recibe el correo ya confía en ese
    /// remitente —le escribió sobre su inscripción—, así que
    /// un enlace que sale de aquí y termina en una página de
    /// estafa no le resulta raro a nadie.
    const seguro = await this.campanas.destinoDelClic(campanaId, destino);
    res.redirect(302, seguro ?? '/');
  }
}
