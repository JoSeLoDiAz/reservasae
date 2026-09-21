/** El celular se guarda de una sola forma, entre por donde entre. */

/**
 * `Persona.celular` se escribía CRUDO por casi todas sus puertas,
 * así que en la misma columna convivían `+57 300 111 2222`,
 * `+573001112222` y `3001112222`. Los tres son la misma persona y
 * ninguno se encuentra buscando por otro: el cruce de un lead
 * contra el CRM (`cruzar-con-el-crm`) busca por celular con
 * igualdad exacta, y el lead SÍ llega normalizado.
 *
 * Es el arreglo del commit 1dae76f del CRM de la raíz, traído
 * aquí. Y como allá, el spec prueba la PUERTA —el DTO construido
 * con las MISMAS opciones que `main.ts`— y no solo la función
 * pura: con solo la función en verde este defecto sobrevivió, porque
 * la regla existía y las puertas no la llamaban.
 */

import { plainToInstance } from 'class-transformer';

import { aCelularGuardable } from './celular';
import { ActualizarParticipanteDto, CrearParticipanteDto } from '../crm/dto';
import { analizar } from '../crm/carga';
import { ArreglarLeadDto } from '../leads/dto';
import {
  CrearPreinscripcionDto,
  DatosPersonaDto,
} from '../preinscripcion/dto';

/// Las opciones de `main.ts`, no las de por defecto: es la
/// lección que este repositorio ya tiene escrita del campo vacío
/// que llegaba como cero.
const COMO_EN_MAIN = { enableImplicitConversion: true } as const;

/// Pasa `celular` por el DTO y devuelve lo que llegaría al
/// servicio. El resto de campos da igual: aquí no se valida.
type ConCelular = new () => { celular?: string | null };

function porEl(Dto: ConCelular, celular: unknown): unknown {
  return plainToInstance(Dto, { celular }, COMO_EN_MAIN).celular;
}

/// Todas las puertas que escriben `Persona.celular` pasando por
/// un DTO. La conversión de un lead y el pegado desde Excel no
/// pasan por ninguno: la primera copia lo que dejó
/// `ArreglarLeadDto` (o la entrada de leads, que ya normalizaba)
/// y el segundo va aparte, abajo.
const PUERTAS: Array<[string, ConCelular]> = [
  ['la ficha nueva del panel', CrearParticipanteDto],
  ['editar la ficha en el panel', ActualizarParticipanteDto],
  ['la preinscripción pública', CrearPreinscripcionDto],
  ['el enlace de completar datos', DatosPersonaDto],
  ['arreglar un lead en la mesa', ArreglarLeadDto],
];

describe('la regla: aCelularGuardable', () => {
  it('las tres grafías que conviven quedan iguales', () => {
    expect(aCelularGuardable('+57 300 111 2222')).toBe('3001112222');
    expect(aCelularGuardable('+573001112222')).toBe('3001112222');
    expect(aCelularGuardable('3001112222')).toBe('3001112222');
  });

  it('y también con guiones y paréntesis', () => {
    expect(aCelularGuardable('(300) 111-2222')).toBe('3001112222');
    expect(aCelularGuardable('57-300-111-2222')).toBe('3001112222');
  });

  /// La regla de la casa: el celular avisa, no bloquea. Un «no
  /// tiene» tecleado se conserva para que el asesor lo vea y lo
  /// corrija; vaciarlo sería decidir por él que ahí no había nada.
  it('lo que no es un móvil se conserva tal cual, solo recortado', () => {
    expect(aCelularGuardable('no tiene')).toBe('no tiene');
    expect(aCelularGuardable('  601 2345678  ')).toBe('601 2345678');
    expect(aCelularGuardable('')).toBe('');
  });

  /// En los DTO de edición `null` borra y ausente no toca.
  /// Confundirlos pisaría un celular bueno con nada.
  it('lo que no es texto no se toca', () => {
    expect(aCelularGuardable(undefined)).toBeUndefined();
    expect(aCelularGuardable(null)).toBeNull();
  });
});

describe.each(PUERTAS)('la puerta: %s', (_nombre, Dto) => {
  it('normaliza antes de llegar al servicio', () => {
    expect(porEl(Dto, '+57 300 111 2222')).toBe('3001112222');
    expect(porEl(Dto, '+573001112222')).toBe('3001112222');
    expect(porEl(Dto, '3001112222')).toBe('3001112222');
  });

  it('y no destruye lo que no es un móvil', () => {
    expect(porEl(Dto, 'no tiene')).toBe('no tiene');
  });

  it('y lo que no mandaron sigue sin mandarse', () => {
    expect(porEl(Dto, undefined)).toBeUndefined();
  });
});

describe('la preinscripción pública sigue tratando el vacío como ausente', () => {
  /// El CRM de la raíz cambió `aTexto` por la regla a secas, y
  /// con eso una casilla en blanco llega como `''` en vez de
  /// ausente. En el enlace de completado eso BORRA el celular
  /// que ya tenía: `guardarPersona` pasa `dto.celular` tal cual a
  /// `persona.update`, que escribe `''` y salta `undefined`.
  it.each<[string, ConCelular]>([
    ['la preinscripción', CrearPreinscripcionDto],
    ['el enlace de completar datos', DatosPersonaDto],
  ])('%s: una casilla en blanco no toca el celular', (_n, Dto) => {
    expect(porEl(Dto, '')).toBeUndefined();
    expect(porEl(Dto, '   ')).toBeUndefined();
  });
});

describe('arreglar un lead en la mesa', () => {
  /// Todo opcional: `null` BORRA. Si la normalización lo
  /// convirtiera en otra cosa, el asesor no podría quitar un
  /// número equivocado.
  it('null sigue borrando', () => {
    expect(porEl(ArreglarLeadDto, null)).toBeNull();
  });
});

describe('el pegado desde Excel', () => {
  /// Esta puerta llama a `crear()` con un objeto suelto, sin
  /// pasar por el DTO. Antes solo quitaba espacios, guiones y
  /// paréntesis, así que el indicativo se quedaba pegado.
  function celularDeLaFila(celular: string) {
    const [fila] = analizar(`CC\t1020304050\tLuis\t\tPérez\t\t\t${celular}`);
    return fila;
  }

  it('deja las tres grafías en diez dígitos', () => {
    expect(celularDeLaFila('+57 300 111 2222').celular).toBe('3001112222');
    expect(celularDeLaFila('+573001112222').celular).toBe('3001112222');
    expect(celularDeLaFila('573001112222').celular).toBe('3001112222');
  });

  it('lo que no es un móvil se guarda y se avisa como se escribió', () => {
    const fila = celularDeLaFila('no tiene');
    expect(fila.celular).toBe('no tiene');
    expect(fila.problemas.join(' ')).toContain('«no tiene» no parece un celular');
  });

  it('sin celular sigue siendo nulo', () => {
    expect(celularDeLaFila('').celular).toBeNull();
  });
});
