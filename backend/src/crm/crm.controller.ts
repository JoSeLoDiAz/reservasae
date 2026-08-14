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

import { type Admin } from '../../generated/prisma';
import { AdminActual } from '../admin/admin-actual.decorator';
import { AdminGuard } from '../admin/admin.guard';
import { IpReal } from '../comun/ip-real';
import { CrmService } from './crm.service';
import {
  ActualizarParticipanteDto,
  AsignarFormacionDto,
  CambiarEtapaDto,
  CrearNotaDto,
  CrearParticipanteDto,
  FiltrosParticipantesDto,
  RegistrarAutorizacionDto,
} from './dto';

/** Inscripciones: las personas detrás de los cupos. */
@Controller('admin/participantes')
@UseGuards(AdminGuard)
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  /** Contadores por etapa: las columnas del tablero. */
  @Get('resumen')
  resumen(@Query() filtros: FiltrosParticipantesDto) {
    return this.crm.resumen(filtros);
  }

  /** Ofertas y grupos donde se puede colocar a alguien. */
  @Get('opciones')
  opciones(@Query('convenioId') convenioId: string) {
    return this.crm.opciones(convenioId);
  }

  @Get()
  listar(@Query() filtros: FiltrosParticipantesDto) {
    return this.crm.listar(filtros);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.crm.obtener(id);
  }

  @Post()
  crear(
    @Body() dto: CrearParticipanteDto,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.crm.crear(dto, admin, ip);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarParticipanteDto) {
    return this.crm.actualizar(id, dto);
  }

  @Patch(':id/etapa')
  cambiarEtapa(
    @Param('id') id: string,
    @Body() dto: CambiarEtapaDto,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.crm.cambiarEtapa(id, dto, admin, ip);
  }

  @Patch(':id/formacion')
  asignar(
    @Param('id') id: string,
    @Body() dto: AsignarFormacionDto,
    @AdminActual() admin: Admin,
  ) {
    return this.crm.asignar(id, dto, admin);
  }

  @Post(':id/autorizacion')
  autorizacion(
    @Param('id') id: string,
    @Body() dto: RegistrarAutorizacionDto,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.crm.registrarAutorizacion(id, dto, admin, ip);
  }

  @Post(':id/notas')
  agregarNota(
    @Param('id') id: string,
    @Body() dto: CrearNotaDto,
    @AdminActual() admin: Admin,
  ) {
    return this.crm.agregarNota(id, dto, admin);
  }
}
