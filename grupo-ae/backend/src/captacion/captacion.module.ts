import { Module } from '@nestjs/common';

import { FormulariosModule } from '../formularios/formularios.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CaptacionController } from './captacion.controller';
import { CaptacionService } from './captacion.service';

/**
 * Sin `JwtModule` porque no hay guard: estas dos rutas son públicas
 * a propósito. Es la diferencia con `OportunidadesModule`, que lo
 * registra porque su controlador usa `AdminGuard`.
 *
 * Se importan los dos módulos que ya saben lo que aquí haría falta
 * repetir:
 *
 *  - `FormulariosModule` valida las respuestas contra las preguntas
 *    publicadas y arma la vista pública del formulario. Un segundo
 *    validador para el mismo formulario acabaría discrepando del
 *    primero, y la reserva y la captación aceptarían cosas
 *    distintas del mismo campo.
 *  - `OportunidadesModule` crea el negocio: ahí viven la numeración
 *    `OP-2026-0001`, la bitácora y las compuertas de la escalera.
 *    Crear la fila aquí a mano sería un segundo generador de código
 *    —dos altas simultáneas sacando el mismo número— y una entrada
 *    que se salta la escalera.
 *
 * `CaptacionModule` NO se registra en `app.module.ts` desde aquí: lo
 * hace Mauricio al final, para que cuatro módulos nuevos no se pisen
 * en el mismo archivo.
 */
@Module({
  imports: [PrismaModule, FormulariosModule, OportunidadesModule],
  controllers: [CaptacionController],
  providers: [CaptacionService],
  exports: [CaptacionService],
})
export class CaptacionModule {}
