import { ErrorApi } from "./api";

/** Cargue por plantilla de Excel. */

export type Reparo = {
  fila: number;
  columna: string;
  problema: string;
};

export type ResultadoCargue = {
  /// Se escribió de verdad, o solo se revisó.
  aplicado: boolean;
  leidas: number;
  actualizadas: number;
  creadas: number;
  sinPareja: Array<{ fila: number; llave: string }>;
  reparos: Reparo[];
  /// Celdas que venían en blanco. No borraron nada.
  vacias: number;
};

export const plantillasApi = {
  /**
   * El formato baja por el navegador, no por `fetch`.
   *
   * Es un archivo, no datos: dejar que el navegador lo
   * descargue evita cargarlo entero en memoria y nos da la
   * barra de progreso y la carpeta de descargas de balde.
   */
  urlFormato: (entidad: string) => `/api/admin/plantillas/${entidad}/formato`,

  /**
   * Sube el archivo.
   *
   * Con `ensayo` no escribe: devuelve lo que haría. La
   * pantalla lo usa siempre antes de aplicar.
   *
   * No pasa por el ayudante `pedir` porque va como FormData:
   * ahí el navegador tiene que poner él mismo el
   * `content-type` con la frontera del multipart, y ponerlo
   * a mano rompe la subida.
   */
  cargar: async (
    entidad: string,
    archivo: File,
    ensayo: boolean,
  ): Promise<ResultadoCargue> => {
    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);

    const gremio =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem("convoca:gremio");

    const respuesta = await fetch(
      `/api/admin/plantillas/${entidad}/cargar${ensayo ? "?ensayo=1" : ""}`,
      {
        method: "POST",
        body: cuerpo,
        headers: gremio ? { "x-gremio": gremio } : undefined,
      },
    );

    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      const bruto = (datos as { message?: string | string[] } | null)?.message;
      const mensaje = Array.isArray(bruto) ? bruto.join(". ") : bruto;
      throw new ErrorApi(
        respuesta.status,
        mensaje ?? "No se pudo cargar el archivo.",
        datos,
      );
    }

    return datos as ResultadoCargue;
  },
};
