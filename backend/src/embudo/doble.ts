/** Un embudo que no escribe nada. Para los tests. */

import type { EmbudoService } from './embudo.service';

/// Vive aquí y no repetido en cada spec: tres copias de un
/// doble acaban discrepando en la que menos se usa, y el
/// síntoma sería un test que pasa por el motivo equivocado.
export function dobleDeEmbudo(): EmbudoService {
  return {
    marcar: async () => {},
    registrado: async () => {},
    embudo: async () => ({}),
  } as unknown as EmbudoService;
}
