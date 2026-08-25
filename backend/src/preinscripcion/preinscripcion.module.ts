import { Module } from '@nestjs/common';

import { DirectorioService } from '../crm/directorio.service';
import {
  CompletarController,
  DirectorioPublicoController,
  PreinscripcionController,
} from './preinscripcion.controller';
import { PreinscripcionService } from './preinscripcion.service';

// sin guard: estas rutas son publicas a proposito
@Module({
  controllers: [PreinscripcionController, CompletarController, DirectorioPublicoController],
  providers: [PreinscripcionService, DirectorioService],
  exports: [PreinscripcionService],
})
export class PreinscripcionModule {}
