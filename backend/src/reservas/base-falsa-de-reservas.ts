/** Una base de mentira para ejercitar `ReservasService` de verdad. */

/**
 * NO ES UN SPEC: es lo que comparten los tres de al lado.
 *
 * Las reglas que se prueban aquí ---la oferta cerrada, la
 * organización que no debe quedar, la política que apunta al texto
 * que la persona pudo leer--- no se ven leyendo el fichero: se ven
 * MIRANDO QUÉ QUEDÓ ESCRITO cuando algo falla a mitad de camino. Así
 * que hace falta una base que sepa dos cosas que un simulacro suelto
 * no sabe:
 *
 *   - DESHACER. `$transaction` guarda una copia de las tablas antes
 *     de entrar y la devuelve a su sitio si lo de dentro lanza. Sin
 *     esto la prueba de la organización no prueba nada, porque el
 *     fallo es precisamente que una escritura sobreviva al `throw`.
 *   - CONTAR Y ORDENAR como la base: `politicaDatos.findFirst`
 *     respeta `vigenteDesde <= ahora` y el orden por versión, que es
 *     justo el criterio que se está corrigiendo, y
 *     `participante.groupBy` devuelve a los inscritos por su cuenta,
 *     que es de donde sale el techo real de la oferta.
 *
 * Lo que no hace falta no está: no hay motor de consultas, cada
 * método entiende solo las formas que `reservas.service.ts` le manda.
 * Si alguien cambia una consulta del servicio, esto se cae, y caerse
 * es lo correcto: la prueba dejó de estar mirando lo que creía.
 */

import { EstadoReserva } from '../../generated/prisma';

export type OfertaFalsa = {
  id: string;
  cuposMaximos: number;
  cuposOcupados: number;
  abierta: boolean;
  visible: boolean;
  convenioId: string;
};

export type ReservaFalsa = {
  id: string;
  empresaId: string;
  ofertaId: string;
  estado: EstadoReserva;
  cuposSolicitados: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  contactoCorreo: string;
  creadoEn: Date;
  politicaDatosId?: string | null;
  [otro: string]: unknown;
};

export type EmpresaFalsa = {
  id: string;
  nit: string;
  razonSocial: string;
  digitoVerificacion?: string | null;
  numeroColaboradores?: number | null;
  redAsociada?: string | null;
  redAsociadaOtra?: string | null;
};

export type PoliticaFalsa = {
  id: string;
  convenioId: string;
  destinatario: string;
  version: number;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
};

export type Mundo = {
  oferta: OfertaFalsa;
  empresas: EmpresaFalsa[];
  reservas: ReservaFalsa[];
  politicas: PoliticaFalsa[];
  /// Gente que se inscribió sola: ocupa silla y no la aparta nadie.
  porSuCuenta: number;
  movimientos: Array<Record<string, unknown>>;
};

export function mundoBase(ajustes: Partial<Mundo> = {}): Mundo {
  return {
    oferta: {
      id: 'of-1',
      cuposMaximos: 100,
      cuposOcupados: 0,
      abierta: true,
      visible: true,
      convenioId: 'cnv-adecopria',
    },
    empresas: [],
    reservas: [],
    politicas: [
      {
        id: 'pol-v1',
        convenioId: 'cnv-adecopria',
        destinatario: 'RESERVA',
        version: 1,
        vigenteDesde: new Date('2026-01-01'),
        vigenteHasta: null,
      },
    ],
    porSuCuenta: 0,
    movimientos: [],
    ...ajustes,
  };
}

/// Igual al `where` que usa el servicio y nada más.
const comoLaBase = {
  politicaCuadra(p: PoliticaFalsa, where: any): boolean {
    if (where.convenioId !== undefined && p.convenioId !== where.convenioId)
      return false;
    if (
      where.destinatario !== undefined &&
      p.destinatario !== where.destinatario
    ) {
      return false;
    }
    if (
      where.vigenteHasta !== undefined &&
      p.vigenteHasta !== where.vigenteHasta
    ) {
      return false;
    }
    if (where.vigenteDesde?.lte !== undefined) {
      if (
        p.vigenteDesde.getTime() > new Date(where.vigenteDesde.lte).getTime()
      ) {
        return false;
      }
    }
    return true;
  },
};

