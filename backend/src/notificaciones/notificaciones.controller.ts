/** El panel de avisos de quien lleva fichas. */

import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { Admin } from '../../generated/prisma';
import { AdminActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere } from '../admin/admin.guard';
import { NotificacionesService } from './notificaciones.service';

/**
 * SON LAS SUYAS Y NO HAY PARÁMETRO PARA PEDIR LAS DE OTRO.
 *
 * El destinatario sale SIEMPRE de la sesión, nunca de la ruta ni
 * de la consulta. Sin eso, un `?de=` convertiría el panel en una
 * forma de leer el trabajo ajeno --y de vaciárselo, porque marcar
 * leída es una escritura--.
 *
 * Va con `inscripciones · VER` y sin `@Roles`: recibe avisos
 * quien lleva fichas, y eso incluye al líder de sistemas, que no
 * es GESTOR por enum.
 */
@Controller('admin/notificaciones')
@UseGuards(AdminGuard)
@Requiere('inscripciones', 'VER')
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  async listar(
    @AdminActual() admin: Admin,
    @Query('sinLeer') sinLeer?: string,
    @Query('limite') limite?: string,
  ) {
    const filas = await this.notificaciones.listar(admin.id, {
      soloSinLeer: sinLeer === 'si',
      limite: limite ? Number(limite) : undefined,
    });
    return { notificaciones: filas, sinLeer: await this.notificaciones.sinLeer(admin.id) };
  }

  /// Solo el número, para la campana: la lista entera cada 30 s
  /// sería traer treinta fichas para pintar un punto rojo.
  @Get('cuenta')
  async cuenta(@AdminActual() admin: Admin) {
    return { sinLeer: await this.notificaciones.sinLeer(admin.id) };
  }

  @Post(':id/leida')
  async leida(@AdminActual() admin: Admin, @Param('id') id: string) {
    const cambiadas = await this.notificaciones.marcarLeida(admin.id, id);
    return { marcada: cambiadas > 0, sinLeer: await this.notificaciones.sinLeer(admin.id) };
  }

  @Post('leer-todas')
  async leerTodas(@AdminActual() admin: Admin) {
    const cambiadas = await this.notificaciones.marcarTodasLeidas(admin.id);
    return { marcadas: cambiadas, sinLeer: 0 };
  }
}
