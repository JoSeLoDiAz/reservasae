/** El webhook de leads. */

import { Module } from '@nestjs/common';

import { ColaRuiModule } from '../crm/rui/cola-rui';
import { PrismaModule } from '../prisma/prisma.module';

import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule, ColaRuiModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
