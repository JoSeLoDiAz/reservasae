/** Quién es esta visita y por dónde va. */

/**
 * Mide el embudo del formulario público SIN datos personales: el
 * identificador lo acuña el navegador, vive en `sessionStorage` y
 * no viaja ni la IP ni nada de lo que la persona escribe.
 *
 * El porqué de cada decisión está en CLAUDE.md.
 */

import { etiquetaDelHost } from "@/lib/gremio-del-host";

const LLAVE = "convoca:visita";

/// Sube cuando cambia el ORDEN de la escalera. Tiene que
/// coincidir con `backend/src/embudo/escalera.ts`.
export const VERSION_EMBUDO = 1;

/// Los peldaños, EN ORDEN. El informe sale de aquí.
export const ESCALERA = [
  "LLEGO",
  "CATALOGO_LISTO",
  "ELIGIO_UBICACION",
  "VIO_ACCIONES",
  "ELIGIO_ACCION",
  "AUTORIZO",
  "DATOS_COMPLETOS",
  "LLEGO_A_REVISION",
  "ENVIO",
  "REGISTRADO",
] as const;

/// Fuera de la escalera: dicen por qué se paró.
export const MARCAS = ["CATALOGO_FALLO", "SIN_COBERTURA", "ENVIO_FALLO"] as const;

export type Paso = (typeof ESCALERA)[number] | (typeof MARCAS)[number];

/// Ahorro de tráfico, NO es la idempotencia: esa la pone el
/// `@@unique([visitaId, paso])` del servidor.
const yaMandados = new Set<string>();
/// El respaldo cuando `sessionStorage` lanza --ventana privada,
/// almacenamiento particionado--. Da un id coherente dentro del
/// documento y se pierde al recargar.
let enMemoria: { id: string; t0: number } | null = null;

function nuevoId(): string {
  /// `randomUUID` no existe fuera de contexto seguro, y se
  /// prueba desde el teléfono por http contra el portátil.
  try {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  } catch {
    // sigue al respaldo
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
}

/** El id de esta visita, o null en el servidor. */
export function idDeVisita(): { id: string; t0: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const guardado = window.sessionStorage.getItem(LLAVE);
    if (guardado) {
      const v = JSON.parse(guardado) as { id?: string; t0?: number };
      if (v.id && typeof v.t0 === "number") return { id: v.id, t0: v.t0 };
    }
    const nuevo = { id: nuevoId(), t0: Date.now() };
    window.sessionStorage.setItem(LLAVE, JSON.stringify(nuevo));
    return nuevo;
  } catch {
    enMemoria ??= { id: nuevoId(), t0: Date.now() };
    return enMemoria;
  }
}

/// Lo que se puede leer de la URL, y nada más.
const UTM = ["utm_source", "utm_campaign", "utm_content"] as const;
const LIMPIO = /[^A-Za-z0-9._-]/g;

function anchoDePantalla(): "MOVIL" | "TABLET" | "ESCRITORIO" {
  const w = window.innerWidth;
  if (w < 640) return "MOVIL";
  return w < 1024 ? "TABLET" : "ESCRITORIO";
}

/** El contexto de llegada. Solo viaja con `LLEGO`. */
export function contextoDeLlegada(slug: string) {
  const url = new URL(window.location.href);
  const lee = (n: string) =>
    (url.searchParams.get(n) ?? "").replace(LIMPIO, "").slice(0, 60) || undefined;

  const etiqueta = etiquetaDelHost(window.location.host);
  const puerta = etiqueta === null ? "RUTA" : etiqueta === slug ? "SUBDOMINIO" : "CRUZADA";

  let referente: string | undefined;
  try {
    referente = document.referrer ? new URL(document.referrer).host : undefined;
  } catch {
    referente = undefined;
  }

  return {
    puerta,
    utmFuente: lee(UTM[0]),
    utmCampana: lee(UTM[1]),
    utmContenido: lee(UTM[2]),
    /// El BIT, nunca el valor: `fbclid` identifica un clic y se
    /// puede volver a unir a una persona.
    huboFbclid: url.searchParams.has("fbclid"),
    referente,
    ancho: anchoDePantalla(),
    /// El navegador por el que llega la pauta, en un bit.
    navegador: /FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent)
      ? "APP_META"
      : "OTRO",
  };
}

/**
 * Marca un paso. No lanza NUNCA y no devuelve promesa.
 *
 * Medir no puede romper el formulario: todo va en un `try`, no se
 * lee la respuesta y no se toca estado de React.
 */
export function marcar(slug: string, paso: Paso, detalle?: string): void {
  try {
    const visita = idDeVisita();
    if (!visita) return;

    const llave = `${visita.id}|${paso}`;
    if (yaMandados.has(llave)) return;
    yaMandados.add(llave);

    const cuerpo = JSON.stringify({
      visita: visita.id,
      paso,
      version: VERSION_EMBUDO,
      ms: Date.now() - visita.t0,
      detalle: detalle?.slice(0, 60),
      ...(paso === "LLEGO" ? contextoDeLlegada(slug) : {}),
    });

    const ruta = `/api/preinscripcion/${encodeURIComponent(slug)}/paso`;
    /// `sendBeacon` y no `fetch`: sobrevive a que la pestaña se
    /// cierre, que es EXACTAMENTE el caso que hay que medir.
    const blob = new Blob([cuerpo], { type: "application/json" });
    if (navigator.sendBeacon?.(ruta, blob)) return;

    void fetch(ruta, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: cuerpo,
    }).catch(() => {});
  } catch {
    // medir no puede romper el formulario
  }
}
