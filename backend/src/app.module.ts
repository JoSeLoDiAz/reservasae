import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogoModule } from './catalogo/catalogo.module';
import { CrmModule } from './crm/crm.module';
import { ThrottlerIpGuard } from './comun/throttler-ip.guard';
import { FormulariosModule } from './formularios/formularios.module';
import { PoliticasModule } from './politicas/politicas.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReservasModule } from './reservas/reservas.module';
import { CronogramaModule } from './cronograma/cronograma.module';
import { PreinscripcionModule } from './preinscripcion/preinscripcion.module';
import { TablerosModule } from './tableros/tableros.module';

@Module({
  imports: [
    // sin esto backend/.env no se lee fuera de Docker
    ConfigModule.forRoot({ isGlobal: true }),
    // límite general de peticiones
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    CatalogoModule,
    FormulariosModule,
    ReservasModule,
    AdminModule,
    CronogramaModule,
    PreinscripcionModule,
    TablerosModule,
    PoliticasModule,
    CrmModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // cuenta por la IP real
    { provide: APP_GUARD, useClass: ThrottlerIpGuard },
  ],
})
export class AppModule {}
