/** La lista de leads clasifica el origen con la regla única. */

/**
 * `crm.service` tenía su propia copia de la tricotomía —un
 * `PAUTA` escrito a mano y el PAUTA/ORGANICO/IMPORTACION en un
 * ternario— y además ignoraba la columna `origenLead`, que es la
 * que escribe la entrada de leads cuando un lead cae con
 * documento sobre una ficha que ya existía.
 *
 * Los informes sí la leen (`origenDeLeadSql` la hace mandar), así
 * que la misma ficha salía «Pauta» en el informe e «Importación»
 * en la lista de leads, que es la que el cliente mira. Es el
 * arreglo del commit eee0f42 del CRM de la raíz, traído aquí.
 *
 * Se prueba por `listar`, que es la puerta pública, y no llamando
 * a `aFila` a mano: lo que importa es lo que llega a la pantalla.
 */

import { CrmService } from './crm.service';
import type { OrigenLead, OrigenParticipante } from '../../generated/prisma';

function fila(
  id: string,
  origen: OrigenParticipante,
  origenLead: OrigenLead | null,
) {
  return {
    id,
    etapa: 'INTERESADO',
    origen,
    origenLead,
    creadoEn: new Date('2026-09-01T12:00:00Z'),
    actualizadoEn: new Date('2026-09-01T12:00:00Z'),
    nivelOcupacionalSepId: null,
    reservaId: null,
    persona: {
      tipoDocumentoSepId: 1,
      numeroDocumento: '1020304050',
      primerNombre: 'Luis',
      segundoNombre: null,
      primerApellido: 'Pérez',
      segundoApellido: null,
      correo: 'luis@example.com',
      celular: '3001112222',
      fechaNacimiento: null,
      generoSepId: null,
      estrato: null,
      departamentoSepId: null,
      municipioSepId: null,
      barrio: null,
      direccion: null,
    },
    convenio: { sigla: 'GAE', slug: 'grupo-ae' },
    accionFormacion: null,
    oferta: null,
    cobertura: null,
    asesor: null,
    reserva: null,
    empresa: null,
    movimientos: [],
    _count: { notas: 0, movimientos: 0 },
  };
}

async function origenesDeLaLista(filas: ReturnType<typeof fila>[]) {
  const prisma = {
    participante: {
      count: () => Promise.resolve(filas.length),
      findMany: () => Promise.resolve(filas),
    },
    registroAuditoria: { groupBy: () => Promise.resolve([]) },
    notaDeGestion: { groupBy: () => Promise.resolve([]) },
  };
  const s = new CrmService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const r = await s.listar({ ambito: ['c1'] } as never);
  return Object.fromEntries(r.participantes.map((p) => [p.id, p.origenLead]));
}

describe('el origen en la lista de leads', () => {
  /// Lo que se rompía: la ficha la subió el equipo (EMPRESA), y
  /// después la trajo una pauta con la misma cédula. La entrada de
  /// leads marcó la columna; la lista la ignoraba.
  it('la columna origenLead MANDA cuando está', async () => {
    const o = await origenesDeLaLista([
      fila('subida-y-luego-pauta', 'EMPRESA', 'PAUTA'),
      fila('formulario-marcado', 'ASESOR', 'ORGANICO'),
      fila('redes-marcado-organico', 'REDES', 'ORGANICO'),
    ]);
    expect(o).toEqual({
      'subida-y-luego-pauta': 'PAUTA',
      'formulario-marcado': 'ORGANICO',
      'redes-marcado-organico': 'ORGANICO',
    });
  });

  /// Nula es casi siempre: solo la escribe la entrada de leads. Y
  /// ahí se deduce del origen, igual que antes.
  it('sin columna, se deduce del origen como siempre', async () => {
    const o = await origenesDeLaLista([
      fila('instagram', 'INSTAGRAM', null),
      fila('autogestion', 'AUTOGESTION', null),
      fila('empresa', 'EMPRESA', null),
    ]);
    expect(o).toEqual({
      instagram: 'PAUTA',
      autogestion: 'ORGANICO',
      empresa: 'IMPORTACION',
    });
  });
});
