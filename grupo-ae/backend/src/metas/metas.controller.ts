import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RolAdmin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { ConsultarMetasDto, FijarMetaDto } from './dto';
import { MetasService } from './metas.service';

/**
 * Las metas del mes.
 *
 * Leerlas es de `inscripciones`, como el embudo: la meta sin el
 * tablero no dice nada, y quien trabaja el tablero tiene que ver
 * contra qué.
 *
 * FIJARLAS Y BORRARLAS es de `reportes` con nivel de escritura, y
 * eso es una decisión, no una copia. Poner una meta es un acto de
 * jefatura: con `inscripciones ESCRIBIR` —que tiene todo gestor,
 * porque lo necesita para mover sus oportunidades— cualquiera
 * podría bajarse la suya el día 28 y cumplirla. En la tabla de
 * permisos, `reportes ESCRIBIR` lo tienen los líderes y sistemas,
 * que es exactamente quien responde por el número.
 */
@UseGuards(AdminGuard)
@Controller('admin/metas')
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class MetasController {
  constructor(private readonly metas: MetasService) {}

  /** Las metas de un año, o de un mes suelto. */
  @Get()
  listar(@Query() filtros: ConsultarMetasDto, @AmbitoActual() ambito: Ambito) {
    return this.metas.listar(ambito, filtros);
  }

  /**
   * Fijar la meta de un mes: la crea si no estaba y la reemplaza si
   * estaba. Con `asesorId` en null, la del equipo.
   */
  @Post()
  @Requiere('reportes', 'ESCRIBIR')
  fijar(@Body() dto: FijarMetaDto, @AmbitoActual() ambito: Ambito) {
    return this.metas.fijar(dto, ambito);
  }

  @Delete(':id')
  @Requiere('reportes', 'ESCRIBIR')
  borrar(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.metas.borrar(id, ambito);
  }

  /**
   * Va la última del archivo a propósito.
   *
   * Nest resuelve las rutas por orden de declaración: con `:id`
   * arriba, cualquier ruta nueva de este controlador —«resumen»,
   * «del-equipo»— llegaría aquí como un id y devolvería un 404 que
   * no se entiende. Es la misma razón por la que en el controlador
   * de oportunidades `sin-respuesta` va antes que `:id`.
   */
  @Get(':id')
  una(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.metas.una(id, ambito);
  }
}
