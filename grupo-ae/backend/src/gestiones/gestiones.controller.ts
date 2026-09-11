import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { booleanoDeVerdad } from '../comun/booleano-de-verdad';
import { CrearGestionDto, EditarGestionDto } from './dto';
import { GestionesService } from './gestiones.service';

/**
 * La gestión comercial: la agenda y el próximo paso.
 *
 * Cuelga del área `inscripciones` y no de una propia, por lo
 * mismo que el embudo: es la misma gente la que trabaja los leads
 * y los negocios, y un permiso aparte obligaría a conceder dos
 * cosas a todo el mundo el primer día.
 */
@UseGuards(AdminGuard)
@Controller('admin/gestiones')
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class GestionesController {
  constructor(private readonly gestiones: GestionesService) {}

  /**
   * Lo vencido, lo de hoy y lo que queda de semana.
   *
   * Las rutas de nombre fijo van ANTES que las de `:id`: Nest las
   * resuelve por orden de declaración, y con `:id` arriba
   * «agenda» llegaría como un identificador y devolvería un 404
   * que no hay forma de entender.
   */
  @Get('agenda')
  agenda(
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @Query('asesorId') asesorId?: string,
    @Query('todos') todos?: string,
  ) {
    return this.gestiones.agenda(admin, ambito, {
      asesorId: asesorId || null,
      /// `booleanoDeVerdad` y no el booleano del pipe: con
      /// `enableImplicitConversion`, `todos=false` llega como
      /// `true` porque cualquier cadena no vacía lo es.
      todos: booleanoDeVerdad(todos) === true,
    });
  }

  /** Los negocios que no tienen nada agendado. */
  @Get('sin-proximo-paso')
  sinProximoPaso(
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @Query('asesorId') asesorId?: string,
    @Query('todos') todos?: string,
  ) {
    return this.gestiones.sinProximoPaso(admin, ambito, {
      asesorId: asesorId || null,
      todos: booleanoDeVerdad(todos) === true,
    });
  }

  /** Todo lo de un negocio: lo pendiente arriba, lo hecho debajo. */
  @Get('oportunidad/:oportunidadId')
  deUnaOportunidad(
    @Param('oportunidadId') oportunidadId: string,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.gestiones.deUnaOportunidad(oportunidadId, ambito);
  }

  @Post('oportunidad/:oportunidadId')
  @Requiere('inscripciones', 'ESCRIBIR')
  crear(
    @Param('oportunidadId') oportunidadId: string,
    @Body() dto: CrearGestionDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.gestiones.crear(oportunidadId, dto, admin, ambito);
  }

  @Patch(':id')
  @Requiere('inscripciones', 'ESCRIBIR')
  editar(
    @Param('id') id: string,
    @Body() dto: EditarGestionDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.gestiones.editar(id, dto, ambito);
  }

  /**
   * Marcar y desmarcar son POST y DELETE de lo MISMO.
   *
   * `/:id/hecha` es un recurso —«la marca de hecha»— y así las
   * dos operaciones se leen solas y ninguna necesita cuerpo. Un
   * `PATCH` con `{ hecha: true | false }` habría hecho lo mismo,
   * pero deja la puerta abierta a que el panel mande la fecha, y
   * cuándo se hizo algo lo pone el servidor.
   */
  @Post(':id/hecha')
  @Requiere('inscripciones', 'ESCRIBIR')
  marcarHecha(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.gestiones.marcarHecha(id, ambito);
  }

  @Delete(':id/hecha')
  @Requiere('inscripciones', 'ESCRIBIR')
  desmarcar(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.gestiones.desmarcar(id, ambito);
  }

  @Delete(':id')
  @Requiere('inscripciones', 'ESCRIBIR')
  borrar(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.gestiones.borrar(id, ambito);
  }
}
