/** Que este módulo arme por su cuenta. */

/**
 * `MetasModule` todavía no está en `app.module.ts` —lo registra
 * Mauricio al final, para que cuatro agentes no se pisen ese
 * archivo—, así que el spec que compila el AppModule entero no
 * pasa por aquí. Sin esta prueba, un import que falte no se
 * descubriría hasta el día en que se registre, y entonces lo que
 * no arranca es la aplicación completa.
 *
 * Lo que de verdad se comprueba es el `JwtModule` de este módulo:
 * `AdminGuard` pide `JwtService` y en Nest un guard se resuelve en
 * el módulo que declara el controlador que lo usa. Ese error no lo
 * ve `tsc`; aparece al arrancar.
 *
 * `compile()` instancia los providers pero no corre los
 * `onModuleInit`, así que no abre conexión: sirve en una máquina
 * sin Postgres.
 */

import { Test } from '@nestjs/testing';

import { InformesController } from './informes.controller';
import { InformesService } from './informes.service';
import { MetasController } from './metas.controller';
import { MetasModule } from './metas.module';
import { MetasService } from './metas.service';

describe('el módulo de metas', () => {
  it('arma entero y con sus dos controladores, sin tocar la base', async () => {
    const modulo = await Test.createTestingModule({
      imports: [MetasModule],
    }).compile();

    expect(modulo.get(MetasService)).toBeInstanceOf(MetasService);
    expect(modulo.get(InformesService)).toBeInstanceOf(InformesService);
    expect(modulo.get(MetasController)).toBeInstanceOf(MetasController);
    expect(modulo.get(InformesController)).toBeInstanceOf(InformesController);

    await modulo.close();
  }, 30_000);
});
