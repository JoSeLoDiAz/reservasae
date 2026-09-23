import { Module } from '@nestjs/common';

import { IntegracionesController } from './integraciones.controller';
import { IntegracionesService } from './integraciones.service';

/// PrismaModule es @Global: no hay que importarlo.
@Module({
  controllers: [IntegracionesController],
  providers: [IntegracionesService],
})
export class IntegracionesModule {}
