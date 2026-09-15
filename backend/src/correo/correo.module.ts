import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import {
  CampanasController,
  CampanasPublicoController,
} from './campanas/campanas.controller';
import { CampanasService } from './campanas/campanas.service';
import { CampanasWorker } from './campanas/campanas.worker';
import { AdminModule } from '../admin/admin.module';
import { EnlaceDeCompletadoModule } from '../preinscripcion/enlace-de-completado';
import { MarcaDeCarta } from './carta/marca-de-la-carta';
import { ColaDeCorreo } from './automaticos/cola-de-correo';
import { CorreoAutomaticoService } from './automaticos/correo-automatico.service';
import { CorreoAutomaticoWorker } from './automaticos/correo-automatico.worker';
import { BienvenidaService } from './bienvenida.service';
import { CorreoController } from './correo.controller';
import { CorreoService } from './correo.service';
import {
  PlantillasCorreoController,
  PlantillasCorreoPublicoController,
} from './plantillas/plantillas-correo.controller';
import { PlantillasCorreoService } from './plantillas/plantillas-correo.service';

/// Global: los avisos de cupos, el enlace al interesado y lo
/// que venga después van a querer mandar correo, y no tiene
/// sentido que cada módulo importe el mismo.
@Global()
@Module({
  // AdminGuard necesita JwtService
  imports: [
    /// Por `AdminService.obtenerMarcaDeGremio`: los logos y los
    /// colores del correo salen de donde salen los del panel.
    AdminModule,
    /// Para poder MANDAR el enlace de completado sin emitir
    /// uno nuevo. Es solo la fila, no el modulo de
    /// preinscripcion --que importa a este y haria un circulo.
    EnlaceDeCompletadoModule,
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    CorreoController,
    PlantillasCorreoController,
    PlantillasCorreoPublicoController,
    CampanasController,
    CampanasPublicoController,
  ],
  providers: [
    BienvenidaService,
    ColaDeCorreo,
    MarcaDeCarta,
    CorreoAutomaticoService,
    CorreoAutomaticoWorker,
    CorreoService,
    PlantillasCorreoService,
    CampanasService,
    CampanasWorker,
  ],
  /// `PlantillasCorreoService` sale del módulo porque la ficha
  /// del lead —que vive en el CRM— es donde se manda el
  /// correo. Escribir la plantilla es configuración; usarla
  /// es trabajo del asesor, y cada cosa en su pantalla.
  exports: [
    BienvenidaService,
    ColaDeCorreo,
    MarcaDeCarta,
    CorreoAutomaticoService,
    CorreoService,
    PlantillasCorreoService,
  ],
})
export class CorreoModule {}
