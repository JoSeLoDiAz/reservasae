/** Las dos fórmulas de la hoja del cliente, y las columnas AF. */

/**
 * De dónde viene: el cliente entregó su modelo de la vista «Por
 * organización» como una hoja de cálculo de 21 columnas
 * (`reservas_colegios.xlsx`, hoja «Reservas», 30 sep 2026). Dos de
 * esas columnas son FÓRMULAS allá —`=K2+L2+M2` y `=I2-J2`— y aquí
 * se calculan. Lo que esta prueba impide:
 *
 *  1. «Total lead gestionados» que no suma sus tres cubos. Es la
 *     columna con la que el cliente sabe si alguien está trabajando
 *     sus leads; si suma otra cosa, no sirve para nada y parece
 *     correcta.
 *
 *  2. «Cupos pendientes» negativos. En su hoja la resta sale
 *     negativa cuando una organización manda más gente que cupos
 *     apartó; aquí se acota a cero, porque «−5 cupos pendientes» no
 *     es una cantidad de cupos.
 *
 *  3. Cubos que se solapan. Los tres se suman, así que un lead que
 *     cayera en dos haría que el total pasara de los leads
 *     recibidos. La precedencia —inscrito, descartado, no
 *     contactable— vive en el SQL; lo que se fija aquí es la
 *     consecuencia que el cliente vería.
 *
 *  4. Una columna AF inventada. Las columnas salen SOLO de las
 *     acciones donde alguien reservó: en el modelo del cliente falta
 *     AF4 porque nadie reservó ahí, y ponerla a mano sería una
 *     acción que parece ofertada y no lo está.
 *
 * Sin base de datos: `cerrarCifrasDeLeads` y `armarAgrupadas` son
 * funciones puras sobre las filas que trae la consulta.
 */

import { EstadoReserva } from '../../generated/prisma';
import {
  armarAgrupadas,
  cerrarCifrasDeLeads,
  type LeadsCrudos,
  type ReservaParaAgrupar,
} from './reservas-agrupadas';

const EMPRESA = {
  id: 'e1',
  nit: '890900938',
  digitoVerificacion: '1',
  razonSocial: 'COLEGIO COLOMBO BRITÁNICO DE ENVIGADO',
  numeroColaboradores: 120,
  redAsociada: 'ADECOPRIA',
  redAsociadaOtra: null,
};

const crudas = (p: Partial<LeadsCrudos> = {}): LeadsCrudos => ({
  leadsRecibidos: 0,
  inscritos: 0,
  descartados: 0,
  noContactable: 0,
  ...p,
});

const AF = (id: string, codigo: string) => ({
  id,
  codigo,
  nombre: 'Acción ' + codigo,
  convenio: { slug: 'adecopria', sigla: 'ADECOPRIA' },
});

function reserva(
  parcial: Partial<ReservaParaAgrupar> & {
    id: string;
    accionId: string;
    codigo: string;
  },
): ReservaParaAgrupar {
  const { accionId, codigo, ...resto } = parcial;
  return {
    estado: EstadoReserva.CONFIRMADA,
    cuposSolicitados: 5,
    cuposConfirmados: 5,
    cuposEnEspera: 0,
    creadoEn: new Date('2026-09-01T15:00:00Z'),
    canceladaEn: null,
    contactoNombre: 'Gerardo Franco',
    contactoCorreo: 'rector@cbw.edu.co',
    contactoCelular: '3166656075',
    contactoCargo: 'Rector',
    empresa: EMPRESA,
    oferta: {
      modalidad: 'VIRTUAL',
      ubicacion: { nombre: 'Medellín' },
      accionFormacion: AF(accionId, codigo),
    },
    formulario: { slug: 'adecopria', titulo: 'Inscripción ADECOPRIA' },
    ...resto,
  };
}

describe('«Total lead gestionados» suma sus tres cubos', () => {
  it('la fila 2 de su hoja: 10 + 5 + 5 = 20', () => {
    const cifras = cerrarCifrasDeLeads(
      crudas({
        leadsRecibidos: 20,
        inscritos: 10,
        descartados: 5,
        noContactable: 5,
      }),
      40,
    );

    expect(cifras.totalLeadGestionados).toBe(20);
  });

  it('sin leads, todo en cero y no en blanco', () => {
    const cifras = cerrarCifrasDeLeads(crudas(), 33);

    expect(cifras.totalLeadGestionados).toBe(0);
    /// Es la fila 4 de su hoja: apartó 33 y todavía no ha llegado
    /// nadie. Los 33 están pendientes, no en blanco.
    expect(cifras.cuposPendientes).toBe(33);
  });

  it('nunca pasa de los leads recibidos: los cubos son disjuntos', () => {
    /// Un PERDIDO al que nadie logró contactar cuenta en UN cubo, no
    /// en dos. Lo garantiza el SQL; aquí se fija lo que el cliente
    /// vería si dejara de garantizarlo.
    const cifras = cerrarCifrasDeLeads(
      crudas({
        leadsRecibidos: 6,
        inscritos: 2,
        descartados: 2,
        noContactable: 2,
      }),
      10,
    );

    expect(cifras.totalLeadGestionados).toBeLessThanOrEqual(
      cifras.leadsRecibidos,
    );
  });
});

