import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import {
  CampanasController,
  CampanasPublicoController,
} from './campanas/campanas.controller';
import { CampanasService } from './campanas/campanas.service';
import { CampanasWorker } from './campanas/campanas.worker';
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
    CorreoService,
    PlantillasCorreoService,
    CampanasService,
    CampanasWorker,
  ],
  /// `PlantillasCorreoService` sale del módulo porque la ficha
  /// del lead —que vive en el CRM— es donde se manda el
  /// correo. Escribir la plantilla es configuración; usarla
  /// es trabajo del asesor, y cada cosa en su pantalla.
  exports: [BienvenidaService, CorreoService, PlantillasCorreoService],
})
export class CorreoModule {}
