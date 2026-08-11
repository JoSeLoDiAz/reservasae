import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AdminController, MarcaPublicaController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    JwtModule.register({
      // secreto de firma de sesión
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AdminController, MarcaPublicaController],
  providers: [AdminService],
})
export class AdminModule {}
