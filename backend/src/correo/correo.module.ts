import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CorreoController } from './correo.controller';
import { CorreoService } from './correo.service';
import { PlantillasCorreoController } from './plantillas/plantillas-correo.controller';
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
  controllers: [CorreoController, PlantillasCorreoController],
  providers: [CorreoService, PlantillasCorreoService],
  /// `PlantillasCorreoService` sale del módulo porque la ficha
  /// del lead —que vive en el CRM— es donde se manda el
  /// correo. Escribir la plantilla es configuración; usarla
  /// es trabajo del asesor, y cada cosa en su pantalla.
  exports: [CorreoService, PlantillasCorreoService],
})
export class CorreoModule {}
