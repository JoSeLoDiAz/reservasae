/** Una marca de carta que no consulta nada. Para los tests. */

import type { MarcaDeCarta } from './marca-de-la-carta';

/// Vive aqui y no repetido en cada spec, por lo mismo que
/// `dobleDeEmbudo` y `dobleDeColaDeCorreo`: tres copias de un
/// doble acaban discrepando en la que menos se usa.
export function dobleDeMarcaDeCarta(
  logos: Array<{ url: string; alt: string }> = [],
): MarcaDeCarta {
  return {
    delConvenio: async () => ({
      colores: {},
      logos,
      gremio: 'ADECOPRIA',
      correoDeContacto: 'proyectosena@grupo-ae.com.co',
      porQueLoRecibe: 'Recibe este correo porque se registró.',
      signo: null,
      nombreApp: 'Convoca CRM',
      eslogan: 'Relaciones que generan resultados',
    }),
  } as unknown as MarcaDeCarta;
}
