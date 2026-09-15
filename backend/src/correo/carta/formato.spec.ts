/** El formato del cuerpo de una plantilla. */

import { bloquesDe, comoTexto, resolverBloques } from './formato';

describe('trocear el cuerpo', () => {
  it('un texto corriente es un párrafo y nada más', () => {
    const b = bloquesDe('Hola, buenos días.\n\nQue tenga buen día.');

    expect(b.map((x) => x.tipo)).toEqual(['PARRAFO', 'PARRAFO']);
  });

  it('el título va arriba y solo arriba', () => {
    const b = bloquesDe('# Su inscripción quedó confirmada\n\nHola.');

    expect(b[0]).toEqual({
      tipo: 'TITULO',
      texto: 'Su inscripción quedó confirmada',
      marca: null,
    });
  });

  it('una almohadilla a mitad del correo es una almohadilla', () => {
    /// «# 1 en ventas» no es un título: es lo que alguien
    /// escribió.
    const b = bloquesDe('Hola.\n\n# 1 en ventas');

    expect(b.map((x) => x.tipo)).toEqual(['PARRAFO', 'PARRAFO']);
  });

  it('un símbolo delante del título es la marca del círculo', () => {
    const b = bloquesDe('# ✓ Su inscripción quedó confirmada');

    expect(b[0]).toEqual({
      tipo: 'TITULO',
      texto: 'Su inscripción quedó confirmada',
      marca: '✓',
    });
  });

  it('DOS filas seguidas son un panel', () => {
    const b = bloquesDe('Modalidad: Virtual\nDuración: 40 horas');

    expect(b).toEqual([
      {
        tipo: 'PANEL',
        filas: [
          { etiqueta: 'Modalidad', valor: 'Virtual' },
          { etiqueta: 'Duración', valor: '40 horas' },
        ],
      },
    ]);
  });

  it('UNA sola sigue siendo una frase', () => {
    /// La regla que hace que esto no estorbe: «Nota: si no
    /// puede asistir, avísenos» es una frase corriente y tiene
    /// que seguir siendo un párrafo.
    const b = bloquesDe('Nota: si no puede asistir, avísenos.');

    expect(b.map((x) => x.tipo)).toEqual(['PARRAFO']);
  });

  it('las viñetas son una lista', () => {
    const b = bloquesDe('• Guarde este correo\n• Llegue diez minutos antes');

    expect(b[0]).toEqual({
      tipo: 'LISTA',
      puntos: ['Guarde este correo', 'Llegue diez minutos antes'],
    });
  });

  it('un enlace de markdown en su línea es un botón', () => {
    const b = bloquesDe('[Completar mis datos](https://x.co/completar/abc)');

    expect(b[0]).toEqual({
      tipo: 'BOTON',
      texto: 'Completar mis datos',
      url: 'https://x.co/completar/abc',
    });
  });

  it('el botón se degrada a texto legible', () => {
    /// Quien lee en texto plano no tiene nada que pulsar: la
    /// dirección tiene que verse entera.
    const t = comoTexto(bloquesDe('[Entrar](https://x.co/a)'));
    expect(t).toBe('Entrar:\nhttps://x.co/a');
  });

  it('secciones y notas se reconocen', () => {
    const b = bloquesDe('## Antes de empezar\n\n> Esto es importante.');

    expect(b).toEqual([
      { tipo: 'SECCION', texto: 'Antes de empezar' },
      { tipo: 'NOTA', texto: 'Esto es importante.' },
    ]);
  });

  it('un correo entero sale en el orden en que se escribió', () => {
    const b = bloquesDe(
      [
        '# ✓ Confirmada',
        '',
        'Hola, Camila.',
        '',
        '## Su formación',
        '',
        'Curso: AF1',
        'Modalidad: Virtual',
        '',
        '• Guarde este correo',
        '',
        'Nos vemos.',
      ].join('\n'),
    );

    expect(b.map((x) => x.tipo)).toEqual([
      'TITULO',
      'PARRAFO',
      'SECCION',
      'PANEL',
      'LISTA',
      'PARRAFO',
    ]);
  });
});

describe('poner las variables', () => {
  const valores: Record<string, string | null> = {
    nombre: 'Camila',
    curso: 'AF1 · Gestión',
    vacia: null,
  };
  const resolver = (t: string) => {
    const faltantes: string[] = [];
    const desconocidas: string[] = [];
    const texto = t.replace(/\{\{(\w+)\}\}/g, (entero, clave: string) => {
      if (!(clave in valores)) {
        desconocidas.push(clave);
        return entero;
      }
      if (valores[clave] === null) {
        faltantes.push(clave);
        return entero;
      }
      return valores[clave] as string;
    });
    return { texto, faltantes, desconocidas };
  };

  it('se ponen DENTRO de cada bloque, no antes de trocear', () => {
    /// Es la razón de ser del orden: si se resolviera primero,
    /// una razón social como «# 1 LOGISTICA S.A.S» se
    /// convertiría en el título del correo de todo el mundo.
    const b = bloquesDe('Hola {{nombre}}.\n\nEmpresa: {{curso}}\nOtra: x');
    const r = resolverBloques(b, resolver);

    expect(r.bloques[0]).toMatchObject({ texto: 'Hola Camila.' });
    expect(r.bloques[1]).toMatchObject({
      filas: [
        { etiqueta: 'Empresa', valor: 'AF1 · Gestión' },
        { etiqueta: 'Otra', valor: 'x' },
      ],
    });
  });

  it('recoge los huecos y las inventadas de TODOS los bloques', () => {
    const b = bloquesDe('# {{vacia}}\n\n• {{noExiste}}');
    const r = resolverBloques(b, resolver);

    expect(r.faltantes).toEqual(['vacia']);
    expect(r.desconocidas).toEqual(['noExiste']);
  });
});

describe('el texto plano', () => {
  it('no lleva ni una marca del formato', () => {
    /// Es lo que recibe quien tiene el HTML apagado: una
    /// almohadilla ahí es marcado crudo en la bandeja.
    const t = comoTexto(
      bloquesDe('# ✓ Confirmada\n\n## Datos\n\nCurso: AF1\nSede: Medellín'),
    );

    expect(t).not.toContain('#');
    expect(t).toContain('✓ Confirmada');
    expect(t).toContain('Curso: AF1');
  });

  it('las viñetas SÍ se quedan, que se leen bien', () => {
    expect(comoTexto(bloquesDe('• Uno\n• Dos'))).toBe('• Uno\n• Dos');
  });
});
