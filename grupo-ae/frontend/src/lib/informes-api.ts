/** Las metas del mes y los informes del embudo, del lado del panel. */

/// Es el espejo de `backend/src/metas/`: `metas.controller.ts`,
/// `informes.controller.ts` e `informes.service.ts`. Las formas de
/// aquí están copiadas de lo que esos servicios DEVUELVEN, no de lo
/// que uno esperaría que devolvieran; si allá cambia un campo, aquí
/// también. Es el mismo precio que paga `oportunidades-api.ts`: son
/// dos paquetes y el panel no puede importar tipos del backend.
///
/// Todas las cifras de dinero llegan ya en pesos enteros. El Decimal
/// de la base se convierte en un solo sitio del backend
/// (`metas/dinero.ts`), fila por fila, para que el total que enseña
/// una pantalla cuadre con la suma de sus filas. El panel no
/// redondea nada otra vez.

import { pedir } from "./pedir";
import type { MotivoCierre, TipoEmbudo } from "./oportunidades-api";

/* ─── El avance contra la meta ─────────────────────────────── */

/**
 * En qué anda una meta, en una palabra.
 *
 * Cinco estados y no un «va bien / va mal»: un mes sin meta no va
 * mal —no hay contra qué—, y un mes terminado por debajo no va
 * «atrasado» —ya no va a ningún sitio—. El porqué largo está en
 * `metas/avance.ts`, en el backend.
 */
export type Ritmo =
  | "SIN_META"
  | "CUMPLIDA"
  | "EN_RITMO"
  | "ATRASADO"
  | "INCUMPLIDA";

/// Las mismas palabras que `ROTULOS_DE_RITMO` en `metas/avance.ts`.
/// Allá las usan también los correos del resumen mensual; si
/// cambia una, cambia la otra, o el correo y la pantalla dirán dos
/// cosas del mismo mes.
export const ROTULO_RITMO: Record<Ritmo, string> = {
  SIN_META: "Sin meta",
  CUMPLIDA: "Cumplida",
  EN_RITMO: "En ritmo",
  ATRASADO: "Atrasado",
  INCUMPLIDA: "No se cumplió",
};

/**
 * Lo ganado de un mes contra lo que había que ganar.
 *
 * `ganado` es a valor COTIZADO de los negocios que se cerraron
 * ganados en el mes —por `cerradaEn`, no por `creadoEn`—, que es la
 * misma regla del «Ganado este mes» del Resumen. No es lo
 * facturado: eso va aparte, en `ResumenDeVentas.mes.facturado`.
 */
export type Avance = {
  anio: number;
  mes: number;
  rotulo: string;

  meta: number;
  ganado: number;
  /// Nunca negativo: pasarse es `excedente`, no faltar menos que cero.
  falta: number;
  excedente: number;
  /// Null sin meta. Con meta cero cualquier porcentaje miente: el
  /// 0 % acusa y el 100 % felicita a quien no tenía nada que hacer.
  porcentaje: number | null;
  /// Lo que tocaría llevar a estas alturas repartiendo la meta
  /// parejo entre los días hábiles. Es una vara, no un pronóstico.
  esperado: number;

  ritmo: Ritmo;
  mesCerrado: boolean;

  diasHabiles: number;
  /// Contando hoy: hoy todavía se vende.
  diasHabilesRestantes: number;
  diasHabilesTranscurridos: number;
  /// Null cuando ya no queda ningún día hábil y todavía falta: no
  /// hay día donde poner lo que falta, y un número ahí sugeriría
  /// una tarea que ya no existe.
  faltaPorDiaHabil: number | null;

  /// Los festivos todavía no se descuentan. Viaja marcado para que
  /// la pantalla lo diga en vez de aparentar una precisión que no
  /// tiene.
  sinDescontarFestivos: true;
};

export type AvanceContraLaMeta = {
  periodo: { anio: number; mes: number; rotulo: string };
  /**
   * El del equipo: la meta con `asesorId` nulo.
   *
   * `sumaDeLasIndividuales` va al lado a propósito. No tiene por
   * qué coincidir con la del equipo —a esa se le suele poner
   * colchón—, pero es la única pista de que a alguien se le olvidó
   * fijar la suya, y la única cifra que hay cuando se fijaron las
   * individuales y la del equipo no.
   */
  equipo: Avance & {
    cuantasGanadas: number;
    sumaDeLasIndividuales: number;
  };
  /// Arriba quien está más lejos de su meta, no quien más vendió:
  /// la lista es para decidir a quién acompañar, no para premiar.
  /// Trae también a quien ganó sin tener meta —y la fila «Sin
  /// asesor», con `asesorId` nulo—, con `ritmo: "SIN_META"`.
  asesores: Array<
    Avance & {
      asesorId: string | null;
      nombre: string;
      cuantasGanadas: number;
    }
  >;
};

