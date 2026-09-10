import { RolConvenio } from '../../generated/prisma';
import {
  AREAS,
  PERMISOS,
  alcanza,
  conveniosQueCierran,
  nivelDe,
  resumenDePermisos,
} from './permisos';

const ROLES = Object.values(RolConvenio);

describe('la matriz de permisos', () => {
  // un rol sin fila daria NADA en silencio
  it('cubre todos los roles del enum', () => {
    for (const rol of ROLES) {
      expect(PERMISOS[rol]).toBeDefined();
      for (const area of AREAS) expect(PERMISOS[rol][area]).toBeDefined();
    }
  });

  it('todos ven la pre-reserva: es el contexto común', () => {
    for (const rol of ROLES) {
      expect(alcanza(PERMISOS[rol].reserva, 'VER')).toBe(true);
    }
  });

  it('solo sistemas configura', () => {
    for (const rol of ROLES) {
      const puede = alcanza(PERMISOS[rol].configuracion, 'ESCRIBIR');
      expect(puede).toBe(rol === 'LIDER_SISTEMAS');
    }
  });

  it('el gestor de inscripciones ve el alistamiento pero no descarga', () => {
    expect(PERMISOS.GESTOR_INSCRIPCION.reportes).toBe('VER');
    expect(PERMISOS.LIDER_INSCRIPCION.reportes).toBe('ESCRIBIR');
  });

  it('el área académica no toca el archivo con las cédulas', () => {
    expect(PERMISOS.GESTOR_ACADEMICO.reportes).toBe('NADA');
    expect(PERMISOS.LIDER_ACADEMICO.reportes).toBe('NADA');
  });

  it('cada gestor ve el área del otro sin poder tocarla', () => {
    expect(PERMISOS.GESTOR_INSCRIPCION.academico).toBe('VER');
    expect(PERMISOS.GESTOR_ACADEMICO.inscripciones).toBe('VER');
  });

  it('CONSULTA no escribe en ningún sitio', () => {
    for (const area of AREAS) expect(PERMISOS.CONSULTA[area]).not.toBe('ESCRIBIR');
  });
});

describe('cómo se combinan', () => {
  it('varias filas en el mismo convenio suman: manda la mayor', () => {
    expect(nivelDe(['GESTOR_ACADEMICO', 'LIDER_INSCRIPCION'], 'reportes')).toBe('ESCRIBIR');
    expect(nivelDe(['CONSULTA'], 'inscripciones')).toBe('VER');
    expect(nivelDe([], 'reserva')).toBe('NADA');
  });

  it('cerrar formación se responde por convenio, no en general', () => {
    const roles = {
      adecopria: ['LIDER_ACADEMICO' as RolConvenio],
      britcham: ['GESTOR_ACADEMICO' as RolConvenio],
    };
    expect(conveniosQueCierran(roles)).toEqual(['adecopria']);
  });

  it('el resumen toma el mayor entre convenios', () => {
    const roles = {
      adecopria: ['GESTOR_INSCRIPCION' as RolConvenio],
      britcham: ['LIDER_SISTEMAS' as RolConvenio],
    };
    expect(resumenDePermisos(roles).configuracion).toBe('ESCRIBIR');
    expect(resumenDePermisos({}).reserva).toBe('NADA');
  });
});
