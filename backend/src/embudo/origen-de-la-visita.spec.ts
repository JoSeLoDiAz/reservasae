/** La compuerta de pago, y la que no la necesita. */

/// Son dos preguntas distintas sobre la misma visita:
/// «¿esto prueba que se PAGÓ?» y «¿esto prueba POR DÓNDE
/// llegó?». La primera protege la cifra con la que se
/// justifica un gasto y por eso exige `utm_campaign` o
/// `fbclid`; la segunda solo describe, y pedirle prueba de
/// pago a un correo sería pedirle algo que nunca puede dar.
///
/// Hasta el 16 sep 2026 la primera no tenía NI UN test, y es
/// justo la que este cambio roza.

import { OrigenParticipante } from '../../generated/prisma';

import {
  DE_CANAL,
  DE_RED,
  canalDeLaVisita,
  origenDeLaVisita,
  redDeLaVisita,
} from './origen-de-la-visita';
import { PROCEDENCIAS } from './procedencia';

/// A MANO y no derivada de `DE_CANAL`: derivándola, añadir una
/// entrada saca esa procedencia del conjunto esperado y el
/// bucle pasa igual. Un test que no puede fallar es peor que
/// ninguno.
const SIN_CANAL = [
  'FACEBOOK',
  'INSTAGRAM',
  'META',
  'BUSQUEDA',
  'QR',
  'INTERNO',
  'OTRA_WEB',
  'OTRO_DECLARADO',
  'SIN_REFERENCIA',
];

describe('qué procedencia sella el canal de la ficha', () => {
  /// RESERVA entro el 18 sep 2026: el enlace que reparte una
  /// empresa con cupos, y sella EMPRESA. Ver `DE_CANAL`.
  /// WHATSAPP entro el mismo dia: el panel ya lo ofrecia y la
  /// ficha no lo guardaba.
  it('hoy son CORREO, RESERVA y WHATSAPP, y solo esos tres', () => {
    expect(Object.keys(DE_CANAL).sort()).toEqual(['CORREO', 'RESERVA', 'WHATSAPP']);
  });

  it('la reserva sella «La empresa lo nominó»', () => {
    expect(canalDeLaVisita({ procedencia: 'RESERVA', pagada: false })).toBe('EMPRESA');
  });

  /// Si alguien añade una procedencia nueva, esto falla y le
  /// obliga a decidir si sella canal o no. Es el criterio de
  /// las pruebas de ámbito: recorrer la superficie, no el caso.
  it('las doce procedencias están todas clasificadas', () => {
    expect([...SIN_CANAL, ...Object.keys(DE_CANAL)].sort()).toEqual(
      [...PROCEDENCIAS].sort(),
    );
  });

  it('ninguna de las demás sella un canal', () => {
    for (const p of SIN_CANAL) {
      expect(canalDeLaVisita({ procedencia: p, pagada: false })).toBeNull();
    }
  });

  /// El `??` de cada función elegiría en silencio, y la
  /// compuerta de pago dejaría de serlo.
  it('los dos mapas no comparten ni una procedencia', () => {
    const cruce = Object.keys(DE_RED).filter((k) => k in DE_CANAL);
    expect(cruce).toEqual([]);
  });
});

describe('el canal no pide prueba de pago', () => {
  it('un correo sin etiqueta de campaña sella CORREO igual', () => {
    expect(canalDeLaVisita({ procedencia: 'CORREO', pagada: false })).toBe(
      OrigenParticipante.CORREO,
    );
  });

  /// Lo que NO puede pasar: que un `utm_campaign` inventado
  /// junto a `utm_source=correo` acuñe una ficha de pauta.
  it('y un correo NUNCA se vuelve pauta, traiga lo que traiga', () => {
    expect(origenDeLaVisita({ procedencia: 'CORREO', pagada: true })).toBeNull();
  });
});

describe('la pauta sí pide prueba de pago', () => {
  it('sin etiqueta de campaña no atribuye', () => {
    expect(origenDeLaVisita({ procedencia: 'FACEBOOK', pagada: false })).toBeNull();
  });

  it('con etiqueta sí', () => {
    expect(origenDeLaVisita({ procedencia: 'FACEBOOK', pagada: true })).toBe(
      OrigenParticipante.FACEBOOK,
    );
  });

  /// El toque es lo cierto que no cambia de quién es el lead:
  /// llegó por ahí aunque no se pueda probar que se pagó.
  it('pero el toque se deja aunque no se haya pagado', () => {
    expect(redDeLaVisita({ procedencia: 'FACEBOOK', pagada: false })).toBe(
      OrigenParticipante.FACEBOOK,
    );
  });
});

describe('sin visita no se inventa nada', () => {
  it('las tres devuelven null', () => {
    for (const f of [origenDeLaVisita, redDeLaVisita, canalDeLaVisita]) {
      expect(f(null)).toBeNull();
      expect(f({ procedencia: null, pagada: true })).toBeNull();
    }
  });
});
