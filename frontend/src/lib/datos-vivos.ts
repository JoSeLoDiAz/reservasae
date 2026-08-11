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
  opciones: { intervaloMs?: number; activo?: boolean } = {},
): DatosVivos<T> {
  const { intervaloMs = INTERVALO_POR_DEFECTO, activo = true } = opciones;

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

  const traer = useCallback(async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setRefrescando(true);
    try {
      const nuevos = await cargarRef.current();
      if (!vivo.current) return;
      setDatos(nuevos);
      hayDatos.current = true;
      setError(null);
      setDesactualizado(false);
      setActualizadoEn(new Date());
    } catch (e) {
      if (!vivo.current) return;
      const mensaje = e instanceof Error ? e.message : "No se pudieron cargar los datos.";
      if (hayDatos.current) setDesactualizado(true);
      else setError(mensaje);
    } finally {
      ultimo.current = Date.now();
      enVuelo.current = false;
      if (vivo.current) setRefrescando(false);
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
