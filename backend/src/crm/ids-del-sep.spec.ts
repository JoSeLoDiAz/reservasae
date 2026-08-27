/// Que ningun id inventado llegue al cargue del SEP.
///
/// Lo encontro un recorrido del entorno de pruebas: la ruta
/// del ASESOR rechazaba un genero inventado y la del CIUDADANO
/// lo aceptaba. La publica era la mas permisiva de las dos, al
/// reves de como tiene que ser.
///
/// Y la comprobacion del municipio corria solo cuando llegaban
/// los DOS campos, asi que partiendo la peticion en dos entraba
/// un par imposible -- y despues la ficha contaba como
/// completa, lista para el cargue, con un municipio inexistente.

import { motivoDeIdInvalido } from './catalogos-sep';

/// Antioquia y Medellin son los codigos DANE de verdad.
const ANTIOQUIA = 5;
const MEDELLIN = 5001;
/// Bogota, que no es de Antioquia.
const BOGOTA_DEPTO = 11;
const BOGOTA = 11001;

describe('los ids del SEP de una persona', () => {
  it('lo que cuadra pasa', () => {
    expect(
      motivoDeIdInvalido({
        generoSepId: 1,
        departamentoSepId: ANTIOQUIA,
        municipioSepId: MEDELLIN,
      }),
    ).toBeNull();
  });

  it('nada obligatorio: vacio pasa', () => {
    expect(motivoDeIdInvalido({})).toBeNull();
  });

  it('un genero que no existe se rechaza', () => {
    expect(motivoDeIdInvalido({ generoSepId: 77 })).toContain('género');
  });

  it('un departamento que no existe se rechaza', () => {
    expect(motivoDeIdInvalido({ departamentoSepId: 999 })).toContain(
      'departamento',
    );
  });

  it('un nivel ocupacional que no existe se rechaza', () => {
    expect(motivoDeIdInvalido({ nivelOcupacionalSepId: 4242 })).toContain(
      'nivel ocupacional',
    );
  });

  it('un municipio que no existe se rechaza AUNQUE llegue solo', () => {
    // era el hueco: sin departamento no se comprobaba nada
    expect(motivoDeIdInvalido({ municipioSepId: 888888 })).toContain(
      'municipio',
    );
  });

  it('un municipio de OTRO departamento se rechaza', () => {
    expect(
      motivoDeIdInvalido({
        departamentoSepId: ANTIOQUIA,
        municipioSepId: BOGOTA,
      }),
    ).toContain('municipio');
  });

  it('partir la peticion en dos ya no cuela el par imposible', () => {
    // primero se guardo Antioquia; ahora llega solo Bogota
    expect(
      motivoDeIdInvalido(
        { municipioSepId: BOGOTA },
        { departamentoSepId: ANTIOQUIA },
      ),
    ).toContain('municipio');
  });

  it('y con el departamento guardado que si cuadra, pasa', () => {
    expect(
      motivoDeIdInvalido(
        { municipioSepId: MEDELLIN },
        { departamentoSepId: ANTIOQUIA },
      ),
    ).toBeNull();
  });

  it('el departamento que llega manda sobre el guardado', () => {
    expect(
      motivoDeIdInvalido(
        { departamentoSepId: BOGOTA_DEPTO, municipioSepId: BOGOTA },
        { departamentoSepId: ANTIOQUIA },
      ),
    ).toBeNull();
  });
});
