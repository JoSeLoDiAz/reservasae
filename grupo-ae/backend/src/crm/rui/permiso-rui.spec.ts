/// La barrera que impide que el entorno de pruebas le pida al
/// Estado la identidad de un ciudadano que no pidió nada.
///
/// El candado de `esDePrueba` solo cubría las filas de la
/// siembra: cualquiera que se registrara después salía al
/// portal real. Lo encontró un recorrido de pruebas.

import { documentosPermitidos, permisoDeRui } from './permiso-rui';

const MIO = '1005483227';
const AJENO = '3058741';

describe('permiso para consultar el RUI', () => {
  it('sin el proveedor real nunca sale a internet', () => {
    for (const e of [{}, { ENTORNO: 'prueba' }, { RUI_PROVEEDOR: 'OTRA' }]) {
      expect(permisoDeRui(MIO, e).real).toBe(false);
    }
  });

  it('en produccion consulta, que es su trabajo', () => {
    expect(permisoDeRui(AJENO, { RUI_PROVEEDOR: 'VENTANILLA' }).real).toBe(true);
  });

  it('en pruebas SOLO los documentos autorizados', () => {
    const env = {
      ENTORNO: 'prueba',
      RUI_PROVEEDOR: 'VENTANILLA',
      RUI_SOLO_ESTOS_DOCUMENTOS: MIO,
    };
    expect(permisoDeRui(MIO, env).real).toBe(true);
    expect(permisoDeRui(AJENO, env).real).toBe(false);
  });

  it('en pruebas sin lista no consulta a NADIE', () => {
    const env = { ENTORNO: 'prueba', RUI_PROVEEDOR: 'VENTANILLA' };
    for (const d of [MIO, AJENO, '99999900000001']) {
      expect([d, permisoDeRui(d, env).real]).toEqual([d, false]);
    }
  });

  it('el que no puede consultar dice por que', () => {
    const env = { ENTORNO: 'prueba', RUI_PROVEEDOR: 'VENTANILLA' };
    expect(permisoDeRui(AJENO, env).motivo).toContain('entorno de pruebas');
  });

  it('la lista aguanta espacios y comas de mas', () => {
    expect(
      documentosPermitidos({ RUI_SOLO_ESTOS_DOCUMENTOS: ' 111 , , 222 ' }),
    ).toEqual(['111', '222']);
    expect(documentosPermitidos({ RUI_SOLO_ESTOS_DOCUMENTOS: ' , ' })).toEqual([]);
  });

  it('un documento con espacios cuadra igual', () => {
    const env = {
      ENTORNO: 'prueba',
      RUI_PROVEEDOR: 'VENTANILLA',
      RUI_SOLO_ESTOS_DOCUMENTOS: MIO,
    };
    expect(permisoDeRui('  ' + MIO + ' ', env).real).toBe(true);
  });
});
