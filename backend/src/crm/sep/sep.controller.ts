import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { RolAdmin } from '../../../generated/prisma';
import { AdminGuard, Roles } from '../../admin/admin.guard';
import { enviarLibro } from '../../tableros/exportar';
import { SepService, type Formato } from './sep.service';

/** Los reportes al SEP. Llevan cédulas: no los ve CONSULTA. */
@Controller('admin/sep')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
export class SepController {
  constructor(private readonly sep: SepService) {}

  /** Cuántos entran y cuántos no, antes de generar nada. */
  @Get('alistamiento')
  alistamiento(@Query('convenioId') convenioId: string) {
    return this.sep.alistamiento(convenioId);
  }

  @Get('exportar')
  async exportar(
    @Query('convenioId') convenioId: string,
    @Query('formato') formato: Formato,
    @Query('ano') ano: string | undefined,
    @Res() res: Response,
  ) {
    const cual: Formato = formato === 'cargue-sep' ? 'cargue-sep' : 'uso-directo';
    const { libro } = await this.sep.exportar(
      convenioId,
      cual,
      Number(ano) || new Date().getFullYear(),
    );
    enviarLibro(res, libro, cual === 'cargue-sep' ? 'cargue-sep' : 'uso-directo');
  }
}
