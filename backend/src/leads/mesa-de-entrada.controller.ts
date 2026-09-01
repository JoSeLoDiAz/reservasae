/** La lista de la mesa de entrada. */

/**
 * Fichero aparte del de la conversión a propósito, por lo mismo
 * que aquel: dos controladores comparten el prefijo sin tocarse,
 * y así cada merge del día no es un conflicto.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';

import { AdminActual } from '../admin/admin-actual.decorator';
import { IpReal } from '../comun/ip-real';

import { ConvertirLoteDto } from './dto';
import { LoteDeLeads } from './lote.service';
import { MesaDeEntrada } from './mesa-de-entrada.service';

@Controller('admin/leads')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
export class MesaDeEntradaController {
  constructor(
    private readonly mesa: MesaDeEntrada,
    private readonly lote: LoteDeLeads,
  ) {}

  /**
   * Lo que llegó por los webhooks.
   *
   * `VER` y no `ESCRIBIR`: mirar el buzón es parte de atender
   * inscripciones, y convertir —que sí escribe— tiene su propia
   * ruta con su propio nivel.
   */
  @Get()
  @Requiere('inscripciones')
  listar(
    @AmbitoActual() ambito: Ambito,
    @Query('estado') estado?: string,
    @Query('convenioId') convenioId?: string,
    @Query('buscar') buscar?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.mesa.listar(
      {
        estado,
        convenioId,
        buscar,
        pagina: pagina ? Number(pagina) : undefined,
        limite: limite ? Number(limite) : undefined,
      },
      ambito.convenios,
    );
  }

  /**
   * Convierte varios de una vez.
   *
   * `ESCRIBIR` y no `VER`: crea fichas. Es la misma exigencia que
   * la conversion de uno, y tiene que serlo -- si el lote pidiera
   * menos, seria la puerta de servicio por la que se entra a hacer
   * cien veces lo que de una en una no se puede.
   *
   * 200 y no 201: puede que no se cree ninguna. Un 201 diria que
   * si, y el cuerpo diria que no.
   */
  /// Un solo segmento, y NO 'lote/convertir'.
  ///
  /// Aquella la capturaba `@Post(':id/convertir')` del otro
  /// controlador con `:id = 'lote'`: dos segmentos, mismo molde.
  /// El lote llegaba a la conversion de UNO y contestaba que le
  /// faltaba el canal. Depender del orden en que se registran los
  /// controladores lo arreglaria hoy y lo romperia en silencio el
  /// dia que alguien los reordene.
  @Post('convertir-lote')
  @Requiere('inscripciones', 'ESCRIBIR')
  @HttpCode(200)
  convertirLote(
    @Body() dto: ConvertirLoteDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.lote.convertir(dto.ids, dto.asesorId, admin, ambito.convenios, ip);
  }
}
