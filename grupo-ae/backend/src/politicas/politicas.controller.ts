import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { DestinatarioPolitica, RolAdmin } from '../../generated/prisma';
import { AdminGuard, Requiere, Roles } from '../admin/admin.guard';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import type { Ambito } from '../admin/admin.guard';
import { ActualizarPoliticaDto, CrearPoliticaDto } from './dto';
import { PoliticasService } from './politicas.service';

/** El texto legal. Escribirlo es cosa de gestión. */
@Controller('admin/politicas')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('configuracion', 'ESCRIBIR')
export class PoliticasAdminController {
  constructor(private readonly politicas: PoliticasService) {}

  /** Qué convenio puede publicar acciones y cuál no. */
  @Get('cobertura')
  cobertura(@AmbitoActual() ambito: Ambito) {
    return this.politicas.cobertura(ambito.convenios);
  }

  @Get()
  listar(
    @AmbitoActual() ambito: Ambito,
    @Query('convenioId') convenioId?: string,
    @Query('destinatario') destinatario?: DestinatarioPolitica,
  ) {
    return this.politicas.listar(ambito.convenios, convenioId, destinatario);
  }

  @Post()
  crear(@AmbitoActual() ambito: Ambito, @Body() dto: CrearPoliticaDto) {
    return this.politicas.crear(ambito.convenios, dto);
  }

  @Patch(':id')
  actualizar(
    @AmbitoActual() ambito: Ambito,
    @Param('id') id: string,
    @Body() dto: ActualizarPoliticaDto,
  ) {
    return this.politicas.actualizar(ambito.convenios, id, dto);
  }

  @Delete(':id')
  @Roles(RolAdmin.SUPERADMIN)
  eliminar(@AmbitoActual() ambito: Ambito, @Param('id') id: string) {
    return this.politicas.eliminar(ambito.convenios, id);
  }
}

/** La lee cualquiera: es el texto que se acepta. */
@Controller('politicas')
export class PoliticasPublicoController {
  constructor(private readonly politicas: PoliticasService) {}

  @Get(':slug/:destinatario')
  vigente(
    @Param('slug') slug: string,
    @Param('destinatario', new ParseEnumPipe(DestinatarioPolitica))
    destinatario: DestinatarioPolitica,
  ) {
    return this.politicas.vigentePublica(slug, destinatario);
  }
}
