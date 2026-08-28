/** Las plantillas de correo, desde el panel. */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { Admin } from '../../../generated/prisma';
import { AdminActual, AmbitoActual } from '../../admin/admin-actual.decorator';
import { AdminGuard, Requiere, type Ambito } from '../../admin/admin.guard';
import { CrearPlantillaDto, EditarPlantillaDto } from './dto';
import { PlantillasCorreoService } from './plantillas-correo.service';

/// Escribir plantillas es configuración: se hace una vez y
/// afecta a todo lo que se mande después. Usarlas para
/// escribirle a alguien vive en el otro controlador, bajo
/// inscripciones, que es donde está el lead.
@Controller('admin/plantillas-correo')
@UseGuards(AdminGuard)
@Requiere('configuracion', 'ESCRIBIR')
export class PlantillasCorreoController {
  constructor(private readonly plantillas: PlantillasCorreoService) {}

  /** El catálogo de variables, para quien escribe. */
  @Get('variables')
  variables() {
    return this.plantillas.variables();
  }

  @Get()
  listar(@AmbitoActual() ambito: Ambito) {
    return this.plantillas.listar(ambito.concedidos);
  }

  @Post()
  crear(@Body() dto: CrearPlantillaDto, @AdminActual() admin: Admin) {
    return this.plantillas.crear(dto, admin.id);
  }

  @Patch(':id')
  editar(@Param('id') id: string, @Body() dto: EditarPlantillaDto) {
    return this.plantillas.editar(id, dto);
  }

  /// No borra: apaga. Una plantilla que ya se usó es parte de
  /// lo que se le dijo a alguien.
  @Delete(':id')
  apagar(@Param('id') id: string) {
    return this.plantillas.apagar(id);
  }
}
