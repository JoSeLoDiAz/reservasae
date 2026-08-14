import { Module } from '@nestjs/common';

import {
  PoliticasAdminController,
  PoliticasPublicoController,
} from './politicas.controller';
import { PoliticasService } from './politicas.service';

@Module({
  controllers: [PoliticasAdminController, PoliticasPublicoController],
  providers: [PoliticasService],
  exports: [PoliticasService],
})
export class PoliticasModule {}
