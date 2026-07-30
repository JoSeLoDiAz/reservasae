import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AdminController, MarcaPublicaController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    JwtModule.register({
      // Se exige por variable de entorno y no hay valor por defecto: un
      // secreto quemado en el código deja abierta cualquier instancia, y uno
      // generado al arrancar tumbaria todas las sesiones en cada despliegue.
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AdminController, MarcaPublicaController],
  providers: [AdminService],
})
export class AdminModule {}
