import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

/// @Global porque avisan desde tres sitios que no se importan
/// entre sí --la puerta pública, el CRM y las integraciones--, y
/// un módulo más en cada `imports` es un sitio más donde
/// olvidarse.
@Global()
@Module({
  // AdminGuard necesita JwtService, igual que en los demas
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
