import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { TablerosController } from './tableros.controller';
import { TablerosService } from './tableros.service';

@Module({
  // AdminGuard necesita JwtService para verificar la cookie de sesión.
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [TablerosController],
  providers: [TablerosService],
})
export class TablerosModule {}
