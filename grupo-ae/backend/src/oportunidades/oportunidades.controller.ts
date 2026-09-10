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

import { RolAdmin, TipoEmbudo, type Admin } from '../../generated/prisma';
import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { CambiarEtapaDto, CrearOportunidadDto } from './dto';
import { OportunidadesService } from './oportunidades.service';

/**
 * El embudo de ventas.
 *
 * Cuelga del área `inscripciones` a propósito y no de un área
 * nueva: es la misma gente la que trabaja los leads y las
 * oportunidades, y crear un permiso aparte obligaría a conceder dos
 * cosas a todo el mundo el primer día. Cuando el equipo de ventas
 * se separe del de captación, aquí es donde se parte.
 */
@UseGuards(AdminGuard)
@Controller('admin/oportunidades')
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class OportunidadesController {
  constructor(private readonly oportunidades: OportunidadesService) {}

  /** El tablero de un embudo, con sus columnas y su pronóstico. */
  @Get('tablero')
  async tablero(
    @AmbitoActual() ambito: Ambito,
    @Query('embudo') embudo?: string,
    @Query('asesorId') asesorId?: string,
  ) {
    const cual = (embudo ?? TipoEmbudo.EMPRESA) as TipoEmbudo;
    if (!Object.values(TipoEmbudo).includes(cual)) {
      throw new BadRequestException('Ese embudo no existe.');
    }
    return this.oportunidades.tablero(cual, ambito, asesorId || undefined);
  }

  /**
   * Las que nadie ha contestado todavía.
   *
   * Va antes que `:id` en el archivo porque Nest resuelve las rutas
   * por orden de declaración: con `:id` arriba, «sin-respuesta»
   * llegaría como un id y devolvería un 404 desconcertante.
   */
  @Get('sin-respuesta')
  sinRespuesta(@AmbitoActual() ambito: Ambito) {
    return this.oportunidades.sinRespuesta(ambito);
  }

  /** La portada: todo lo que hay que saber al entrar. */
  @Get('resumen')
  resumen(@AmbitoActual() ambito: Ambito) {
    return this.oportunidades.resumen(ambito);
  }

  /** Las que llevan días quietas. */
  @Get('frias')
  frias(@AmbitoActual() ambito: Ambito, @Query('dias') dias?: string) {
    const n = Number(dias);
    return this.oportunidades.frias(
      ambito,
      Number.isFinite(n) && n > 0 ? Math.floor(n) : 7,
    );
  }

  @Get(':id')
  unaSola(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.oportunidades.unaSola(id, ambito);
  }

  @Post()
  @Requiere('inscripciones', 'ESCRIBIR')
  crear(
    @Body() dto: CrearOportunidadDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    /// El convenio se comprueba contra el ámbito y no se cree lo que
    /// mande el cliente: mandar el de otro sería crear una
    /// oportunidad en una cuenta ajena.
    if (!ambito.convenios.includes(dto.convenioId)) {
      throw new BadRequestException('No trabaja en esa cuenta.');
    }
    return this.oportunidades.crear(dto, admin);
  }

  @Patch(':id/etapa')
  @Requiere('inscripciones', 'ESCRIBIR')
  cambiarEtapa(
    @Param('id') id: string,
    @Body() dto: CambiarEtapaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.oportunidades.cambiarEtapa(id, dto, admin, ambito);
  }
}
