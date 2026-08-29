/** El webhook de leads. */

import { Module } from '@nestjs/common';

import { ColaRuiModule } from '../crm/rui/cola-rui';
import { PrismaModule } from '../prisma/prisma.module';

import { CrmModule } from '../crm/crm.module';

import { ConversionController } from './conversion.controller';
import { ConversionDeLeads } from './conversion.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule, ColaRuiModule, CrmModule],
  controllers: [LeadsController, ConversionController],
  providers: [LeadsService, ConversionDeLeads],
})
export class LeadsModule {}
