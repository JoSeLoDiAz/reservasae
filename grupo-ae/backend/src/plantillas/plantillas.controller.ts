/** Bajar el formato y subir el archivo lleno. */

import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, type Ambito } from '../admin/admin.guard';
import type { Admin } from '../../generated/prisma';
import { CATALOGO, type Entidad } from './catalogo';
import { PlantillasService } from './plantillas.service';

/// Cinco megas. Un .xlsx de cinco mil filas pesa menos de
/// uno; por encima de esto no es una plantilla, es otra cosa.
const MAXIMO = 5 * 1024 * 1024;

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('admin/plantillas')
@UseGuards(AdminGuard)
export class PlantillasController {
  constructor(private readonly plantillas: PlantillasService) {}

  /** Qué se puede cargar, y con qué reglas. */
  @Get()
  catalogo() {
    return Object.entries(CATALOGO).map(([clave, d]) => ({
      entidad: clave,
      nombre: d.plantilla.nombre,
      queEs: d.queEs,
      admiteNuevas: d.admiteNuevas,
      columnas: d.plantilla.columnas.map((c) => ({
        titulo: c.titulo,
        llave: Boolean(c.llave),
        soloLectura: Boolean(c.soloLectura),
        ayuda: c.ayuda ?? null,
      })),
    }));
  }

  /**
   * El formato, con los datos que ya hay dentro.
   *
   * No viene vacío: corregir sobre lo que existe es el caso
   * normal, y obligar a teclear doscientos NIT para cambiar
   * un teléfono garantiza que alguien se equivoque en uno.
   */
  @Get(':entidad/formato')
  @Requiere('reserva', 'ESCRIBIR')
  /// `@Res()` SIN `passthrough`: la respuesta la escribe uno
  /// mismo y Nest no toca el valor devuelto.
  ///
  /// Con `passthrough`, Nest intenta serializar lo que
  /// devuelve el método -- y `res.end()` devuelve el propio
  /// Response, que lleva un socket dentro. Serializarlo
  /// revienta con «circular structure» y sale un 500 con un
  /// archivo a medio mandar.
  async formato(
    @Param('entidad') entidad: string,
    @AmbitoActual() ambito: Ambito,
    @Res() respuesta: Response,
  ) {
    const cual = this.exigirEntidad(entidad);
    const libro = await this.plantillas.formato(cual, ambito.convenios);

    const hoy = new Date().toISOString().slice(0, 10);
    respuesta.setHeader('Content-Type', XLSX);
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename="plantilla-${cual}-${hoy}.xlsx"`,
    );
    respuesta.setHeader('Cache-Control', 'no-store');
    respuesta.send(libro);
  }

  /**
   * Sube el archivo lleno.
   *
   * Con `?ensayo=1` no escribe nada y devuelve lo que haría.
   * Es lo que la pantalla usa para enseñar el resumen antes
   * de que la persona confirme: nadie debería descubrir que
   * un cargue pisó dos mil filas después de que las pisó.
   */
  @Post(':entidad/cargar')
  @Requiere('reserva', 'ESCRIBIR')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAXIMO } }))
  async cargar(
    @Param('entidad') entidad: string,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @Query('ensayo') ensayo?: string,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    const cual = this.exigirEntidad(entidad);

    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');

    /// Solo .xlsx, y se mira el nombre además del tipo.
    ///
    /// Un .csv se abre en Excel con el separador del sistema,
    /// y en Colombia eso parte «1.234,56» en dos celdas. El
    /// .xls viejo tampoco: exceljs no lo lee.
    const esXlsx =
      archivo.mimetype === XLSX ||
      archivo.originalname.toLowerCase().endsWith('.xlsx');
    if (!esXlsx) {
      throw new BadRequestException(
        'Solo se admite .xlsx. Si lo tiene en .csv o en .xls, ábralo en Excel ' +
          'y guárdelo como «Libro de Excel (.xlsx)».',
      );
    }

    return this.plantillas.aplicar(
      cual,
      // copia: multer puede dar un SharedArrayBuffer
      Buffer.from(archivo.buffer),
      { id: admin.id, nombre: admin.nombre },
      ambito.convenios,
      ensayo === '1',
    );
  }

  private exigirEntidad(v: string): Entidad {
    if (v in CATALOGO) return v as Entidad;
    throw new BadRequestException(
      `No hay plantilla para «${v}». Hay para: ${Object.keys(CATALOGO).join(', ')}.`,
    );
  }
}
