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
