import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { RolAdmin } from '../../generated/prisma';
import { AdminGuard, Requiere, Roles } from '../admin/admin.guard';
import { ActualizarServicioDto } from './dto';
import { ServiciosService } from './servicios.service';

/**
 * El portafolio.
 *
 * LEERLO es de quien trabaja negocios (`inscripciones`): el asesor
 * tiene que ver qué se vende para elegirlo en su oportunidad.
 * CAMBIARLO es de `configuracion` con escritura: renombrar u ocultar
 * un servicio cambia lo que ofrece toda la empresa.
 */
@UseGuards(AdminGuard)
@Controller('admin/servicios')
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class ServiciosController {
  constructor(private readonly servicios: ServiciosService) {}

  /** `?todos=si` trae también los ocultos, para administrarlos. */
  @Get()
  listar(@Query('todos') todos?: string) {
    return this.servicios.listar(todos !== 'si');
  }

  @Patch(':id')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarServicioDto) {
    return this.servicios.actualizar(id, dto);
  }
}
