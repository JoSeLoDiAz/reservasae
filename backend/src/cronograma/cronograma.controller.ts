import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { RolAdmin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { CronogramaService } from './cronograma.service';
import { ActualizarGrupoDto } from './dto';

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
}
