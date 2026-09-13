import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { LucyController } from './lucy.controller';
import { LucyService } from './lucy.service';
import { hayLlaveDeLucy } from './secreto-de-lucy';

/// PrismaModule es @Global: no hay que importarlo.
@Module({
  controllers: [LucyController],
  providers: [LucyService],
})
export class LucyModule implements OnModuleInit {
  private readonly log = new Logger('Lucy');

  /// El precio de NO tumbar el arranque se paga aqui. Sin este
  /// aviso, una sede con el .env incompleto rechazaria las
  /// notas en silencio -- y las notas no tienen contador
  /// natural: nadie sabe cuantas deberia haber hoy.
  onModuleInit(): void {
    if (hayLlaveDeLucy()) {
      this.log.log('Encendido. Las conversaciones entran y quedan como nota.');
      return;
    }
    this.log.warn(
      'APAGADO: falta LUCY_WEBHOOK_SECRET (mínimo 32 caracteres). ' +
        'La puerta contesta 401 a todo y las conversaciones NO quedan en ninguna ficha.',
    );
  }
}
