/** La lista de la mesa de entrada. */

/**
 * Fichero aparte del de la conversión a propósito, por lo mismo
 * que aquel: dos controladores comparten el prefijo sin tocarse,
 * y así cada merge del día no es un conflicto.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { RolAdmin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';

import { MesaDeEntrada } from './mesa-de-entrada.service';

@Controller('admin/leads')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
export class MesaDeEntradaController {
  constructor(private readonly mesa: MesaDeEntrada) {}

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
}
