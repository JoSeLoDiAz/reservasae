import { RolConvenio } from '../../generated/prisma';
import {
  AREAS,
  MUEVEN_INSCRITO,
  PERMISOS,
  REPARTEN_FICHAS,
  alcanza,
  conveniosQueCierran,
  nivelDe,
  resumenDePermisos,
} from './permisos';
import { PUEDEN_LLEVAR_FICHAS } from '../crm/quien-lleva-fichas';

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

  /// Cambió a propósito el 4 sep 2026: la dirección pidió
  /// poder cambiar la apariencia, y esa cuelga de aquí.
  it('configuran sistemas y la coordinación administrativa', () => {
    const CONFIGURAN = ['LIDER_SISTEMAS', 'COUNTRY_MANAGER'];
    for (const rol of ROLES) {
      const puede = alcanza(PERMISOS[rol].configuracion, 'ESCRIBIR');
      expect(puede).toBe(CONFIGURAN.includes(rol));
    }
  });

  it('quien dirige mira el proceso, no lo trabaja', () => {
    const suyo = PERMISOS.COUNTRY_MANAGER;
    expect(suyo.reserva).toBe('VER');
    expect(suyo.inscripciones).toBe('VER');
    expect(suyo.inscritos).toBe('VER');
    expect(suyo.academico).toBe('VER');
    // pero SI saca los archivos: lo pidio la direccion
    expect(suyo.reportes).toBe('ESCRIBIR');
  });

  /// Quien dirige no entra en el reparto del trabajo.
  it('quien dirige no lleva fichas, ni las reparte, ni deshace una inscripción', () => {
    const rol = RolConvenio.COUNTRY_MANAGER;
    expect(PUEDEN_LLEVAR_FICHAS).not.toContain(rol);
    expect(REPARTEN_FICHAS).not.toContain(rol);
    expect(MUEVEN_INSCRITO).not.toContain(rol);
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
