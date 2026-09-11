/** El embudo de ventas, del lado del panel. */

import { pedir } from "./pedir";

export type TipoEmbudo = "EMPRESA" | "PERSONA";

export type EtapaOportunidad =
  | "CAPTADO"
  | "CONTACTADO"
  | "CALIFICADO"
  | "PROPUESTA_ENVIADA"
  | "EN_NEGOCIACION"
  | "GANADO"
  | "PERDIDO";

export type MotivoCierre =
  | "PRECIO_ACEPTADO"
  | "UNICA_OPCION"
  | "RECOMENDACION"
  | "PRECIO_ALTO"
  | "SIN_PRESUPUESTO"
  | "SE_FUE_CON_OTRO"
  | "FUERA_DE_TIEMPO"
  | "NO_ERA_QUIEN_DECIDE"
  | "NUNCA_RESPONDIO"
  | "NO_LE_INTERESA"
  | "DATOS_ERRADOS"
  | "OTRO";

export type OportunidadEnTablero = {
  id: string;
  codigo: string;
  titulo: string;
  etapa: EtapaOportunidad;
  valor: number;
  probabilidad: number;
  cierreEsperado: string | null;
  creadoEn: string;
  ultimoToqueEn: string;
  primeraRespuestaEn: string | null;
  minutosPrimeraRespuesta: number | null;
  campana: string | null;
  asesor: { id: string; nombre: string } | null;
  deQuien: string | null;
};

export type ColumnaDelEmbudo = {
  etapa: EtapaOportunidad;
  rotulo: string;
  probabilidad: number;
  cuantas: number;
  total: number;
  ponderado: number;
  oportunidades: OportunidadEnTablero[];
};

export type Tablero = {
  embudo: TipoEmbudo;
  columnas: ColumnaDelEmbudo[];
  pronostico: {
    cuantas: number;
    total: number;
    ponderado: number;
    probabilidadesEstimadas: boolean;
  };
};

export type SinRespuesta = {
  id: string;
  codigo: string;
  titulo: string;
  embudo: TipoEmbudo;
  creadoEn: string;
  campana: string | null;
  asesor: { nombre: string } | null;
  minutosEsperando: number;
};

export type ResumenDeVentas = {
  pronostico: {
    cuantas: number;
    total: number;
    ponderado: number;
    probabilidadesEstimadas: boolean;
  };
  mes: {
    ganadas: number;
    ganado: number;
    perdidas: number;
    perdido: number;
    /// Null cuando no se ha cerrado nada: un 0 % con cero cierres
    /// afirma algo que no es verdad.
    tasa: number | null;
  };
  reloj: {
    esperando: number;
    pasadosDeCinco: number;
    /// La mediana, no el promedio: un lead olvidado tres días
    /// dispara la media y esconde que el resto se contesta en
    /// minutos.
    medianaRespuesta: number | null;
    lista: Array<{
      id: string;
      codigo: string;
      titulo: string;
      embudo: TipoEmbudo;
      campana: string | null;
      asesor: { id: string; nombre: string } | null;
      minutosEsperando: number;
    }>;
  };
  porEtapa: Array<{
    etapa: EtapaOportunidad;
    rotulo: string;
    cuantas: number;
    total: number;
  }>;
  porCampana: Array<{
    campana: string;
    cuantas: number;
    abierto: number;
    ganado: number;
  }>;
  frias: Array<{
    id: string;
    codigo: string;
    titulo: string;
    etapa: EtapaOportunidad;
    valor: number;
    asesor: { id: string; nombre: string } | null;
    dias: number;
  }>;
  cuantasFrias: number;
};

/** Un movimiento de la bitácora: qué le pasó y quién lo hizo. */
export type MovimientoDeOportunidad = {
  id: string;
  de: EtapaOportunidad | null;
  a: EtapaOportunidad;
  nota: string | null;
  actorNombre: string;
  creadoEn: string;
};

/**
 * La oportunidad entera, para su ficha.
 *
 * Trae la bitácora dentro y no en una llamada aparte: el historial
 * es la mitad de la ficha —lo que dice POR QUÉ está donde está— y
 * pedirlo por separado deja media pantalla en blanco mientras carga
 * lo que más se lee.
 */