describe('«Cupos pendientes» = cupos reservados − leads recibidos', () => {
  it('la fila 2 de su hoja: 40 − 20 = 20', () => {
    expect(
      cerrarCifrasDeLeads(crudas({ leadsRecibidos: 20 }), 40).cuposPendientes,
    ).toBe(20);
  });

  it('la fila 3 de su hoja: 40 − 40 = 0, y cero no es «sin datos»', () => {
    expect(
      cerrarCifrasDeLeads(crudas({ leadsRecibidos: 40 }), 40).cuposPendientes,
    ).toBe(0);
  });

  it('más leads que cupos NO da una cifra negativa', () => {
    /// En su hoja la resta sale negativa; aquí se acota. «−5 cupos
    /// pendientes» no es una cantidad de cupos: es cero pendientes y
    /// cinco personas de más, que es otra cifra y no esta.
    expect(
      cerrarCifrasDeLeads(crudas({ leadsRecibidos: 45 }), 40).cuposPendientes,
    ).toBe(0);
  });
});

describe('las columnas AF salen solo de donde alguien reservó', () => {
  /// El mismo reparto de la fila 2 de su hoja: AF1 2, AF2 1, AF3 2,
  /// AF5 5. AF4 NO aparece, porque nadie reservó ahí.
  const suyas = [
    reserva({
      id: 'r1',
      accionId: 'af1',
      codigo: 'AF1',
      cuposConfirmados: 2,
      cuposSolicitados: 2,
    }),
    reserva({
      id: 'r2',
      accionId: 'af2',
      codigo: 'AF2',
      cuposConfirmados: 1,
      cuposSolicitados: 1,
    }),
    reserva({
      id: 'r3',
      accionId: 'af3',
      codigo: 'AF3',
      cuposConfirmados: 2,
      cuposSolicitados: 2,
    }),
    reserva({
      id: 'r5',
      accionId: 'af5',
      codigo: 'AF5',
      cuposConfirmados: 5,
      cuposSolicitados: 5,
    }),
  ];

  it('AF4 no sale porque nadie reservó en ella', () => {
    const { acciones } = armarAgrupadas(suyas);

    expect(acciones.map((a) => a.codigo)).toEqual(['AF1', 'AF2', 'AF3', 'AF5']);
  });

  it('cada celda lleva los cupos de SU acción, y suman el total de la fila', () => {
    const [fila] = armarAgrupadas(suyas).filas;

    expect(fila.porAccion['af1'].cuposConfirmados).toBe(2);
    expect(fila.porAccion['af2'].cuposConfirmados).toBe(1);
    expect(fila.porAccion['af3'].cuposConfirmados).toBe(2);
    expect(fila.porAccion['af5'].cuposConfirmados).toBe(5);

    const suma = Object.values(fila.porAccion).reduce(
      (t, c) => t + c.cuposConfirmados,
      0,
    );
    expect(suma).toBe(fila.cuposConfirmados);
    expect(fila.cuposConfirmados).toBe(10);
  });

  it('la misma acción en dos sedes es UNA columna y la suma de las dos', () => {
    /// `@@unique([empresaId, ofertaId])` da una reserva por oferta,
    /// pero una acción puede dictarse en dos sedes. Partirla en dos
    /// columnas dejaría la fila con dos «AF1»; quedarse con una
    /// dejaría cupos contando en el total sin verse en ninguna.
    const [fila] = armarAgrupadas([
      ...suyas,
      reserva({
        id: 'r1b',
        accionId: 'af1',
        codigo: 'AF1',
        cuposConfirmados: 3,
        cuposSolicitados: 3,
        oferta: {
          modalidad: 'PRESENCIAL',
          ubicacion: { nombre: 'Bogotá' },
          accionFormacion: AF('af1', 'AF1'),
        },
      }),
    ]).filas;

    expect(Object.keys(fila.porAccion)).toHaveLength(4);
    expect(fila.porAccion['af1'].cuposConfirmados).toBe(5);
    expect(fila.cuposConfirmados).toBe(13);
  });
});

describe('las cifras de leads llegan a la fila ya cerradas', () => {
  it('la fila trae el total y los pendientes calculados con SUS cupos', () => {
    const { filas } = armarAgrupadas(
      [
        reserva({
          id: 'r1',
          accionId: 'af1',
          codigo: 'AF1',
          cuposConfirmados: 40,
          cuposSolicitados: 40,
        }),
      ],
      new Map(),
      new Map([
        [
          'e1',
          crudas({
            leadsRecibidos: 20,
            inscritos: 10,
            descartados: 5,
            noContactable: 5,
          }),
        ],
      ]),
    );

    expect(filas[0].leads).toEqual({
      leadsRecibidos: 20,
      inscritos: 10,
      descartados: 5,
      noContactable: 5,
      totalLeadGestionados: 20,
      cuposPendientes: 20,
    });
  });

  it('una organización sin leads sale en ceros, con sus cupos pendientes', () => {
    const { filas } = armarAgrupadas([
      reserva({
        id: 'r1',
        accionId: 'af1',
        codigo: 'AF1',
        cuposConfirmados: 18,
        cuposSolicitados: 18,
      }),
    ]);

    expect(filas[0].leads.leadsRecibidos).toBe(0);
    expect(filas[0].leads.totalLeadGestionados).toBe(0);
    expect(filas[0].leads.cuposPendientes).toBe(18);
  });
});
