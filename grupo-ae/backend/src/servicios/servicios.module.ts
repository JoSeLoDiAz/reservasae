import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';
import { ServiciosController } from './servicios.controller';
import { ServiciosService } from './servicios.service';

/**
 * El portafolio: lo que Grupo AE oferta al público.
 *
 * `JwtModule` registrado aquí por la misma razón que en `MetasModule`:
 * `AdminGuard` pide `JwtService` y en Nest se resuelve en el módulo del
 * controlador que lo usa.
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
    PrismaModule,
  ],
  controllers: [ServiciosController],
  providers: [ServiciosService],
  exports: [ServiciosService],
})
export class ServiciosModule {}
