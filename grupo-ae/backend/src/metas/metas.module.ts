import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';
import { InformesController } from './informes.controller';
import { InformesService } from './informes.service';
import { MetasController } from './metas.controller';
import { MetasService } from './metas.service';

/**
 * Metas e informes viven en el mismo módulo porque son la misma
 * pregunta partida en dos: la meta es el número que hay que
 * alcanzar y el informe es dónde va. Separarlos obligaría a que el
 * de informes importara el de metas para nada más que leer una
 * tabla.
 *
 * El `JwtModule` se registra aquí y no se hereda: `AdminGuard` pide
 * `JwtService`, y en Nest un guard se resuelve en el módulo que
 * declara el controlador que lo usa, no en el que lo definió. Sin
 * esta línea el grafo no arma y el error apunta a un sitio raro.
 * Misma clave y misma vigencia que en `OportunidadesModule` y
 * `CrmModule`: las tres sesiones son la misma.
 *
 * Este módulo NO se registra en `app.module.ts` desde aquí: lo hace
 * Mauricio al final, para que cuatro agentes no se pisen ese
 * archivo.
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
    PrismaModule,
  ],
  controllers: [MetasController, InformesController],
  providers: [MetasService, InformesService],
  exports: [MetasService, InformesService],
})
export class MetasModule {}
