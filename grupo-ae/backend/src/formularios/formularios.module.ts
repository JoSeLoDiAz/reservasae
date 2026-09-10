import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import {
  FormulariosAdminController,
  FormulariosPublicoController,
} from './formularios.controller';
import { FormulariosService } from './formularios.service';

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [FormulariosAdminController, FormulariosPublicoController],
  providers: [FormulariosService],
  // lo usa ReservasService
  exports: [FormulariosService],
})
export class FormulariosModule {}
