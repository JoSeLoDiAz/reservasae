import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EmbudoAdminController } from './embudo-admin.controller';
import { EmbudoController } from './embudo.controller';
import { EmbudoService } from './embudo.service';
import { OlvidadorDePasos } from './olvidador';

/// PrismaModule es @Global: no hay que importarlo.
@Module({
  /// El guard del panel lee la sesion, y para eso necesita el
  /// JWT. Mismo registro que el resto de modulos con panel.
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [EmbudoController, EmbudoAdminController],
  providers: [EmbudoService, OlvidadorDePasos],
  exports: [EmbudoService],
})
export class EmbudoModule {}
