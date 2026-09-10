"use client";

/** Componer un lead que llegó mal, desde la mesa. */

/**
 * Es la otra mitad de «se reciben todos los leads».
 *
 * Si entran todos, alguien tiene que poder arreglar los que
 * llegaron incompletos: el curso que no se reconoció, la ciudad
 * mal escrita, el documento que no vino. Sin esto la mesa dice
 * qué falta y no da por dónde — el mismo callejón que ya se comió
 * este proyecto con el enlace de completado.
 *
 * SOLO SE MANDA LO QUE CAMBIA. Un PATCH con los once campos
 * pisaría con lo que hay en pantalla cosas que otro pudo haber
 * corregido mientras tanto, y aquí la lista se refresca cada diez
 * segundos.
 */

import { useMemo, useState } from "react";

import { crmApi, type CatalogosSep } from "@/lib/crm-api";
import { ErrorApi } from "@/lib/api";
import {
  mesaApi,
  type ArregloDeLead,
  type LeadDeLaMesa,
  type ListadoDeLaMesa,
} from "@/lib/mesa-api";

import { Aviso, Boton } from "./marco-admin";

const CAMPO =
  "w-full rounded-lg border border-borde bg-campo px-3 py-1.5 text-sm " +
  "outline-none focus:ring-2 focus:ring-campo-foco";

