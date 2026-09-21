/**
 * Una etapa, un nombre. En los cinco sitios.
 *
 * El 15 sep 2026 el mismo valor se llamaba distinto según dónde
 * se mirara: `INSCRITO` era «Ganado» en las listas del panel y
 * «Propuesta enviada» en el selector de plantillas y en los
 * segmentos; `CERTIFICADO`, al revés. Quien armaba una campaña
 * para «Ganado» le escribía a otra gente y no tenía forma de
 * notarlo — la pantalla que usó para decidir y la que usó para
 * segmentar decían lo mismo con distinto significado.
 *
 * Y el 18 sep 2026 el fallo era el otro: los cuatro sitios ya
 * coincidían entre sí, pero no con el EMBUDO. La persona decía
 * «Propuesta enviada / Ganado» y el negocio «Cotización enviada /
 * Cerrado ganado», y en la demostración del Mailing nadie supo
 * decir si eran la misma gente. Ahora las siete etapas de la
 * persona que tienen pareja en el negocio se llaman como su
 * pareja, y eso también se fija aquí.
 *
 * No es un fallo que se arregle una vez: son cinco listas en dos
 * paquetes. Tres viven en el backend —la frase del segmento, los
 * tokens de Apariencia y el aviso de plantillas— y se importan.
 * Las dos del panel —`ETIQUETA_ETAPA` y las casillas del selector
 * de plantillas— no se pueden importar desde aquí, así que se
 * LEEN COMO TEXTO, igual que `la-mesa-dice-la-sede.spec.ts` lee
 * los servicios. Antes solo estaban «anotadas a esta», y una nota
 * no falla cuando alguien se olvida de ella.
 *
 * Si mañana alguien añade una etapa al enum y no la nombra, esto
 * falla ANTES de que una campaña salga con «en ABANDONO» en
 * mitad de una frase en español.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EtapaOportunidad, EtapaParticipante } from '../../../generated/prisma';
import { rotulo } from '../../oportunidades/escalera';
import { TOKENS } from '../../admin/temas';
import { ETAPA_EN_PALABRAS } from '../plantillas/etapas-de-plantilla';
import { enPalabras } from './segmento';

/// `grupo-ae/`, desde `grupo-ae/backend/src/correo/campanas`.
const RAIZ = join(__dirname, '..', '..', '..', '..');
const CRM_API = readFileSync(join(RAIZ, 'frontend', 'src', 'lib', 'crm-api.ts'), 'utf8');
const PLANTILLAS = readFileSync(
  join(RAIZ, 'frontend', 'src', 'app', 'admin', 'plantillas-correo', 'page.tsx'),
  'utf8',
);

/// El token de color de cada etapa se llama como la etapa, en
/// camelCase y con `etapa` delante: `INSCRITO` -> `etapaInscrito`.
function claveDeToken(etapa: string): string {
  const camel = etapa
    .toLowerCase()
    .split('_')
    .map((t, i) => (i === 0 ? t : t[0].toUpperCase() + t.slice(1)))
    .join('');
  return 'etapa' + camel[0].toUpperCase() + camel.slice(1);
}

/// Lo que `enPalabras` deja escrito para una sola etapa.
function nombreEnLaFrase(etapa: EtapaParticipante): string {
  const frase = enPalabras({ etapas: [etapa] });
  const m = /^Personas en la etapa «(.+)», que tengan correo\.$/.exec(frase);
  if (!m) throw new Error(`La frase cambió de forma: «${frase}»`);
  return m[1];
}

/// `ETIQUETA_ETAPA` del panel, leído del fuente. Si el mapa cambia
/// de forma —deja de ser un objeto literal de comillas dobles—,
/// esto lanza en vez de devolver un mapa vacío que pasaría
/// cualquier comparación hecha con `every`.
function etiquetasDelPanel(): Record<string, string> {
  const m = /export const ETIQUETA_ETAPA[^=]*=\s*\{([\s\S]*?)\n\};/.exec(CRM_API);
  if (!m) throw new Error('No se encontró `ETIQUETA_ETAPA` en crm-api.ts');
  const salida: Record<string, string> = {};
  for (const [, valor, texto] of m[1].matchAll(/^\s*([A-Z_]+):\s*"([^"]*)",?\s*$/gm)) {
    salida[valor] = texto;
  }
  return salida;
}

/// Las casillas del selector de plantillas: `["VALOR", "Texto"`.
function casillasDePlantillas(): Record<string, string> {
  const m = /const GRUPOS[\s\S]*?\n\];/.exec(PLANTILLAS);
  if (!m) throw new Error('No se encontró `GRUPOS` en plantillas-correo/page.tsx');
  const salida: Record<string, string> = {};
  for (const [, valor, texto] of m[0].matchAll(/\[\s*"([A-Z_]+)",\s*"([^"]+)"/g)) {
    salida[valor] = texto;
  }
  return salida;
}

const TODAS = Object.values(EtapaParticipante);

/// La etapa del negocio con la que cada etapa de la persona
/// comparte color y, desde el 18 sep 2026, nombre. Las cuatro que
/// faltan —RETIRADO, NO_APROBO, DESERTO, ABANDONO— no tienen
/// pareja: solo existen en la persona.
const PAREJA: Partial<Record<EtapaParticipante, EtapaOportunidad>> = {
  INTERESADO: 'CAPTADO',
  CONTACTADO: 'CONTACTADO',
  DATOS_COMPLETOS: 'CALIFICADO',
  INSCRITO: 'PROPUESTA_ENVIADA',
  EN_FORMACION: 'EN_NEGOCIACION',
  CERTIFICADO: 'GANADO',
  PERDIDO: 'PERDIDO',
};

describe('una etapa, un nombre', () => {
  it('toda etapa del enum tiene nombre en la frase del segmento', () => {
    for (const etapa of TODAS) {
      const nombre = nombreEnLaFrase(etapa);
      /// El fallo que esto caza: `enBonito` caía a `?? e` y
      /// dejaba el valor crudo de la base dentro de la frase.
      expect(nombre).not.toBe(etapa);
      expect(nombre).not.toMatch(/^[A-Z_]+$/);
      expect(nombre.trim()).not.toBe('');
    }
  });

  it('las siete con pareja en el embudo se llaman como su pareja', () => {
    /// Es la regla del 18 sep 2026. Si alguien vuelve a poner
    /// «Propuesta enviada» en la persona, la demostración vuelve a
    /// tener dos nombres para la misma columna.
    for (const [persona, negocio] of Object.entries(PAREJA)) {
      expect([persona, nombreEnLaFrase(persona as EtapaParticipante)]).toEqual([
        persona,
        rotulo(negocio),
      ]);
    }
  });

  it('cada color de etapa se llama como la etapa del NEGOCIO que pinta', () => {
    /// Estos siete tokens pintan el embudo y la lista de negocios
    /// (`VARIABLE_DE_ETAPA` en el panel), así que en Apariencia se
    /// tienen que llamar como las etapas que se ven ahí. Estuvieron con
    /// el vocabulario de la persona —«Interesado», «Propuesta enviada»—
    /// y en Apariencia se editaba un color que no se sabía qué pintaba.
    const porClave = new Map(TOKENS.map((t) => [t.clave, t.etiqueta]));
    for (const [persona, negocio] of Object.entries(PAREJA)) {
      expect([negocio, porClave.get(claveDeToken(persona))]).toEqual([
        negocio,
        rotulo(negocio),
      ]);
    }
  });

  it('los once colores se llaman como en la frase del segmento', () => {
    /// Antes solo se miraban las cuatro que usa únicamente la
    /// persona; las otras siete iban por la regla del negocio. Con
    /// la persona hablando como el embudo, las once coinciden, y
    /// mirarlas todas es lo que impide que un día diverjan.
    const porClave = new Map(TOKENS.map((t) => [t.clave, t.etiqueta]));
    for (const etapa of TODAS) {
      expect([etapa, porClave.get(claveDeToken(etapa))]).toEqual([
        etapa,
        nombreEnLaFrase(etapa),
      ]);
    }
  });

  it('`ETIQUETA_ETAPA` del panel dice lo mismo que la frase', () => {
    const panel = etiquetasDelPanel();
    expect(Object.keys(panel).sort()).toEqual([...TODAS].sort());
    for (const etapa of TODAS) {
      expect([etapa, panel[etapa]]).toEqual([etapa, nombreEnLaFrase(etapa)]);
    }
  });

  it('las casillas del selector de plantillas dicen lo mismo que la frase', () => {
    /// Sin variantes «que caben mejor»: una casilla decía «Con datos
    /// completos» donde el chip decía «Datos completos», y es por
    /// ahí por donde dos listas empiezan a separarse.
    const casillas = casillasDePlantillas();
    expect(Object.keys(casillas).sort()).toEqual([...TODAS].sort());
    for (const etapa of TODAS) {
      expect([etapa, casillas[etapa]]).toEqual([etapa, nombreEnLaFrase(etapa)]);
    }
  });

  it('el aviso de plantillas dice lo mismo, en minúscula', () => {
    /// Este decía «no cerró» para `NO_APROBO` mientras el panel
    /// decía otra cosa: quien leía el bloqueo buscaba en el
    /// selector una casilla que no existía.
    for (const etapa of TODAS) {
      expect([etapa, ETAPA_EN_PALABRAS[etapa]]).toEqual([
        etapa,
        nombreEnLaFrase(etapa).toLocaleLowerCase('es-CO'),
      ]);
    }
  });

  it('ningún nombre se repite en dos etapas', () => {
    /// Dos etapas con el mismo rótulo son indistinguibles en el
    /// selector de campañas, que es exactamente la clase de fallo
    /// del que viene esta prueba.
    const vistos = new Map<string, EtapaParticipante>();
    for (const etapa of TODAS) {
      const nombre = nombreEnLaFrase(etapa);
      const ya = vistos.get(nombre);
      expect([nombre, ya ?? null]).toEqual([nombre, null]);
      vistos.set(nombre, etapa);
    }
  });
});
