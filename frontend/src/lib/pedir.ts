/** La única puerta de salida al backend. */

/// Existía nueve veces, copiada, una por cada archivo de API.
/// Eso funcionó mientras solo hacía `fetch` y traducía
/// errores. Dejó de funcionar el día que hubo que mandar en
/// CADA llamada de qué gremio se está hablando: parchear ocho
/// copias y olvidar una mezcla los datos de los dos gremios,
/// y el error no se ve -- salen números, solo que de más.
///
/// Por eso ahora es una sola. Si mañana hay que añadir otra
/// cabecera, hay un solo sitio donde ponerla.

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly cuerpo?: unknown,
  ) {
    super(mensaje);
  }
}

/// Donde el panel guarda el gremio elegido.
const LLAVE_GREMIO = "convoca:gremio";

/// Lo lee de aquí y no lo recibe por parámetro: si cada
/// llamada tuviera que acordarse de pasarlo, bastaría con
/// olvidarlo en una.
function gremioElegido(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LLAVE_GREMIO);
  } catch {
    // en ventana privada localStorage puede fallar
    return null;
  }
}

export async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const gremio = gremioElegido();
  // con FormData no se pone content-type: el navegador tiene
  // que poner el suyo con la frontera del multipart
  const esFormData = opciones?.body instanceof FormData;

  const respuesta = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: {
      ...(esFormData ? {} : { "content-type": "application/json" }),
      // el backend la usa para recortar el ámbito. NUNCA
      // amplía: si pide un gremio que su cuenta no le
      // concede, se ignora y se queda con lo suyo
      ...(gremio ? { "x-gremio": gremio } : {}),
      ...opciones?.headers,
    },
  });

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    // Nest manda `message` como texto o como lista
    const bruto = (cuerpo as { message?: string | string[] } | null)?.message;
    const mensaje = Array.isArray(bruto) ? bruto.join(". ") : bruto;
    throw new ErrorApi(
      respuesta.status,
      mensaje ?? "No se pudo completar la operación.",
      cuerpo,
    );
  }

  return cuerpo as T;
}
