import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import {
  PoliticasAdminController,
  PoliticasPublicoController,
} from './politicas.controller';
import { PoliticasService } from './politicas.service';

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [PoliticasAdminController, PoliticasPublicoController],
  providers: [PoliticasService],
  exports: [PoliticasService],
})
export class PoliticasModule {}
