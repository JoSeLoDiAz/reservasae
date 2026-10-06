import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';

import { LeadsModule } from './leads/leads.module';
import { EmbudoModule } from './embudo/embudo.module';
import { IntegracionesModule } from './integraciones/integraciones.module';
import { LucidModule } from './lucid/lucid.module';
import { NotasModule } from './notas/notas.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogoModule } from './catalogo/catalogo.module';
import { CrmModule } from './crm/crm.module';
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
    EmbudoModule,
    IntegracionesModule,
    LucidModule,
    NotificacionesModule,
    NotasModule,
    // sin esto backend/.env no se lee fuera de Docker
    ConfigModule.forRoot({ isGlobal: true }),
    // límite general de peticiones
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    /**
     * PARA QUE EL LÍMITE SEPA DE QUIÉN ES CADA PETICIÓN.
     *
     * `ThrottlerIpGuard` cuenta por sesión cuando hay una ---en una
     * oficina, contar por IP es un cubo compartido entre todas--- y
     * para eso tiene que poder verificar la firma de la cookie.
     *
     * El MISMO secreto que firma la sesión en `AdminModule`: con otro,
     * la verificación fallaría siempre y todo el panel volvería a
     * contarse por IP sin que nada lo dijera.
     */
    JwtModule.register({ secret: process.env.ADMIN_JWT_SECRET }),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // cuenta por la IP real
    { provide: APP_GUARD, useClass: ThrottlerIpGuard },
  ],
})
export class AppModule {}
