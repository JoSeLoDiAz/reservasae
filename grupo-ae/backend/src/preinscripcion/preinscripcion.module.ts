import { Module } from '@nestjs/common';

import { AuditoriaService } from '../comun/auditoria.service';
import { CorreoModule } from '../correo/correo.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { DirectorioService } from '../crm/directorio.service';
import { ColaRuiModule } from '../crm/rui/cola-rui';
import {
  CompletarController,
  DirectorioPublicoController,
  PreinscripcionController,
} from './preinscripcion.controller';
import { PreinscripcionService } from './preinscripcion.service';

// sin guard: estas rutas son publicas a proposito
@Module({
  // solo la cola del RUI, no el CRM entero: el CRM importa
  // a este modulo y el circulo no dejaria arrancar a Nest
  /// OportunidadesModule: la preinscripción abre el negocio en el
  /// embudo de personas, para que el lead se vea en el panel.
  imports: [ColaRuiModule, CorreoModule, OportunidadesModule],
  controllers: [
    PreinscripcionController,
    CompletarController,
    DirectorioPublicoController,
  ],
  providers: [PreinscripcionService, DirectorioService, AuditoriaService],
  exports: [PreinscripcionService],
})
export class PreinscripcionModule {}
