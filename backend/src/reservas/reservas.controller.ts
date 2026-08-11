import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { IpReal } from '../comun/ip-real';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import {
  CancelarReservaDto,
  ConsultarReservasDto,
  EditarReservaDto,
} from './dto/editar-reserva.dto';
import { ReservasService } from './reservas.service';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  crear(
    @Body() dto: CrearReservaDto,
    @IpReal() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.reservas.crear(dto, { ip, userAgent });
  }

  // solo pide el NIT, que es publico: limite estrecho
  @Get()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  consultar(@Query() dto: ConsultarReservasDto) {
    return this.reservas.consultarPorNit(dto.nit);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  editar(
    @Param('id') id: string,
    @Body() dto: EditarReservaDto,
    @IpReal() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.reservas.editar(id, dto.nit, dto.cuposSolicitados, { ip, userAgent });
  }

  // POST: lleva cuerpo y no borra la fila
  @Post(':id/cancelar')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarReservaDto,
    @IpReal() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.reservas.cancelar(id, dto.nit, { ip, userAgent });
  }
}
