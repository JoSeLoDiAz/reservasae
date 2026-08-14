import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
