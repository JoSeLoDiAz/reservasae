import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { IpReal } from '../comun/ip-real';
import { CronogramaService } from './cronograma.service';
import {
  ActualizarCuposDto,
  CrearCoberturaDto,
  ActualizarGrupoDto,
  ActualizarInformacionDto,
} from './dto';

/** El calendario de los grupos. Lo ve todo el mundo. */
@Controller('admin/cronograma')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('reserva')
export class CronogramaController {
  constructor(private readonly cronograma: CronogramaService) {}

  @Get()
  listar(@AmbitoActual() ambito: Ambito) {
    return this.cronograma.listar(ambito.convenios);
  }

  /**
   * Las cuentas que pueden llevar un grupo.
   *
   * Mismo permiso que editar el grupo, y a propósito: quien puede
   * asignar asesor es quien puede ver a quién asignar. La lista de
   * cuentas de `admin/usuarios` es de SUPERADMIN y no sirve aquí.
   */
  @Get('asesores')
  @Requiere('configuracion', 'ESCRIBIR')
  asesores(@AmbitoActual() ambito: Ambito) {
    return this.cronograma.asesoresPosibles(ambito.convenios);
  }

  // configurar la formacion ya es del lider de sistemas y
  // el calendario es parte de ella. Un cambio aqui mueve
  // el "va al dia" de todo un grupo
  @Patch('grupos/:id')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizarGrupo(
    @Param('id') id: string,
    @Body() dto: ActualizarGrupoDto,
    @AmbitoActual() ambito: Ambito,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.cronograma.actualizarGrupo(
      id,
      dto,
      ambito.convenios,
      { id: admin.id, nombre: admin.nombre },
      ip,
    );
  }

  /**
   * Los cupos de un grupo en una sede.
   *
   * Mismo permiso que las fechas: repartir plazas entre departamentos
   * cambia lo que se le prometio al SENA por cada uno, y mueve el tope
   * de la oferta entera.
   */
  /**
   * Los tres textos del proyecto: objetivo, contenido y competencia.
   *
   * Mismo permiso que las fechas, y por el mismo motivo: esto es lo que
   * el formulario publico ensenia detras de «Mas informacion», asi que
   * lo lee quien esta decidiendo si se inscribe.
   */
  @Patch('acciones/:id/informacion')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizarInformacion(
    @Param('id') id: string,
    @Body() dto: ActualizarInformacionDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.cronograma.actualizarInformacion(id, dto, ambito.convenios);
  }

  @Patch('coberturas/:id/cupos')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizarCupos(
    @Param('id') id: string,
    @Body() dto: ActualizarCuposDto,
    @AmbitoActual() ambito: Ambito,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.cronograma.actualizarCupos(
      id,
      dto,
      ambito.convenios,
      { id: admin.id, nombre: admin.nombre },
      ip,
    );
  }


  /**
   * DONDE SE LE PUEDE ANADIR UNA SEDE A ESTE GRUPO.
   *
   * Es lo que llena el desplegable, y por eso va con `VER` y no con
   * `ESCRIBIR`: preguntar donde se dicta una accion no cambia nada.
   */
  @Get('grupos/:id/sedes-posibles')
  @Requiere('configuracion', 'VER')
  sedesPosibles(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.cronograma.sedesPosibles(id, ambito.convenios);
  }
  /**
   * ANADE UNA SEDE A UN GRUPO QUE YA EXISTE.
   *
   * Cuelga del grupo y no de `/coberturas` a secas porque el grupo es
   * lo que acota el ambito: sin el en la ruta habria que deducirlo del
   * cuerpo, y eso ya se ha equivocado aqui antes.
   */
  @Post('grupos/:id/coberturas')
  @Requiere('configuracion', 'ESCRIBIR')
  crearCobertura(
    @Param('id') id: string,
    @Body() dto: CrearCoberturaDto,
    @AmbitoActual() ambito: Ambito,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.cronograma.crearCobertura(
      id,
      dto,
      ambito.convenios,
      { id: admin.id, nombre: admin.nombre },
      ip,
    );
  }
}
