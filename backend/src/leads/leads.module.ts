/** El webhook de leads. */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ColaRuiModule } from '../crm/rui/cola-rui';
import { PrismaModule } from '../prisma/prisma.module';

import { CrmModule } from '../crm/crm.module';

import { ConversionController } from './conversion.controller';
import { MesaDeEntradaController } from './mesa-de-entrada.controller';
import { AuditoriaService } from '../comun/auditoria.service';
import { AQuienSeParece } from './a-quien-se-parece';
import { GestionDelLead } from './gestion-del-lead.service';
import { Comparativo } from './comparativo.service';
import { MesaDeEntrada } from './mesa-de-entrada.service';
import { LoteDeLeads } from './lote.service';
import { ConversionDeLeads } from './conversion.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { MetaPruebasController } from './meta-pruebas.controller';

@Module({
  imports: [
    PrismaModule,
    ColaRuiModule,
    /// La conversion crea la ficha con `crm.crear`, la misma
    /// puerta que usa el asesor desde el panel.
    CrmModule,
    /// El banco de pruebas SÍ lleva sesión de admin, y el
    /// `AdminGuard` necesita el JwtService. El webhook en sí
    /// no: ese se autentica con una llave o con la firma de
    /// Meta, que es justo por lo que vive aparte del panel.
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    LeadsController,
    MetaPruebasController,
    ConversionController,
    MesaDeEntradaController,
  ],
  providers: [
    LeadsService,
    ConversionDeLeads,
    MesaDeEntrada,
    LoteDeLeads,
    Comparativo,
    GestionDelLead,
    AQuienSeParece,
    /// Igual que en CrmModule: se provee aqui en vez de importar
    /// un modulo, que es como ya lo hace el resto.
    AuditoriaService,
  ],
})
export class LeadsModule {}