export type FichaDeOportunidad = {
  id: string;
  codigo: string;
  convenioId: string;
  embudo: TipoEmbudo;
  etapa: EtapaOportunidad;
  titulo: string;
  valor: number;
  moneda: string;
  probabilidad: number;
  probabilidadPropia: boolean;
  cierreEsperado: string | null;
  campana: string | null;
  creadoEn: string;
  ultimoToqueEn: string;
  primeraRespuestaEn: string | null;
  minutosPrimeraRespuesta: number | null;
  cerradaEn: string | null;
  motivoCierre: MotivoCierre | null;
  notaCierre: string | null;
  asesor: { id: string; nombre: string } | null;
  empresa: { id: string; razonSocial: string; nit: string } | null;
  persona: {
    id: string;
    primerNombre: string;
    primerApellido: string;
    correo: string | null;
    celular: string | null;
  } | null;
  movimientos: MovimientoDeOportunidad[];
};

export const oportunidadesApi = {
  resumen: () => pedir<ResumenDeVentas>("/admin/oportunidades/resumen"),

  /// La ficha entera de una oportunidad, con su historial.
  ficha: (id: string) => pedir<FichaDeOportunidad>(`/admin/oportunidades/${id}`),

  actualizar: (
    id: string,
    cambios: {
      titulo?: string;
      valor?: number;
      cierreEsperado?: string | null;
      campana?: string | null;
    },
  ) =>
    pedir<FichaDeOportunidad>(`/admin/oportunidades/${id}`, {
      method: "PATCH",
      body: JSON.stringify(cambios),
    }),

  /// `null` la suelta. Se manda escrito, nunca omitido: un
  /// `undefined` que se cuela dejaría sin dueño un negocio que
  /// alguien estaba trabajando, y en silencio.
  asignarAsesor: (id: string, asesorId: string | null, nota?: string) =>
    pedir(`/admin/oportunidades/${id}/asesor`, {
      method: "PATCH",
      body: JSON.stringify({ asesorId, nota }),
    }),

  /// `null` la devuelve a la probabilidad de su etapa.
  pisarProbabilidad: (id: string, probabilidad: number | null, nota?: string) =>
    pedir(`/admin/oportunidades/${id}/probabilidad`, {
      method: "PATCH",
      body: JSON.stringify({ probabilidad, nota }),
    }),

  atarCliente: (id: string, quien: { empresaId?: string; personaId?: string }) =>
    pedir(`/admin/oportunidades/${id}/cliente`, {
      method: "PATCH",
      body: JSON.stringify(quien),
    }),

  anotar: (id: string, nota: string) =>
    pedir(`/admin/oportunidades/${id}/notas`, {
      method: "POST",
      body: JSON.stringify({ nota }),
    }),

  crear: (datos: {
    embudo: TipoEmbudo;
    titulo: string;
    convenioId: string;
    valor?: number;
    cierreEsperado?: string;
    asesorId?: string;
    empresaId?: string;
    personaId?: string;
    campana?: string;
  }) =>
    pedir<{ id: string; codigo: string }>("/admin/oportunidades", {
      method: "POST",
      body: JSON.stringify(datos),
    }),

  tablero: (embudo: TipoEmbudo, asesorId?: string) =>
    pedir<Tablero>(
      `/admin/oportunidades/tablero?embudo=${embudo}` +
        (asesorId ? `&asesorId=${encodeURIComponent(asesorId)}` : ""),
    ),

  sinRespuesta: () => pedir<SinRespuesta[]>("/admin/oportunidades/sin-respuesta"),

  cambiarEtapa: (
    id: string,
    cambio: { a: EtapaOportunidad; motivo?: MotivoCierre; nota?: string },
  ) =>
    pedir(`/admin/oportunidades/${id}/etapa`, {
      method: "PATCH",
      body: JSON.stringify(cambio),
    }),
};

/**
 * Pesos, sin centavos.
 *
 * `maximumFractionDigits: 0` y no un `toFixed(0)` a mano: el
 * separador de miles en Colombia es el punto, y escribirlo a mano
 * es como se llega a tableros donde 1.200.000 sale como 1,200,000
 * y nadie sabe si son pesos o dólares.
 */
export function enPesos(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
}

/**
 * «hace 3 min», «hace 2 h», «hace 4 d».
 *
 * Corto a propósito: va dentro de una tarjeta estrecha, y lo que
 * importa de una espera no es la precisión, es el orden de
 * magnitud. Cinco minutos y siete minutos se atienden igual;
 * cinco minutos y cinco horas, no.
 */
export function haceCuanto(minutos: number): string {
  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}
