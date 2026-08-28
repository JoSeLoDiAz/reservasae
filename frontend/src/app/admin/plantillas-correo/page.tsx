"use client";

/** Las plantillas de correo: escribirlas una vez. */

/// Lo que cambia de una persona a otra va entre llaves. Esta
/// pantalla tiene que hacer dos cosas bien: enseñar CUÁLES
/// existen —a mano, para poder pegarlas— y no dejar guardar
/// una variable que no existe. Lo segundo es lo que evita que
/// salga «Estimado {{nombreDePila}}» a cuarenta personas.

import { useCallback, useEffect, useState } from "react";

import { Aviso, Boton, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { useToast } from "@/components/admin/toast";
import { VistaPreviaCorreo } from "@/components/admin/vista-previa-correo";
import { ErrorApi } from "@/lib/api";
import {
  plantillasCorreoApi,
  type PlantillaCorreo,
  type VariableCorreo,
} from "@/lib/plantillas-correo-api";

type Borrador = {
  nombre: string;
  asunto: string;
  cuerpo: string;
  etapasPermitidas: string[];
};

const VACIO: Borrador = {
  nombre: "",
  asunto: "",
  cuerpo: "",
  etapasPermitidas: [],
};

/// Las etapas en las que se le puede escribir a alguien. Las
/// de salida —perdido, retirado, desertó— no están: a quien
/// se fue no se le manda una plantilla, se le llama.
const ETAPAS: Array<[string, string]> = [
  ["INTERESADO", "Interesado"],
  ["CONTACTADO", "Contactado"],
  ["DATOS_COMPLETOS", "Con datos completos"],
  ["INSCRITO", "Inscrito"],
  ["EN_FORMACION", "En formación"],
  ["CERTIFICADO", "Certificado"],
];

export default function PaginaPlantillasCorreo() {
  const toast = useToast();
  const [plantillas, setPlantillas] = useState<PlantillaCorreo[] | null>(null);
  const [variables, setVariables] = useState<VariableCorreo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /// Null: no se está editando nada. "" : una nueva.
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(VACIO);

  const cargar = useCallback(async () => {
    const [lista, vars] = await Promise.all([
      plantillasCorreoApi.listar(),
      plantillasCorreoApi.variables(),
    ]);
    setPlantillas(lista);
    setVariables(vars);
  }, []);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  function abrirNueva() {
    setEditando("");
    setBorrador(VACIO);
  }

  function abrir(p: PlantillaCorreo) {
    setEditando(p.id);
    setBorrador({
      nombre: p.nombre,
      asunto: p.asunto,
      cuerpo: p.cuerpo,
      etapasPermitidas: p.etapasPermitidas ?? [],
    });
  }

  async function guardar() {
    setOcupado(true);
    try {
      if (editando) {
        await plantillasCorreoApi.editar(editando, borrador);
        toast.exito("Se guardó la plantilla.");
      } else {
        await plantillasCorreoApi.crear(borrador);
        toast.exito("Se creó la plantilla.");
      }
      setEditando(null);
      await cargar();
    } catch (e) {
      toast.error((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  /// Pega la variable donde esté el cursor. Escribirlas a
  /// mano es como se cuela un `{{nombrecompleto}}` con la ce
  /// minúscula, que el servidor rechaza y nadie entiende por
  /// qué.
  function pegar(clave: string) {
    const caja = document.getElementById("cuerpo") as HTMLTextAreaElement | null;
    const trozo = `{{${clave}}}`;
    if (!caja) {
      setBorrador((b) => ({ ...b, cuerpo: b.cuerpo + trozo }));
      return;
    }
    const { selectionStart: a, selectionEnd: b } = caja;
    setBorrador((v) => ({
      ...v,
      cuerpo: v.cuerpo.slice(0, a) + trozo + v.cuerpo.slice(b),
    }));
    // devolver el cursor detrás de lo pegado
    requestAnimationFrame(() => {
      caja.focus();
      caja.setSelectionRange(a + trozo.length, a + trozo.length);
    });
  }

  if (!plantillas) {
    return error ? (
      <Aviso tipo="error">{error}</Aviso>
    ) : (
      <p className="text-texto-suave">Cargando…</p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plantillas de correo</h1>
          <p className="mt-1 max-w-3xl text-texto-suave">
            Se escriben una vez y se mandan muchas. Lo que cambia de una persona a
            otra va entre llaves, y se llena solo con los datos de su ficha.
          </p>
        </div>
        {editando === null && <Boton onClick={abrirNueva}>Nueva plantilla</Boton>}
      </header>

      {editando !== null && (
        <Tarjeta titulo={editando ? "Editar la plantilla" : "Nueva plantilla"}>
          <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
            <div className="space-y-4">
              <div>
                <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium">
                  Cómo la va a reconocer
                </label>
                <input
                  id="nombre"
                  className={CLASE_CONTROL}
                  value={borrador.nombre}
                  onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                  placeholder="Confirmación de inscripción"
                />
              </div>

              <div>
                <label htmlFor="asunto" className="mb-1.5 block text-sm font-medium">
                  Asunto
                </label>
                <input
                  id="asunto"
                  className={CLASE_CONTROL}
                  value={borrador.asunto}
                  onChange={(e) => setBorrador({ ...borrador, asunto: e.target.value })}
                  placeholder="{{tratamiento}} {{primerApellido}}, quedó inscrito"
                />
              </div>

              <div>
                <label htmlFor="cuerpo" className="mb-1.5 block text-sm font-medium">
                  El mensaje
                </label>
                <textarea
                  id="cuerpo"
                  rows={14}
                  className={`${CLASE_CONTROL} font-mono text-[13px] leading-relaxed`}
                  value={borrador.cuerpo}
                  onChange={(e) => setBorrador({ ...borrador, cuerpo: e.target.value })}
                  placeholder={"{{saludo}}:\n\nSu curso {{accionFormacion}} arranca el {{fechaInicio}}."}
                />
              </div>

              {/* Sin esto se podia mandar «quedo inscrito» a
                  quien todavia no lo esta. Ese correo no se
                  recoge: la persona se queda esperando un
                  cupo que nadie le dio. */}
              <fieldset className="rounded-xl border border-borde p-4">
                <legend className="px-1 text-sm font-medium">
                  ¿A quién se le puede mandar?
                </legend>
                <p className="mb-3 text-xs text-texto-suave">
                  Si no marca ninguna, sirve para cualquiera. Marque solo si
                  esta plantilla dice algo que no es cierto en otra etapa.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {ETAPAS.map(([valor, texto]) => (
                    <label
                      key={valor}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-superficie-alterna"
                    >
                      <input
                        type="checkbox"
                        checked={borrador.etapasPermitidas.includes(valor)}
                        onChange={(e) =>
                          setBorrador((b) => ({
                            ...b,
                            etapasPermitidas: e.target.checked
                              ? [...b.etapasPermitidas, valor]
                              : b.etapasPermitidas.filter((x) => x !== valor),
                          }))
                        }
                      />
                      <span>{texto}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-4">
                <Boton onClick={() => void guardar()} disabled={ocupado}>
                  {ocupado ? "Guardando…" : "Guardar"}
                </Boton>
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="text-sm underline"
                >
                  Cancelar
                </button>
              </div>
            </div>

            <div className="space-y-5">
            {/* La vista va ARRIBA de la lista de variables: lo
                primero que uno quiere ver mientras escribe es
                cómo va quedando, no el catálogo. */}
            <VistaPreviaCorreo
              asunto={borrador.asunto}
              cuerpo={borrador.cuerpo}
              variables={variables}
            />

            {/* A mano y con un clic: escribirlas a mano es como
                se cuela un {{nombrecompleto}} con la ce
                minúscula, que el servidor rechaza y nadie
                entiende por qué. */}
            <div className="rounded-xl border border-borde bg-superficie-alterna p-4">
              <p className="text-sm font-medium">Lo que puede poner</p>
              <p className="mt-1 text-xs text-texto-suave">
                Pulse una para pegarla donde esté el cursor.
              </p>
              <ul className="mt-3 space-y-1.5">
                {variables.map((v) => (
                  <li key={v.clave}>
                    <button
                      type="button"
                      onClick={() => pegar(v.clave)}
                      className="w-full rounded-lg px-2 py-1 text-left transition hover:bg-superficie"
                    >
                      <span className="font-mono text-[12px] text-marca">
                        {`{{${v.clave}}}`}
                      </span>
                      <span className="block text-xs text-texto-suave">
                        {v.titulo} · <em>{v.ejemplo}</em>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            </div>
          </div>
        </Tarjeta>
      )}

      {plantillas.length === 0 && editando === null && (
        <Tarjeta titulo="Todavía no hay ninguna">
          <p className="text-sm text-texto-suave">
            Cree la primera con «Nueva plantilla». Después, en la ficha de un lead,
            aparece para escogerla.
          </p>
        </Tarjeta>
      )}

      {plantillas.map((p) => (
        <Tarjeta
          key={p.id}
          titulo={p.nombre}
          descripcion={
            p.convenio
              ? `Solo para ${p.convenio.sigla ?? p.convenio.nombre}`
              : "Sirve para todos los gremios"
          }
        >
          <div className="space-y-3">
            {!p.activa && (
              <span className="inline-block rounded-full bg-superficie-alterna px-2.5 py-1 text-xs text-texto-suave">
                Apagada · no aparece al escribir un correo
              </span>
            )}
            {p.etapasPermitidas?.length > 0 && (
              <p className="text-xs text-texto-suave">
                Solo para quien esté:{" "}
                <strong>
                  {p.etapasPermitidas
                    .map(
                      (e) =>
                        ETAPAS.find(([v]) => v === e)?.[1].toLocaleLowerCase(
                          "es-CO",
                        ) ?? e,
                    )
                    .join(", ")}
                </strong>
              </p>
            )}
            <p className="text-sm">
              <span className="text-texto-suave">Asunto: </span>
              <span className="font-mono text-[13px]">{p.asunto}</span>
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-borde bg-superficie-alterna p-3 font-mono text-[12px] leading-relaxed">
              {p.cuerpo}
            </pre>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => abrir(p)}
                className="text-marca underline"
              >
                Editar
              </button>
              {p.activa && (
                <button
                  type="button"
                  onClick={() =>
                    void plantillasCorreoApi
                      .apagar(p.id)
                      .then(cargar)
                      .then(() => toast.exito("Se apagó la plantilla."))
                      .catch((e) => toast.error((e as ErrorApi).message))
                  }
                  className="text-error underline"
                >
                  Apagar
                </button>
              )}
              {!p.activa && (
                <button
                  type="button"
                  onClick={() =>
                    void plantillasCorreoApi
                      .editar(p.id, { activa: true })
                      .then(cargar)
                      .then(() => toast.exito("Se encendió la plantilla."))
                      .catch((e) => toast.error((e as ErrorApi).message))
                  }
                  className="text-marca underline"
                >
                  Encender
                </button>
              )}
              {p.creadoPor && (
                <span className="text-xs text-texto-suave">
                  La escribió {p.creadoPor.nombre}
                </span>
              )}
            </div>
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}
