import { Module } from '@nestjs/common';

import { CompletarController, PreinscripcionController } from './preinscripcion.controller';
import { PreinscripcionService } from './preinscripcion.service';

// sin guard: estas rutas son publicas a proposito
@Module({
  controllers: [PreinscripcionController, CompletarController],
  providers: [PreinscripcionService],
  exports: [PreinscripcionService],
})
export class PreinscripcionModule {}
