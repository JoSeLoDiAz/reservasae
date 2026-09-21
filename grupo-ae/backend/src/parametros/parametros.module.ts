import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';
import { ParametrosController } from './parametros.controller';
import { ParametrosService } from './parametros.service';

/**
 * Los parámetros con los que se arma el tablero.
 *
 * Se EXPORTA porque `OportunidadesModule` los lee en cada cálculo: el
 * pronóstico, el reloj de respuesta y las señales salen de aquí.
 *
 * `JwtModule` registrado aquí por lo mismo que en `ServiciosModule`:
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
  controllers: [ParametrosController],
  providers: [ParametrosService],
  exports: [ParametrosService],
})
export class ParametrosModule {}
