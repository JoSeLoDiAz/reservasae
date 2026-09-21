/** Las reglas del contacto que se escribe a mano. */

import { CanalAutorizacion } from '../../generated/prisma';
import {
  CANALES_A_MANO,
  esLaMismaPersona,
  notaDelContacto,
  revisarContacto,
  tituloDelNegocio,
} from './contacto-nuevo';

describe('esLaMismaPersona', () => {
  /// Es lo que impide colgarle el negocio a otra persona por un
  /// dígito mal tecleado en la cédula.
  it('reconoce a la misma persona escrita con más o menos apellidos', () => {
    expect(
      esLaMismaPersona(
        { primerApellido: 'Ruiz', segundoApellido: 'Gómez' },
        { primerApellido: 'RUIZ' },
      ),
    ).toBe(true);
  });

  it('no se deja engañar por las tildes', () => {
    expect(
      esLaMismaPersona(
        { primerApellido: 'Gómez' },
        { primerApellido: 'gomez' },
      ),
    ).toBe(true);
  });

  it('rechaza apellidos que no comparten nada', () => {
    expect(
      esLaMismaPersona(
        { primerApellido: 'Ruiz', segundoApellido: 'Gómez' },
        { primerApellido: 'Pérez', segundoApellido: 'Díaz' },
      ),
    ).toBe(false);
  });

  /// «De la Hoz» comparte «de» y «la» con medio país: las palabras
  /// de una letra y las vacías no pueden hacer pasar a nadie.
  it('no cuenta las partículas de una sola letra', () => {
    expect(
      esLaMismaPersona({ primerApellido: 'Y' }, { primerApellido: 'y' }),
    ).toBe(false);
  });
});

describe('revisarContacto', () => {
  it('pide al menos uno de los dos', () => {
    const r = revisarContacto('', '  ');
    expect(r.puede).toBe(false);
  });

  it('acepta solo el correo, en minúsculas', () => {
    expect(revisarContacto('Ana@Colegio.edu.co', undefined)).toEqual({
      puede: true,
      correo: 'ana@colegio.edu.co',
      celular: null,
    });
  });

  it('acepta solo el celular, normalizado a diez dígitos', () => {
    const r = revisarContacto(null, '+57 300 111 2222');
    expect(r).toEqual({ puede: true, correo: null, celular: '3001112222' });
  });

  /// La diferencia con el formulario público: allí un fijo junto a un
  /// correo bueno se deja pasar; aquí se le dice al asesor, porque
  /// guardar callado la mitad le hace creer que quedó todo.
  it('no deja pasar un fijo aunque el correo sirva', () => {
    const r = revisarContacto('ana@colegio.edu.co', '6015551234');
    expect(r.puede).toBe(false);
    if (!r.puede) expect(r.porque).toContain('6015551234');
  });

  it('dice qué correo está mal', () => {
    const r = revisarContacto('ana-arroba-colegio', '3001112222');
    expect(r.puede).toBe(false);
    if (!r.puede) expect(r.porque).toContain('ana-arroba-colegio');
  });
});

describe('tituloDelNegocio', () => {
  it('usa lo que le interesa cuando se escribió', () => {
    expect(tituloDelNegocio('  Workspace para 40 personas ', 'Ana Ruiz')).toBe(
      'Workspace para 40 personas',
    );
  });

  it('sin interés dice que es una solicitud de esa persona', () => {
    expect(tituloDelNegocio('', 'Ana Ruiz')).toBe('Solicitud de Ana Ruiz');
    expect(tituloDelNegocio('ok', 'Ana Ruiz')).toBe('Solicitud de Ana Ruiz');
  });

  it('no se pasa del largo del título', () => {
    expect(tituloDelNegocio('x'.repeat(300), 'Ana').length).toBe(160);
  });
});

describe('notaDelContacto', () => {
  const base = {
    registradoPor: 'Laura Asesora',
    loQueNoSePiso: [] as string[],
  };

  it('lleva la organización y el cargo, que no tienen columna en la persona', () => {
    const nota = notaDelContacto({
      ...base,
      organizacion: 'Colegio San Bartolomé',
      nit: '860007322',
      cargo: 'Coordinadora de sistemas',
      constancia: 'REGISTRADA',
      canal: CanalAutorizacion.CORREO,
    });
    expect(nota).toContain('Laura Asesora');
    expect(nota).toContain('Colegio San Bartolomé (NIT 860007322)');
    expect(nota).toContain('Cargo: Coordinadora de sistemas');
    expect(nota).toContain('por correo');
  });

  /// Callar que falta se lee como «todo en orden».
  it('dice que falta la autorización cuando no se dio', () => {
    expect(notaDelContacto({ ...base, constancia: 'NO_DIJO' })).toContain(
      'FALTA su autorización',
    );
  });

  it('avisa de lo que no reemplazó a lo guardado', () => {
    const nota = notaDelContacto({
      ...base,
      constancia: 'YA_TENIA',
      loQueNoSePiso: ['el correo «otro@correo.co»'],
    });
    expect(nota).toContain('ya estaba en el CRM');
    expect(nota).toContain('otro@correo.co');
  });

  it('no habla del SENA ni de formación', () => {
    const nota = notaDelContacto({
      ...base,
      organizacion: 'Textiles La Sabana',
      constancia: 'SIN_POLITICA',
      nota: 'Lo conocí en la feria de Corferias.',
    });
    expect(nota).not.toMatch(/SENA|formaci[oó]n|SEP\b/i);
    expect(nota).toContain('Corferias');
  });
});

describe('CANALES_A_MANO', () => {
  /// El formulario web y la carga de una empresa los escribe el
  /// sistema; afirmarlos desde el panel sería inventar una prueba.
  it('no deja afirmar canales que solo deja el sistema', () => {
    expect(CANALES_A_MANO).not.toContain(CanalAutorizacion.FORMULARIO_WEB);
    expect(CANALES_A_MANO).not.toContain(CanalAutorizacion.CARGA_EMPRESA);
  });
});
