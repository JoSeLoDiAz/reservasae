/** Que el módulo arme antes de que alguien lo registre. */

/**
 * `CaptacionModule` no está en `app.module.ts`: lo registra Mauricio
 * al final, para que cuatro módulos nuevos no se pisen en el mismo
 * archivo. Eso deja un hueco — los errores de inyección («Nest can't
 * resolve dependencies of CaptacionService») aparecen al ARRANCAR, y
 * si el módulo no se arranca nunca, el error espera al día en que se
 * registra y se lo lleva quien no lo escribió.
 *
 * Esto lo compila solo. `compile()` instancia los providers pero no
 * corre los `onModuleInit`, así que no abre conexión a la base.
 */

import { Test } from '@nestjs/testing';

import { CaptacionController } from './captacion.controller';
import { CaptacionModule } from './captacion.module';
import { CaptacionService } from './captacion.service';

describe('el módulo de captación', () => {
  it('arma entero, con lo que le presta cada módulo', async () => {
    const modulo = await Test.createTestingModule({
      imports: [CaptacionModule],
    }).compile();

    expect(modulo.get(CaptacionService)).toBeInstanceOf(CaptacionService);
    /// El controlador también: es el que trae `FormulariosService` y
    /// `OportunidadesService` por debajo, y un import que falte se
    /// nota aquí y no en el despliegue.
    expect(modulo.get(CaptacionController)).toBeInstanceOf(CaptacionController);

    await modulo.close();
  }, 30_000);
});
