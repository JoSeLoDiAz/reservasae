/** Las plazas se cuentan igual en las cinco pantallas y al escribir. */

/**
 * LA CUENTA ESTABA COPIADA EN SIETE SITIOS.
 *
 * `Oferta.cuposOcupados` son SOLO las plazas que apartan las empresas
 * ---lo mueve únicamente `reservas.service.ts`, y en `admin.service.ts`
 * hasta se llama `cuposReservados`---. Quien se inscribe por su cuenta
 * no estaba en ningún contador.
 *
 * Lo vio el cliente el 2 oct 2026 comparando dos pantallas: el sitio
 * público decía 422 libres en AF1, y el panel de la misma acción 520 de
 * tope, 98 apartados y 120 personas ya dentro. 520 − 98 = 422.
 *
 * Y ARREGLARLO EN UNA COPIA CREÓ EL SIGUIENTE FALLO: el catálogo pasó a
 * contar bien mientras la preinscripción seguía con el número viejo, o
 * sea las dos pantallas públicas contradiciéndose. Por eso la decisión
 * vive ahora en un solo sitio.
 */

import { plazasOcupadas } from './plazas-de-la-oferta';

describe('cuántas plazas están ocupadas', () => {
  it('las apartadas por empresas y las de quien entró por su cuenta', () => {
    expect(plazasOcupadas(98, 120)).toBe(218);
  });

  it('con 520 de tope, quedan 302 y no 422', () => {
    expect(520 - plazasOcupadas(98, 120)).toBe(302);
    /// Lo que decía antes.
    expect(520 - 98).toBe(422);
  });

  /**
   * EL DAÑO OPUESTO, que es igual de malo: quien entró POR una reserva
   * ya está contado en las apartadas. Sumarlo otra vez cerraría ofertas
   * con sitio, y por eso solo cuentan los de `reservaId` nulo.
   */
  it('sin inscritos directos, la cuenta no cambia', () => {
    expect(plazasOcupadas(98, 0)).toBe(98);
  });
});

describe('quién usa la cuenta buena', () => {
  const leer = (ruta: string) =>
    require('fs').readFileSync(
      require('path').join(__dirname, '..', ruta),
      'utf8',
    ) as string;

  it('el catálogo público', () => {
    expect(leer('catalogo/catalogo.service.ts')).toContain('plazasOcupadas(');
  });

  /**
   * LA PREINSCRIPCIÓN, que es la que el cliente señaló: pintaba
   * «Disponibilidad: N cupos» en rojo, como una promesa, con el número
   * inflado.
   */
  it('el formulario público de preinscripción', () => {
    const t = leer('preinscripcion/preinscripcion.service.ts');
    expect(t).toContain('inscritosPorSuCuenta(');
    expect(t).toContain('plazasOcupadas(o.cuposOcupados, sueltos.get(o.id) ?? 0)');
    expect(t).not.toContain('libres: Math.max(0, o.cuposMaximos - o.cuposOcupados)');
  });

  /**
   * Y EL CAMINO QUE ESCRIBE, que es donde la cuenta vieja hacía el daño
   * de verdad: con 302 plazas reales se le CONFIRMABAN 422 a una
   * empresa, y nadie entraba en lista de espera porque el cálculo creía
   * que había sitio.
   */
  it('crear, editar y la lista de espera', () => {
    const t = leer('reservas/reservas.service.ts');
    /// Las tres: el alta, el techo al editar y la promoción.
    expect(t.split('ocupadasDeLaOferta(tx').length - 1).toBe(3);
    expect(t).not.toContain(
      'const disponibles = bloqueada.cuposMaximos - bloqueada.cuposOcupados;',
    );
  });

  /**
   * DENTRO DE LA TRANSACCIÓN Y DESPUÉS DEL BLOQUEO. Contar fuera deja
   * abierta la misma carrera que el bloqueo existe para cerrar.
   */
  it('y lo cuenta con el `tx`, no con el prisma suelto', () => {
    const t = leer('reservas/reservas.service.ts');
    expect(t).not.toContain('ocupadasDeLaOferta(this.prisma');
  });
});
