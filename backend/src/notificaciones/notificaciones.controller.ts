/** El panel de avisos de quien lleva fichas. */

import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, type Ambito } from '../admin/admin.guard';
import { conveniosQueVenElEquipo } from '../admin/permisos';
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

  /**
   * Lo del EQUIPO, para quien responde por él.
   *
   * No lleva `@Roles`: quien manda es `VEN_EL_EQUIPO`, la misma
   * lista que ya decide quién ve el módulo de asesores. Va antes de
   * `:id/leida` en el fichero por costumbre, pero el orden que
   * importa es el de Nest: `equipo` es literal y no choca con
   * ninguna ruta con parámetro de este controlador.
   *
   * Si la cuenta no lidera en ningún gremio se contesta VACÍO y 200,
   * no 403: la lista está acotada por convenio, y un 403 aquí diría
   * que existe algo que mirar.
   */
  @Get('equipo')
  async equipo(
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @Query('sinLeer') sinLeer?: string,
    @Query('limite') limite?: string,
  ) {
    /**
     * EL SUPERADMIN TAMBIEN, Y SE CRUZA CON EL AMBITO.
     *
     * La regla de quien responde por el equipo vivia en TRES
     * sitios y solo dos nombraban al superadmin --`admin.controller`
     * :164 y `crm.controller`:136--. Aqui faltaba, y el efecto era
     * un control en pie y vacio de efecto: `/admin/yo` decia
     * `verElEquipo: true`, el panel pintaba la pestaña «Del
     * equipo», y la ruta que abre contestaba SIEMPRE vacio --«Al
     * equipo no le ha llegado nada»-- aunque los asesores tuvieran
     * avisos sin leer. Porque `db:crear-admin` le concede a un
     * superadmin `LIDER_SISTEMAS`, que NO esta en `VEN_EL_EQUIPO`.
     * O sea que la afirmacion falsa se la llevaba justo quien abrio
     * la pestaña para supervisar.
     *
     * Y SE INTERSECA CON `ambito.convenios`, que es lo segundo.
     * `ambito.roles` son TODAS las concesiones de la cuenta, sin
     * recortar por el gremio de la direccion; `ambito.convenios` ya
     * viene recortado por `@Requiere` y por el host. Sin el cruce,
     * entrando por `adecopria.` se leian los avisos de BRITCHAM
     * --con nombre y cedula dentro--, que es la fuga de ambito de
     * siempre por la puerta nueva.
     */
    const convenios =
      admin.rol === RolAdmin.SUPERADMIN
        ? ambito.convenios
        : conveniosQueVenElEquipo(ambito.roles).filter((c) =>
            ambito.convenios.includes(c),
          );
    const filas = await this.notificaciones.listarDelEquipo(convenios, {
      soloSinLeer: sinLeer === 'si',
      limite: limite ? Number(limite) : undefined,
    });
    return { notificaciones: filas, sinLeer: filas.filter((f) => !f.leida).length };
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
