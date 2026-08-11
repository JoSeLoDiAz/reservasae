import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AdminController, MarcaPublicaController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    JwtModule.register({
      // sin defecto: quemarlo abriria cualquier instancia
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AdminController, MarcaPublicaController],
  providers: [AdminService],
})
export class AdminModule {}
