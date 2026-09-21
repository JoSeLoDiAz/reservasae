import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { LeadsModule } from './leads/leads.module';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogoModule } from './catalogo/catalogo.module';
import { CrmModule } from './crm/crm.module';
import { OportunidadesModule } from './oportunidades/oportunidades.module';
import { GestionesModule } from './gestiones/gestiones.module';
import { MetasModule } from './metas/metas.module';
import { CuentasModule } from './cuentas/cuentas.module';
import { ParametrosModule } from './parametros/parametros.module';
import { ServiciosModule } from './servicios/servicios.module';
import { CaptacionModule } from './captacion/captacion.module';
import { ThrottlerIpGuard } from './comun/throttler-ip.guard';
import { FormulariosModule } from './formularios/formularios.module';
import { PoliticasModule } from './politicas/politicas.module';
import { InstitucionesModule } from './instituciones/instituciones.module';
import { PlantillasModule } from './plantillas/plantillas.module';
import { CorreoModule } from './correo/correo.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReservasModule } from './reservas/reservas.module';
import { CronogramaModule } from './cronograma/cronograma.module';
import { PreinscripcionModule } from './preinscripcion/preinscripcion.module';
import { TablerosModule } from './tableros/tableros.module';

@Module({
  imports: [
    LeadsModule,
    // sin esto backend/.env no se lee fuera de Docker
    ConfigModule.forRoot({ isGlobal: true }),
    // límite general de peticiones
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    CorreoModule,
    PlantillasModule,
    CatalogoModule,
    FormulariosModule,
    ReservasModule,
    AdminModule,
    CronogramaModule,
    PreinscripcionModule,
    TablerosModule,
    PoliticasModule,
    InstitucionesModule,
    CrmModule,
    OportunidadesModule,
    // El embudo entero: la gestion que lo empuja y la meta contra la
    // que se mide. Cada uno registra su propio JwtModule porque el
    // AdminGuard se resuelve en el modulo del controlador.
    GestionesModule,
    MetasModule,
    CuentasModule,
    ParametrosModule,
    ServiciosModule,
    // Publico a proposito: su controlador no lleva guard, asi que no
    // necesita JwtModule.
    CaptacionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // cuenta por la IP real
    { provide: APP_GUARD, useClass: ThrottlerIpGuard },
  ],
})
export class AppModule {}