export function ArreglarLead({
  lead,
  cursos,
  catalogos,
  alCerrar,
  alGuardado,
}: {
  lead: LeadDeLaMesa;
  cursos: ListadoDeLaMesa["cursos"];
  /// Departamentos, municipios, géneros y tipos de documento.
  /// Los mismos que usa la ficha: dos catálogos para lo mismo
  /// acaban ofreciendo valores distintos.
  catalogos: CatalogosSep | null;
  alCerrar: () => void;
  alGuardado: () => void;
}) {
  const [c, setC] = useState<ArregloDeLead>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /// Lo que vale ahora: lo tecleado si se tocó, y si no lo que
  /// trae el lead.
  function v<K extends keyof ArregloDeLead>(k: K): ArregloDeLead[K] {
    return k in c ? c[k] : (lead.crudo[k] as ArregloDeLead[K]);
  }
  function set<K extends keyof ArregloDeLead>(k: K, valor: ArregloDeLead[K]) {
    setC((antes) => ({ ...antes, [k]: valor }));
  }

  /// Los municipios del departamento elegido, no los 1.100.
  ///
  /// Ofrecerlos todos deja elegir uno que no es de su
  /// departamento, y el servidor lo rechaza — con razón, pero
  /// después de haberlo dejado elegir.
  const municipios = useMemo(() => {
    const dep = v("departamentoSepId");
    if (!catalogos || !dep) return [];
    return catalogos.municipios.filter((m) => m[1] === dep);
  }, [catalogos, c, lead]);

  const hayCambios = Object.keys(c).length > 0;

  async function guardar() {
    setGuardando(true);
    try {
      await mesaApi.arreglar(lead.id, c);
      setError(null);
      alGuardado();
      alCerrar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* El velo cierra. Un cajón sin forma de salir salvo un
          botón pequeño se siente atrapado. */}
      <button
        aria-label="Cerrar"
        className="flex-1 bg-black/30"
        onClick={alCerrar}
      />

      <aside className="flex w-full max-w-md flex-col overflow-y-auto border-l border-borde bg-superficie shadow-xl">
        <header className="border-b border-borde px-6 py-4">
          <h2 className="font-semibold">Arreglar este lead</h2>
          <p className="mt-0.5 text-sm text-texto-suave">{lead.nombre}</p>
          {lead.falta.length > 0 && (
            /* Lo que falta, arriba y a la vista: es la razón por
               la que se abrió esta pantalla. */
            <p className="mt-2 text-sm text-aviso">
              Le falta {lead.falta.join(", ")}
            </p>
          )}
        </header>

        <div className="space-y-4 px-6 py-5">
          {error && <Aviso tipo="error">{error}</Aviso>}

          {/* Lo que dijo, para poder cotejarlo mientras se
              corrige. Sin esto hay que cerrar y volver a abrir. */}
          {lead.pidio && (
            <p className="rounded-lg border border-borde bg-superficie-alterna px-3 py-2 text-xs text-texto-suave">
              Escribió: «{lead.pidio}»
            </p>
          )}

          <Campo etiqueta="Curso">
            <select
              className={CAMPO}
              value={v("accionFormacionId") ?? ""}
              onChange={(e) => set("accionFormacionId", e.target.value || null)}
            >
              <option value="">Sin curso</option>
              {cursos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.codigo} · {x.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Tipo de documento">
              <select
                className={CAMPO}
                value={v("tipoDocumentoSepId") ?? ""}
                onChange={(e) =>
                  set(
                    "tipoDocumentoSepId",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              >
                <option value="">Elija…</option>
                {(catalogos?.documentosPersona ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.sigla} · {d.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Número">
              <input
                className={CAMPO}
                value={v("numeroDocumento") ?? ""}
                onChange={(e) => set("numeroDocumento", e.target.value || null)}
              />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Nombres">
              <input
                className={CAMPO}
                value={v("primerNombre") ?? ""}
                onChange={(e) => set("primerNombre", e.target.value || null)}
              />
            </Campo>
            <Campo etiqueta="Primer apellido">
              <input
                className={CAMPO}
                value={v("primerApellido") ?? ""}
                onChange={(e) => set("primerApellido", e.target.value || null)}
              />
            </Campo>
          </div>

          <Campo etiqueta="Segundo apellido">
            <input
              className={CAMPO}
              value={v("segundoApellido") ?? ""}
              onChange={(e) => set("segundoApellido", e.target.value || null)}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Correo">
              <input
                className={CAMPO}
                value={v("correo") ?? ""}
                onChange={(e) => set("correo", e.target.value || null)}
              />
            </Campo>
            <Campo etiqueta="Celular">
              <input
                className={CAMPO}
                value={v("celular") ?? ""}
                onChange={(e) => set("celular", e.target.value || null)}
              />
            </Campo>
          </div>

          <Campo etiqueta="Departamento">
            <select
              className={CAMPO}
              value={v("departamentoSepId") ?? ""}
              onChange={(e) => {
                const dep = e.target.value ? Number(e.target.value) : null;
                set("departamentoSepId", dep);
                /// Al cambiar de departamento se limpia la
                /// ciudad: dejarla sería un par que el servidor
                /// rechaza, y con razón.
                set("municipioSepId", null);
              }}
            >
              <option value="">Sin departamento</option>
              {(catalogos?.departamentos ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.etiqueta}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Ciudad">
            <select
              className={CAMPO}
              value={v("municipioSepId") ?? ""}
              onChange={(e) =>
                set(
                  "municipioSepId",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              disabled={!v("departamentoSepId")}
            >
              <option value="">
                {v("departamentoSepId")
                  ? "Sin ciudad"
                  : "Elija primero el departamento"}
              </option>
              {municipios.map((m) => (
                <option key={m[0]} value={m[0]}>
                  {m[2]}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Género">
            <select
              className={CAMPO}
              value={v("generoSepId") ?? ""}
              onChange={(e) =>
                set("generoSepId", e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Sin decir</option>
              {(catalogos?.generos ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <footer className="mt-auto flex items-center gap-3 border-t border-borde px-6 py-4">
          <Boton onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
          <button
            className="text-sm font-medium text-texto-suave hover:underline"
            onClick={alCerrar}
          >
            Cancelar
          </button>
          {hayCambios && (
            <span className="ml-auto text-xs text-texto-suave">
              {/* Se dice cuántos, no cuáles: quien lo está
                  llenando ya sabe qué tocó. */}
              {Object.keys(c).length} sin guardar
            </span>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}
