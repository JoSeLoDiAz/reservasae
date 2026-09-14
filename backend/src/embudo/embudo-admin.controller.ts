/** El embudo del formulario público, para el panel. */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, type Ambito } from '../admin/admin.guard';
import type { Rango } from '../crm/ventana';
import { EmbudoService } from './embudo.service';

/// SIN @Roles: quien mira esto es la cuenta de la pauta, que es
/// CONSULTA por concesión y `RolAdmin.GESTOR` por enum. Un
/// @Roles aquí la dejaría fuera de su propia pantalla.
@Controller('admin/embudo-publico')
@UseGuards(AdminGuard)
@Requiere('inscripciones')
export class EmbudoAdminController {
  constructor(private readonly embudo: EmbudoService) {}

  @Get()
  ver(@AmbitoActual() ambito: Ambito, @Query('rango') rango?: Rango) {
    return this.embudo.embudo(ambito.convenios, rango ?? 'SEMANA');
  }
}
