import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CorreoController } from './correo.controller';
import { CorreoService } from './correo.service';

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
  controllers: [CorreoController],
  providers: [CorreoService],
  exports: [CorreoService],
})
export class CorreoModule {}
