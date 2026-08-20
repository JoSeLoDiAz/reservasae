import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CronogramaController } from './cronograma.controller';
import { CronogramaService } from './cronograma.service';

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [CronogramaController],
  providers: [CronogramaService],
})
export class CronogramaModule {}
