import { Module } from '@nestjs/common';

import { FormulariosModule } from '../formularios/formularios.module';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

@Module({
  // Para validar y guardar las respuestas del formulario al reservar.
  imports: [FormulariosModule],
  controllers: [ReservasController],
  providers: [ReservasService],
})
export class ReservasModule {}
