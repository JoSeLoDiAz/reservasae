import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { RolAdmin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { PeriodoDto } from './dto';
import { InformesService } from './informes.service';
import { diaEnColombia } from './periodo';

/**
 * Los informes del embudo.
 *
 * Cuelgan de `inscripciones` en nivel de lectura, igual que el
 * tablero de oportunidades: es la misma gente y son las mismas
 * cifras, contadas de otra manera. Quien puede ver el embudo puede
 * ver lo que el embudo dejó.
 *
 * El ámbito lo recorta el guard, así que un informe nunca suma un
 * gremio que el que consulta no trabaja. Ninguna de estas rutas
 * recibe un convenio por parámetro: dejar elegir el convenio aquí
 * sería la manera de olvidarse de comprobarlo en una de las cinco.
 */
@UseGuards(AdminGuard)
@Controller('admin/informes')
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class InformesController {
  constructor(private readonly informes: InformesService) {}

  /**
   * El avance contra la meta del mes.
   *
   * Sin periodo, el mes corriente de Bogotá: se entra a esta
   * pantalla sin haber elegido nada y tiene que enseñar algo. El
   * mes se resuelve en hora de Colombia y no con la del servidor,
   * que en producción es UTC y a partir de las siete de la tarde
   * del último día del mes ya estaría enseñando el siguiente.
   */
  @Get('avance')
  avance(@Query() periodo: PeriodoDto, @AmbitoActual() ambito: Ambito) {
    const hoy = diaEnColombia(new Date());
    return this.informes.avanceContraLaMeta(
      ambito,
      periodo.anio ?? hoy.anio,
      periodo.mes ?? hoy.mes,
    );
  }

  /** Ganadas contra perdidas, con el porqué de cada cierre. */
  @Get('ganadas-perdidas')
  ganadasContraPerdidas(
    @Query() periodo: PeriodoDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.informes.ganadasContraPerdidas(
      ambito,
      periodo.anio ?? diaEnColombia(new Date()).anio,
      /// Sin mes, el año entero: es la comparación que se hace
      /// cuando se quiere aprender del año anterior.
      periodo.mes ?? null,
    );
  }

  /** Qué lleva cada asesor: abierto, ganado y perdido. */
  @Get('por-asesor')
  porAsesor(@Query() periodo: PeriodoDto, @AmbitoActual() ambito: Ambito) {
    return this.informes.porAsesor(
      ambito,
      periodo.anio ?? diaEnColombia(new Date()).anio,
      periodo.mes ?? null,
    );
  }

  /** Qué trajo cada campaña, y cuánto de eso se ganó. */
  @Get('por-campana')
  porCampana(@Query() periodo: PeriodoDto, @AmbitoActual() ambito: Ambito) {
    return this.informes.porCampana(
      ambito,
      periodo.anio ?? diaEnColombia(new Date()).anio,
      periodo.mes ?? null,
    );
  }

  /**
   * Los últimos doce meses: cuántas entraron y cuántas se cerraron.
   *
   * No recibe periodo. Son siempre los doce meses que acaban en el
   * corriente: la pregunta que contesta es la tendencia, y una
   * tendencia con las fechas a gusto del que consulta se puede
   * recortar hasta que diga lo que uno quiera.
   */
  @Get('embudo-en-el-tiempo')
  embudoEnElTiempo(@AmbitoActual() ambito: Ambito) {
    return this.informes.embudoEnElTiempo(ambito);
  }
}
