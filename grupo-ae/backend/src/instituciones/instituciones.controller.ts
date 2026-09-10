/** El maestro de organizaciones, desde el panel. */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { Admin } from '../../generated/prisma';
import { AdminActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere } from '../admin/admin.guard';
import { AplicarPropuestaDto, EditarInstitucionDto } from './dto';
import { InstitucionesService } from './instituciones.service';
import { webConectado } from './web/proveedor-web';
import { WebService } from './web/web.service';

/// Va bajo el área de reserva: quien atiende organizaciones
/// es quien las va a corregir. Verificar exige ESCRIBIR --
/// firmar que una ficha está bien no es una consulta.
@Controller('admin/instituciones')
@UseGuards(AdminGuard)
@Requiere('reserva', 'VER')
export class InstitucionesController {
  constructor(
    private readonly instituciones: InstitucionesService,
    private readonly web: WebService,
  ) {}

  @Get()
  listar(
    @Query('buscar') buscar?: string,
    @Query('incompletas') incompletas?: string,
    @Query('sinVerificar') sinVerificar?: string,
    @Query('sugeridos') sugeridos?: string,
    @Query('pagina') pagina?: string,
  ) {
    return this.instituciones.listar({
      buscar,
      soloIncompletas: incompletas === '1',
      soloSinVerificar: sinVerificar === '1',
      soloSugeridos: sugeridos === '1',
      pagina: pagina ? Number(pagina) : 1,
    });
  }

  @Get('resumen')
  resumen() {
    return this.instituciones.resumen();
  }

  /** Lo que un robot propuso y nadie ha resuelto. */
  @Get('pendientes')
  pendientes() {
    return this.instituciones.pendientes();
  }

  @Get(':id')
  ver(@Param('id') id: string) {
    return this.instituciones.ver(id);
  }

  @Patch(':id')
  @Requiere('reserva', 'ESCRIBIR')
  editar(
    @Param('id') id: string,
    @Body() dto: EditarInstitucionDto,
    @AdminActual() admin: Admin,
  ) {
    return this.instituciones.editar(id, dto, {
      id: admin.id,
      nombre: admin.nombre,
    });
  }

  @Post(':id/verificar')
  @Requiere('reserva', 'ESCRIBIR')
  verificar(@Param('id') id: string, @AdminActual() admin: Admin) {
    return this.instituciones.verificar(id, admin.id);
  }

  @Post(':id/desverificar')
  @Requiere('reserva', 'ESCRIBIR')
  desverificar(@Param('id') id: string) {
    return this.instituciones.desverificar(id);
  }

  /**
   * Que el buscador web vaya a mirar este NIT.
   *
   * Pide ESCRIBIR aunque no escriba nada en la ficha: la
   * consulta cuesta plata y termina en una propuesta que
   * alguien va a tener que resolver.
   */
  @Post(':id/validar-web')
  @Requiere('reserva', 'ESCRIBIR')
  async validarWeb(@Param('id') id: string) {
    /// Apagado no se encola: una fila esperando en una cola
    /// que nadie va a vaciar se ve igual que una consulta en
    /// curso, y el asesor se queda esperando una respuesta
    /// que no va a llegar nunca.
    if (!webConectado()) {
      throw new BadRequestException(
        'El buscador web está apagado en el servidor.',
      );
    }

    // quien está mirando la ficha va delante de lo que se
    // encoló en segundo plano
    await this.web.encolar(id, 100);
    return this.web.estado(id);
  }

  /** En qué va la consulta, para poder mostrarlo en la ficha. */
  @Get(':id/estado-web')
  estadoWeb(@Param('id') id: string) {
    return this.web.estado(id);
  }

  @Post('propuestas/:id/aplicar')
  @Requiere('reserva', 'ESCRIBIR')
  aplicar(
    @Param('id') id: string,
    @Body() dto: AplicarPropuestaDto,
    @AdminActual() admin: Admin,
  ) {
    return this.instituciones.aplicarPropuesta(id, dto, admin.id);
  }
}
