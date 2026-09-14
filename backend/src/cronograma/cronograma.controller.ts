import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { RolAdmin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { CronogramaService } from './cronograma.service';
import {
  ActualizarCuposDto,
  ActualizarGrupoDto,
  ActualizarInformacionDto,
} from './dto';

/** El calendario de los grupos. Lo ve todo el mundo. */
@Controller('admin/cronograma')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('reserva')
export class CronogramaController {
  constructor(private readonly cronograma: CronogramaService) {}

  @Get()
  listar(@AmbitoActual() ambito: Ambito) {
    return this.cronograma.listar(ambito.convenios);
  }

  // configurar la formacion ya es del lider de sistemas y
  // el calendario es parte de ella. Un cambio aqui mueve
  // el "va al dia" de todo un grupo
  @Patch('grupos/:id')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizarGrupo(
    @Param('id') id: string,
    @Body() dto: ActualizarGrupoDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.cronograma.actualizarGrupo(id, dto, ambito.convenios);
  }

  /**
   * Los cupos de un grupo en una sede.
   *
   * Mismo permiso que las fechas: repartir plazas entre departamentos
   * cambia lo que se le prometio al SENA por cada uno, y mueve el tope
   * de la oferta entera.
   */
  /**
   * Los tres textos del proyecto: objetivo, contenido y competencia.
   *
   * Mismo permiso que las fechas, y por el mismo motivo: esto es lo que
   * el formulario publico ensenia detras de «Mas informacion», asi que
   * lo lee quien esta decidiendo si se inscribe.
   */
  @Patch('acciones/:id/informacion')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizarInformacion(
    @Param('id') id: string,
    @Body() dto: ActualizarInformacionDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.cronograma.actualizarInformacion(id, dto, ambito.convenios);
  }

  @Patch('coberturas/:id/cupos')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizarCupos(
    @Param('id') id: string,
    @Body() dto: ActualizarCuposDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.cronograma.actualizarCupos(id, dto, ambito.convenios);
  }
}
