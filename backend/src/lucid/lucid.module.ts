import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { BandejaController } from './bandeja.controller';
import { BandejaDeConversaciones } from './bandeja.service';
import { LucidController } from './lucid.controller';
import { LucidService } from './lucid.service';
import { OlvidadorDeConversaciones } from './olvidador';
import { proveedoresConLlave } from '../integraciones/proveedores';

/// PrismaModule es @Global: no hay que importarlo.
@Module({
  /// `AdminGuard` ---el de la bandeja--- necesita `JwtService`, y el
  /// MISMO secreto que firma la sesion. Es lo que hacen los demas
  /// modulos que guardan rutas del panel.
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  /// La bandeja va en este modulo y con controlador aparte: el
  /// webhook lo guarda una llave de proveedor y la bandeja una sesion
  /// del panel, y una ruta que acepta dos autenticaciones deja entrar
  /// por la mas debil.
  controllers: [LucidController, BandejaController],
  providers: [LucidService, BandejaDeConversaciones, OlvidadorDeConversaciones],
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
