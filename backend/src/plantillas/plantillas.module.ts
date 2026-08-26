import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditoriaService } from '../comun/auditoria.service';
import { PlantillasController } from './plantillas.controller';
import { PlantillasService } from './plantillas.service';

// AdminGuard necesita JwtService
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [PlantillasController],
  providers: [PlantillasService, AuditoriaService],
  exports: [PlantillasService],
})
export class PlantillasModule {}
