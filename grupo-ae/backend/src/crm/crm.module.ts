import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditoriaService } from '../comun/auditoria.service';
import { InstitucionesModule } from '../instituciones/instituciones.module';
import { PreinscripcionModule } from '../preinscripcion/preinscripcion.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { Matricula } from './matricula';
import { PanelDeCupos } from './panel-de-cupos';
import { VigiaDeCupos } from './vigia-de-cupos';
import { AsignarGrupo } from './asignar-grupo.service';
import { DirectorioService } from './directorio.service';
import { ColaRuiModule } from './rui/cola-rui';
import {
  PROVEEDOR_RUI,
  ProveedorRuiLocal,
  ruiConectado,
} from './rui/proveedor';
import { ProveedorRuiVentanilla } from './rui/proveedor-ventanilla';
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
    ColaRuiModule,
    // el cambio a INSCRITO dispara la validacion de la empresa
    InstitucionesModule,
  ],
  controllers: [CrmController, SepController],
  providers: [
    CrmService,
    Matricula,
    PanelDeCupos,
    VigiaDeCupos,
    SepService,
    DirectorioService,
    AsignarGrupo,
    RuiService,
    RuiWorker,
    AuditoriaService,
    // se cambia por el real sin tocar la cola
    {
      // con RUI_PROVEEDOR=VENTANILLA sale al portal del DNP;
      // sin eso queda el simulador, que se identifica como tal
      provide: PROVEEDOR_RUI,
      useClass: ruiConectado() ? ProveedorRuiVentanilla : ProveedorRuiLocal,
    },
  ],
  exports: [CrmService, RuiService, DirectorioService, Matricula, PanelDeCupos, VigiaDeCupos],
})
export class CrmModule {}
