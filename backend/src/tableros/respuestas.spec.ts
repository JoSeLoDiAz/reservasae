import { contarOpciones, resumenNumerico } from './tableros.service';

describe('resumenNumerico', () => {
  it('media, mediana y extremos con lista impar', () => {
    expect(resumenNumerico([1, 3, 10])).toEqual({
      media: 4.7,
      mediana: 3,
      minimo: 1,
      maximo: 10,
      suma: 14,
    });
  });

  it('la mediana de una lista par promedia los dos del centro', () => {
    expect(resumenNumerico([2, 4, 6, 8]).mediana).toBe(5);
  });

  it('sin respuestas no inventa ceros', () => {
    expect(resumenNumerico([])).toEqual({
      media: null,
      mediana: null,
      minimo: null,
      maximo: null,
      suma: 0,
    });
  });
});

describe('contarOpciones', () => {
  const opciones = [
    { valor: 'si', etiqueta: 'Sí', archivada: false },
    { valor: 'no', etiqueta: 'No', archivada: false },
  ];

  it('cuenta y ordena de mayor a menor', () => {
    const filas = contarOpciones(opciones, [
      { valoresSeleccion: ['si'], etiquetasSeleccion: ['Sí'] },
      { valoresSeleccion: ['si'], etiquetasSeleccion: ['Sí'] },
      { valoresSeleccion: ['no'], etiquetasSeleccion: ['No'] },
    ]);
    expect(filas.map((f) => [f.valor, f.veces, f.porcentaje])).toEqual([
      ['si', 2, 66.7],
      ['no', 1, 33.3],
    ]);
  });

  it('una opción sin elegir sale con cero, no desaparece', () => {
    const filas = contarOpciones(opciones, [
      { valoresSeleccion: ['si'], etiquetasSeleccion: ['Sí'] },
    ]);
    expect(filas.find((f) => f.valor === 'no')?.veces).toBe(0);
  });

  it('muestra la etiqueta de hoy para las opciones que siguen existiendo', () => {
    const filas = contarOpciones(opciones, [
      { valoresSeleccion: ['si'], etiquetasSeleccion: ['Afirmativo'] },
    ]);
    expect(filas.find((f) => f.valor === 'si')?.etiqueta).toBe('Sí');
  });

  it('un valor que ya no está en el catálogo usa la etiqueta congelada', () => {
    const filas = contarOpciones(opciones, [
      { valoresSeleccion: ['quiza'], etiquetasSeleccion: ['Quizá'] },
    ]);
    const huerfana = filas.find((f) => f.valor === 'quiza');
    expect(huerfana).toMatchObject({ etiqueta: 'Quizá', veces: 1, archivada: true });
  });

  it('una selección múltiple cuenta cada marca', () => {
    const filas = contarOpciones(opciones, [
      { valoresSeleccion: ['si', 'no'], etiquetasSeleccion: ['Sí', 'No'] },
    ]);
    expect(filas.map((f) => f.veces)).toEqual([1, 1]);
    expect(filas[0].porcentaje).toBe(50);
  });

  it('sin respuestas no divide entre cero', () => {
    const filas = contarOpciones(opciones, []);
    expect(filas.every((f) => f.veces === 0 && f.porcentaje === 0)).toBe(true);
  });
});
