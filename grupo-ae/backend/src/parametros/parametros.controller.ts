import { Body, Controller, Delete, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';

import type { Admin, EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';
import { RolAdmin } from '../../generated/prisma';
import { AdminActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles } from '../admin/admin.guard';
import { ActualizarParametrosDto, ActualizarProbabilidadDto } from './dto';
import { ParametrosService } from './parametros.service';

/**
 * Los parámetros del tablero.
 *
 * VERLOS es de cualquiera que trabaje negocios: el asesor al que le
 * salta una alerta a los cinco minutos tiene derecho a saber de dónde
 * sale ese cinco.
 *
 * CAMBIARLOS es de `configuracion` con escritura, como el portafolio y
 * por el mismo motivo: mover un umbral cambia lo que el tablero le
 * enseña a toda la empresa, y la cifra con la que se juzga al equipo no
 * la mueve quien sale medido por ella.
 */
@UseGuards(AdminGuard)
@Controller('admin/parametros')
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class ParametrosController {
  constructor(private readonly parametros: ParametrosService) {}

  @Get()
  ver() {
    return this.parametros.paraElPanel();
  }

  @Patch()
  @Requiere('configuracion', 'ESCRIBIR')
  actualizar(@Body() dto: ActualizarParametrosDto, @AdminActual() admin: Admin) {
    return this.parametros.actualizar(dto, admin.id);
  }

  /// PUT y no PATCH: la probabilidad de una etapa se pone entera, no
  /// se ajusta por partes.
  @Put('probabilidad')
  @Requiere('configuracion', 'ESCRIBIR')
  fijarProbabilidad(@Body() dto: ActualizarProbabilidadDto) {
    return this.parametros.fijarProbabilidad(dto);
  }

  /// Volver a la de fábrica. Borra la fila, no escribe el número.
  @Delete('probabilidad/:embudo/:etapa')
  @Requiere('configuracion', 'ESCRIBIR')
  volverDeFabrica(
    @Param('embudo') embudo: TipoEmbudo,
    @Param('etapa') etapa: EtapaOportunidad,
  ) {
    return this.parametros.volverDeFabrica(embudo, etapa);
  }
}
