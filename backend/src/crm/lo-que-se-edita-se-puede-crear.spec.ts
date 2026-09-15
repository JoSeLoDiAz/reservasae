/** Lo que la ficha deja editar, crear lo deja mandar. */

/**
 * El cliente pidio poder dejar TODOS los datos de la persona
 * al inscribirla desde el CRM, y el panel manda ahora el mismo
 * formulario en las dos pantallas --`campos-de-la-persona.tsx`
 * es uno solo--. Este spec ata las dos puntas.
 *
 * Y no es un lujo: `main.ts` monta el ValidationPipe con
 * `forbidNonWhitelisted: true`, asi que un campo que el DTO no
 * declare no se ignora — devuelve 400 y la ficha NO SE CREA.
 * O sea que anadir un campo al formulario del panel y
 * olvidarse del DTO rompe la pantalla entera, no ese campo.
 *
 * Se lee el archivo del panel, no una copia: es el mismo
 * criterio de `la-escalera-no-se-separa` y de
 * `el-espejo-no-se-separa`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CrearParticipanteDto } from './dto';

const PANEL = join(
  __dirname,
  '../../../frontend/src/components/admin/campos-de-la-persona.tsx',
);

/// Los campos que el panel declara para una persona.
function camposDelPanel(): string[] {
  const texto = readFileSync(PANEL, 'utf8');
  const bloque = texto.match(
    /export type DatosDeLaPersona = \{([\s\S]*?)\n\};/,
  );
  if (!bloque) throw new Error('No se encontró DatosDeLaPersona en el panel.');

  return [...bloque[1].matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)].map((m) => m[1]);
}

/// Un valor que pasa la validación de cada campo. Lo que se
/// prueba aquí es que el DTO lo ADMITA, no que lo valide.
const EJEMPLO: Record<string, unknown> = {
  primerNombre: 'Camila',
  segundoNombre: 'Alejandra',
  primerApellido: 'Caro',
  segundoApellido: 'Garavito',
  generoSepId: 2,
  estrato: 3,
  departamentoSepId: 68,
  municipioSepId: 68001,
  barrio: 'Cabecera',
  direccion: 'Calle 1 # 2-3',
  nivelOcupacionalSepId: 1,
  cargoEnEmpresa: 'Analista',
  beneficiarioPrevio: false,
  fechaNacimiento: '1994-05-01',
  correo: 'camila@ejemplo.test',
  celular: '3001234567',
};

describe('lo que se edita se puede crear', () => {
  const campos = camposDelPanel();

  it('el panel declara los diecisiete campos de una persona', () => {
    /// Si alguien añade uno, este número cambia y hay que
    /// mirar las dos puntas. No es decoración: es el aviso.
    expect(campos).toHaveLength(16);
    expect(campos).toContain('estrato');
    expect(campos).toContain('beneficiarioPrevio');
  });

  it('el catálogo de ejemplos cubre todo lo que manda el panel', () => {
    /// Sin esto, un campo nuevo pasaría el test de abajo por
    /// no estar en el cuerpo — que es un verde por el motivo
    /// equivocado.
    expect(campos.filter((c) => !(c in EJEMPLO))).toEqual([]);
  });

  it('el DTO de crear los acepta todos', () => {
    const cuerpo: Record<string, unknown> = {
      tipoDocumentoSepId: 1,
      numeroDocumento: '1017138135',
      convenioId: 'c1',
    };
    for (const campo of campos) cuerpo[campo] = EJEMPLO[campo];

    const dto = plainToInstance(CrearParticipanteDto, cuerpo, {
      /// Las MISMAS opciones que `main.ts`: con las de por
      /// defecto el defecto no se reproduce.
      enableImplicitConversion: true,
    });
    const errores = validateSync(dto as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    const rechazados = errores
      .filter((e) => e.constraints?.whitelistValidation)
      .map((e) => e.property);

    expect(rechazados).toEqual([]);
  });
});
