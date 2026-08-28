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
  aCuantos(@Body() dto: { convenioId: string; segmento: SegmentoDto }) {
    return this.campanas.aCuantos(dto.convenioId, dto.segmento);
  }

  @Post()
  crear(@Body() dto: CrearCampanaDto, @AdminActual() admin: Admin) {
    return this.campanas.crear(
      dto.convenioId,
      {
        nombre: dto.nombre,
        asunto: dto.asunto,
        cuerpo: dto.cuerpo,
        segmento: dto.segmento,
      },
      admin.id,
    );
  }

  @Patch(':id')
  editar(@Param('id') id: string, @Body() dto: EditarCampanaDto) {
    return this.campanas.editar(id, dto);
  }

  @Post(':id/banner')
  @UseInterceptors(FileInterceptor('archivo'))
  async banner(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
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
    );
  }

  @Post(':id/lanzar')
  lanzar(@Param('id') id: string) {
    return this.campanas.lanzar(id);
  }

  @Post(':id/pausar')
  pausar(@Param('id') id: string) {
    return this.campanas.pausar(id);
  }

  @Post(':id/reanudar')
  reanudar(@Param('id') id: string) {
    return this.campanas.reanudar(id);
  }

  @Get(':id/resultados')
  resultados(@Param('id') id: string) {
    return this.campanas.resultados(id);
  }

  @Get(':id/destinatarios')
  destinatarios(@Param('id') id: string) {
    return this.campanas.destinatarios(id);
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
    @Param('destinatarioId') destinatarioId: string,
    @Query('a') destino: string | undefined,
    @Res() res: Response,
  ) {
    await this.campanas.anotarClic(destinatarioId).catch(() => undefined);

    /// Solo http(s), y nada de `javascript:`. Este parámetro
    /// viaja en una URL que cualquiera puede reescribir, así
    /// que redirigir a lo que venga sería abrirle la puerta a
    /// que usen nuestro dominio para mandar a donde sea.
    const seguro = destino && /^https?:\/\//i.test(destino) ? destino : '/';
    res.redirect(302, seguro);
  }
}
