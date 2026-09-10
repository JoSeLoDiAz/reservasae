import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
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
  ResumenPublicoDto,
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

  /// Antes de `:id` a proposito: si no, «resumenes» se
  /// leeria como el id de un formulario.
  @Get('resumenes')
  resumenes(@AmbitoActual() ambito: Ambito) {
    return this.formularios.resumenesPublicos(ambito.convenios);
  }

  /** El texto de la tarjeta de una acción. */
  @Patch('resumenes/:accionId')
  guardarResumen(
    @AmbitoActual() ambito: Ambito,
    @Param('accionId') accionId: string,
    @Body() dto: ResumenPublicoDto,
  ) {
    return this.formularios.guardarResumenPublico(ambito.convenios, accionId, dto.resumen ?? null);
  }

  @Get()
  listar(@AmbitoActual() ambito: Ambito) {
    return this.formularios.listar(ambito.convenios);
  }

  @Get(':id')
  obtener(@AmbitoActual() ambito: Ambito, @Param('id') id: string) {
    return this.formularios.obtener(ambito.convenios, id);
  }

  @Post()
  crear(@AmbitoActual() ambito: Ambito, @Body() dto: CrearFormularioDto) {
    return this.formularios.crear(ambito.convenios, dto);
  }

  /** Copia uno existente, en borrador. */
  @Post(':id/duplicar')
  @Roles(RolAdmin.SUPERADMIN)
  duplicar(@AmbitoActual() ambito: Ambito, @Param('id') id: string, @Body() dto: DuplicarFormularioDto) {
    return this.formularios.duplicar(ambito.convenios, id, dto);
  }

  // el titulo y los textos los edita quien construye;
  // abrirlo al publico es del administrador
  @Patch(':id')
  actualizar(
    @AmbitoActual() ambito: Ambito,
    @Param('id') id: string,
    @Body() dto: ActualizarFormularioDto,
    @AdminActual() admin: Admin,
  ) {
    if (dto.publicado !== undefined && admin.rol !== RolAdmin.SUPERADMIN) {
      throw new ForbiddenException(
        'Publicar o retirar un formulario es del administrador del sistema.',
      );
    }
    return this.formularios.actualizar(ambito.convenios, id, dto);
  }

  @Delete(':id')
  @Roles(RolAdmin.SUPERADMIN)
  eliminar(@AmbitoActual() ambito: Ambito, @Param('id') id: string) {
    return this.formularios.eliminar(ambito.convenios, id);
  }

  // apariencia

  @Patch(':id/apariencia')
  @Roles(RolAdmin.SUPERADMIN)
  actualizarApariencia(@AmbitoActual() ambito: Ambito, @Param('id') id: string, @Body() dto: ActualizarAparienciaDto) {
    return this.formularios.actualizarApariencia(ambito.convenios, id, dto);
  }

  // los logos van por /admin/logos?formularioId=

  // secciones

  @Post(':id/secciones')
  crearSeccion(@AmbitoActual() ambito: Ambito, @Param('id') id: string, @Body() dto: SeccionDto) {
    return this.formularios.crearSeccion(ambito.convenios, id, dto);
  }

  @Patch('secciones/:seccionId')
  actualizarSeccion(@AmbitoActual() ambito: Ambito, @Param('seccionId') seccionId: string, @Body() dto: SeccionDto) {
    return this.formularios.actualizarSeccion(ambito.convenios, seccionId, dto);
  }

  @Delete('secciones/:seccionId')
  @Roles(RolAdmin.SUPERADMIN)
  eliminarSeccion(@AmbitoActual() ambito: Ambito, @Param('seccionId') seccionId: string) {
    return this.formularios.eliminarSeccion(ambito.convenios, seccionId);
  }

  @Patch(':id/secciones/orden')
  reordenarSecciones(@AmbitoActual() ambito: Ambito, @Param('id') id: string, @Body() dto: ReordenarDto) {
    return this.formularios.reordenarSecciones(ambito.convenios, id, dto.ids);
  }

  // preguntas

  @Post(':id/preguntas')
  crearPregunta(@AmbitoActual() ambito: Ambito, @Param('id') id: string, @Body() dto: CrearPreguntaDto) {
    return this.formularios.crearPregunta(ambito.convenios, id, dto);
  }

  @Patch('preguntas/:preguntaId')
  actualizarPregunta(
    @AmbitoActual() ambito: Ambito,
    @Param('preguntaId') preguntaId: string,
    @Body() dto: ActualizarPreguntaDto,
  ) {
    return this.formularios.actualizarPregunta(ambito.convenios, preguntaId, dto);
  }

  @Patch(':id/preguntas/orden')
  reordenarPreguntas(@AmbitoActual() ambito: Ambito, @Param('id') id: string, @Body() dto: ReordenarDto) {
    return this.formularios.reordenarPreguntas(ambito.convenios, id, dto.ids);
  }

  // opciones

  @Post('preguntas/:preguntaId/opciones')
  crearOpcion(@AmbitoActual() ambito: Ambito, @Param('preguntaId') preguntaId: string, @Body() dto: OpcionDto) {
    return this.formularios.crearOpcion(ambito.convenios, preguntaId, dto);
  }

  @Patch('opciones/:opcionId')
  actualizarOpcion(@AmbitoActual() ambito: Ambito, @Param('opcionId') opcionId: string, @Body() dto: ActualizarOpcionDto) {
    return this.formularios.actualizarOpcion(ambito.convenios, opcionId, dto);
  }

  @Delete('opciones/:opcionId')
  @Roles(RolAdmin.SUPERADMIN)
  eliminarOpcion(@AmbitoActual() ambito: Ambito, @Param('opcionId') opcionId: string) {
    return this.formularios.eliminarOpcion(ambito.convenios, opcionId);
  }

  @Patch('preguntas/:preguntaId/opciones/orden')
  reordenarOpciones(@AmbitoActual() ambito: Ambito, @Param('preguntaId') preguntaId: string, @Body() dto: ReordenarDto) {
    return this.formularios.reordenarOpciones(ambito.convenios, preguntaId, dto.ids);
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
