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

import { RolAdmin } from '../../generated/prisma';
import { AdminGuard, Requiere, Roles } from '../admin/admin.guard';
import {
  ActualizarAparienciaDto,
  ActualizarFormularioDto,
  ActualizarOpcionDto,
  ActualizarPreguntaDto,
  CrearFormularioDto,
  DuplicarFormularioDto,
  CrearPreguntaDto,
  OpcionDto,
  ReordenarDto,
  SeccionDto,
} from './dto';
import { FormulariosService } from './formularios.service';

/** El constructor. Herramienta de gestión, no de consulta. */
@Controller('admin/formularios')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('configuracion', 'ESCRIBIR')
export class FormulariosAdminController {
  constructor(private readonly formularios: FormulariosService) {}

  /** Campos del sistema que se pueden añadir. */
  @Get('campos-nucleo')
  camposNucleo() {
    return this.formularios.camposNucleo();
  }

  @Get()
  listar() {
    return this.formularios.listar();
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.formularios.obtener(id);
  }

  @Post()
  crear(@Body() dto: CrearFormularioDto) {
    return this.formularios.crear(dto);
  }

  /** Copia uno existente, en borrador. */
  @Post(':id/duplicar')
  duplicar(@Param('id') id: string, @Body() dto: DuplicarFormularioDto) {
    return this.formularios.duplicar(id, dto);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarFormularioDto) {
    return this.formularios.actualizar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.formularios.eliminar(id);
  }

  // apariencia

  @Patch(':id/apariencia')
  actualizarApariencia(@Param('id') id: string, @Body() dto: ActualizarAparienciaDto) {
    return this.formularios.actualizarApariencia(id, dto);
  }

  // los logos van por /admin/logos?formularioId=

  // secciones

  @Post(':id/secciones')
  crearSeccion(@Param('id') id: string, @Body() dto: SeccionDto) {
    return this.formularios.crearSeccion(id, dto);
  }

  @Patch('secciones/:seccionId')
  actualizarSeccion(@Param('seccionId') seccionId: string, @Body() dto: SeccionDto) {
    return this.formularios.actualizarSeccion(seccionId, dto);
  }

  @Delete('secciones/:seccionId')
  eliminarSeccion(@Param('seccionId') seccionId: string) {
    return this.formularios.eliminarSeccion(seccionId);
  }

  @Patch(':id/secciones/orden')
  reordenarSecciones(@Param('id') id: string, @Body() dto: ReordenarDto) {
    return this.formularios.reordenarSecciones(id, dto.ids);
  }

  // preguntas

  @Post(':id/preguntas')
  crearPregunta(@Param('id') id: string, @Body() dto: CrearPreguntaDto) {
    return this.formularios.crearPregunta(id, dto);
  }

  @Patch('preguntas/:preguntaId')
  actualizarPregunta(
    @Param('preguntaId') preguntaId: string,
    @Body() dto: ActualizarPreguntaDto,
  ) {
    return this.formularios.actualizarPregunta(preguntaId, dto);
  }

  @Patch(':id/preguntas/orden')
  reordenarPreguntas(@Param('id') id: string, @Body() dto: ReordenarDto) {
    return this.formularios.reordenarPreguntas(id, dto.ids);
  }

  // opciones

  @Post('preguntas/:preguntaId/opciones')
  crearOpcion(@Param('preguntaId') preguntaId: string, @Body() dto: OpcionDto) {
    return this.formularios.crearOpcion(preguntaId, dto);
  }

  @Patch('opciones/:opcionId')
  actualizarOpcion(@Param('opcionId') opcionId: string, @Body() dto: ActualizarOpcionDto) {
    return this.formularios.actualizarOpcion(opcionId, dto);
  }

  @Delete('opciones/:opcionId')
  eliminarOpcion(@Param('opcionId') opcionId: string) {
    return this.formularios.eliminarOpcion(opcionId);
  }

  @Patch('preguntas/:preguntaId/opciones/orden')
  reordenarOpciones(@Param('preguntaId') preguntaId: string, @Body() dto: ReordenarDto) {
    return this.formularios.reordenarOpciones(preguntaId, dto.ids);
  }
}

/** Lo que pide el navegador para dibujar. */
@Controller('formularios')
export class FormulariosPublicoController {
  constructor(private readonly formularios: FormulariosService) {}

  @Get(':slug')
  obtener(@Param('slug') slug: string) {
    return this.formularios.obtenerPublico(slug);
  }
}