/* ─── Ganadas contra perdidas ──────────────────────────────── */

/// Un cierre desglosado por su porqué. `motivo` nulo son las que
/// se cerraron antes de que la compuerta exigiera motivo: se
/// cuentan aparte en lugar de inventarles una razón.
export type CierrePorMotivo = {
  motivo: MotivoCierre | null;
  rotulo: string;
  cuantas: number;
  valor: number;
  /// Sobre el total de ganadas, o de perdidas: no sobre los dos.
  porcentaje: number;
};

type LadoDelCierre = {
  cuantas: number;
  valor: number;
  valorMedio: number | null;
};

export type GanadasContraPerdidas = {
  /// `mes` nulo es el año entero.
  periodo: { anio: number; mes: number | null; rotulo: string };
  ganadas: LadoDelCierre;
  perdidas: LadoDelCierre;
  /// De cada cien cerradas, cuántas se ganaron. Null sin cierres.
  tasa: number | null;
  porQueSeGano: CierrePorMotivo[];
  porQueSePerdio: CierrePorMotivo[];
};

/* ─── Por asesor ───────────────────────────────────────────── */

export type InformePorAsesor = {
  periodo: { anio: number; mes: number | null; rotulo: string };
  /// Lo abierto es un retrato de HOY y lo cerrado es del periodo.
  /// Viaja escrito para que la tabla lo pueda decir en la cabecera
  /// y nadie sume peras con manzanas.
  abiertasAlDiaDeHoy: true;
  asesores: Array<{
    asesorId: string | null;
    nombre: string;
    abiertas: { cuantas: number; valor: number; ponderado: number };
    ganadas: { cuantas: number; valor: number };
    perdidas: { cuantas: number; valor: number };
    tasa: number | null;
  }>;
};

/* ─── Por campaña ──────────────────────────────────────────── */

export type InformePorCampana = {
  periodo: { anio: number; mes: number | null; rotulo: string };
  /// Se cuenta por cuándo ENTRÓ la oportunidad, y lo ganado se le
  /// atribuye cierre cuando cierre. Las campañas del mes en curso
  /// siempre se ven mal por eso: miden la cosecha, no el mes.
  atribucionPorEntrada: true;
  campanas: Array<{
    /// «Sin campaña» también es una fila, y suele ser la mayor.
    campana: string;
    cuantas: number;
    /// Las que entraron solas por la mesa de entrada.
    leads: number;
    abiertas: number;
    abierto: number;
    ganadas: number;
    ganado: number;
    perdidas: number;
    perdido: number;
    tasa: number | null;
    /// De todo lo que trajo, cuánto acabó en venta.
    conversion: number;
  }>;
};

/* ─── El embudo en el tiempo ───────────────────────────────── */

export type MesDelEmbudo = {
  anio: number;
  /// De 1 a 12, como lo dice la gente.
  mes: number;
  /// «2026-09»: la llave para no comparar objetos.
  clave: string;
  /// El nombre del mes, sin año: «Septiembre».
  rotulo: string;
  /// Por `creadoEn`.
  entraron: number;
  valorEntrado: number;
  /// Por `cerradaEn`: una de hace dos años que cerró el mes pasado
  /// cuenta el mes pasado.
  cerradas: number;
  ganadas: number;
  ganado: number;
  perdidas: number;
  perdido: number;
  tasa: number | null;
};

export type EmbudoEnElTiempo = {
  /// Los doce que acaban en el corriente, del más viejo al de hoy.
  meses: MesDelEmbudo[];
  /// El último todavía no ha terminado. Sin esta marca, la última
  /// columna siempre parece una caída.
  ultimoMesIncompleto: true;
};

/* ─── Las metas ────────────────────────────────────────────── */

export type MetaComercial = {
  id: string;
  convenioId: string;
  anio: number;
  mes: number;
  valor: number;
  /// Null: la meta cubre los dos embudos sumados.
  embudo: TipoEmbudo | null;
  /// Null: es la del EQUIPO, no «sin asesor».
  asesorId: string | null;
  asesor: { id: string; nombre: string } | null;
  esDelEquipo: boolean;
  rotuloDelMes: string;
  actualizadoEn: string;
};

