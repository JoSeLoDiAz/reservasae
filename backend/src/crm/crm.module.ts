import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditoriaService } from '../comun/auditoria.service';
import { PreinscripcionModule } from '../preinscripcion/preinscripcion.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { DirectorioService } from './directorio.service';
import { PROVEEDOR_RUI, ProveedorRuiLocal } from './rui/proveedor';
import { RuiService } from './rui/rui.service';
import { RuiWorker } from './rui/rui.worker';
import { SepController } from './sep/sep.controller';
import { SepService } from './sep/sep.service';

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
    // el asesor emite el enlace desde la ficha
    PreinscripcionModule,
  ],
  controllers: [CrmController, SepController],
  providers: [
    CrmService,
    SepService,
    DirectorioService,
    RuiService,
    RuiWorker,
    AuditoriaService,
    // se cambia por el real sin tocar la cola
    { provide: PROVEEDOR_RUI, useClass: ProveedorRuiLocal },
  ],
  exports: [CrmService, RuiService, DirectorioService],
})
export class CrmModule {}
