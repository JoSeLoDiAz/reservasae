/** Cuántos cupos quedan en el grupo, medido como mide el candado. */

/**
 * Lo pidió el cliente: «cada vez que una persona se inscribe y se
 * asigna a un grupo, que nos muestre cuántos cupos quedan».
 *
 * LA REGLA CAMBIÓ EL 9 OCT 2026, A PROPÓSITO, Y ESTE SPEC LO DICE.
 * Antes fijaba que la cuenta se hiciera SIEMPRE con
 * `RETIENEN_ASIENTO`, y eso era medio cierto: protege de apuntar
 * doscientos leads encima de doscientos, pero también le cerraba la
 * puerta a quien YA ocupa silla.
 *
 * El caso que lo destapó, medido en producción: el grupo 3 de
 * ANTIOQUIA en AF1 de ADECOPRIA, tope 65, con 52 INSCRITOS y 13
 * INTERESADOS. `cabenEnLaCobertura` decía 0 y no dejaba mover a
 * nadie, mientras `exigirQueQuepa` ---el candado que de verdad
 * impide la sobreventa al inscribir--- contaba sillas y decía 52 de
 * 65: trece libres. El sistema se negaba a meter a alguien en un
 * grupo donde él mismo lo habría inscrito. Lo vio Josse, y su cuenta
 * era exacta: «52 más 13 me da 65».
 *
 * Lo que NO cambia, y sigue fijado aquí:
 *
 *   1. Se mide contra `cuposMaximos` ---el tope, con el 30 % de
 *      sobrecupo--- y nunca contra `cuposBase`.
 *   2. Un LEAD se sigue midiendo contra los apuntados, que es lo que
 *      impide llenar una cohorte de gente que no cabrá.
 *   3. El aforo no se relaja: un grupo con sus sillas llenas sigue
 *      diciendo que no.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cuantosCaben } from './elegibles-del-grupo';
import { OCUPAN_SILLA, RETIENEN_ASIENTO } from './etapas';

/// Quien ya ocupa silla: se mide en sillas.
const inscrito = (cuposMaximos: number, apuntados: number, sillas: number) =>
  cuantosCaben({ cuposMaximos, apuntados, sillas, entra: 'INSCRITO' });

/// Un lead: se mide en apuntados.
const lead = (cuposMaximos: number, apuntados: number, sillas: number) =>
  cuantosCaben({ cuposMaximos, apuntados, sillas, entra: 'INTERESADO' });

describe('el tope es cuposMaximos, no cuposBase', () => {
  it('un grupo de 50 comprometidos admite 65 con el sobrecupo', () => {
    /// `cuposMaximos` es `cuposBase` + 30 % truncado, y ya viene
    /// calculado en la base. Lo que este test fija es que la cuenta
    /// se hace contra ESE número.
    expect(lead(65, 50, 50)).toBe(15);
    expect(inscrito(65, 50, 50)).toBe(15);
  });

  it('con el tope alcanzado, cero', () => {
    expect(lead(65, 65, 65)).toBe(0);
    expect(inscrito(65, 65, 65)).toBe(0);
  });

  it('y con sobrecupo firmado por encima del tope, cero y no negativo', () => {
    /// El sobrecupo se permite y deja firma, así que una celda puede
    /// tener más gente que su tope. Devolver -5 haría que el `slice`
    /// del lote se comiera el final de la lista.
    expect(lead(65, 70, 70)).toBe(0);
    expect(inscrito(65, 70, 70)).toBe(0);
  });
});

describe('UN LEAD se mide contra los apuntados', () => {
  it('las dos listas no son la misma, y esa es la clave', () => {
    /// Si fueran iguales, no habría nada que decidir.
    expect(RETIENEN_ASIENTO.length).toBeGreaterThan(OCUPAN_SILLA.length);
  });

  it('un INTERESADO con grupo puesto YA retiene su asiento', () => {
    expect(RETIENEN_ASIENTO).toContain('INTERESADO');
    expect(OCUPAN_SILLA).not.toContain('INTERESADO');
  });

  it('y quien consume aula también retiene, claro', () => {
    /// `RETIENEN_ASIENTO` tiene que ser un superconjunto: si alguien
    /// «optimiza» quitando de ahí a los inscritos, el grupo volvería
    /// a verse vacío por el otro lado.
    expect(RETIENEN_ASIENTO).toEqual(expect.arrayContaining([...OCUPAN_SILLA]));
  });

  it('quien salió NO retiene: su asiento se liberó', () => {
    for (const e of [
      'RETIRADO',
      'DESERTO',
      'ABANDONO',
      'NO_APROBO',
      'PERDIDO',
    ] as const) {
      expect(RETIENEN_ASIENTO).not.toContain(e);
    }
  });

  it('CON DOSCIENTOS INTERESADOS DENTRO, el grupo NO se ve vacío', () => {
    /// Es la protección que la regla vieja daba y que no se pierde:
    /// sin ella el lote metía otros doscientos encima.
    expect(lead(65, 65, 0)).toBe(0);
  });
});

describe('QUIEN YA OCUPA SILLA se mide en sillas', () => {
  it('el caso de producción: 52 sillas y 13 leads en un tope de 65', () => {
    /// Grupo 3 de ANTIOQUIA, 9 oct 2026. Trece sillas libres de
    /// verdad, y antes salían cero.
    expect(inscrito(65, 65, 52)).toBe(13);
  });

  it('para el lead del mismo grupo, en cambio, sigue siendo cero', () => {
    /// Y es correcto: apuntar otro lead ahí llenaría la cohorte de
    /// gente que no va a caber.
    expect(lead(65, 65, 52)).toBe(0);
  });

  it('las tres etapas que ocupan silla se miden igual', () => {
    for (const e of OCUPAN_SILLA) {
      expect(
        cuantosCaben({
          cuposMaximos: 65,
          apuntados: 65,
          sillas: 52,
          entra: e,
        }),
      ).toBe(13);
    }
  });

  it('y las tres que NO ocupan silla, también entre ellas', () => {
    for (const e of RETIENEN_ASIENTO.filter(
      (x) => !OCUPAN_SILLA.includes(x),
    )) {
      expect(
        cuantosCaben({
          cuposMaximos: 65,
          apuntados: 65,
          sillas: 52,
          entra: e,
        }),
      ).toBe(0);
    }
  });
});

describe('EL AFORO NO SE RELAJA, que es lo que hace segura la regla', () => {
  it('con las sillas llenas, ni un inscrito más', () => {
    /// Lo único que convierte un apuntado en silla es pasar a
    /// INSCRITO, y esa puerta cuenta sillas. Un grupo de 65 puede
    /// tener cien leads encima y nunca tendrá 66 inscritos.
    expect(inscrito(65, 100, 65)).toBe(0);
  });

  it('LAS DOS PUERTAS COINCIDEN: lo que el aforo admite, esta no lo niega', () => {
    /// EL INVARIANTE QUE ESTABA ROTO, y es el que de verdad protege.
    ///
    /// `exigirQueQuepa` deja inscribir mientras las sillas no lleguen
    /// al tope. Si `cuantosCaben` dijera 0 ahí, el sistema se negaría
    /// a mover a alguien a un grupo donde sí lo inscribe --- que es
    /// exactamente el defecto del 9 oct. Se recorre toda la rejilla
    /// en vez de un caso elegido a mano.
    const tope = 20;
    for (let sillas = 0; sillas < tope; sillas++) {
      for (let apuntados = sillas; apuntados <= tope + 10; apuntados++) {
        for (const e of OCUPAN_SILLA) {
          expect(
            cuantosCaben({ cuposMaximos: tope, apuntados, sillas, entra: e }),
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('y al contrario: con el aforo lleno, ninguna de las dos admite', () => {
    for (let apuntados = 20; apuntados <= 40; apuntados++) {
      for (const e of OCUPAN_SILLA) {
        expect(
          cuantosCaben({ cuposMaximos: 20, apuntados, sillas: 20, entra: e }),
        ).toBe(0);
      }
    }
  });
});

describe('el aserto que protege del arreglo excesivo', () => {
  it('un grupo vacío admite a todos los del tope', () => {
    /// Si alguien «endurece» la cuenta y el grupo deja de admitir,
    /// este test cae y le obliga a mirar por qué.
    expect(lead(65, 0, 0)).toBe(65);
    expect(inscrito(65, 0, 0)).toBe(65);
  });
});

/**
 * Y AHORA LA PARTE QUE DE VERDAD FALTABA.
 *
 * Los tests de arriba prueban `cuantosCaben`, que es pura --- y al
 * mutar el SERVICIO, devolviéndolo a `cuposBase` y a las sillas, los
 * ocho seguían en verde. O sea que daban confianza sin darla, que es
 * el defecto que este proyecto lleva documentado desde la segunda
 * ronda de revisiones.
 *
 * El defecto nunca estuvo en la función: estuvo en QUÉ COLUMNAS le
 * pasa `opciones`. Así que se mira el código fuente, como ya hace
 * `caracterizacion-amparada.spec.ts` con el `include` del reporte.
 * Es lo único que distingue «mide con el tope» de «mide con lo
 * comprometido».
 */
