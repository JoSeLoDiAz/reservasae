import {
  BadRequestException,
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

import { RolAdmin, TipoEmbudo, type Admin } from '../../generated/prisma';
import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import {
  ActualizarOportunidadDto,
  AsignarAsesorDto,
  AtarClienteDto,
  CambiarEtapaDto,
  CrearOportunidadDto,
  NotaDto,
  PisarProbabilidadDto,
} from './dto';
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

  /** A quién se le puede pasar este negocio, para el desplegable. */
  @Get(':id/asesores')
  asesoresPosibles(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.oportunidades.asesoresPosibles(id, ambito);
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
      throw new BadRequestException('No tiene acceso a esa línea de negocio.');
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

  /**
   * Pasarle el negocio a otra persona, o soltarlo.
   *
   * Ruta aparte y no un campo más de la edición: quién responde por
   * un negocio no es un dato de la ficha como el título. Se pide
   * solo, deja su propio movimiento en la bitácora y se le puede
   * dar o quitar el permiso por separado el día que el traspaso lo
   * autorice un líder y la corrección del título no.
   */
  @Patch(':id/asesor')
  @Requiere('inscripciones', 'ESCRIBIR')
  asignarAsesor(
    @Param('id') id: string,
    @Body() dto: AsignarAsesorDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.oportunidades.asignarAsesor(id, dto, admin, ambito);
  }

  /** Pisar la probabilidad a mano, o devolverla a la de su etapa. */
  @Patch(':id/probabilidad')
  @Requiere('inscripciones', 'ESCRIBIR')
  pisarProbabilidad(
    @Param('id') id: string,
    @Body() dto: PisarProbabilidadDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.oportunidades.pisarProbabilidad(id, dto, admin, ambito);
  }

  /** Atarle la empresa o la persona a la que se le vende. */
  @Patch(':id/cliente')
  @Requiere('inscripciones', 'ESCRIBIR')
  atarCliente(
    @Param('id') id: string,
    @Body() dto: AtarClienteDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.oportunidades.atarCliente(id, dto, admin, ambito);
  }

  /** Una nota suelta en la bitácora, sin agendar nada. */
  @Post(':id/notas')
  @Requiere('inscripciones', 'ESCRIBIR')
  dejarNota(
    @Param('id') id: string,
    @Body() dto: NotaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.oportunidades.dejarNota(id, dto.nota, admin, ambito);
  }

  /**
   * Corregir la ficha.
   *
   * Va la última de las `PATCH` porque es la más general: las de
   * arriba llevan un segundo segmento en la ruta y esta no, así que
   * leerlas en este orden es leerlas de la más específica a la que
   * recoge el resto.
   */
  @Patch(':id')
  @Requiere('inscripciones', 'ESCRIBIR')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarOportunidadDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.oportunidades.actualizar(id, dto, admin, ambito);
  }

  /**
   * Borrar, que solo vale para lo que entró por error.
   *
   * Todo lo demás se cierra como PERDIDO con su motivo. La regla
   * entera está explicada en `puedeBorrarse`, y el mensaje de error
   * la dice también, porque quien la va a encontrar es el asesor que
   * le dio al botón.
   */
  @Delete(':id')
  @Requiere('inscripciones', 'ESCRIBIR')
  borrar(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.oportunidades.borrar(id, ambito);
  }
}
