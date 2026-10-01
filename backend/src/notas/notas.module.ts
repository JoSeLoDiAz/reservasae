import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditoriaService } from '../comun/auditoria.service';
import { ConfiguracionDeNotasController } from './configuracion-de-notas.controller';
import { ConfiguracionDeNotasService } from './configuracion-de-notas.service';

/**
 * El catálogo de clasificación de las notas.
 *
 * Se EXPORTA el servicio porque lo usan los dos módulos que crean
 * notas —`CrmModule` para la ficha y `LeadsModule` para el lead— y
 * la comprobación de «esta subcategoría es de esta categoría» tiene
 * que ser literalmente la misma en los dos. Copiarla sería la forma
 * de que un día dijeran cosas distintas.
 */
@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [ConfiguracionDeNotasController],
  providers: [ConfiguracionDeNotasService, AuditoriaService],
  exports: [ConfiguracionDeNotasService],
})
export class NotasModule {}
