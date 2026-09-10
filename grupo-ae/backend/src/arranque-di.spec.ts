/** Que el grafo de dependencias arme. */

/**
 * Un `tsc` limpio no dice nada de la inyeccion: los errores de DI
 * ("Nest can't resolve dependencies of CrmService") aparecen al ARRANCAR,
 * o sea en produccion, cuando ya es tarde.
 *
 * Este spec compila el AppModule entero y falla aqui en vez de alla.
 *
 * `compile()` instancia los providers pero NO corre los `onModuleInit`,
 * asi que no abre conexion a la base ni levanta workers: sirve igual en
 * una maquina sin Postgres.
 */

import { Test } from '@nestjs/testing';

import { AppModule } from './app.module';
import { CrmService } from './crm/crm.service';
import { DisparadorInscripcion } from './instituciones/web/disparador';

describe('el grafo de dependencias', () => {
  it('arma entero, sin tocar la base', async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(modulo.get(CrmService)).toBeInstanceOf(CrmService);

    await modulo.close();
  }, 30_000);

  /// El disparo del buscador cruza de modulo: CrmService (CrmModule) pide
  /// DisparadorInscripcion (InstitucionesModule). Si alguien quita ese
  /// import o el export, esto se cae aqui y no en el despliegue.
  it('CrmService recibe el disparador de InstitucionesModule', async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(modulo.get(DisparadorInscripcion)).toBeInstanceOf(DisparadorInscripcion);

    await modulo.close();
  }, 30_000);
});
