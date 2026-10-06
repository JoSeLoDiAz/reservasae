/** Las dos rutas de la bandeja de conversaciones. */

/**
 * CONTROLADOR APARTE del webhook, y es deliberado.
 *
 * `LucidController` lo guarda una llave de proveedor; esto lo guarda
 * una sesión del panel. Colgar las dos cosas del mismo controlador
 * sería la trampa que su propio docblock ya nombra: «una ruta que
 * acepta dos autenticaciones deja entrar por la más débil».
 */

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { RolAdmin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import {
  AdminGuard,
  Requiere,
  Roles,
  type Ambito,
} from '../admin/admin.guard';
import { BandejaDeConversaciones } from './bandeja.service';
import { PegarConversacionDto } from './dto';

@Controller('admin/conversaciones')
@UseGuards(AdminGuard)
/// Aquí viven celulares y lo que una persona escribió por WhatsApp:
/// una cuenta de solo consulta no tiene nada que hacer.
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
/// El área es la de inscripciones: una conversación de WhatsApp es
/// trabajo de la cola de leads, no del aula.
@Requiere('inscripciones')
export class BandejaController {
  constructor(private readonly bandeja: BandejaDeConversaciones) {}

  /** Las que esperan dueño. Las pegadas ya están en su ficha. */
  @Get()
  enEspera(@AmbitoActual() ambito: Ambito) {
    return this.bandeja.enEspera(ambito.convenios);
  }

  /**
   * Pegarla a una ficha o a un lead.
   *
   * ESCRIBE, así que pide nivel de escritura además del área de la
   * clase. Ver la bandeja y repartir conversaciones no son el mismo
   * permiso: lo primero es mirar una cola, lo segundo mete una nota
   * en la ficha de una persona.
   */
  @Post(':id/pegar')
  @Requiere('inscripciones', 'ESCRIBIR')
  pegar(
    @AmbitoActual() ambito: Ambito,
    @Param('id') id: string,
    @Body() dto: PegarConversacionDto,
  ) {
    return this.bandeja.pegar(id, ambito.convenios, {
      participanteId: dto.participanteId,
      leadId: dto.leadId,
    });
  }
}
