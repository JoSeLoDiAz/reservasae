import { nombreBonito, revisarBase, type FilaDeBase } from './base-cargada';

/// Lo que cuidan estas pruebas: que una lista subida no
/// arrastre basura hasta el envío. Cada correo malo que pasa
/// es un rebote, y los rebotes son lo que hace que los
/// correos BUENOS de la misma cuenta empiecen a caer en spam.

const fila = (fila: number, correo: string, nombre = ''): FilaDeBase => ({
  fila,
  correo,
  nombre,
});

describe('lo que se cae, y con el motivo escrito', () => {
  const malo = (correo: string) => {
    const r = revisarBase([fila(2, correo, 'Ana')]);
    expect(r.listos).toHaveLength(0);
    expect(r.descartados).toHaveLength(1);
    return r.descartados[0].motivo;
  };

  it('sin arroba', () => {
    expect(malo('anagmail.com')).toContain('arroba');
  });

  it('con dos arrobas', () => {
    expect(malo('ana@@gmail.com')).toContain('2 arrobas');
  });

  it('con espacios en la mitad', () => {
    // pasa cuando pegan «Ana Gómez <ana@x.com>» en la celda
    expect(malo('ana gomez@x.com')).toContain('espacios');
  });

  it('sin punto en el dominio', () => {
    expect(malo('ana@gmail')).toContain('punto');
  });

  it('con tilde: casi siempre es el nombre metido en la casilla del correo', () => {
    expect(malo('maría@x.com')).toContain('tildes');
  });

  it('la fila que se descarta se puede encontrar en el archivo', () => {
    const r = revisarBase([fila(2, 'bien@x.com'), fila(3, 'roto')]);
    // el número de fila y el correo TAL COMO VENÍA: sin eso,
    // «hay un error» obliga a revisar las 300 a ojo
    expect(r.descartados[0]).toMatchObject({ fila: 3, correo: 'roto' });
  });
});

describe('lo que sí pasa', () => {
  it('un correo normal', () => {
    expect(revisarBase([fila(2, 'ana@gmail.com')]).listos).toHaveLength(1);
  });

  it('con punto, guion y más en el buzón', () => {
    const r = revisarBase([fila(2, 'ana.maria-gomez+sena@grupo-ae.com.co')]);
    expect(r.listos).toHaveLength(1);
  });

  it('un .co colombiano, que es lo normal acá', () => {
    expect(revisarBase([fila(2, 'ana@empresa.co')]).listos).toHaveLength(1);
  });

  it('las mayúsculas se bajan: MARIA@X.COM es el mismo buzón', () => {
    expect(revisarBase([fila(2, 'MARIA@X.COM')]).listos[0].correo).toBe(
      'maria@x.com',
    );
  });

  it('los espacios de los lados no estorban', () => {
    expect(revisarBase([fila(2, '  ana@x.com  ')]).listos[0].correo).toBe(
      'ana@x.com',
    );
  });
});

describe('los repetidos, que es como se gana uno un «esto es spam»', () => {
  it('el mismo correo dos veces sale una', () => {
    const r = revisarBase([fila(2, 'ana@x.com'), fila(3, 'ana@x.com')]);
    expect(r.listos).toHaveLength(1);
    expect(r.repetidos).toBe(1);
  });

  it('aunque venga con otras mayúsculas', () => {
    const r = revisarBase([fila(2, 'ana@x.com'), fila(3, 'Ana@X.com')]);
    expect(r.listos).toHaveLength(1);
    expect(r.repetidos).toBe(1);
  });
});

describe('las filas vacías no son un error', () => {
  it('el relleno de abajo de la hoja no se cuenta como problema', () => {
    // toda hoja de Excel trae filas en blanco debajo; decir
    // «900 errores» por eso es no decir nada
    const r = revisarBase([fila(2, 'ana@x.com'), fila(3, ''), fila(4, '')]);
    expect(r.descartados).toHaveLength(0);
    expect(r.vacias).toBe(2);
  });

  it('pero una fila CON nombre y SIN correo sí lo es', () => {
    const r = revisarBase([fila(2, '', 'Ana')]);
    expect(r.descartados[0].motivo).toContain('no trae correo');
  });
});

describe('los errores de dedo se señalan, no se corrigen', () => {
  it('gmail.con entra, pero avisado', () => {
    // corregirlo por nuestra cuenta sería mandarle el correo a
    // otra persona si resulta que sí era así
    const r = revisarBase([fila(2, 'ana@gmail.con')]);
    expect(r.listos).toHaveLength(1);
    expect(r.listos[0].correo).toBe('ana@gmail.con');
    expect(r.listos[0].sospecha).toContain('gmail.com');
  });

  it('hotmial.com también', () => {
    expect(revisarBase([fila(2, 'ana@hotmial.com')]).listos[0].sospecha).toBeTruthy();
  });

  it('un correo bueno no lleva sospecha encima', () => {
    expect(revisarBase([fila(2, 'ana@gmail.com')]).listos[0].sospecha).toBeUndefined();
  });
});

describe('el nombre, como se le escribe a una persona', () => {
  it('MARIA no sale gritando', () => {
    expect(nombreBonito('MARIA')).toBe('Maria');
  });

  it('maria sale con su mayúscula', () => {
    expect(nombreBonito('maria')).toBe('Maria');
  });

  it('del nombre completo se toma el primero', () => {
    // «Hola, María Fernanda Gómez Rueda» no lo escribe nadie
    expect(nombreBonito('María Fernanda Gómez Rueda')).toBe('María');
  });

  it('vacío es vacío, no una cadena rara', () => {
    expect(nombreBonito('   ')).toBeNull();
  });

  it('un correo en la casilla del nombre no es un nombre', () => {
    // pasa al arrastrar mal la fórmula y duplicar la columna
    expect(nombreBonito('ana@x.com')).toBeNull();
  });

  it('la fila sin nombre carga igual: el correo es lo que hace falta', () => {
    const r = revisarBase([fila(2, 'ana@x.com', '')]);
    expect(r.listos).toHaveLength(1);
    expect(r.listos[0].nombre).toBeNull();
  });
});
