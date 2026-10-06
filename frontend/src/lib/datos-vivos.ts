"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const INTERVALO_POR_DEFECTO = 30_000;

export type DatosVivos<T> = {
  datos: T | null;
  /** Solo se pone si aún no hay datos buenos. */
  error: string | null;
  cargando: boolean;
  refrescando: boolean;
  /** Falló el último intento. */
  desactualizado: boolean;
  actualizadoEn: Date | null;
  refrescar: () => void;
};

/** Datos que se vuelven a pedir solos. */
export function useDatosVivos<T>(
  cargar: () => Promise<T>,
  opciones: { intervaloMs?: number; activo?: boolean; clave?: string } = {},
): DatosVivos<T> {
  const { intervaloMs = INTERVALO_POR_DEFECTO, activo = true, clave = "" } = opciones;

  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [desactualizado, setDesactualizado] = useState(false);
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null);

  // en una ref: no reinicia el temporizador
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const enVuelo = useRef(false);
  const hayDatos = useRef(false);
  const ultimo = useRef(0);
  const vivo = useRef(true);

  /**
   * DE QUÉ CORTE ES LO QUE SE ESTÁ PIDIENDO, y si quedó algo por
   * pedir. Las dos arreglan el mismo síntoma por dos caminos.
   *
   * «No es confiable los filtros en los tableros» (cliente, 5 oct
   * 2026).
   *
   * 1. LA PETICIÓN QUE SE TIRABA. Si llegaba una pedida mientras
   *    había otra en vuelo, `return` y a otra cosa: nadie la
   *    reintentaba. Cambiar un filtro mientras cargaba dejaba la
   *    pantalla con las cifras del filtro ANTERIOR hasta el siguiente
   *    tic ---treinta segundos--- o para siempre si el tic caía con
   *    la pestaña en segundo plano. Es la mitad del «25»: la cabecera
   *    resolvía el periodo, pedía con él, y esa pedida se perdía.
   *
   * 2. LA RESPUESTA VIEJA QUE SE PINTABA. La que venía en vuelo era
   *    del corte anterior, y al llegar se escribía igual. Así que
   *    durante un instante ---o hasta el siguiente tic--- la pantalla
   *    enseñaba los números de un filtro bajo el rótulo de otro.
   *
   * Ahora cada pedida se marca con la clave de su corte: al volver,
   * si la clave ya no es la de ahora, su respuesta se descarta, y lo
   * que quedó pendiente se pide en cuanto la anterior suelta.
   */
  const claveRef = useRef(clave);
  claveRef.current = clave;
  const pendiente = useRef(false);

  const traer = useCallback(async () => {
    if (enVuelo.current) {
      /// No se tira: se apunta y se pide al soltar la de ahora.
      pendiente.current = true;
      return;
    }
    enVuelo.current = true;
    const claveDeEsta = claveRef.current;
    setRefrescando(true);
    try {
      const nuevos = await cargarRef.current();
      if (!vivo.current) return;
      /// LLEGÓ TARDE: el corte cambió mientras venía. Sus cifras son
      /// del filtro de antes, y el `pendiente` de abajo ya se encarga
      /// de pedir las de ahora.
      if (claveRef.current !== claveDeEsta) return;
      setDatos(nuevos);
      hayDatos.current = true;
      setError(null);
      setDesactualizado(false);
      setActualizadoEn(new Date());
    } catch (e) {
      if (!vivo.current) return;
      /// Un fallo del corte viejo tampoco se enseña: el aviso diría
      /// que falló lo que se está mirando, y no es eso lo que falló.
      if (claveRef.current !== claveDeEsta) return;
      const mensaje = e instanceof Error ? e.message : "No se pudieron cargar los datos.";
      if (hayDatos.current) setDesactualizado(true);
      else setError(mensaje);
    } finally {
      ultimo.current = Date.now();
      enVuelo.current = false;
      if (vivo.current) setRefrescando(false);
      /// Y lo que se quedó esperando, ahora.
      ///
      /// Es una sola vuelta y no un bucle: `pendiente` se apaga antes
      /// de volver a entrar, así que solo se repite si entre tanto
      /// vuelve a pedirse de verdad.
      if (pendiente.current) {
        pendiente.current = false;
        if (vivo.current) void traer();
      }
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  useEffect(() => {
    if (!activo) return;
    void traer();

    // refresca al volver a la pestaña
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimo.current >= intervaloMs) void traer();
    };

    const id = setInterval(() => {
      if (document.visibilityState === "visible") void traer();
    }, intervaloMs);

    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [activo, intervaloMs, traer]);

  // al cambiar un filtro hay que pedir YA: la funcion de
  // carga vive en una ref y por si sola no dispara nada,
  // asi que sin esto el filtro tarda hasta un intervalo
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (activo) void traer();
  }, [clave, activo, traer]);

  return {
    datos,
    error,
    cargando: datos === null && error === null,
    refrescando,
    desactualizado,
    actualizadoEn,
    refrescar: () => void traer(),
  };
}
