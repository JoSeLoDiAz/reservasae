"use client";

/** Las dos líneas que ve quien se preinscribe, por acción. */

/**
 * `AccionFormacion.resumenPublico` existía, la ruta que lo guarda
 * existía —`PATCH /admin/formularios/resumenes/:accionId`— y NO LA
 * LLAMABA NADIE. Una API sin pantalla, que es el mismo defecto de
 * siempre con otra cara: el mecanismo en pie y vacío de efecto.
 *
 * El resultado es que en el formulario público salía lo que
 * hubiera dejado la siembra. En pruebas eso es texto inventado; en
 * producción, un texto que nadie escribió y nadie puede corregir.
 *
 * Va en la pantalla de la acción y no en Formularios porque es ahí
 * donde uno lo busca: es un dato de ESTE curso, no del formulario.
 */

import { useState } from "react";

import { ErrorApi } from "@/lib/api";
import { formulariosApi } from "@/lib/formularios-api";

import { Aviso, Boton } from "./marco-admin";
import { Bloque } from "./piezas";

/// Lo que cabe en la tarjeta sin romperla. No es un límite del
/// servidor: es el ancho de la caja donde se lee.
const HOLGADO = 240;

export function ResumenPublico({
  accionId,
  valor,
  alGuardado,
}: {
  accionId: string;
  valor: string | null;
  alGuardado: () => void;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const cambio = texto.trim() !== (valor ?? "").trim();

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await formulariosApi.guardarResumen(accionId, texto.trim() || null);
      setListo(true);
      alGuardado();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Bloque
      titulo="Lo que lee quien se preinscribe"
      descripcion="Dos líneas en la tarjeta del formulario público: qué se lleva quien haga este curso. El objetivo del proyecto no sirve para esto — está redactado para el convenio."
    >
      {error && <Aviso tipo="error">{error}</Aviso>}

      {!valor?.trim() && (
        /* Se dice ANTES de que alguien lo descubra en el
           formulario público. Sin texto, la tarjeta sale con el
           nombre del curso a secas. */
        <p className="mb-3 rounded-lg border border-aviso/30 bg-aviso-suave px-3 py-2 text-sm text-aviso">
          Esta acción todavía no tiene texto. En el formulario público sale sin
          descripción.
        </p>
      )}

      <textarea
        rows={3}
        value={texto}
        maxLength={400}
        onChange={(e) => {
          setTexto(e.target.value);
          setListo(false);
        }}
        placeholder="Ej.: Aprenderá a diseñar rutas de formación con herramientas de inteligencia artificial y a medir su impacto."
        className="w-full rounded-lg border border-borde bg-campo px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-campo-foco"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Boton onClick={guardar} disabled={!cambio || guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
        <span
          className={`text-xs tabular-nums ${
            texto.length > HOLGADO ? "text-aviso" : "text-texto-suave"
          }`}
        >
          {texto.length} caracteres
          {texto.length > HOLGADO ? " · se va a ver apretado en la tarjeta" : ""}
        </span>
        {listo && !cambio && (
          <span className="text-xs text-exito">Guardado.</span>
        )}
      </div>
    </Bloque>
  );
}
