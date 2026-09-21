import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';
import { CuentasController } from './cuentas.controller';
import { CuentasService } from './cuentas.service';

/**
 * Las cuentas: la ficha de cada empresa con su gente y sus negocios.
 *
 * `JwtModule` aquí por lo mismo que en los demás módulos del panel:
 * `AdminGuard` pide `JwtService` y Nest lo resuelve en el módulo del
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
  controllers: [CuentasController],
  providers: [CuentasService],
})
export class CuentasModule {}
