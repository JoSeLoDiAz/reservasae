import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import {
  FormulariosAdminController,
  FormulariosPublicoController,
} from './formularios.controller';
import { FormulariosService } from './formularios.service';

@Module({
  // AdminGuard necesita JwtService para verificar la cookie de sesión.
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [FormulariosAdminController, FormulariosPublicoController],
  providers: [FormulariosService],
  // Lo usa ReservasService para validar y guardar las respuestas al reservar.
  exports: [FormulariosService],
})
export class FormulariosModule {}
