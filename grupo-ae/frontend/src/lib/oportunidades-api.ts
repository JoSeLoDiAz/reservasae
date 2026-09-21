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

/**
 * Las dos señales de que un negocio se está pudriendo.
 *
 * NO son etapas y no van en `EtapaOportunidad`: cruzan el embudo.
 * El porqué largo está en el backend, en `oportunidades/senales.ts`,
 * y ahí es donde hay que leerlo antes de cambiar nada de esto.
 *
 * Llegan como código y no como texto para no mandar la misma frase
 * repetida en cada una de las tarjetas del tablero. Las palabras
 * están en `ROTULO_SENAL` y `PORQUE_SENAL`, abajo.
 */
export type Senal = "MUERTO_VIVIENTE" | "BANANEO";

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
  /// Qué se vende, del portafolio. Null en los que nacieron antes.
  /// La unidad («licencia», «equipo») es la que se lee al lado de la
  /// cantidad en la tarjeta: «40 licencias».
  servicio: { nombre: string; unidad: string } | null;
  cantidad: number | null;
  /// Lo facturado. Null mientras no se haya facturado.
  valorFacturado: number | null;
  /// Vacío es lo normal: un negocio sano no lleva ninguna.
  senales: Senal[];
};

/// Las mismas palabras que `senales.ts` en el backend. Son dos
/// paquetes y el panel no puede importar de allá; si cambia una,
/// cambia la otra.
export const ROTULO_SENAL: Record<Senal, string> = {
  MUERTO_VIVIENTE: "Muerto viviente",
  BANANEO: "Bananeo",
};

/// Por qué está marcada. Sin esto la marca no se la cree nadie y
/// en dos semanas todo el mundo la ignora.
export const PORQUE_SENAL: Record<Senal, string> = {
  MUERTO_VIVIENTE:
    "La fecha de cierre que tiene puesta ya pasó y sigue abierta. Cámbiele la fecha o ciérrela.",
  BANANEO:
    "Ya se le hicieron varias gestiones y no se ha movido de etapa. O no es quien decide, o no hay presupuesto.",
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
    /// Lo cotizado de los negocios ganados en el mes.
    ganado: number;
    /// Lo FACTURADO de los negocios ganados en el mes, y cuántos de
    /// ellos ya tienen factura. No es lo mismo que `ganado`: se gana
    /// al cerrar y se factura después, y la diferencia es plata que
    /// todavía no ha entrado.
    facturado: number;
    facturadas: number;
    perdidas: number;
    perdido: number;
    /// Null cuando no se ha cerrado nada: un 0 % con cero cierres
    /// afirma algo que no es verdad.
    tasa: number | null;
  };
  reloj: {
    esperando: number;
    /// Las que pasaron de SU compromiso: cinco minutos en
    /// personas, un día en empresas. El número sale de
    /// `oportunidades/ans.ts`, en el backend.
    incumplidos: number;
    /// El nombre viejo, con el MISMO número que `incumplidos`.
    /// Contaba cinco minutos para los dos embudos, que era el
    /// fallo. Se queda mientras haya algo que lo lea.
    /// @deprecated use `incumplidos`
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
  /**
   * El dinero por LÍNEA DE NEGOCIO: Educación y Empresas.
   *
   * No es lo mismo que el embudo. El embudo dice por dónde entró
   * el negocio —una organización o una persona—; la línea dice qué
   * se le está vendiendo, y sale del servicio del portafolio.
   *
   * «Sin servicio elegido» es una línea más a propósito: son los
   * negocios que faltan por completar, y esconderlos haría que las
   * dos cifras de arriba no cuadraran con el total.
   */
  porLinea: Array<{
    linea: "EDUCACION" | "EMPRESAS" | "SIN_LINEA";
    rotulo: string;
    cuantas: number;
    total: number;
    ponderado: number;
    ganadoDelMes: number;
  }>;
  /// Qué se está vendiendo: lo abierto por servicio, de mayor a
  /// menor. Los ocho primeros.
  mixDeProductos: Array<{
    id: string;
    nombre: string;
    linea: string;
    cuantas: number;
    total: number;
  }>;
  /// Con qué umbrales se calculó esto. Se enseñan al pie del reloj:
  /// una alerta que no dice contra qué compromiso salta no se puede
  /// defender en una reunión.
  parametros: {
    ans: Record<TipoEmbudo, number>;
    diasParaFria: number;
  };
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
  /// Lo COTIZADO. La columna se sigue llamando `valor` en la base y
  /// en la API: renombrarla rompería todo lo que ya la lee. En
  /// pantalla se dice «Valor cotizado».
  valor: number;
  /// Lo FACTURADO de verdad. Null mientras no se haya facturado: un
  /// cero diría que se facturó cero, que es otra cosa.
  valorFacturado: number | null;
  moneda: string;
  probabilidad: number;
  probabilidadPropia: boolean;
  cierreEsperado: string | null;
  campana: string | null;
  servicio: { id: string; nombre: string; familia: "EDUCACION" | "EMPRESAS"; unidad: string } | null;
  cantidad: number | null;
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
      /// Null lo devuelve a «sin facturar».
      valorFacturado?: number | null;
      cierreEsperado?: string | null;
      campana?: string | null;
      servicioId?: string | null;
      cantidad?: number | null;
    },
  ) =>
    pedir<FichaDeOportunidad>(`/admin/oportunidades/${id}`, {
      method: "PATCH",
      body: JSON.stringify(cambios),
    }),

  /// A quién se le puede pasar: la misma regla que aplica el servidor
  /// al guardar, así el desplegable no ofrece a quien luego rechaza.
  asesores: (id: string) =>
    pedir<Array<{ id: string; nombre: string }>>(`/admin/oportunidades/${id}/asesores`),

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
