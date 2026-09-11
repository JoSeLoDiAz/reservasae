import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';
import { GestionesController } from './gestiones.controller';
import { GestionesService } from './gestiones.service';

/**
 * El `JwtModule` se registra aquí y no se hereda.
 *
 * `AdminGuard` pide `JwtService`, y en Nest un guard se resuelve
 * en el módulo que declara el controlador que lo usa, no en el
 * que lo definió. Sin esta línea el grafo no arma y el error
 * («JwtService no está disponible en GestionesModule») apunta a
 * un sitio raro. Es lo mismo que hacen `OportunidadesModule` y
 * `CrmModule`, con la misma clave y la misma vigencia: las tres
 * sesiones son la misma.
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
    PrismaModule,
  ],
  controllers: [GestionesController],
  providers: [GestionesService],
  exports: [GestionesService],
})
export class GestionesModule {}