let secuencia = 0;
const nuevoId = (prefijo: string) => `${prefijo}-${++secuencia}`;

export function baseFalsa(mundo: Mundo) {
  const ubicacion = { id: 'ub-1', nombre: 'Sede Centro', tipo: 'PRESENCIAL' };
  const convenio = { id: mundo.oferta.convenioId, slug: 'adecopria' };
  const accion = () => ({
    id: 'af-1',
    codigo: 'AF1',
    nombre: 'Acción de prueba',
    horas: 40,
    visible: mundo.oferta.visible,
    convenioId: mundo.oferta.convenioId,
    convenio,
  });
  const ofertaEntera = () => ({
    ...mundo.oferta,
    modalidad: 'PRESENCIAL',
    accionFormacionId: 'af-1',
    ubicacionId: 'ub-1',
    ubicacion,
    accionFormacion: accion(),
  });

  const conEmpresaYOferta = (r: ReservaFalsa) => ({
    ...r,
    empresa: mundo.empresas.find((e) => e.id === r.empresaId),
    oferta: ofertaEntera(),
  });

  const db: any = {
    oferta: {
      findUnique: async ({ where }: any) =>
        where.id === mundo.oferta.id ? ofertaEntera() : null,
      findUniqueOrThrow: async ({ where }: any) => {
        if (where.id !== mundo.oferta.id)
          throw new Error('no existe la oferta');
        return ofertaEntera();
      },
    },

    empresa: {
      findUnique: async ({ where }: any) =>
        mundo.empresas.find((e) => e.nit === where.nit || e.id === where.id) ??
        null,
      create: async ({ data }: any) => {
        /// La unicidad del NIT la tiene la base; aquí también, o la
        /// prueba de la carrera no significaría nada.
        if (mundo.empresas.some((e) => e.nit === data.nit)) {
          const error: any = new Error('nit repetido');
          error.code = 'P2002';
          throw error;
        }
        const empresa = { id: nuevoId('emp'), ...data };
        mundo.empresas.push(empresa);
        return empresa;
      },
      update: async ({ where, data }: any) => {
        const empresa = mundo.empresas.find((e) => e.id === where.id);
        if (!empresa) throw new Error('no existe la empresa');
        Object.assign(empresa, data);
        return empresa;
      },
    },

    reserva: {
      findUnique: async ({ where }: any) => {
        const r = where.empresaId_ofertaId
          ? mundo.reservas.find(
              (x) =>
                x.empresaId === where.empresaId_ofertaId.empresaId &&
                x.ofertaId === where.empresaId_ofertaId.ofertaId,
            )
          : mundo.reservas.find((x) => x.id === where.id);
        return r ? conEmpresaYOferta(r) : null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const r = mundo.reservas.find((x) => x.id === where.id);
        if (!r) throw new Error('no existe la reserva');
        return conEmpresaYOferta(r);
      },
      findMany: async ({ where }: any) =>
        mundo.reservas
          .filter(
            (r) =>
              r.ofertaId === where.ofertaId &&
              (where.cuposEnEspera?.gt === undefined ||
                r.cuposEnEspera > where.cuposEnEspera.gt) &&
              (where.estado?.not === undefined ||
                r.estado !== where.estado.not),
          )
          .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime()),
      create: async ({ data }: any) => {
        const reserva = { id: nuevoId('res'), creadoEn: new Date(), ...data };
        mundo.reservas.push(reserva);
        return reserva;
      },
      update: async ({ where, data }: any) => {
        const r = mundo.reservas.find((x) => x.id === where.id);
        if (!r) throw new Error('no existe la reserva');
        Object.assign(r, data);
        return r;
      },
    },

    respuesta: {
      create: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },

    movimientoReserva: {
      create: async ({ data }: any) => {
        mundo.movimientos.push(data);
        return data;
      },
    },

    /// De aquí sale el techo de verdad: los que entraron por su
    /// cuenta no los aparta ninguna reserva.
    participante: {
      groupBy: async () =>
        mundo.porSuCuenta > 0
          ? [{ ofertaId: mundo.oferta.id, _count: { _all: mundo.porSuCuenta } }]
          : [],
    },

    politicaDatos: {
      findFirst: async ({ where }: any) => {
        const candidatas = mundo.politicas
          .filter((p) => comoLaBase.politicaCuadra(p, where))
          .sort((a, b) => b.version - a.version);
        return candidatas[0] ?? null;
      },
    },

    /// El `SELECT ... FOR UPDATE OF o` de `bloquearOferta`.
    $queryRaw: async (
      trozos: { join?: unknown } | string[],
      ...valores: unknown[]
    ) => {
      const texto = Array.isArray(trozos) ? trozos.join('?') : String(trozos);
      if (!texto.includes('FROM "ofertas"')) {
        throw new Error(`consulta cruda no prevista: ${texto}`);
      }
      if (valores[0] !== mundo.oferta.id) return [];
      return [
        {
          id: mundo.oferta.id,
          cuposMaximos: mundo.oferta.cuposMaximos,
          cuposOcupados: mundo.oferta.cuposOcupados,
          abierta: mundo.oferta.abierta,
          accionVisible: mundo.oferta.visible,
        },
      ];
    },

    /// El `UPDATE ... WHERE cuposOcupados + delta BETWEEN 0 y el tope`
    /// de `moverContador`: devuelve 0 filas cuando no cabe, que es lo
    /// que hace saltar el 409.
    $executeRaw: async (trozos: string[], ...valores: unknown[]) => {
      const texto = trozos.join('?');
      if (!texto.includes('UPDATE "ofertas"')) {
        throw new Error(`consulta cruda no prevista: ${texto}`);
      }
      const delta = valores[0] as number;
      const id = valores[1] as string;
      if (id !== mundo.oferta.id) return 0;
      const nuevo = mundo.oferta.cuposOcupados + delta;
      if (nuevo < 0 || nuevo > mundo.oferta.cuposMaximos) return 0;
      mundo.oferta.cuposOcupados = nuevo;
      return 1;
    },

    /**
     * LO QUE DESHACE. Copia las tablas al entrar y las devuelve a su
     * sitio si lo de dentro lanza, igual que un ROLLBACK. Es el único
     * motivo de que estas pruebas puedan afirmar algo sobre lo que
     * QUEDA escrito.
     */
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const copia = {
        oferta: { ...mundo.oferta },
        empresas: mundo.empresas.map((e) => ({ ...e })),
        reservas: mundo.reservas.map((r) => ({ ...r })),
        movimientos: mundo.movimientos.slice(),
      };
      try {
        return await fn(db);
      } catch (error) {
        mundo.oferta = copia.oferta;
        mundo.empresas = copia.empresas;
        mundo.reservas = copia.reservas;
        mundo.movimientos = copia.movimientos;
        throw error;
      }
    },
  };

  return db;
}

/** El DTO mínimo que acepta `crear`. */
export function dtoDeReserva(ajustes: Record<string, unknown> = {}) {
  return {
    ofertaId: 'of-1',
    nit: '890123456',
    razonSocial: 'Instituto Musical',
    contactoNombre: 'Natalia Montes',
    contactoCorreo: 'natalia@ejemplo.test',
    cuposSolicitados: 10,
    aceptaTerminos: true,
    aceptaPoliticaDatos: true,
    ...ajustes,
  } as any;
}

export const CONTEXTO = { ip: '190.1.2.3', userAgent: 'jest' };
