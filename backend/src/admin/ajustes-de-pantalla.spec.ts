/** Los ajustes de pantalla que viajan con la cuenta. */

import {
  AJUSTES_POR_DEFECTO,
  conAjustes,
  escalaValida,
  leerAjustesDePantalla,
} from './ajustes-de-pantalla';

describe('ajustes de pantalla', () => {
  describe('leer lo guardado', () => {
    it('sin nada guardado, los de siempre', () => {
      expect(leerAjustesDePantalla(null)).toEqual(AJUSTES_POR_DEFECTO);
      expect(leerAjustesDePantalla(undefined)).toEqual(AJUSTES_POR_DEFECTO);
    });

    it('lo que no es un objeto no se mira', () => {
      expect(leerAjustesDePantalla('110')).toEqual(AJUSTES_POR_DEFECTO);
      expect(leerAjustesDePantalla([110])).toEqual(AJUSTES_POR_DEFECTO);
      expect(leerAjustesDePantalla(110)).toEqual(AJUSTES_POR_DEFECTO);
    });

    it('lee una escala del recorrido', () => {
      expect(leerAjustesDePantalla({ texto: 110 }).texto).toBe(110);
      expect(leerAjustesDePantalla({ texto: 90 }).texto).toBe(90);
      expect(leerAjustesDePantalla({ texto: 140 }).texto).toBe(140);
    });

    /// El tamaño de la interfaz entera sale de aquí: una escala
    /// disparatada guardada a mano no puede llegar al navegador.
    it('una escala fuera del recorrido cae al 100 %', () => {
      expect(leerAjustesDePantalla({ texto: 400 }).texto).toBe(100);
      expect(leerAjustesDePantalla({ texto: 10 }).texto).toBe(100);
      expect(leerAjustesDePantalla({ texto: -110 }).texto).toBe(100);
      expect(leerAjustesDePantalla({ texto: Number.NaN }).texto).toBe(100);
      expect(leerAjustesDePantalla({ texto: 'grande' }).texto).toBe(100);
    });

    it('una escala que no va de cinco en cinco cae al 100 %', () => {
      expect(escalaValida(103)).toBe(false);
      expect(leerAjustesDePantalla({ texto: 103 }).texto).toBe(100);
    });

    it('las dos ayudas solo se leen si son sí o no', () => {
      expect(leerAjustesDePantalla({ sinMovimiento: true }).sinMovimiento).toBe(true);
      expect(leerAjustesDePantalla({ sinMovimiento: 'si' }).sinMovimiento).toBe(false);
      expect(leerAjustesDePantalla({ enlacesSubrayados: true }).enlacesSubrayados).toBe(true);
      expect(leerAjustesDePantalla({ enlacesSubrayados: 1 }).enlacesSubrayados).toBe(false);
    });

    it('un campo roto no se lleva a los demás', () => {
      expect(leerAjustesDePantalla({ texto: 999, sinMovimiento: true })).toEqual({
        texto: 100,
        sinMovimiento: true,
        enlacesSubrayados: false,
      });
    });
  });

  describe('guardar lo que se tocó', () => {
    /// Es lo que evita que mover la escala apague las dos ayudas que
    /// esa persona tenía encendidas.
    it('suma, no reemplaza', () => {
      const tenia = { texto: 120, sinMovimiento: true, enlacesSubrayados: true };
      expect(conAjustes(tenia, { texto: 110 })).toEqual({
        texto: 110,
        sinMovimiento: true,
        enlacesSubrayados: true,
      });
    });

    it('apagar una ayuda no toca la escala', () => {
      const tenia = { texto: 120, sinMovimiento: true, enlacesSubrayados: false };
      expect(conAjustes(tenia, { sinMovimiento: false })).toEqual({
        texto: 120,
        sinMovimiento: false,
        enlacesSubrayados: false,
      });
    });

    it('lo que llega roto no ensucia lo guardado', () => {
      const tenia = { texto: 110, sinMovimiento: false, enlacesSubrayados: false };
      expect(conAjustes(tenia, { texto: 999 } as never).texto).toBe(100);
    });
  });
});
