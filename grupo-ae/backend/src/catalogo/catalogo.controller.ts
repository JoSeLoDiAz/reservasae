import { Controller, Get, Param } from '@nestjs/common';

import { CatalogoService } from './catalogo.service';

@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get()
  convenios() {
    return this.catalogo.convenios();
  }

  @Get(':slug')
  porConvenio(@Param('slug') slug: string) {
    return this.catalogo.porConvenio(slug);
  }
}
