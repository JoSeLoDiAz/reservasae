import { Module } from '@nestjs/common';

import { FormulariosModule } from '../formularios/formularios.module';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

@Module({
  // para validar las respuestas
  imports: [FormulariosModule],
  controllers: [ReservasController],
  providers: [ReservasService],
})
export class ReservasModule {}
