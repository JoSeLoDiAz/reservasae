import {
  conveniosQueMuevenInscrito,
  MUEVEN_INSCRITO,
} from './permisos';

/// Inscribir es el punto de no retorno: a partir de ahí la
/// persona cuenta en el cupo, entra en el reporte al SENA y le
/// llegan las citaciones. Sacarla no es corregir un tecleo.

describe('quién puede mover a alguien ya inscrito', () => {
  it('un gestor de inscripciones NO', () => {
    // es quien más mueve fichas al día, y justo por eso: un
    // clic de más deshace una inscripción que ya salió
    expect(MUEVEN_INSCRITO).not.toContain('GESTOR_INSCRIPCION');
  });

  it('un gestor académico tampoco', () => {
    expect(MUEVEN_INSCRITO).not.toContain('GESTOR_ACADEMICO');
  });

  it('consulta, menos todavía', () => {
    expect(MUEVEN_INSCRITO).not.toContain('CONSULTA');
  });

  it('los líderes sí', () => {
    expect(MUEVEN_INSCRITO).toContain('LIDER_INSCRIPCION');
    expect(MUEVEN_INSCRITO).toContain('LIDER_ACADEMICO');
    expect(MUEVEN_INSCRITO).toContain('LIDER_SISTEMAS');
  });
});

describe('se responde por convenio, no en general', () => {
  it('líder en uno y gestor en el otro: solo en el suyo', () => {
    // la misma persona puede liderar en ADECOPRIA y solo
    // digitar en BRITCHAM, y el permiso no se contagia
    const puede = conveniosQueMuevenInscrito({
      'cv-adecopria': ['LIDER_INSCRIPCION'],
      'cv-britcham': ['GESTOR_INSCRIPCION'],
    });
    expect(puede).toEqual(['cv-adecopria']);
  });

  it('sin ningún rol de líder, ninguno', () => {
    expect(
      conveniosQueMuevenInscrito({ 'cv-adecopria': ['GESTOR_INSCRIPCION'] }),
    ).toEqual([]);
  });

  it('con dos roles en el mismo convenio, manda el mayor', () => {
    expect(
      conveniosQueMuevenInscrito({
        'cv-adecopria': ['GESTOR_INSCRIPCION', 'LIDER_INSCRIPCION'],
      }),
    ).toEqual(['cv-adecopria']);
  });
});

describe('sacar no es lo mismo que avanzar', () => {
  /// La primera versión de esta regla bloqueaba CUALQUIER
  /// salida de INSCRITO, y una prueba de cambiar-etapa la
  /// tumbó: el ingreso tardío —alguien que entra al aula con
  /// el grupo ya andando— es INSCRITO → EN_FORMACION, que es
  /// avanzar. Negárselo al gestor le rompe el trabajo del día
  /// por una regla que iba dirigida a otra cosa.
  ///
  /// Se deja escrito aquí para que quien lo lea entienda la
  /// distinción sin tener que reconstruirla.

  const AVANZAR = ['EN_FORMACION', 'CERTIFICADO'];
  const DESHACER = [
    'INTERESADO',
    'CONTACTADO',
    'DATOS_COMPLETOS',
    'PERDIDO',
    'RETIRADO',
  ];

  it('avanzar y deshacer no se solapan', () => {
    for (const a of AVANZAR) expect(DESHACER).not.toContain(a);
  });

  it('las de avanzar son las del aula, no las del embudo', () => {
    // si alguien añade INTERESADO aquí, un gestor podría
    // devolver a alguien al principio del embudo y sacarlo del
    // cupo sin que nadie lo firme
    expect(AVANZAR).not.toContain('INTERESADO');
    expect(AVANZAR).not.toContain('RETIRADO');
  });
});
