/** La cabecera dice la concesión, no el RolAdmin. */

import { RolAdmin, RolConvenio } from '../../generated/prisma';
import { rolQueSeEnsena, type AmbitoDeRol } from './rol-que-se-ensena';

const ADECO = 'cv-adecopria';
const BRIT = 'cv-britcham';

const ambito = (a: Partial<AmbitoDeRol>): AmbitoDeRol => ({
  roles: {},
  gremioElegido: null,
  concedidos: [],
  ...a,
});

describe('con qué rol se presenta la cuenta', () => {
  /// El caso que lo destapó: «CRM pauta» salía como GESTOR.
  it('una cuenta de solo consulta NO se presenta como gestor', () => {
    const suyo = rolQueSeEnsena(
      RolAdmin.GESTOR,
      ambito({
        roles: {
          [ADECO]: [RolConvenio.CONSULTA],
          [BRIT]: [RolConvenio.CONSULTA],
        },
        gremioElegido: ADECO,
        concedidos: [ADECO, BRIT],
      }),
    );
    expect(suyo).toBe(RolConvenio.CONSULTA);
    expect(suyo).not.toBe(RolAdmin.GESTOR);
  });

  it('manda el gremio de la dirección, no el otro', () => {
    const roles = {
      [ADECO]: [RolConvenio.CONSULTA],
      [BRIT]: [RolConvenio.LIDER_INSCRIPCION],
    };
    const concedidos = [ADECO, BRIT];
    expect(
      rolQueSeEnsena(RolAdmin.GESTOR, ambito({ roles, concedidos, gremioElegido: ADECO })),
    ).toBe(RolConvenio.CONSULTA);
    expect(
      rolQueSeEnsena(RolAdmin.GESTOR, ambito({ roles, concedidos, gremioElegido: BRIT })),
    ).toBe(RolConvenio.LIDER_INSCRIPCION);
  });

  it('en la puerta general con roles distintos no se elige uno', () => {
    expect(
      rolQueSeEnsena(
        RolAdmin.GESTOR,
        ambito({
          roles: {
            [ADECO]: [RolConvenio.CONSULTA],
            [BRIT]: [RolConvenio.LIDER_INSCRIPCION],
          },
          concedidos: [ADECO, BRIT],
        }),
      ),
    ).toBeNull();
  });

  it('en la puerta general con el mismo rol en los dos, ese', () => {
    expect(
      rolQueSeEnsena(
        RolAdmin.GESTOR,
        ambito({
          roles: {
            [ADECO]: [RolConvenio.GESTOR_INSCRIPCION],
            [BRIT]: [RolConvenio.GESTOR_INSCRIPCION],
          },
          concedidos: [ADECO, BRIT],
        }),
      ),
    ).toBe(RolConvenio.GESTOR_INSCRIPCION);
  });

  /// De un superadmin lo que hay que leer es que lo es.
  it('el superadmin no se presenta con su concesión', () => {
    expect(
      rolQueSeEnsena(
        RolAdmin.SUPERADMIN,
        ambito({
          roles: { [ADECO]: [RolConvenio.LIDER_SISTEMAS] },
          gremioElegido: ADECO,
          concedidos: [ADECO],
        }),
      ),
    ).toBeNull();
  });

  it('sin concesión no se inventa ninguna', () => {
    expect(rolQueSeEnsena(RolAdmin.GESTOR, ambito({}))).toBeNull();
    expect(
      rolQueSeEnsena(RolAdmin.GESTOR, ambito({ gremioElegido: ADECO, concedidos: [ADECO] })),
    ).toBeNull();
  });

  /// `CONSULTA` existe en los DOS enums, y por eso la
  /// cabecera confundia tan facil: el mismo texto podia
  /// venir del rol equivocado.
  it('devuelve la concesión tal cual, sea cual sea', () => {
    for (const rol of Object.values(RolConvenio)) {
      expect(
        rolQueSeEnsena(
          RolAdmin.GESTOR,
          ambito({ roles: { [ADECO]: [rol] }, gremioElegido: ADECO, concedidos: [ADECO] }),
        ),
      ).toBe(rol);
    }
  });
});
