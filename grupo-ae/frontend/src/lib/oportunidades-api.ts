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

export const oportunidadesApi = {
  resumen: () => pedir<ResumenDeVentas>("/admin/oportunidades/resumen"),

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
