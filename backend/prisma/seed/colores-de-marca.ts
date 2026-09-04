/** Pinta el panel con el color de cada logo. */

import { writeFileSync } from 'node:fs';

import { derivarTemas } from '../../src/admin/derivar';
import { contraste } from '../../src/admin/contraste';
import { COMPROBACIONES_CONTRASTE, type ColoresTema } from '../../src/admin/temas';

type EsquemaColor = 'CLARO' | 'OSCURO';

// muestreados de los logos que hay en produccion
const MARCAS = [
  { clave: 'general', color: '#C615EA', de: 'Grupo AE, medio del gradiente' },
  { clave: 'adecopria', color: '#558E1C', de: 'ADECOPRIA, verde del logo' },
  { clave: 'britcham-adee', color: '#4055BF', de: 'ADEE, azul del logo' },
];

/** Solo lo que difiere del general: la herencia se conserva. */
function soloLoQueCambia(
  propio: ColoresTema,
  general: ColoresTema,
): Record<string, string> {
  const diff: Record<string, string> = {};
  for (const [k, v] of Object.entries(propio)) {
    if (general[k as keyof ColoresTema] !== v) diff[k] = v as string;
  }
  return diff;
}

/** Los pares que no llegan al minimo, si queda alguno. */
function ilegibles(colores: ColoresTema): string[] {
  const malos: string[] = [];
  for (const c of COMPROBACIONES_CONTRASTE) {
    if (c.entreEstados) continue;
    const minimo = c.grande ? 3 : 4.5;
    const r = contraste(
      colores[c.fondo as keyof ColoresTema],
      colores[c.frente as keyof ColoresTema],
    );
    if (r !== null && r < minimo) {
      malos.push(`${c.frente}/${c.fondo} ${r.toFixed(2)}<${minimo}`);
    }
  }
  return malos;
}

const esquemas: EsquemaColor[] = ['CLARO', 'OSCURO'];
const derivadas = new Map<string, Record<EsquemaColor, ColoresTema>>();

for (const m of MARCAS) {
  const temas = derivarTemas({ principal: m.color, encabezadoDeColor: true });
  derivadas.set(m.clave, temas);

  console.log(`\n${m.clave.toUpperCase()}  ${m.color}  (${m.de})`);
  for (const e of esquemas) {
    const malos = ilegibles(temas[e]);
    console.log(
      `  ${e.padEnd(7)} marca ${temas[e].marca}  ` +
        `encabezado ${temas[e].encabezadoFondo}  ` +
        (malos.length ? `ILEGIBLES: ${malos.join('; ')}` : 'contraste OK'),
    );
  }
}

const general = derivadas.get('general')!;
const salida: Record<string, unknown> = {
  general: { CLARO: general.CLARO, OSCURO: general.OSCURO },
};

for (const clave of ['adecopria', 'britcham-adee']) {
  const suyo = derivadas.get(clave)!;
  salida[clave] = {
    CLARO: soloLoQueCambia(suyo.CLARO, general.CLARO),
    OSCURO: soloLoQueCambia(suyo.OSCURO, general.OSCURO),
  };
  const n = Object.keys(
    (salida[clave] as Record<string, object>).CLARO,
  ).length;
  console.log(`\n${clave}: ${n} tokens propios en claro (el resto hereda)`);
}

writeFileSync('paletas.json', JSON.stringify(salida, null, 1), 'utf8');
console.log('\nescrito paletas.json');
