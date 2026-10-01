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

import { Desplegable } from "./desplegable";
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

          {/* LOS DESPLEGABLES, CON EL DE LA CASA.
              «No debe haber desplegables cuadrados, todos deben ser
              redondeados» (cliente, 1 oct 2026): la lista de un
              `<select>` la pinta Windows --cuadrada y con su azul--
              y ninguna regla de CSS llega hasta ahi.

              TODOS con `enPortal`: este cajon es un `<aside>` con
              `overflow-y-auto` propio, y lo que sobresale de un
              contenedor con `overflow` se recorta. Sin portal, una
              lista de cuarenta cursos abierta en el ultimo campo
              quedaba cortada por el canto del cajon. */}
          <CampoLista etiqueta="Curso">
            <Desplegable
              enPortal
              etiquetaAria="Curso"
              marcador="Sin curso"
              valor={v("accionFormacionId") ?? ""}
              alElegir={(x) => set("accionFormacionId", x || null)}
              opciones={[
                /// «Sin curso» es un valor, no un marcador vacio: el
                /// lead puede quedarse sin curso a proposito y hay
                /// que poder volver a eso.
                { valor: "", etiqueta: "Sin curso" },
                /// El codigo Y el nombre en la misma linea, como
                /// estaban: el codigo solo no distingue nada --se
                /// repiten entre gremios-- y el nombre solo no se
                /// cruza con el listado de acciones.
                ...cursos.map((x) => ({
                  valor: x.id,
                  etiqueta: `${x.codigo} · ${x.nombre}`,
                })),
              ]}
            />
          </CampoLista>

          <div className="grid grid-cols-2 gap-3">
            <CampoLista etiqueta="Tipo de documento">
              <Desplegable
                enPortal
                etiquetaAria="Tipo de documento"
                /// «Elija…» NO va como opcion de la lista: no es un
                /// valor, es la ausencia de uno. Va de marcador, que
                /// es donde se lee sin ocupar un renglon.
                marcador="Elija…"
                valor={
                  v("tipoDocumentoSepId") === null ||
                  v("tipoDocumentoSepId") === undefined
                    ? ""
                    : String(v("tipoDocumentoSepId"))
                }
                alElegir={(x) =>
                  set("tipoDocumentoSepId", x ? Number(x) : null)
                }
                opciones={(catalogos?.documentosPersona ?? []).map((d) => ({
                  valor: String(d.id),
                  etiqueta: `${d.sigla} · ${d.etiqueta}`,
                }))}
              />
            </CampoLista>

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

          <CampoLista etiqueta="Departamento">
            <Desplegable
              enPortal
              etiquetaAria="Departamento"
              marcador="Sin departamento"
              valor={
                v("departamentoSepId") ? String(v("departamentoSepId")) : ""
              }
              alElegir={(x) => {
                const dep = x ? Number(x) : null;
                set("departamentoSepId", dep);
                /// Al cambiar de departamento se limpia la
                /// ciudad: dejarla sería un par que el servidor
                /// rechaza, y con razón.
                set("municipioSepId", null);
              }}
              opciones={[
                { valor: "", etiqueta: "Sin departamento" },
                ...(catalogos?.departamentos ?? []).map((d) => ({
                  valor: String(d.id),
                  etiqueta: d.etiqueta,
                })),
              ]}
            />
          </CampoLista>

          <CampoLista etiqueta="Ciudad">
            <Desplegable
              enPortal
              etiquetaAria="Ciudad"
              desactivado={!v("departamentoSepId")}
              /// Apagado y vacio parece roto: el marcador dice por
              /// que no se puede tocar todavia.
              marcador={
                v("departamentoSepId")
                  ? "Sin ciudad"
                  : "Elija primero el departamento"
              }
              valor={v("municipioSepId") ? String(v("municipioSepId")) : ""}
              alElegir={(x) => set("municipioSepId", x ? Number(x) : null)}
              opciones={[
                { valor: "", etiqueta: "Sin ciudad" },
                ...municipios.map((m) => ({
                  valor: String(m[0]),
                  etiqueta: m[2],
                })),
              ]}
            />
          </CampoLista>

          <CampoLista etiqueta="Género">
            <Desplegable
              enPortal
              etiquetaAria="Género"
              marcador="Sin decir"
              valor={v("generoSepId") ? String(v("generoSepId")) : ""}
              alElegir={(x) => set("generoSepId", x ? Number(x) : null)}
              opciones={[
                { valor: "", etiqueta: "Sin decir" },
                ...(catalogos?.generos ?? []).map((g) => ({
                  valor: String(g.id),
                  etiqueta: g.etiqueta,
                })),
              ]}
            />
          </CampoLista>
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

/**
 * El mismo campo, en `<div>`: es el que lleva un desplegable.
 *
 * Un `<label>` se ata al primer control ATABLE de dentro, y el
 * disparador del `Desplegable` es un `<button>`, que no lo es:
 * la etiqueta quedaria apuntando al vacio y el clic en el
 * rotulo no haria nada. El nombre se da entonces por
 * `etiquetaAria`, que es lo que oye un lector de pantalla.
 */
function CampoLista({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium">{etiqueta}</span>
      {children}
    </div>
  );
}
