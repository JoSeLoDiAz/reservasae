/** Sin correo ni celular no se capta. */

import { hayComoResponder } from './hay-como-responder';

describe('con qué se le responde a quien escribió', () => {
  it('con un correo basta', () => {
    const r = hayComoResponder({ correo: 'ana@empresa.com' });
    expect(r.puede).toBe(true);
    expect(r.correo).toBe('ana@empresa.com');
    expect(r.celular).toBeNull();
  });

  it('con un celular basta', () => {
    const r = hayComoResponder({ celular: '3001112222' });
    expect(r.puede).toBe(true);
    expect(r.celular).toBe('3001112222');
  });

  it('sin ninguno de los dos, no se capta', () => {
    const r = hayComoResponder({});
    expect(r.puede).toBe(false);
    expect(r.porque).toContain('correo o un celular');
  });

  it('los espacios en blanco no cuentan como contacto', () => {
    const r = hayComoResponder({ correo: '   ', celular: '  ' });
    expect(r.puede).toBe(false);
    expect(r.porque).toContain('correo o un celular');
  });

  describe('lo que se guarda queda limpio', () => {
    /// Se normalizan aquí y no en cada llamador: `Ana@Empresa.COM`
    /// y `ana@empresa.com` son el mismo buzón, y guardados
    /// distinto no se cruzan.
    it('el correo baja a minúsculas y se recorta', () => {
      const r = hayComoResponder({ correo: '  Ana@Empresa.COM ' });
      expect(r.correo).toBe('ana@empresa.com');
    });

    /// El mismo normalizador del resto del sistema: si aquí se
    /// guardara con el indicativo, este celular no cruzaría con el
    /// que ya está en su ficha.
    it('el celular pierde el indicativo y los separadores', () => {
      const r = hayComoResponder({ celular: '+57 300 111 2222' });
      expect(r.celular).toBe('3001112222');
    });
  });

  describe('lo que no sirve se dice por su nombre', () => {
    it('un correo mal tecleado no vale como contacto', () => {
      const r = hayComoResponder({ correo: 'ana@empresa' });
      expect(r.puede).toBe(false);
      expect(r.porque).toContain('no es un correo');
    });

    /// Un fijo no recibe mensajes, que es para lo que se pide.
    it('un fijo no vale como celular', () => {
      const r = hayComoResponder({ celular: '6015551234' });
      expect(r.puede).toBe(false);
      expect(r.porque).toContain('no es un celular');
    });

    it('«no tiene» tampoco vale', () => {
      const r = hayComoResponder({ celular: 'no tiene' });
      expect(r.puede).toBe(false);
    });

    /**
     * El aserto que separa las dos negativas: a quien escribió algo
     * mal se le señala lo que escribió, no se le pide de cero. Es
     * la diferencia entre corregir un campo y volver a llenar el
     * formulario.
     */
    it('a quien tecleó mal se le nombra lo que tecleó', () => {
      const r = hayComoResponder({ correo: 'ana(arroba)empresa.com' });
      expect(r.porque).toContain('ana(arroba)empresa.com');
      expect(r.porque).not.toContain('Déjenos');
    });

    /// Con uno bueno y otro malo, se capta: exigir los dos es
    /// pedir de más, y cada campo obligatorio se paga en gente que
    /// no termina el formulario.
    it('un correo bueno salva a un celular malo', () => {
      const r = hayComoResponder({
        correo: 'ana@empresa.com',
        celular: '123',
      });
      expect(r.puede).toBe(true);
      expect(r.correo).toBe('ana@empresa.com');
      expect(r.celular).toBeNull();
    });
  });
});
