import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { RolAdmin } from '../../../generated/prisma';
import { AmbitoActual } from '../../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../../admin/admin.guard';
import { enviarLibro } from '../../tableros/exportar';
import { SepService, type Formato } from './sep.service';

/** Los reportes al SEP. Llevan cédulas: no los ve CONSULTA. */
@Controller('admin/sep')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('reportes')
export class SepController {
  constructor(private readonly sep: SepService) {}

  /** Cuántos entran y cuántos no, antes de generar nada. */
  @Get('alistamiento')
  alistamiento(@Query('convenioId') convenioId: string, @AmbitoActual() ambito: Ambito) {
    return this.sep.alistamiento(convenioId, ambito.convenios);
  }

  /// El F7 tiene su propio alistamiento y su propia cifra.
  ///
  /// El metodo existia y no tenia ruta, asi que la pantalla
  /// pintaba el numero de PERSONAS al lado del boton del F7,
  /// que va por organizacion: dos cosas distintas bajo la
  /// misma cifra.
  @Get('alistamiento-f7')
  alistamientoF7(@Query('convenioId') convenioId: string, @AmbitoActual() ambito: Ambito) {
    return this.sep.alistamientoF7(convenioId, ambito.convenios);
  }

  // el gestor ve cuantos entran; el archivo con las
  // cedulas lo saca su lider
  @Get('exportar')
  @Requiere('reportes', 'ESCRIBIR')
  async exportar(
    @Query('convenioId') convenioId: string,
    @Query('formato') formato: Formato,
    @Query('ano') ano: string | undefined,
    @AmbitoActual() ambito: Ambito,
    @Res() res: Response,
  ) {
    // el F7 va por organizacion y tiene su propio camino
    if (formato === 'f7') {
      const { libro } = await this.sep.exportarF7(convenioId, ambito.convenios);
      enviarLibro(res, libro, 'f7-empresas');
      return;
    }

    const cual: Formato = formato === 'cargue-sep' ? 'cargue-sep' : 'uso-directo';
    const { libro } = await this.sep.exportar(
      convenioId,
      cual,
      Number(ano) || new Date().getFullYear(),
      ambito.convenios,
    );
    enviarLibro(res, libro, cual === 'cargue-sep' ? 'reporte-sep' : 'reporte-control');
  }
}
