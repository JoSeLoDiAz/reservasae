/** La BBDD de leads: el cargue masivo y su informe. */

/// Vive aparte de `mesa-api.ts` aunque comparta el prefijo
/// `admin/leads`, y no es por orden: son dos pantallas con dos
/// trabajos distintos. La mesa atiende lo que ENTRÓ solo --por
/// webhook-- y aquí se METE una base a mano. Mezclar los dos
/// tipos en un archivo haría que el día que el cargue cambie de
/// forma haya que releer la mesa entera para saber qué se rompe.

import { pedir } from "./pedir";

/// Por dónde entró un lead cargado desde esta pantalla. Lo pone
/// el SERVIDOR en `origenSistema`, y es lo que separa esta lista
/// de la mesa de entrada: el mismo listado, otro origen.
export const ORIGEN_DEL_CARGUE = "cargue-masivo";

/// Qué le pasó a una fila del archivo.
export type QueLePasoALaFila =
  | "NUEVA"
  | "YA_ESTABA"
  /// Ya tiene ficha en Gestion de leads: no se crea lead ni se le
  /// toca nada. Llego el 6 oct 2026.
  | "YA_TIENE_FICHA"
  | "REPETIDA_EN_EL_ARCHIVO"
  | "NO_SE_RECONOCE"
  | "FALLO";

/// Con qué dato se vio que la persona ya estaba.
export type PorQueEsLaMisma = "DOCUMENTO" | "LLAVE" | "CORREO" | "CELULAR";

/// Un dato que viene distinto de lo guardado. NO se pisa: se
/// enseña con los dos valores para que alguien decida.
export type ChoqueDelCargue = {
  campo: string;
  /// Cómo se llama el campo en castellano, que es lo que se pinta.
  comoSeLlama: string;
  /// Lo que dice el archivo.
  dice: string;
  /// Lo que ya hay guardado.
  guardado: string;
};

export type FilaDelInforme = {
  /// El número de fila EN EL EXCEL. Es el dato que permite
  /// volver al archivo y corregirlo sin contar renglones.
  fila: number;
  que: QueLePasoALaFila;
  /// Con qué se reconoce a esta persona en el archivo.
  quien: string;
  leadId: string | null;
  porque: PorQueEsLaMisma | null;
  comoSeReconocio: string | null;
  /// Los huecos que se tapan, en castellano.
  rellena: string[];
  choques: ChoqueDelCargue[];
  /// Lo que se mandó y no servía, y por qué la fila no entró.
  avisos: string[];
};

export type ReparoDelCargue = { fila: number; problema: string };

export type ResultadoDelCargue = {
  /// Se escribió de verdad, o solo se revisó. Es lo único que
  /// distingue la respuesta de los dos pasos.
  aplicado: boolean;
  convenio: { id: string; slug: string };
  archivo: string;
  /// En qué fila del Excel estaban los títulos: la plantilla se
  /// lee a sí misma, así que una base con dos renglones de
  /// adorno arriba también entra.
  filaDeLaCabecera: number;
  columnasTraidas: string[];
  /// Rótulos que venían y no se reconocen. No son un error, pero
  /// son lo que más desconcierta: el cliente ve que su columna no
  /// se cargó y no sabe por qué.
  columnasQueNoSeReconocen: string[];
  leidas: number;
  nuevas: number;
  yaEstaban: number;
  /// Cuantas ya estaban en Gestion de leads, no en la mesa.
  /// Opcional: un backend sin reiniciar no la manda, y entonces la
  /// tarjeta sale en cero en vez de romper la pantalla.
  yaTienenFicha?: number;
  seRellenan: number;
  camposQueSeRellenan: number;
  conChoques: number;
  repetidasEnElArchivo: number;
  sinReconocer: number;
  fallaron: number;
  reparos: ReparoDelCargue[];
  filas: FilaDelInforme[];
};

export const ETIQUETA_QUE_PASO: Record<QueLePasoALaFila, string> = {
  NUEVA: "Nueva",
  YA_ESTABA: "Ya estaba",
  /// En Gestión de leads, no en la mesa: son dos poblaciones y
  /// casi no se solapan. El rótulo lo dice entero porque la
  /// diferencia es lo que explica que no se le tocara nada.
  YA_TIENE_FICHA: "Ya está en Gestión de leads",
  REPETIDA_EN_EL_ARCHIVO: "Repetida en el archivo",
  NO_SE_RECONOCE: "No se reconoce",
  FALLO: "Falló",
};

