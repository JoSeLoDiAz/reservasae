import {
  Body,
  Controller,
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
import { conveniosQueCierran } from '../admin/permisos';
import { IpReal } from '../comun/ip-real';
import { CrmService } from './crm.service';
import {
  ActualizarParticipanteDto,
  AsignarFormacionDto,
  CargaDto,
  CambiarEtapaDto,
  CrearNotaDto,
  CrearParticipanteDto,
  FiltrosParticipantesDto,
  RegistrarAutorizacionDto,
} from './dto';

/** Inscripciones: las personas detrás de los cupos. */
@Controller('admin/participantes')
@UseGuards(AdminGuard)
// aqui viven cedulas, celulares y correos de terceros:
// una cuenta de solo consulta no tiene nada que hacer
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  /** Contadores por etapa: las columnas del tablero. */
  @Get('resumen')
  resumen(@Query() filtros: FiltrosParticipantesDto, @AmbitoActual() ambito: Ambito) {
    return this.crm.resumen({ ...filtros, ambito: ambito.convenios });
  }

  /** Cupos reservados sin nombre detrás. */
  @Get('brecha')
  brecha(@AmbitoActual() ambito: Ambito, @Query('convenioId') convenioId?: string) {
    return this.crm.brecha(convenioId, ambito.convenios);
  }

  /** Las listas del SEP que dibujan los formularios. */
  @Get('catalogos')
  catalogos() {
    return this.crm.catalogos();
  }

  /** Quién va al día y quién no, contra las fechas del grupo. */
  @Get('academico')
  @Requiere('academico')
  academico(@Query() filtros: FiltrosParticipantesDto, @AmbitoActual() ambito: Ambito) {
    return this.crm.academico({ ...filtros, ambito: ambito.convenios });
  }

  /** Ofertas y grupos donde se puede colocar a alguien. */
  @Get('opciones')
  opciones(@Query('convenioId') convenioId: string, @AmbitoActual() ambito: Ambito) {
    return this.crm.opciones(convenioId, ambito.convenios);
  }

  @Get()
  listar(@Query() filtros: FiltrosParticipantesDto, @AmbitoActual() ambito: Ambito) {
    return this.crm.listar({ ...filtros, ambito: ambito.convenios });
  }

  @Post('carga/previsualizar')
  @Requiere('inscripciones', 'ESCRIBIR')
  previsualizarCarga(@Body() dto: CargaDto, @AmbitoActual() ambito: Ambito) {
    return this.crm.previsualizarCarga(dto, ambito.convenios);
  }

  @Post('carga/confirmar')
  @Requiere('inscripciones', 'ESCRIBIR')
  confirmarCarga(
    @Body() dto: CargaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.confirmarCarga(dto, admin, ambito.convenios, ip);
  }

  @Get(':id')
  obtener(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.crm.obtener(id, ambito.convenios);
  }

  @Post()
  @Requiere('inscripciones', 'ESCRIBIR')
  crear(
    @Body() dto: CrearParticipanteDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.crear(dto, admin, ambito.convenios, ip);
  }

  @Patch(':id')
  @Requiere('inscripciones', 'ESCRIBIR')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarParticipanteDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.actualizar(id, dto, ambito.convenios);
  }

  @Patch(':id/etapa')
  @Requiere(['inscripciones', 'academico'], 'ESCRIBIR')
  cambiarEtapa(
    @Param('id') id: string,
    @Body() dto: CambiarEtapaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.cambiarEtapa(
      id,
      dto,
      admin,
      ambito.convenios,
      ip,
      conveniosQueCierran(ambito.roles),
    );
  }

  @Patch(':id/formacion')
  @Requiere('inscripciones', 'ESCRIBIR')
  asignar(
    @Param('id') id: string,
    @Body() dto: AsignarFormacionDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.asignar(id, dto, admin, ambito.convenios);
  }

  @Post(':id/autorizacion')
  @Requiere('inscripciones', 'ESCRIBIR')
  autorizacion(
    @Param('id') id: string,
    @Body() dto: RegistrarAutorizacionDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.crm.registrarAutorizacion(id, dto, admin, ambito.convenios, ip);
  }

  @Post(':id/notas')
  @Requiere('inscripciones', 'ESCRIBIR')
  agregarNota(
    @Param('id') id: string,
    @Body() dto: CrearNotaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.crm.agregarNota(id, dto, admin, ambito.convenios);
  }
}
