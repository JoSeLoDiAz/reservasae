import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogoModule } from './catalogo/catalogo.module';
import { ThrottlerIpGuard } from './comun/throttler-ip.guard';
import { FormulariosModule } from './formularios/formularios.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReservasModule } from './reservas/reservas.module';
import { TablerosModule } from './tableros/tableros.module';

@Module({
  imports: [
    // Sin esto backend/.env no se lee al correr fuera de Docker: PORT,
    // DATABASE_URL y demas quedaban definidas en el archivo pero muertas.
    // En Docker las variables llegan por `env_file` y dotenv no pisa lo que
    // ya existe en process.env, asi que produccion no cambia.
    ConfigModule.forRoot({ isGlobal: true }),
    // Límite general. Cada endpoint sensible aprieta el suyo con @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    CatalogoModule,
    FormulariosModule,
    ReservasModule,
    AdminModule,
    TablerosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // El guard cuenta por IP real (CF-Connecting-IP), no por la del socket.
    { provide: APP_GUARD, useClass: ThrottlerIpGuard },
  ],
})
export class AppModule {}
