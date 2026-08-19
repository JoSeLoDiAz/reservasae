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
  cobertura() {
    return this.politicas.cobertura();
  }

  @Get()
  listar(
    @Query('convenioId') convenioId?: string,
    @Query('destinatario') destinatario?: DestinatarioPolitica,
  ) {
    return this.politicas.listar(convenioId, destinatario);
  }

  @Post()
  crear(@Body() dto: CrearPoliticaDto) {
    return this.politicas.crear(dto);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarPoliticaDto) {
    return this.politicas.actualizar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.politicas.eliminar(id);
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
