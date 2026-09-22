import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AdminController, MarcaPublicaController } from './admin.controller';
import { AdminService } from './admin.service';
import { editoresDeMarca } from './editores-de-marca';

@Module({
  imports: [
    JwtModule.register({
      // secreto de firma de sesión
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AdminController, MarcaPublicaController],
  providers: [AdminService],
  /// Lo exporta para que el correo resuelva la marca con la
  /// MISMA funcion que pinta el panel por Host, y no con una
  /// segunda que acabe discrepando.
  exports: [AdminService],
})
export class AdminModule implements OnModuleInit {
  private readonly log = new Logger('Marca');

  /// SIN LISTA NO HAY MARCA, y hay que oírlo al arrancar.
  ///
  /// `EDITORES_DE_MARCA` falla cerrado a propósito, pero el síntoma
  /// de una variable ausente y el de «esta cuenta no es editora» son
  /// el mismo: Apariencia no pinta los bloques y no hay ni un 403 que
  /// leer, porque la pantalla ni llega a pedir. Un dedazo en un
  /// correo --y el de la Sra. Catalina venía con un «confírmalo»--
  /// dejaría a esa persona fuera sin que nada fallara.
  ///
  /// Va el RECUENTO y no los correos: son tres, así que el número
  /// caza el dedazo, y un log no es sitio para direcciones de nadie.
  onModuleInit(): void {
    const cuantos = editoresDeMarca().length;
    if (cuantos > 0) {
      this.log.log(`${cuantos} cuenta(s) pueden cambiar logos y colores del sistema.`);
      return;
    }
    this.log.warn(
      'EDITORES_DE_MARCA vacía: NADIE puede cambiar logos, textos ni colores ' +
        'del sistema, tampoco un superadministrador. Los colores de cada ' +
        'persona sí siguen funcionando.',
    );
  }
}
