/** Quién es esta visita y por dónde va. */

/**
 * Mide el embudo del formulario público SIN datos personales: el
 * identificador lo acuña el navegador, vive en `sessionStorage` y
 * no viaja ni la IP ni nada de lo que la persona escribe.
 *
 * El porqué de cada decisión está en CLAUDE.md.
 */

import { leerEnlaceCorto } from "@/lib/enlace-corto";
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
export const MARCAS = [
  "CATALOGO_FALLO",
  "SIN_COBERTURA",
  "ENVIO_FALLO",
  "SE_QUEDO",
] as const;

/// Cuanto hay que seguir ahi para contar como persona. Vive
/// tambien en `backend/src/embudo/escalera.ts`, y hay un test
/// que ata los dos archivos.
export const SEGUNDOS_PARA_CONTAR = 3;

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

/// Cual de las dos apps de Meta, que no son el mismo anuncio.
///
/// Medido en produccion: 111 visitas con `FBAV` y 2 con
/// `Instagram`. Juntarlas en un solo valor impedia saber cual de
/// las dos campanas funciona, que es lo que hay que decidir.
function appDeLlegada(): "APP_INSTAGRAM" | "APP_FACEBOOK" | "OTRO" {
  const ua = navigator.userAgent;
  if (/Instagram/i.test(ua)) return "APP_INSTAGRAM";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "APP_FACEBOOK";
  return "OTRO";
}

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

  const corto = leerEnlaceCorto(url.search);

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
    /// El enlace corto (`?mailing18092026`) dice lo mismo que los
    /// dos `utm_`, y solo cuenta cuando ellos no estan.
    utmFuente: lee(UTM[0]) ?? corto?.fuente,
    utmCampana: lee(UTM[1]) ?? corto?.campana,
    utmContenido: lee(UTM[2]),
    /// El BIT, nunca el valor: `fbclid` identifica un clic y se
    /// puede volver a unir a una persona.
    huboFbclid: url.searchParams.has("fbclid"),
    referente,
    ancho: anchoDePantalla(),
    /// Por que app llega. Instagram PRIMERO: su navegador manda
    /// tambien las marcas de Facebook en algunas versiones, y al
    /// reves no pasa.
    navegador: appDeLlegada(),
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

/**
 * Cuenta a quien de verdad se quedo.
 *
 * Un escaner de enlaces --el del proveedor de correo masivo, el
 * Safe Links de un buzon corporativo-- carga la pagina, dispara
 * las balizas de carga y cierra el navegador. Medido en
 * produccion el 16 sep 2026: setenta direcciones de Microsoft
 * abrieron el formulario 14.801 veces, una sola de ellas 310.
 * Una persona sigue ahi tres segundos despues.
 *
 * Va por TEMPORIZADOR y no colgada de un suceso de la pagina, y
 * esa es toda la diferencia: el `ms` que ya viaja en cada paso
 * mide lo que TARDO EN CARGAR, y por eso no sirve --de 8.309
 * visitas con un paso pasados los 3 s, 8.254 lo eran solo por un
 * catalogo lento.
 *
 * Devuelve como cancelarlo. Sin eso, salir de la pagina antes de
 * los tres segundos marcaria igual: justo lo contrario.
 */
export function contarSiSeQueda(slug: string): () => void {
  let reloj: ReturnType<typeof setTimeout> | null = null;
  try {
    reloj = setTimeout(() => {
      marcar(slug, "SE_QUEDO");
    }, SEGUNDOS_PARA_CONTAR * 1000);
  } catch {
    // medir no puede romper el formulario
  }
  return () => {
    if (reloj) clearTimeout(reloj);
  };
}
