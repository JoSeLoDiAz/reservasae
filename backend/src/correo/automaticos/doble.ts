/** Una cola de correo que no escribe nada. Para los tests. */

import type { ColaDeCorreo } from './cola-de-correo';

/// Vive aqui y no repetido en cada spec, por lo mismo que
/// `dobleDeEmbudo`: tres copias de un doble acaban
/// discrepando en la que menos se usa.
///
/// Guarda lo que se le encolo para que un spec pueda
/// afirmar que se encolo UNA vez y con que motivo.
export function dobleDeColaDeCorreo(): ColaDeCorreo & {
  encolados: Array<{ participanteId: string; convenioId: string; motivo: string }>;
} {
  const encolados: Array<{
    participanteId: string;
    convenioId: string;
    motivo: string;
  }> = [];
  return {
    encolados,
    encolar: async (participanteId: string, convenioId: string, motivo: string) => {
      encolados.push({ participanteId, convenioId, motivo });
    },
  } as unknown as ColaDeCorreo & { encolados: typeof encolados };
}
