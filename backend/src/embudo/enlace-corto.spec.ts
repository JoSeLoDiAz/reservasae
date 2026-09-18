/** El enlace corto que arma el panel, y el que lee la baliza. */

/// Vive en el frontend y se prueba aqui, como el armador de
/// `lo-que-el-panel-ofrece-se-clasifica.spec.ts`: es el servidor
/// quien sabe que canales existen, y un prefijo que no clasifique
/// dejaria el envio en «Otro declarado» sin que nada falle.

import {
  leerEnlaceCorto,
  palabraCorta,
  PREFIJO_DEL_CANAL,
  PREFIJOS,
} from '../../../frontend/src/lib/enlace-corto';
import { procedenciaSql } from './procedencia';

const RECONOCIDOS = new Set(
  (procedenciaSql().values as unknown[]).filter(
    (v): v is string => typeof v === 'string',
  ),
);

describe('el enlace corto', () => {
  it('cada prefijo lleva a un canal que el servidor clasifica', () => {
    for (const fuente of Object.values(PREFIJOS)) {
      expect(RECONOCIDOS.has(fuente)).toBe(true);
    }
  });

  /// La compuerta de pago. `pauta` entro el 18 sep 2026 y va a
  /// `meta`, que es lo unico cierto: el enlace no sabe si el
  /// anuncio se vio en Facebook o en Instagram. Ningun OTRO prefijo
  /// puede llevar a Meta, o un mailing se contaria como pagado.
  it('solo «pauta» lleva a Meta, y a ninguna red en concreto', () => {
    const deMeta = ['fb', 'facebook', 'ig', 'instagram', 'meta', 'redes'];
    for (const [p, f] of Object.entries(PREFIJOS)) {
      if (p === 'pauta') expect(f).toBe('meta');
      else expect(deMeta).not.toContain(f);
    }
    for (const p of Object.keys(PREFIJOS)) expect(deMeta).not.toContain(p);
  });

  it('?pauta0305202255 es pauta de Meta con su campana', () => {
    expect(leerEnlaceCorto('?pauta0305202255')).toEqual({
      fuente: 'meta',
      campana: 'pauta0305202255',
    });
    expect(palabraCorta('meta', '0305202255')).toBe('pauta0305202255');
  });

  it('lo que pidio Mauricio: ?mailing18092026', () => {
    expect(leerEnlaceCorto('?mailing18092026')).toEqual({
      fuente: 'correo',
      campana: 'mailing18092026',
    });
  });

  /// La reserva lleva la EMPRESA en el nombre (18 sep 2026).
  it('?reserva-transportes-el-condor dice reserva y la empresa', () => {
    expect(leerEnlaceCorto('?reserva-transportes-el-condor')).toEqual({
      fuente: 'reserva',
      campana: 'reserva-transportes-el-condor',
    });
    expect(palabraCorta('reserva', 'transportes-el-condor')).toBe(
      'reserva-transportes-el-condor',
    );
  });

  it('el canal a secas no inventa nombre de envio', () => {
    expect(leerEnlaceCorto('?mailing')).toEqual({ fuente: 'correo', campana: undefined });
  });

  it('los utm_ mandan sobre el corto', () => {
    expect(leerEnlaceCorto('?mailing1&utm_source=correo')).toBeNull();
    expect(leerEnlaceCorto('?mailing1&utm_campaign=otra')).toBeNull();
  });

  it('una clave con valor, o sin prefijo conocido, no es un enlace corto', () => {
    expect(leerEnlaceCorto('?qr=1')).toBeNull();
    expect(leerEnlaceCorto('?fbclid=abc')).toBeNull();
    expect(leerEnlaceCorto('')).toBeNull();
  });

  it('mayusculas en el enlace no cambian el canal', () => {
    expect(leerEnlaceCorto('?Mailing18092026')?.fuente).toBe('correo');
  });

  it('el panel arma la palabra como se pidio', () => {
    expect(palabraCorta('correo', '18092026')).toBe('mailing18092026');
    expect(palabraCorta('correo', 'mailing18092026')).toBe('mailing18092026');
    expect(palabraCorta('correo', 'septiembre')).toBe('mailing-septiembre');
    expect(palabraCorta('correo', '')).toBe('mailing');
    expect(palabraCorta('whatsapp', '0305')).toBe('whatsapp0305');
    // un nombre que empieza como OTRO canal no se cuela en ese canal
    expect(palabraCorta('correo', 'qr-feria')).toBe('mailing-qr-feria');
    expect(palabraCorta('', '18092026')).toBeNull();
  });

  /// Lo que arma el panel, la baliza lo lee al mismo canal.
  it('ida y vuelta para cada canal del panel', () => {
    for (const [canal] of Object.entries(PREFIJO_DEL_CANAL)) {
      for (const nombre of ['', '18092026', 'feria-bogota']) {
        const palabra = palabraCorta(canal, nombre)!;
        expect(leerEnlaceCorto(`?${palabra}`)?.fuente).toBe(canal);
      }
    }
  });
});