/// El color dice si hay algo que mirar, no categoría. Lo que
/// entra bien va en el color del texto: pintar de verde las
/// 2.000 filas buenas deja la tabla hecha una alfombra y
/// esconde justo las seis que piden atención.
export const TONO_QUE_PASO: Record<QueLePasoALaFila, string> = {
  NUEVA: "text-exito",
  YA_ESTABA: "text-texto-suave",
  /// En el color de aviso: no es un fallo ---no se duplicó a
  /// nadie, que es lo que se quería--- pero sí es algo que mirar,
  /// porque esa persona ya está siendo trabajada por alguien.
  YA_TIENE_FICHA: "text-aviso",
  REPETIDA_EN_EL_ARCHIVO: "text-aviso",
  NO_SE_RECONOCE: "text-aviso",
  FALLO: "text-error",
};

/// Cómo se reconoció a la persona, en castellano.
export const ETIQUETA_PORQUE: Record<PorQueEsLaMisma, string> = {
  DOCUMENTO: "por el documento",
  LLAVE: "por la llave del cargue",
  CORREO: "por el correo",
  CELULAR: "por el celular",
};

/**
 * De dónde salió la base, si se sabe.
 *
 * NO es la lista entera de `OrigenParticipante`: ofrecer
 * `FACEBOOK` aquí falsearía la comparación entre lo que cuesta un
 * inscrito por pauta y lo que cuesta por otras vías, que es
 * justamente de lo que vive esa columna. Son las tres formas en
 * que de verdad llega una base en un archivo.
 */
export const ORIGENES_DE_UNA_BASE = [
  { valor: "", etiqueta: "Lo cargó el equipo" },
  { valor: "EVENTO", etiqueta: "De una feria o un evento" },
  { valor: "EMPRESA", etiqueta: "La mandó una empresa" },
] as const;

export const bbddLeadsApi = {
  /**
   * La plantilla en blanco baja por el navegador, no por `fetch`.
   *
   * Es un archivo, no datos: dejar que lo descargue el navegador
   * da la carpeta de descargas y la barra de progreso de balde,
   * y evita cargarlo entero en memoria. Mismo criterio que el
   * formato de empresas.
   */
  urlPlantilla: () => "/api/admin/leads/cargue-plantilla",

  /**
   * Sube el archivo. Con `aplicar` en falso NO escribe nada:
   * devuelve el mismo informe diciendo qué haría.
   *
   * Va por `pedir` aunque sea un multipart: la única puerta ya
   * sabe no poner el `content-type` cuando el cuerpo es un
   * `FormData` --el navegador tiene que poner el suyo con la
   * frontera-- y es la que manda el `x-gremio`. Copiar el
   * `fetch` aquí sería la novena copia que se arregló en su día.
   *
   * Las dos rutas contestan 200 aunque el archivo esté mal: el
   * informe dice qué pasa con cada fila, así que lo que vuelve
   * no es un error, es la respuesta.
   */
  cargar: (
    archivo: File,
    /// El id del convenio o su slug. OBLIGATORIO y sin valor por
    /// omisión: los códigos AF se repiten entre gremios y no
    /// significan lo mismo, así que una base cargada en el
    /// equivocado no falla --entra y le rellena huecos a la gente
    /// del otro--. Adivinarlo sería acertar hoy y meter mil
    /// personas donde no van el día que alguien tenga los dos.
    convenio: string,
    /// Opcional. Vacío: lo decide el servidor (`ASESOR`).
    origen: string,
    aplicar: boolean,
  ) => {
    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);
    cuerpo.append("convenio", convenio);
    if (origen) cuerpo.append("origen", origen);

    return pedir<ResultadoDelCargue>(
      aplicar ? "/admin/leads/cargue-aplicar" : "/admin/leads/cargue-vista-previa",
      { method: "POST", body: cuerpo },
    );
  },
};

/// Cuánto pesa como máximo el archivo, en bytes. Lo fija el
/// servidor; aquí solo se dice antes de subir 40 MB por nada.
export const MAXIMO_ARCHIVO = 5 * 1024 * 1024;
