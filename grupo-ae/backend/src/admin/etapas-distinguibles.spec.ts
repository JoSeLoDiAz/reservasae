import { hexAOklch } from './oklch';
import { TEMAS_POR_DEFECTO } from './temas';

/**
 * Las etapas que caben juntas en un mismo gráfico tienen que
 * distinguirse ENTRE SÍ, no solo del fondo.
 *
 * `PARES_CONTRASTE` mide cada etapa contra `superficie`, que
 * es lo que hace falta para leer su etiqueta. Pero en las
 * barras apiladas del tablero académico los segmentos miden
 * diez píxeles, no llevan cifra y lo único que los separa es
 * el color contra la leyenda. Ahí dos tonos parecidos son dos
 * series indistinguibles.
 *
 * Pasó de verdad: «En formación» era `#8a5a12` y «Desertó»
 * `#8a5a24` —dos ámbares a ΔE 7,6— y son justo las dos de
 * significado opuesto del gráfico. Ningún test lo vio porque
 * ninguno comparaba una etapa con otra.
 */

/// Las seis que conviven en el gráfico
/// del aula.
const DEL_AULA = [
  'etapaEnFormacion',
  'etapaCertificado',
  'etapaRetirado',
  'etapaNoAprobo',
  'etapaDeserto',
  'etapaAbandono',
] as const;

/**
 * Distancia perceptual en OKLab.
 *
 * OKLab es uniforme, así que una misma distancia se ve igual
 * de distinta en cualquier zona del espacio. En HSL no: dos
 * amarillos a 20° de tono se parecen mucho más que dos azules
 * a 20°, y por eso comparar tonos no sirve aquí.
 */
function separacion(unHex: string, otroHex: string): number {
  const a = hexAOklch(unHex);
  const b = hexAOklch(otroHex);
  if (!a || !b) throw new Error(`Color inválido: ${unHex} o ${otroHex}`);

  const aA = a.c * Math.cos((a.h * Math.PI) / 180);
  const aB = a.c * Math.sin((a.h * Math.PI) / 180);
  const bA = b.c * Math.cos((b.h * Math.PI) / 180);
  const bB = b.c * Math.sin((b.h * Math.PI) / 180);

  return Math.sqrt((a.l - b.l) ** 2 + (aA - bA) ** 2 + (aB - bB) ** 2) * 100;
}

/**
 * El suelo. Por debajo de esto, dos segmentos de diez píxeles
 * dejan de ser dos series y pasan a ser una mancha.
 */
const MINIMO = 12;

describe('las etapas del aula se distinguen entre sí', () => {
  for (const esquema of ['CLARO', 'OSCURO'] as const) {
    const paleta = TEMAS_POR_DEFECTO[esquema] as Record<string, string>;

    describe(`en ${esquema.toLowerCase()}`, () => {
      for (let i = 0; i < DEL_AULA.length; i++) {
        for (let j = i + 1; j < DEL_AULA.length; j++) {
          const una = DEL_AULA[i];
          const otra = DEL_AULA[j];

          it(`${una} contra ${otra}`, () => {
            const d = separacion(paleta[una], paleta[otra]);
            expect(d).toBeGreaterThanOrEqual(MINIMO);
          });
        }
      }
    });
  }

  it('todas las del aula tienen color en las dos paletas', () => {
    for (const esquema of ['CLARO', 'OSCURO'] as const) {
      const paleta = TEMAS_POR_DEFECTO[esquema] as Record<string, string>;
      for (const clave of DEL_AULA) {
        expect(paleta[clave]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
