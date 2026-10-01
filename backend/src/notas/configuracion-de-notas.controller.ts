/** «Configuración notas»: el catálogo que ofrecen los desplegables. */

/**
 * DOS NIVELES DE PERMISO EN EL MISMO CONTROLADOR, y es la razón de
 * que no sea uno solo:
 *
 *  - Leer el catálogo lo tiene que poder hacer quien ANOTA, o sea el
 *    asesor, que no configura nada. Exige `inscripciones` con VER,
 *    que es menos de lo que ya hace falta para escribir la nota.
 *  - Tocarlo exige `configuracion` con ESCRIBIR, que es lo que el
 *    encargo pidió. Un asesor no se inventa categorías: si pudiera,
 *    el catálogo acabaría con veinte formas de decir «no contestó»
 *    y volveríamos al texto libre.
 *
 * El `@Requiere` va POR MÉTODO y no en la clase por eso mismo.
 */

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

import type { Admin } from '../../generated/prisma';
import { AdminActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere } from '../admin/admin.guard';
import { IpReal } from '../comun/ip-real';
import { ConfiguracionDeNotasService } from './configuracion-de-notas.service';
import {
  ActualizarCategoriaDto,
  ActualizarSubcategoriaDto,
  CrearCategoriaDto,
  CrearSubcategoriaDto,
} from './dto';

@Controller('admin/configuracion-notas')
@UseGuards(AdminGuard)
export class ConfiguracionDeNotasController {
  constructor(private readonly catalogo: ConfiguracionDeNotasService) {}

  /**
   * El catálogo. Con `?visibles=1`, solo lo que se puede ofrecer.
   *
   * Es la misma ruta para las dos pantallas y a propósito: dos rutas
   * distintas serían dos ideas de qué es el catálogo, y la del
   * asesor acabaría ofreciendo algo que la de configuración ya
   * ocultó.
   */
  @Get()
  @Requiere('inscripciones', 'VER')
  listar(@Query('visibles') visibles?: string) {
    return this.catalogo.listar(visibles === '1');
  }

  @Post('categorias')
  @Requiere('configuracion', 'ESCRIBIR')
  crearCategoria(
    @Body() dto: CrearCategoriaDto,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.catalogo.crearCategoria(dto, admin, ip);
  }

  /**
   * Renombrar, reordenar, ocultar o volver a ofrecer.
   *
   * NO HAY `@Delete`, y es la decisión, no un olvido: hay notas
   * viejas que nombran esta fila, y sin la fila esas notas dicen
   * «categoría» sin que nadie pueda leer cuál. Ocultar es lo que
   * hace lo que la gente quiere cuando pide borrar: que deje de
   * ofrecerse.
   */
  @Patch('categorias/:id')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizarCategoria(
    @Param('id') id: string,
    @Body() dto: ActualizarCategoriaDto,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.catalogo.actualizarCategoria(id, dto, admin, ip);
  }

  @Post('categorias/:id/subcategorias')
  @Requiere('configuracion', 'ESCRIBIR')
  crearSubcategoria(
    @Param('id') id: string,
    @Body() dto: CrearSubcategoriaDto,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.catalogo.crearSubcategoria(id, dto, admin, ip);
  }

  @Patch('subcategorias/:id')
  @Requiere('configuracion', 'ESCRIBIR')
  actualizarSubcategoria(
    @Param('id') id: string,
    @Body() dto: ActualizarSubcategoriaDto,
    @AdminActual() admin: Admin,
    @IpReal() ip: string,
  ) {
    return this.catalogo.actualizarSubcategoria(id, dto, admin, ip);
  }
}