describe('`opciones` mide con las MISMAS columnas que el candado', () => {
  const FUENTE = readFileSync(join(__dirname, 'crm.service.ts'), 'utf8');

  /// El bloque donde se arma cada grupo para la ficha.
  const bloque = (() => {
    const i = FUENTE.indexOf('etiqueta: `Grupo ${g.grupo.numero}');
    return i === -1 ? '' : FUENTE.slice(i, i + 2400);
  })();

  it('el bloque se encuentra', () => {
    /// Sin esto, renombrar la etiqueta dejaría los cinco tests de
    /// abajo pasando sobre una cadena vacía.
    expect(bloque.length).toBeGreaterThan(500);
  });

  it('el tope sale de `cuposMaximos`, nunca de `cuposBase`', () => {
    expect(bloque).toContain('cupos: g.cuposMaximos');
    expect(bloque).not.toContain('cupos: g.cuposBase');
  });

  it('los apuntados NO son el `_count` de las sillas', () => {
    /// `_count.participantes` cuenta `ETAPAS_VIVAS`, que es
    /// `OCUPAN_SILLA`. Si «los que caben» se calculara solo con eso,
    /// un grupo con doscientos interesados dentro se vería vacío para
    /// un lead.
    expect(bloque).toContain('apuntados: apuntadosPorCelda.get(g.id)');
  });

  it('`caben` va por `cuantosCaben` y NO a mano', () => {
    /// Era la sexta copia de la cuenta. A mano, la pantalla decía
    /// «0 cupos libres» donde el servidor sí deja entrar.
    expect(bloque).toContain('caben: cuantosCaben({');
    expect(bloque).not.toContain('caben: Math.max(0, g.cuposMaximos');
  });

  it('y le pasa LAS DOS cuentas más la etapa de quien entra', () => {
    /// Sin `sillas` no se puede medir el aforo, y sin `entra` la
    /// función no sabe contra cuál de los dos medir.
    expect(bloque).toContain('sillas: g._count.participantes');
    expect(bloque).toContain('entra,');
  });

  it('la consulta de apuntados filtra por RETIENEN_ASIENTO', () => {
    /// Sin esto, el groupBy contaría a todo el mundo --- incluidos
    /// los retirados, que ya liberaron su asiento.
    const i = FUENTE.indexOf('apuntadosPorCelda');
    expect(FUENTE.slice(i, i + 500)).toContain('RETIENEN_ASIENTO');
  });

  it('`entra` sale de la etapa de la ficha, y sin ficha es un lead', () => {
    /// Sin ficha es un alta, y una ficha nueva nace INTERESADO: se
    /// mide como un lead, que es lo conservador.
    const i = FUENTE.indexOf('const entra: EtapaParticipante');
    expect(i).toBeGreaterThan(-1);
    const trozo = FUENTE.slice(i, i + 400);
    expect(trozo).toContain('select: { etapa: true }');
    expect(trozo).toContain("'INTERESADO'");
  });
});
