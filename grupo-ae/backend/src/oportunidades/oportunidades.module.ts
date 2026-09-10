import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesService } from './oportunidades.service';

/**
 * El JwtModule se registra aquí y no se hereda.
 *
 * `AdminGuard` pide `JwtService`, y en Nest un guard se resuelve en
 * el módulo que declara el controlador que lo usa — no en el que lo
 * definió. Sin esta línea el grafo no arma, y el error que da
 * («JwtService no está disponible en OportunidadesModule») no dice
 * que falte esto, sino que falta en un sitio raro.
 *
 * Es exactamente lo que hace `CrmModule` con la misma clave y la
 * misma vigencia: las dos sesiones son la misma.
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
    PrismaModule,
  ],
  controllers: [OportunidadesController],
  providers: [OportunidadesService],
  exports: [OportunidadesService],
})
export class OportunidadesModule {}
