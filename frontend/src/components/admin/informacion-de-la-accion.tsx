"use client";

/** Los tres textos del proyecto: objetivo, contenido y competencia. */

/**
 * Sustituye a dos apartados que estaban separados: «Objetivo de la
 * acción» --que solo se leía, con un «Texto del proyecto, sin
 * modificar»-- y «Lo que lee quien se preinscribe». Lo pidió el
 * cliente el 13 sep 2026: un solo apartado con tres campos.
 *
 * Los tres se guardan con UN botón y no uno cada uno: se escriben de
 * una sentada, copiando del proyecto, y tres botones invitan a dejarse
 * dos a medias.
 *
 * Esto es lo que el formulario público abre con «Más información», así
 * que lo lee quien está decidiendo si se inscribe.
 */

import { useState } from "react";

import { cronogramaApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

import { Aviso, Boton } from "./marco-admin";
import { Bloque } from "./piezas";

const CAMPOS = [
  {
    clave: "objetivo" as const,
    etiqueta: "Objetivo",
    ayuda: "Para qué existe la acción. Viene del proyecto del convenio.",
    ejemplo:
      "Ej.: Fortalecer las competencias pedagógicas y socioemocionales de los docentes para gestionar la atención en el aula.",
  },
  {
    clave: "contenido" as const,
    etiqueta: "Contenido",
    ayuda: "Qué se ve en el curso: los temas, en el orden en que se dan.",
    ejemplo: "Ej.: Módulo 1, neurociencia del aprendizaje. Módulo 2, estrategias de aula.",
  },
  {
    clave: "competencia" as const,
    /// Lo pidio el cliente el 14 sep 2026. La COLUMNA se sigue
    /// llamando `competencia` --renombrarla seria una migracion
    /// para cambiar un rotulo-- y lo que ve la gente es esto.
    etiqueta: "Resultado de aprendizaje",
    ayuda: "Qué sabrá hacer quien lo termine.",
    ejemplo: "Ej.: Diseñar e implementar estrategias de autorregulación en su grupo.",
  },
];

type Textos = { objetivo: string; contenido: string; competencia: string };

export function InformacionDeLaAccion({
  accionId,
  objetivo,
  contenido,
  competencia,
  puedeEditar,
  alGuardado,
}: {
  accionId: string;
  objetivo: string | null;
  contenido: string | null;
  competencia: string | null;
  /// Sin `configuracion:ESCRIBIR` se lee y no se toca. El backend lo
  /// exige igual; esto evita ofrecer un botón que va a fallar.
  puedeEditar: boolean;
  alGuardado: () => void;
}) {
  const guardado: Textos = {
    objetivo: objetivo ?? "",
    contenido: contenido ?? "",
    competencia: competencia ?? "",
  };
  const [texto, setTexto] = useState<Textos>(guardado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const cambio = CAMPOS.some((c) => texto[c.clave].trim() !== guardado[c.clave].trim());
  const vacios = CAMPOS.every((c) => !texto[c.clave].trim());

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await cronogramaApi.guardarInformacion(accionId, {
        objetivo: texto.objetivo.trim() || null,
        contenido: texto.contenido.trim() || null,
        competencia: texto.competencia.trim() || null,
      });
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
      titulo="Información Acción de Formación"
      descripcion="Los tres textos del proyecto. Es lo que se abre en el formulario público con «Más información»."
    >
      {error && <Aviso tipo="error">{error}</Aviso>}

      {vacios && puedeEditar && (
        /* Se dice ANTES de que alguien lo busque en el formulario:
           sin ninguno de los tres, el botón no se pinta. */
        <p className="mb-3 rounded-lg border border-aviso/30 bg-aviso-suave px-3 py-2 text-sm text-aviso">
          Todavía no hay ningún texto. Mientras los tres estén vacíos, en el
          formulario público no sale el botón de «Más información».
        </p>
      )}

      <div className="space-y-4">
        {CAMPOS.map((c) => (
          <div key={c.clave}>
            <label
              htmlFor={`${c.clave}-${accionId}`}
              className="block text-[0.78125rem] font-semibold text-titulo"
            >
              {c.etiqueta}
            </label>
            <p className="mt-0.5 mb-1.5 text-[0.75rem] text-texto-suave">{c.ayuda}</p>
            <textarea
              id={`${c.clave}-${accionId}`}
              rows={5}
              maxLength={4000}
              readOnly={!puedeEditar}
              value={texto[c.clave]}
              onChange={(e) => {
                setTexto({ ...texto, [c.clave]: e.target.value });
                setListo(false);
              }}
              placeholder={puedeEditar ? c.ejemplo : "Sin texto."}
              className="w-full rounded-lg border border-borde bg-campo px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-campo-foco read-only:bg-superficie-alterna read-only:text-texto-suave"
            />
          </div>
        ))}
      </div>

      {puedeEditar && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Boton onClick={guardar} disabled={!cambio || guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
          {listo && !cambio && <span className="text-xs text-exito">Guardado.</span>}
        </div>
      )}
    </Bloque>
  );
}
