import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { LucidController } from './lucid.controller';
import { LucidService } from './lucid.service';
import { OlvidadorDeConversaciones } from './olvidador';
import { proveedoresConLlave } from '../integraciones/proveedores';

/// PrismaModule es @Global: no hay que importarlo.
@Module({
  controllers: [LucidController],
  providers: [LucidService, OlvidadorDeConversaciones],
})
export class LucidModule implements OnModuleInit {
  private readonly log = new Logger('Lucid');

  /// El precio de NO tumbar el arranque se paga aqui. Sin este
  /// aviso, una sede con el .env incompleto rechazaria las
  /// notas en silencio -- y las notas no tienen contador
  /// natural: nadie sabe cuantas deberia haber hoy.
  onModuleInit(): void {
    const quienes = proveedoresConLlave();
    if (quienes.length) {
      this.log.log(
        `Encendido para: ${quienes.join(', ')}. ` +
          'Las conversaciones entran y quedan como nota.',
      );
      return;
    }
    this.log.warn(
      'APAGADO: no hay ninguna llave de integración (LUCID_WEBHOOK_SECRET o ' +
        'NUA_WEBHOOK_SECRET, mínimo 32 caracteres). La puerta contesta 401 a ' +
        'todo y las conversaciones NO quedan en ningún lead.',
    );
  }
}
