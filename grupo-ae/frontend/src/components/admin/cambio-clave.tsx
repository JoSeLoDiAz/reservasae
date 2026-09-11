"use client";

import { useState } from "react";

import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

const LARGO_MINIMO = 10;

/** Tapa el panel con la clave temporal. */
export function CambioDeClaveObligatorio({ alTerminar }: { alTerminar: () => Promise<void> }) {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="titulo-pantalla">Cambie su contraseña</h1>
      <p className="secundario prosa mt-2">
        Su cuenta se creó con una contraseña temporal que conoce quien se la
        entregó. Elija una nueva para continuar.
      </p>
      <div className="mt-8">
        <FormularioCambioClave alTerminar={alTerminar} textoBoton="Cambiar y entrar" />
      </div>
    </div>
  );
}

export function FormularioCambioClave({
  alTerminar,
  textoBoton = "Cambiar contraseña",
}: {
  alTerminar: () => Promise<void>;
  textoBoton?: string;
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    // el servidor solo recibe una de las dos
    if (nueva !== repetida) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    if (nueva.length < LARGO_MINIMO) {
      setError(`La contraseña nueva debe tener al menos ${LARGO_MINIMO} caracteres.`);
      return;
    }

    setEnviando(true);
    try {
      await adminApi.cambiarClave(actual, nueva);
      setListo(true);
      setActual("");
      setNueva("");
      setRepetida("");
      await alTerminar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setEnviando(false);
    }
  }

  /// La misma medida que `CLASE_CONTROL`, escrita aquí.
  ///
  /// No se importa de `marco-admin` porque aquel importa
  /// `CambioDeClaveObligatorio` de este archivo, y traerse la
  /// clase cerraría el círculo entre los dos módulos.
  const clase =
    "w-full rounded-plano border border-campo-borde bg-campo-fondo px-3 py-[7px] dato " +
    "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco";

  return (
    /// Tres campos de contraseña, cada uno en su celda: dentro
    /// del formulario de 720 px eso da 348 de ancho, que es lo
    /// que mide un campo de escribir. A lo ancho medían 1350.
    <form onSubmit={enviar} className="formulario">
      <div className="formulario-doble">
        <label className="block">
          <span className="rotulo-bloque mb-1.5 block">Contraseña actual</span>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className={clase}
          />
        </label>

        <label className="block">
          <span className="rotulo-bloque mb-1.5 block">Contraseña nueva</span>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={LARGO_MINIMO}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className={clase}
          />
          <span className="secundario mt-1.5 block">
            Mínimo {LARGO_MINIMO} caracteres.
          </span>
        </label>

        <label className="block">
          <span className="rotulo-bloque mb-1.5 block">
            Repita la contraseña nueva
          </span>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            className={clase}
          />
        </label>
      </div>

      {/* El color va en la LETRA. Y el que falla no va en rojo:
          `--error` está reservado para el tiempo que alguien
          lleva esperando respuesta, que es la única señal
          cálida que existe en el panel. */}
      {error && (
        <p role="alert" className="aviso-en-linea text-titulo mt-4">
          {error}
        </p>
      )}
      {listo && !error && (
        <p role="status" className="aviso-en-linea text-exito mt-4">
          Contraseña actualizada.
        </p>
      )}

      <div className="border-hairline mt-6 border-t pt-4">
        <button
          type="submit"
          disabled={enviando}
          className="estado rounded-plano sin-aro inline-flex h-[32px] items-center justify-center bg-marca px-[13px] text-marca-texto transition hover:bg-marca-fuerte disabled:cursor-not-allowed disabled:bg-campo-borde disabled:text-texto-suave"
        >
          {enviando ? "Guardando…" : textoBoton}
        </button>
      </div>
    </form>
  );
}
