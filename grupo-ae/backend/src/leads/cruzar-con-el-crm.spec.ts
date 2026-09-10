import { partirNombreCompleto, porDondeSeEncontro } from './cruzar-con-el-crm';

/// Lo que cuida esto: que un lead de pauta no se cruce con la
/// persona equivocada, y que el nombre no entre de una pieza.

describe('partir un nombre completo', () => {
  it('dos palabras: nombre y apellido', () => {
    expect(partirNombreCompleto('Ana Jaramillo')).toEqual({
      primerNombre: 'Ana',
      segundoNombre: null,
      primerApellido: 'Jaramillo',
      segundoApellido: null,
    });
  });

  it('tres: un nombre y dos apellidos, que es lo normal acá', () => {
    expect(partirNombreCompleto('Ana Jaramillo Ruiz')).toEqual({
      primerNombre: 'Ana',
      segundoNombre: null,
      primerApellido: 'Jaramillo',
      segundoApellido: 'Ruiz',
    });
  });

  it('cuatro: dos y dos', () => {
    expect(partirNombreCompleto('Ana María Jaramillo Ruiz')).toEqual({
      primerNombre: 'Ana',
      segundoNombre: 'María',
      primerApellido: 'Jaramillo',
      segundoApellido: 'Ruiz',
    });
  });

  it('los apellidos son SIEMPRE los dos últimos', () => {
    // «Juan Carlos de la Hoz Peña» queda mal repartido, y por
    // eso esto va a una propuesta y no a la ficha: lo confirma
    // quien llama
    const r = partirNombreCompleto('Juan Carlos de la Hoz Peña');
    expect(r.primerApellido).toBe('Hoz');
    expect(r.segundoApellido).toBe('Peña');
  });

  it('una sola palabra no inventa apellido', () => {
    const r = partirNombreCompleto('Ana');
    expect(r.primerNombre).toBe('Ana');
    expect(r.primerApellido).toBe('');
  });

  it('vacío no revienta', () => {
    expect(partirNombreCompleto('   ').primerNombre).toBe('');
  });

  it('los espacios de más no cuentan', () => {
    expect(partirNombreCompleto('  Ana   Jaramillo  ').primerApellido).toBe(
      'Jaramillo',
    );
  });
});

describe('lo que se le dice al asesor sobre el cruce', () => {
  it('por documento: es la misma persona', () => {
    const t = porDondeSeEncontro({
      participanteId: 'p',
      personaId: 'q',
      por: 'DOCUMENTO',
      firme: true,
    });
    expect(t).toContain('misma persona');
  });

  it('por correo: se le AVISA que puede no serlo', () => {
    // una empresa pone el correo de la secretaria en veinte
    // formularios, y los veinte no son la misma persona
    const t = porDondeSeEncontro({
      participanteId: 'p',
      personaId: 'q',
      por: 'CORREO',
      firme: false,
    });
    expect(t).toContain('Confírmelo');
    expect(t).toContain('comparten');
  });

  it('por celular: igual', () => {
    const t = porDondeSeEncontro({
      participanteId: 'p',
      personaId: 'q',
      por: 'CELULAR',
      firme: false,
    });
    expect(t).toContain('Confírmelo');
  });
});
