import {
  Body,
  Controller,
  ForbiddenException,
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

/**
 * CAMBIAR O CANCELAR UNA SOLICITUD SIN SESIÓN QUEDA APAGADO POR DEFECTO.
 *
 * La única prueba que pedían estas dos rutas era el NIT, y el NIT de
 * una empresa es público: está en el RUES, en sus facturas y en su
 * página web. Así que cualquiera que lo conociera podía cancelar las
 * solicitudes de otra empresa sin dejar más rastro que una IP. La
 * auditoría del 18 sep 2026 lo marcó grave para salir a producción.
 *
 * No se borra nada: el código, las rutas y la pantalla siguen. Se
 * enciende con RESERVAS_EDICION_PUBLICA=si el día que haya una prueba
 * de verdad (un enlace por correo, como el de /completar/:token).
 * Mientras tanto, la respuesta le dice a la empresa qué hacer, que es
 * escribirle a su asesor, en vez de un error sin explicación.
 *
 * CONSULTAR sigue abierto a propósito: solo devuelve datos de la
 * empresa que ya son públicos y el estado de sus solicitudes, sin
 * nombres, correos ni teléfonos de nadie.
 */
function exigirEdicionPublica(): void {
  if (process.env.RESERVAS_EDICION_PUBLICA === 'si') return;
  throw new ForbiddenException(
    'Para cambiar o cancelar una solicitud, escríbale a su asesor comercial. ' +
      'Por seguridad, ya no se hace solo con el NIT.',
  );
}

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

  // solo pide el NIT: límite estrecho
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
    exigirEdicionPublica();
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
    exigirEdicionPublica();
    return this.reservas.cancelar(id, dto.nit, { ip, userAgent });
  }
}
