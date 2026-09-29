import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditoriaService } from '../comun/auditoria.service';
import { TablerosController } from './tableros.controller';
import { TablerosService } from './tableros.service';

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [TablerosController],
  /// `AuditoriaService` porque corregir el NIT de una organizacion
  /// arrastra sus leads y sus reservas detras, y eso tiene que quedar
  /// escrito: quien lo hizo y de que a que. Se declara aqui igual que
  /// en `CrmModule`.
  providers: [TablerosService, AuditoriaService],
})
export class TablerosModule {}
