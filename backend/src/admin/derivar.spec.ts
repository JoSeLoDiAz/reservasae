import { EsquemaColor } from '../../generated/prisma';
import { contraste, minimoExigido } from './contraste';
import { derivarTemas } from './derivar';
import { hexAOklch, oklchAHex } from './oklch';
import { PLANTILLAS, temasDePlantilla } from './plantillas-tema';
import { COMPROBACIONES_CONTRASTE, TOKENS } from './temas';

const HEXADECIMAL = /^#[0-9a-fA-F]{6}$/;
const ESQUEMAS: EsquemaColor[] = ['CLARO', 'OSCURO'];

// 24 tonos, croma alto: fuerza el recorte
const RUEDA = Array.from({ length: 24 }, (_, i) =>
  oklchAHex({ l: 0.55, c: 0.2, h: i * 15 }),
);

describe('oklch', () => {
  it('va y vuelve sin perder el color', () => {
    for (const hex of ['#1d4ed8', '#0f766e', '#ffffff', '#000000', '#c2410c']) {
      const oklch = hexAOklch(hex);
      expect(oklch).not.toBeNull();
      expect(oklchAHex(oklch!)).toBe(hex);
    }
  });

  it('recorta al gamut sRGB en vez de devolver basura', () => {
    // croma imposible para ese tono
    const hex = oklchAHex({ l: 0.5, c: 0.9, h: 250 });
    expect(hex).toMatch(HEXADECIMAL);
  });

  it('respeta el orden de luminosidad', () => {
    const claro = hexAOklch(oklchAHex({ l: 0.8, c: 0.05, h: 120 }))!;
    const oscuro = hexAOklch(oklchAHex({ l: 0.3, c: 0.05, h: 120 }))!;
    expect(claro.l).toBeGreaterThan(oscuro.l);
  });
});

describe('derivarTemas', () => {
  it('devuelve los 28 tokens del catalogo, en hexadecimal', () => {
    const temas = derivarTemas({ principal: '#1d4ed8' });
    for (const esquema of ESQUEMAS) {
      expect(Object.keys(temas[esquema])).toHaveLength(TOKENS.length);
      for (const token of TOKENS) {
        expect(temas[esquema][token.clave]).toMatch(HEXADECIMAL);
      }
    }
  });

  it('cumple el contraste minimo desde cualquier tono', () => {
    for (const principal of RUEDA) {
      for (const encabezadoDeColor of [false, true]) {
        const temas = derivarTemas({ principal, encabezadoDeColor });
        for (const esquema of ESQUEMAS) {
          for (const par of COMPROBACIONES_CONTRASTE) {
            // los pares entre estados van por distancia de
            // color, no por WCAG: aqui no aplican
            if (par.entreEstados) continue;
            const razon = contraste(temas[esquema][par.frente], temas[esquema][par.fondo]);
            expect({ principal, encabezadoDeColor, esquema, par: par.descripcion, razon })
              .toMatchObject({ razon: expect.any(Number) });
            expect(razon!).toBeGreaterThanOrEqual(minimoExigido(par.grande));
          }
        }
      }
    }
  });

  it('el amarillo puro saca texto oscuro en los botones', () => {
    const temas = derivarTemas({ principal: '#ffd400' });
    const claro = temas.CLARO;
    expect(contraste(claro.marcaTexto, claro.marca)!).toBeGreaterThanOrEqual(4.5);
  });

  it('el oscuro no es el claro invertido: la marca baja de saturacion', () => {
    const temas = derivarTemas({ principal: '#1d4ed8' });
    const claro = hexAOklch(temas.CLARO.marca)!;
    const oscuro = hexAOklch(temas.OSCURO.marca)!;
    expect(oscuro.l).toBeGreaterThan(claro.l);
    expect(oscuro.c).toBeLessThan(claro.c);
  });

  it('los estados no se derivan: se mantienen los validados', () => {
    const temas = derivarTemas({ principal: '#c2410c' });
    expect(temas.CLARO.exito).toBe('#047857');
    expect(temas.OSCURO.aviso).toBe('#fbbf24');
  });

  it('los ajustes de la plantilla mandan sobre lo derivado', () => {
    const temas = derivarTemas({
      principal: '#1d4ed8',
      ajustes: { CLARO: { fondo: '#fafafa' } },
    });
    expect(temas.CLARO.fondo).toBe('#fafafa');
  });

  it('rechaza un color que no sea hexadecimal', () => {
    expect(() => derivarTemas({ principal: 'rojo' })).toThrow();
  });
});

describe('plantillas', () => {
  it('la primera es exactamente la de restablecer', () => {
    const temas = temasDePlantilla(PLANTILLAS[0]);
    expect(temas.CLARO.marca).toBe('#1d4ed8');
    expect(temas.OSCURO.marca).toBe('#60a5fa');
  });

  it('ninguna deja un par por debajo del minimo', () => {
    for (const plantilla of PLANTILLAS) {
      const temas = temasDePlantilla(plantilla);
      for (const esquema of ESQUEMAS) {
        for (const par of COMPROBACIONES_CONTRASTE) {
          // los pares entre estados van por distancia de
          // color, no por WCAG: aqui no aplican
          if (par.entreEstados) continue;
          const razon = contraste(temas[esquema][par.frente], temas[esquema][par.fondo]);
          expect(
            `${plantilla.clave} ${esquema} ${par.descripcion}: ${razon?.toFixed(2)}`,
          ).toBe(
            razon! >= minimoExigido(par.grande)
              ? `${plantilla.clave} ${esquema} ${par.descripcion}: ${razon?.toFixed(2)}`
              : 'por debajo del minimo',
          );
        }
      }
    }
  });

  it('no hay dos plantillas con la misma clave', () => {
    const claves = PLANTILLAS.map((p) => p.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
