/** El webhook de leads. */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ColaRuiModule } from '../crm/rui/cola-rui';
import { PrismaModule } from '../prisma/prisma.module';

import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { MetaPruebasController } from './meta-pruebas.controller';

@Module({
  imports: [
    PrismaModule,
    ColaRuiModule,
    /// El banco de pruebas SÍ lleva sesión de admin, y el
    /// `AdminGuard` necesita el JwtService. El webhook en sí
    /// no: ese se autentica con una llave o con la firma de
    /// Meta, que es justo por lo que vive aparte del panel.
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [LeadsController, MetaPruebasController],
  providers: [LeadsService],
})
export class LeadsModule {}
