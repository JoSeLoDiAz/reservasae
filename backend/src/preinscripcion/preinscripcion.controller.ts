import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CrearPreinscripcionDto, DatosEmpresaDto, DatosPersonaDto } from './dto';
import { PreinscripcionService } from './preinscripcion.service';

/** Público: no lleva guard. Nadie ha entrado todavía. */
@Controller('preinscripcion')
export class PreinscripcionController {
  constructor(private readonly preinscripcion: PreinscripcionService) {}

  @Get(':slug')
  catalogo(@Param('slug') slug: string) {
    return this.preinscripcion.catalogo(slug);
  }

  @Post(':slug')
  registrar(@Param('slug') slug: string, @Body() dto: CrearPreinscripcionDto) {
    return this.preinscripcion.registrar(slug, dto);
  }
}

/** El enlace con el que cada quien completa su ficha. */
@Controller('completar')
export class CompletarController {
  constructor(private readonly preinscripcion: PreinscripcionService) {}

  @Get(':token')
  abrir(@Param('token') token: string) {
    return this.preinscripcion.abrir(token);
  }

  @Patch(':token')
  guardarPersona(@Param('token') token: string, @Body() dto: DatosPersonaDto) {
    return this.preinscripcion.guardarPersona(token, dto);
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
