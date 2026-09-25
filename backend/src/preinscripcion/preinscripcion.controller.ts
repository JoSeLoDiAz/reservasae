import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IpReal } from '../comun/ip-real';

import {
  CrearPreinscripcionDto,
  DatosEmpresaDto,
  DatosPersonaDto,
} from './dto';
import { DirectorioService } from '../crm/directorio.service';
import { PreinscripcionService } from './preinscripcion.service';

/** Público: no lleva guard. Nadie ha entrado todavía. */
@Controller('preinscripcion')
export class PreinscripcionController {
  constructor(private readonly preinscripcion: PreinscripcionService) {}

  /// `?f=TallerBootcamp` es el formulario personalizado.
  ///
  /// Va como parametro y no en la ruta a proposito: la direccion
  /// publica sigue siendo la de siempre, y la palabra viaja tal
  /// cual la escribio quien reparte el enlace.
  @Get(':slug')
  catalogo(@Param('slug') slug: string, @Query('f') f?: string) {
    return this.preinscripcion.catalogo(slug, f);
  }

  @Post(':slug')
  registrar(
    @Param('slug') slug: string,
    @Body() dto: CrearPreinscripcionDto,
    @IpReal() ip: string,
  ) {
    return this.preinscripcion.registrar(slug, dto, ip);
  }
}

/** El enlace con el que cada quien completa su ficha. */
/// El banco de NIT, para que el formulario autocomplete.
/// Publico a proposito: son razones sociales y NIT, que ya
/// estan en el RUES y en cualquier factura. Solo consulta
/// exacta, sin listar el directorio entero.
@Controller('directorio')
export class DirectorioPublicoController {
  constructor(private readonly directorio: DirectorioService) {}

  @Get('nit/:nit')
  buscar(@Param('nit') nit: string) {
    return this.directorio.buscar(nit);
  }
}

@Controller('completar')
export class CompletarController {
  constructor(private readonly preinscripcion: PreinscripcionService) {}

  @Get(':token')
  abrir(@Param('token') token: string) {
    return this.preinscripcion.abrir(token);
  }

  @Patch(':token')
  guardarPersona(
    @Param('token') token: string,
    @Body() dto: DatosPersonaDto,
    @IpReal() ip: string,
  ) {
    return this.preinscripcion.guardarPersona(token, dto, ip);
  }

  @Patch(':token/empresa')
  guardarEmpresa(@Param('token') token: string, @Body() dto: DatosEmpresaDto) {
    return this.preinscripcion.guardarEmpresa(token, dto);
  }

  @Post(':token/cerrar')
  cerrar(@Param('token') token: string) {
    return this.preinscripcion.cerrar(token);
  }
}
