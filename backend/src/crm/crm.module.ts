import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { SepController } from './sep/sep.controller';
import { SepService } from './sep/sep.service';

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [CrmController, SepController],
  providers: [CrmService, SepService],
  exports: [CrmService],
})
export class CrmModule {}
