/** La misma persona en dos formaciones: cuándo sí y cuándo no. */

import {
  motivoDeSegundaImposible,
  seCursanJuntas,
  type AccionParaCombinar,
} from './segunda-inscripcion';

/// Las de ADECOPRIA, con la pareja puesta como en la migración.
const FORO: AccionParaCombinar = {
  id: 'af7',
  codigo: 'AF7',
  nombre: 'Salto adelante',
  combinaConAccionId: null,
};
const AF1: AccionParaCombinar = {
  id: 'af1',
  codigo: 'AF1',
  nombre: 'Gestión de la atención',
  combinaConAccionId: FORO.id,
};
const AF2: AccionParaCombinar = {
  id: 'af2',
  codigo: 'AF2',
  nombre: 'Diseño estratégico',
  combinaConAccionId: FORO.id,
};
const AF3: AccionParaCombinar = {
  id: 'af3',
  codigo: 'AF3',
  nombre: 'Gobernanza',
  combinaConAccionId: null,
};

/// El AF7 del OTRO gremio: mismo código, otra cosa.
const AF7_AJENA: AccionParaCombinar = {
  id: 'br-af7',
  codigo: 'AF7',
  nombre: 'Expansión global',
  combinaConAccionId: null,
};

describe('seCursanJuntas', () => {
  it('AF1 con el foro, en los dos sentidos', () => {
    expect(seCursanJuntas(AF1, FORO)).toBe(true);
    expect(seCursanJuntas(FORO, AF1)).toBe(true);
  });

  it('AF2 con el foro también', () => {
    expect(seCursanJuntas(AF2, FORO)).toBe(true);
  });

  it('AF1 con AF2 no: las dos nombran al foro, no entre ellas', () => {
    expect(seCursanJuntas(AF1, AF2)).toBe(false);
  });

  it('AF3 con el foro tampoco', () => {
    expect(seCursanJuntas(AF3, FORO)).toBe(false);
  });

  it('consigo misma, nunca', () => {
    expect(seCursanJuntas(AF1, { ...AF1 })).toBe(false);
  });

  /// LA TRAMPA DE ESTE CAMBIO, y por eso la regla va por ID.
  ///
  /// «AF7» existe en ADECOPRIA y en BRITCHAM y no es la misma
  /// cosa: allá es el foro híbrido y aquí «Expansión global»,
  /// presencial. Escrita sobre el código, esta pareja habría
  /// dejado repetir en un gremio que no lo pidió.
  it('el AF7 del otro gremio NO combina, aunque el código coincida', () => {
    expect(seCursanJuntas(AF1, AF7_AJENA)).toBe(false);
  });
});

describe('motivoDeSegundaImposible', () => {
  it('sin ninguna ficha previa, entra', () => {
    expect(motivoDeSegundaImposible(AF3, [])).toBeNull();
  });

  it('quien está en AF1 puede sumar el foro', () => {
    expect(motivoDeSegundaImposible(FORO, [AF1])).toBeNull();
  });

  /// Simétrica: lo decidió Josse. Quien entró por el foro puede
  /// sumar su curso después.
  it('y quien está en el foro puede sumar AF1', () => {
    expect(motivoDeSegundaImposible(AF1, [FORO])).toBeNull();
  });

  it('quien está en AF1 NO puede sumar AF2', () => {
    const m = motivoDeSegundaImposible(AF2, [AF1]);
    expect(m).toContain('AF1');
    expect(m).toContain('no se cursa a la vez');
  });

  it('quien está en AF3 no puede sumar nada', () => {
    expect(motivoDeSegundaImposible(FORO, [AF3])).not.toBeNull();
    expect(motivoDeSegundaImposible(AF1, [AF3])).not.toBeNull();
  });

  /// Se distingue de la pareja imposible a propósito: se arreglan
  /// de formas distintas y el asesor tiene a la persona delante.
  it('ya estar en ESA misma se dice con otras palabras', () => {
    const m = motivoDeSegundaImposible(AF1, [AF1]);
    expect(m).toContain('ya está inscrita');
  });

  /// DOS ES EL TECHO. Con tres fichas no se puede explicar cuál
  /// pareja vale, y el conteo de inscritos deja de sostenerse.
  it('con dos fichas ya no entra una tercera, aunque combinara', () => {
    const m = motivoDeSegundaImposible(AF2, [AF1, FORO]);
    expect(m).toContain('dos formaciones');
  });

  /// El mensaje lo lee un asesor con la persona al teléfono.
  it('el mensaje nombra la formación que ya tiene', () => {
    const m = motivoDeSegundaImposible(AF2, [AF3]);
    expect(m).toContain('Gobernanza');
    expect(m).toContain('Diseño estratégico');
  });
});
