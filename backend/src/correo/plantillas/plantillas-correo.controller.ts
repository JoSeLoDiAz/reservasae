/** Las plantillas de correo, desde el panel. */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { CrearPlantillaDto, EditarPlantillaDto } from './dto';
import { PlantillasCorreoService } from './plantillas-correo.service';

/// Los tipos que un cliente de correo dibuja sin pelear. SVG
/// no: Gmail y Outlook no lo pintan, así que el cabezote
/// quedaría en blanco justo donde más se ve.
const TIPOS_BANNER = ['image/png', 'image/jpeg', 'image/webp'];
const MAXIMO_BANNER = 2 * 1024 * 1024;

/// Escribir plantillas es configuración: se hace una vez y
/// afecta a todo lo que se mande después. Usarlas para
/// escribirle a alguien vive en el otro controlador, bajo
/// inscripciones, que es donde está el lead.
@Controller('admin/plantillas-correo')
@UseGuards(AdminGuard)
@Requiere('configuracion', 'ESCRIBIR')
export class PlantillasCorreoController {
  constructor(private readonly plantillas: PlantillasCorreoService) {}

  /** El catálogo de variables, para quien escribe. */
  @Get('variables')
  variables() {
    return this.plantillas.variables();
  }

  @Get()
  listar(@AmbitoActual() ambito: Ambito) {
    return this.plantillas.listar(ambito.concedidos);
  }

  @Post()
  crear(
    @Body() dto: CrearPlantillaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.plantillas.crear(dto, admin.id, ambito.convenios);
  }

  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body() dto: EditarPlantillaDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.plantillas.editar(id, ambito.convenios, dto);
  }

  /// No borra: apaga. Una plantilla que ya se usó es parte de
  /// lo que se le dijo a alguien.
  @Delete(':id')
  apagar(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.plantillas.apagar(id, ambito.convenios);
  }

  @Post(':id/banner')
  /// El límite va AQUÍ, en multer, no solo en la comprobación
  /// de abajo: sin él, multer se traga el archivo entero en
  /// memoria y solo después miramos `archivo.size`. Un .png de
  /// dos gigas tumba el servidor antes de que le digamos que
  /// no.
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAXIMO_BANNER } }),
  )
  async subirBanner(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @AmbitoActual() ambito: Ambito,
  ) {
    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');
    if (!TIPOS_BANNER.includes(archivo.mimetype)) {
      throw new BadRequestException(
        'El cabezote debe ser PNG, JPG o WebP. El SVG no sirve: Gmail y ' +
          'Outlook no lo dibujan, y quedaría un hueco blanco justo arriba ' +
          'del correo.',
      );
    }
    if (archivo.size > MAXIMO_BANNER) {
      throw new BadRequestException(
        'El cabezote no puede pesar más de 2 MB: un correo pesado se tarda ' +
          'en abrir y algunos clientes lo recortan.',
      );
    }

    return this.plantillas.guardarBanner(
      id,
      archivo.buffer,
      archivo.mimetype,
      archivo.originalname,
      ambito.convenios,
    );
  }

  @Delete(':id/banner')
  quitarBanner(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.plantillas.quitarBanner(id, ambito.convenios);
  }
}

/**
 * El cabezote, para quien abre el correo.
 *
 * Va SIN guardia y en su propio controlador, igual que el de
 * las campañas: quien pide esta imagen no es el panel, es el
 * cliente de correo de la persona a la que se le escribió, y
 * ese no tiene sesión ni la va a tener.
 *
 * No expone nada: son los bytes de una franja decorativa que
 * ya salió por correo. Sin el id --un cuid-- no se llega.
 */
@Controller('plantillas-correo')
export class PlantillasCorreoPublicoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/banner')
  async verBanner(@Param('id') id: string, @Res() res: Response) {
    const p = await this.prisma.plantillaCorreo.findUnique({
      where: { id },
      select: { bannerDatos: true, bannerMime: true },
    });

    if (!p?.bannerDatos || !p.bannerMime) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', p.bannerMime);
    /// Se cachea fuerte y se puede: la versión viaja en la
    /// dirección (`?v=`), así que cambiar el cabezote cambia
    /// la URL y nadie sirve el viejo.
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(Buffer.from(p.bannerDatos));
  }
}
