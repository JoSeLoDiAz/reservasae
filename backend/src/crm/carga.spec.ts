import { analizar, esInsalvable, repetidosEnElPegado } from './carga';

const fila = (...c: string[]) => c.join('\t');

describe('analizar', () => {
  it('lee una fila pegada desde Excel', () => {
    const [f] = analizar(
      fila('CC', '1019456782', 'Laura', 'Camila', 'Gómez', 'Rojas', 'l@e.com', '3001234567'),
    );

    expect(f.tipoDocumento).toBe('CC');
    expect(f.numeroDocumento).toBe('1019456782');
    expect(f.primerNombre).toBe('Laura');
    expect(f.segundoApellido).toBe('Rojas');
    expect(f.correo).toBe('l@e.com');
    expect(f.problemas).toEqual([]);
  });

  it('no se traga una fila cuyo tipo viene escrito como palabra', () => {
    const filas = analizar(
      [
        fila('Cedula', '1019456782', 'Laura', '', 'Gómez'),
        fila('CC', '1019456783', 'Ana', '', 'Pérez'),
      ].join('\n'),
    );

    // el titulo se detecta por el conjunto, no por una palabra
    expect(filas).toHaveLength(2);
    expect(filas[0].primerNombre).toBe('Laura');
  });

  it('se salta la fila de titulos', () => {
    const filas = analizar(
      [
        fila('Tipo documento', 'Número', 'Primer nombre'),
        fila('CC', '1019456782', 'Laura', '', 'Gómez', '', 'l@e.com', ''),
      ].join('\n'),
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].primerNombre).toBe('Laura');
  });

  it('acepta punto y coma y coma como separador', () => {
    const conPuntoYComa = analizar('CC;1019456782;Laura;;Gómez;;l@e.com;');
    const conComa = analizar('CC,1019456782,Laura,,Gómez,,l@e.com,');

    expect(conPuntoYComa[0].numeroDocumento).toBe('1019456782');
    expect(conComa[0].numeroDocumento).toBe('1019456782');
  });

  it('normaliza el documento con puntos y espacios', () => {
    const [f] = analizar(fila('CC', ' 1.019.456.782 ', 'Laura', '', 'Gómez'));
    expect(f.numeroDocumento).toBe('1019456782');
  });

  it('avisa de un tipo desconocido y asume CC', () => {
    const [f] = analizar(fila('cedula', '1019456782', 'Laura', '', 'Gómez'));

    expect(f.tipoDocumento).toBe('CC');
    expect(f.problemas.join(' ')).toContain('no es un tipo de documento conocido');
  });

  it('rechaza letras en una cedula', () => {
    const [f] = analizar(fila('CC', 'ABC123', 'Laura', '', 'Gómez'));
    expect(f.problemas.join(' ')).toContain('no es válido para CC');
  });

  it('admite letras en un pasaporte', () => {
    const [f] = analizar(fila('PA', 'AB1234567', 'John', '', 'Smith', '', 'j@e.com'));
    expect(f.problemas).toEqual([]);
  });

  it('señala el nombre y el apellido que faltan', () => {
    const [f] = analizar(fila('CC', '1019456782', '', '', ''));

    expect(f.problemas).toContain('falta el primer nombre');
    expect(f.problemas).toContain('falta el primer apellido');
    expect(esInsalvable(f)).toBe(true);
  });

  it('avisa si no hay forma de contactar', () => {
    const [f] = analizar(fila('CC', '1019456782', 'Laura', '', 'Gómez'));

    expect(f.problemas.join(' ')).toContain('sin correo ni celular');
    // se puede crear igual: contactarla es requisito de matricula
    expect(esInsalvable(f)).toBe(false);
  });

  it('limpia el celular con parentesis y guiones', () => {
    const [f] = analizar(
      fila('CC', '1019456782', 'Laura', '', 'Gómez', '', '', '(300) 123-4567'),
    );
    expect(f.celular).toBe('3001234567');
  });

  it('descarta un correo que no lo es', () => {
    const [f] = analizar(
      fila('CC', '1019456782', 'Laura', '', 'Gómez', '', 'laura arroba empresa'),
    );
    expect(f.problemas.join(' ')).toContain('no parece un correo');
  });

  it('ignora lineas en blanco y quita comillas', () => {
    const filas = analizar(
      ['"CC"\t"1019456782"\t"Laura"\t""\t"Gómez"', '', '   '].join('\n'),
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].numeroDocumento).toBe('1019456782');
    expect(filas[0].primerApellido).toBe('Gómez');
  });

  it('devuelve la linea real para poder señalarla', () => {
    const filas = analizar(
      [
        fila('Tipo', 'Documento'),
        fila('CC', '1019456782', 'Laura', '', 'Gómez'),
        fila('CC', '1019456783', 'Ana', '', 'Pérez'),
      ].join('\n'),
    );

    expect(filas.map((f) => f.linea)).toEqual([2, 3]);
  });

  it('no revienta con un pegado vacio', () => {
    expect(analizar('')).toEqual([]);
    expect(analizar('\n\n  \n')).toEqual([]);
  });
});

describe('repetidosEnElPegado', () => {
  it('encuentra el mismo documento dos veces', () => {
    const filas = analizar(
      [
        fila('CC', '1019456782', 'Laura', '', 'Gómez'),
        fila('CC', '1.019.456.782', 'Laura', '', 'Gomez'),
        fila('CC', '1019456783', 'Ana', '', 'Pérez'),
      ].join('\n'),
    );

    const repes = repetidosEnElPegado(filas);
    expect(repes.has('CC:1019456782')).toBe(true);
    expect(repes.has('CC:1019456783')).toBe(false);
  });

  it('no confunde el mismo numero con distinto tipo', () => {
    const filas = analizar(
      [
        fila('CC', '1019456782', 'Laura', '', 'Gómez'),
        fila('CE', '1019456782', 'Otra', '', 'Persona'),
      ].join('\n'),
    );

    expect(repetidosEnElPegado(filas).size).toBe(0);
  });
});
