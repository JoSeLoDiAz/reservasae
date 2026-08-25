import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditoriaService } from '../comun/auditoria.service';
import { InstitucionesController } from './instituciones.controller';
import { InstitucionesService } from './instituciones.service';

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [InstitucionesController],
  providers: [InstitucionesService, AuditoriaService],
  exports: [InstitucionesService],
})
export class InstitucionesModule {}
