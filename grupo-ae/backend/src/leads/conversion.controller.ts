/** Convertir un lead en ficha. */

/**
 * Fichero aparte del de la lista a propósito: Andrés monta la
 * pantalla de la mesa de entrada con su endpoint de LECTURA, y
 * dos controladores pueden compartir el prefijo sin tocarse. Si
 * los dos escribiéramos en el mismo archivo, cada merge del día
 * sería un conflicto.
 */

import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AdminActual } from '../admin/admin-actual.decorator';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { IpReal } from '../comun/ip-real';

import { ConversionDeLeads } from './conversion.service';
import { ConvertirLeadDto } from './dto';

@Controller('admin/leads')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class ConversionController {
  constructor(private readonly conversion: ConversionDeLeads) {}

  /** Crea la ficha a partir del lead, con su autorización. */
  @Post(':id/convertir')
  @Requiere('inscripciones', 'ESCRIBIR')
  convertir(
    @Param('id') id: string,
    @Body() dto: ConvertirLeadDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.conversion.convertir(id, dto, admin, ambito.convenios, ip);
  }
}