export type MetasDelPeriodo = {
  anio: number;
  mes: number | null;
  cuantas: number;
  /// Con la misma regla que el avance: dentro de un mes y de un
  /// dueño, la general manda sobre las de embudo.
  total: number;
  metas: MetaComercial[];
};

/// El periodo de un informe como parámetros de la URL. Lo que no se
/// manda no se escribe, ni vacío: el backend lee «vacío» como «no
/// lo mandé» y lo rellena con el mes corriente de Bogotá, pero una
/// URL sin el parámetro no deja nada que interpretar.
function periodoEnLaUrl(periodo?: { anio?: number; mes?: number | null }): string {
  const partes = new URLSearchParams();
  if (periodo?.anio !== undefined) partes.set("anio", String(periodo.anio));
  if (periodo?.mes !== undefined && periodo.mes !== null) {
    partes.set("mes", String(periodo.mes));
  }
  const texto = partes.toString();
  return texto ? `?${texto}` : "";
}

export const informesApi = {
  /// Sin periodo, el mes corriente en hora de Bogotá: el servidor
  /// vive en UTC y resolverlo aquí con el reloj del navegador
  /// podría pedir otro mes la última noche de cada mes.
  avance: (periodo?: { anio?: number; mes?: number }) =>
    pedir<AvanceContraLaMeta>(`/admin/informes/avance${periodoEnLaUrl(periodo)}`),

  /// Sin mes, el año entero.
  ganadasContraPerdidas: (periodo?: { anio?: number; mes?: number | null }) =>
    pedir<GanadasContraPerdidas>(
      `/admin/informes/ganadas-perdidas${periodoEnLaUrl(periodo)}`,
    ),

  porAsesor: (periodo?: { anio?: number; mes?: number | null }) =>
    pedir<InformePorAsesor>(`/admin/informes/por-asesor${periodoEnLaUrl(periodo)}`),

  porCampana: (periodo?: { anio?: number; mes?: number | null }) =>
    pedir<InformePorCampana>(`/admin/informes/por-campana${periodoEnLaUrl(periodo)}`),

  /// No recibe periodo, y no es un olvido: son siempre los doce
  /// meses que acaban en el corriente. Una tendencia con las
  /// fechas a gusto de quien consulta se recorta hasta que diga
  /// lo que uno quiera.
  embudoEnElTiempo: () =>
    pedir<EmbudoEnElTiempo>("/admin/informes/embudo-en-el-tiempo"),
};

export const metasApi = {
  /// Las de un año, o las de un mes suelto.
  listar: (filtros: {
    anio: number;
    mes?: number;
    convenioId?: string;
    asesorId?: string;
  }) => {
    const partes = new URLSearchParams({ anio: String(filtros.anio) });
    if (filtros.mes !== undefined) partes.set("mes", String(filtros.mes));
    if (filtros.convenioId) partes.set("convenioId", filtros.convenioId);
    if (filtros.asesorId) partes.set("asesorId", filtros.asesorId);
    return pedir<MetasDelPeriodo>(`/admin/metas?${partes.toString()}`);
  },

  una: (id: string) => pedir<MetaComercial>(`/admin/metas/${id}`),

  /**
   * Fijarla: la crea si no estaba y la reemplaza si estaba.
   *
   * Pide `reportes` con escritura, no `inscripciones`: poner una
   * meta es un acto de jefatura, y con el permiso del asesor
   * cualquiera podría bajarse la suya el día 28 y cumplirla.
   *
   * `asesorId` nulo es la del equipo. Cero SE ADMITE: `metas/dinero.ts`
   * lo defiende como «este mes no tiene que vender», distinto de no
   * tener meta. OJO, que hoy el avance no lo distingue:
   * `calcularAvance` pregunta `meta > 0` y una meta en cero sale como
   * SIN_META. Hasta que el backend lo resuelva, en pantalla las dos
   * se ven igual.
   */
  fijar: (meta: {
    convenioId: string;
    asesorId?: string | null;
    anio: number;
    mes: number;
    valor: number;
    embudo?: TipoEmbudo | null;
  }) =>
    pedir<MetaComercial>("/admin/metas", {
      method: "POST",
      body: JSON.stringify(meta),
    }),

  /// Esta sí se borra de verdad —la excepción a «ocultar, nunca
  /// eliminar», y el backend dice por qué—: una meta no registra
  /// nada que pasó, es una cifra escrita para el futuro.
  borrar: (id: string) =>
    pedir<{ borrada: true; mensaje: string }>(`/admin/metas/${id}`, {
      method: "DELETE",
    }),
};
