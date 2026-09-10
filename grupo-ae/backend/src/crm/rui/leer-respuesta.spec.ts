import {
  documentoNoEncontrado,
  leerRespuesta,
  sigueConsultando,
} from './leer-respuesta';

/// El recuadro tal como lo pinta el portal. Si el DNP le
/// cambia los colores, esto sigue funcionando; si le cambia
/// la forma, estas pruebas se caen y se sabe por que.

describe('leerRespuesta', () => {
  it('saca los cinco datos de una ficha completa', () => {
    const r = leerRespuesta(
      [
        'Resultado de la consulta',
        'JUAN CARLOS MARTINEZ GOMEZ',
        '34 años · Masculino',
        'Medellín — Antioquia',
      ].join('\n'),
    );

    expect(r).toEqual({
      nombre: 'JUAN CARLOS MARTINEZ GOMEZ',
      edad: 34,
      genero: 'Masculino',
      ciudad: 'Medellín',
      departamento: 'Antioquia',
    });
  });

  it('no confunde el título de la ficha con el nombre', () => {
    const r = leerRespuesta('Resultado de la consulta\nANA GOMEZ');
    expect(r.nombre).toBe('ANA GOMEZ');
  });

  it('aguanta que falte la ubicación', () => {
    const r = leerRespuesta('PEDRO PEREZ RUIZ\n28 años · Masculino');
    expect(r.nombre).toBe('PEDRO PEREZ RUIZ');
    expect(r.edad).toBe(28);
    expect(r.ciudad).toBeNull();
  });

  it('no toma «34 años» como nombre', () => {
    const r = leerRespuesta('34 años · Femenino');
    expect(r.nombre).toBeNull();
    expect(r.edad).toBe(34);
  });

  it('con un recuadro que no entiende, no inventa', () => {
    expect(leerRespuesta('').nombre).toBeNull();
    expect(leerRespuesta('<<< algo raro >>>').nombre).toBeNull();
  });
});

describe('documentoNoEncontrado', () => {
  it('reconoce lo que contesta el portal de verdad', () => {
    // capturado del portal el 25 ago 2026
    expect(
      documentoNoEncontrado(
        'Documento no encontrado\nNo se encontró clasificación RUI para este documento.',
      ),
    ).toBe(true);
  });

  it('una ficha con datos no es un «no encontrado»', () => {
    expect(documentoNoEncontrado('ANA GOMEZ\n30 años · Femenino')).toBe(false);
  });
});

describe('sigueConsultando', () => {
  it('reconoce el mensaje de espera', () => {
    // este es el que se leia como si fuera el nombre
    expect(sigueConsultando('Consultando bases de datos...')).toBe(true);
    expect(sigueConsultando('ANA GOMEZ')).toBe(false);
  });
});
