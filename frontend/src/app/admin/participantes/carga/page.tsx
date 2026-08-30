"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { crmApi, type OpcionOferta } from "@/lib/crm-api";

type Estado = "NUEVA" | "PERSONA_CONOCIDA" | "REPETIDA" | "DESCARTADA";

type FilaPrevia = {
  linea: number;
  tipoDocumentoSepId: number;
  sigla: string;
  numeroDocumento: string;
  primerNombre: string;
  primerApellido: string;
  correo: string | null;
  celular: string | null;
  problemas: string[];
  estado: Estado;
};

type Previa = {
  total: number;
  creables: number;
  descartadas: number;
  repetidas: number;
  conocidas: number;
  filas: FilaPrevia[];
};

const ETIQUETA_ESTADO: Record<Estado, string> = {
  NUEVA: "Se crea",
  PERSONA_CONOCIDA: "Ya está en el sistema",
  REPETIDA: "Repetida aquí",
  DESCARTADA: "No se crea",
};

export default function PaginaCarga() {
  const router = useRouter();
  const [convenios, setConvenios] = useState<
    Array<{ id: string; nombre: string; sigla: string | null }>
  >([]);
  const [ofertas, setOfertas] = useState<OpcionOferta[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [ofertaId, setOfertaId] = useState("");
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [deArchivo, setDeArchivo] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const selector = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void adminApi
      .convenios()
      .then((l) => {
        const activos = l.filter((c) => c.activo);
        setConvenios(activos);
        if (activos.length === 1) setConvenioId(activos[0].id);
      })
      .catch((e) => setError((e as ErrorApi).message));
  }, []);

  useEffect(() => {
    if (!convenioId) return;
    void crmApi
      .opciones(convenioId)
      .then((o) => setOfertas(o.ofertas))
      .catch(() => setOfertas([]));
  }, [convenioId]);

  /// El archivo se vuelve el MISMO texto que se pegaria y cae en
  /// la misma caja. Asi hay un solo lector de filas, y se ve lo
  /// que trajo el archivo antes de confirmar nada.
  async function leerArchivo(f: File | null | undefined) {
    if (!f) return;
    await conError(async () => {
      const cuerpo = new FormData();
      cuerpo.append("archivo", f);
      const r = await fetch("/api/admin/participantes/carga/archivo", {
        method: "POST",
        body: cuerpo,
      });
      const d = (await r.json()) as { texto?: string; filas?: number; message?: string };
      if (!r.ok) throw new Error(d.message ?? "No se pudo leer el archivo.");
      setTexto(d.texto ?? "");
      setDeArchivo(`${f.name} · ${d.filas} ${d.filas === 1 ? "fila" : "filas"}`);
      setPrevia(null);
    });
  }

  async function conError(accion: () => Promise<void>) {
    setError(null);
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[18px] pb-[22px]">
        <Link
          href="/admin/participantes"
          className="inline-flex items-center gap-1 text-[0.75rem] text-texto-suave transition hover:text-marca"
        >
          <span aria-hidden="true">&larr;</span> Gestión de leads
        </Link>
        <h1 className="mt-2 text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
          Cargar una lista
        </h1>
        <p className="mt-1 text-texto-suave">
          Suba el archivo que le mandó la empresa, o copie las celdas y péguelas. Verá
          qué va a pasar antes de confirmar nada.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta
        titulo="Dónde van"
        descripcion="La acción de formación es opcional: si no la sabe todavía, se asigna después desde cada ficha."
      >
        <div className="grid sm:grid-cols-2">
          <Campo etiqueta="Convenio">
            <select
              className={CLASE_CONTROL}
              value={convenioId}
              onChange={(e) => {
                setConvenioId(e.target.value);
                setOfertaId("");
                setPrevia(null);
              }}
            >
              <option value="">Elija uno</option>
              {convenios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sigla ?? c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Acción de formación">
            <select
              className={CLASE_CONTROL}
              value={ofertaId}
              onChange={(e) => {
                setOfertaId(e.target.value);
                setPrevia(null);
              }}
              disabled={!convenioId}
            >
              <option value="">Sin asignar por ahora</option>
              {ofertas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.etiqueta} · {o.ubicacion} · {o.disponibles} libres
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="La lista"
        descripcion="Suba el archivo o pegue las celdas. Van ocho columnas, en este orden, y si la primera fila son títulos se salta sola."
      >
        <div className="space-y-3">
          <p className="rounded-md bg-superficie-alterna p-3 font-mono text-xs">
            tipo · documento · primer nombre · segundo nombre · primer apellido ·
            segundo apellido · correo · celular
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setEncima(true);
            }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => {
              e.preventDefault();
              setEncima(false);
              void leerArchivo(e.dataTransfer.files?.[0]);
            }}
            className={
              "flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition " +
              (encima ? "border-marca bg-marca-suave" : "border-campo-borde bg-campo-fondo")
            }
          >
            <input
              ref={selector}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                void leerArchivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={ocupado}
              onClick={() => selector.current?.click()}
              className="inline-flex h-[32px] items-center rounded-[9px] border border-campo-borde bg-superficie px-[13px] text-[0.78125rem] font-semibold text-titulo transition hover:border-marca disabled:opacity-50"
            >
              {ocupado ? "Leyendo…" : "Elegir un archivo"}
            </button>
            <span className="text-xs text-texto-suave">
              {deArchivo
                ? `Se leyó ${deArchivo}. Revíselo abajo antes de continuar.`
                : "Arrastre aquí el .xlsx o el .csv que le mandó la empresa, o péguelo abajo."}
            </span>
          </div>

          <textarea
            className={`${CLASE_CONTROL} min-h-56 font-mono text-sm`}
            placeholder={
              "CC\t1019456782\tLaura\tCamila\tGómez\tRojas\tlaura@empresa.com\t3001234567"
            }
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setDeArchivo(null);
              setPrevia(null);
            }}
          />

          <Boton
            disabled={!convenioId || !texto.trim() || ocupado}
            onClick={() =>
              conError(async () => {
                setPrevia(
                  (await (
                    await fetch("/api/admin/participantes/carga/previsualizar", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        convenioId,
                        ofertaId: ofertaId || undefined,
                        texto,
                      }),
                    })
                  ).json()) as Previa,
                );
              })
            }
          >
            {ocupado ? "Revisando…" : "Ver qué va a pasar"}
          </Boton>
        </div>
      </Tarjeta>

      {previa && (
        <Tarjeta
          titulo={`${previa.total} filas leídas`}
          descripcion={`Se crearían ${previa.creables}. ${previa.conocidas} ya existen como persona, ${previa.repetidas} vienen repetidas y ${previa.descartadas} no se pueden crear.`}
        >
          <div className="space-y-4">
            <div className="caja-scroll max-h-96 overflow-auto">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Qué pasa</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.filas.map((f) => (
                    <tr key={f.linea}>
                      <td>{f.linea}</td>
                      <td className="font-mono text-sm">
                        {f.sigla} {f.numeroDocumento || "—"}
                      </td>
                      <td>
                        {f.primerNombre} {f.primerApellido}
                      </td>
                      <td className="text-sm">{f.correo ?? f.celular ?? "—"}</td>
                      <td>
                        <p
                          className={
                            f.estado === "DESCARTADA" || f.estado === "REPETIDA"
                              ? "font-medium text-error"
                              : ""
                          }
                        >
                          {ETIQUETA_ESTADO[f.estado]}
                        </p>
                        {f.problemas.map((p) => (
                          <p key={p} className="text-xs text-texto-suave">
                            {p}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previa.creables > 0 ? (
              <Boton
                disabled={ocupado}
                onClick={() =>
                  conError(async () => {
                    const r = await fetch("/api/admin/participantes/carga/confirmar", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        convenioId,
                        ofertaId: ofertaId || undefined,
                        texto,
                      }),
                    });
                    const res = (await r.json()) as {
                      creados: number;
                      fallos: Array<{ linea: number; motivo: string }>;
                    };
                    if (res.fallos?.length) {
                      setError(
                        `Se crearon ${res.creados}. Fallaron ${res.fallos.length}: ` +
                          res.fallos
                            .slice(0, 3)
                            .map((x) => `línea ${x.linea} (${x.motivo})`)
                            .join("; "),
                      );
                      return;
                    }
                    router.push("/admin/participantes");
                  })
                }
              >
                {ocupado ? "Creando…" : `Crear ${previa.creables} participantes`}
              </Boton>
            ) : (
              <Aviso tipo="error">
                Ninguna fila se puede crear. Corrija la lista y vuelva a pegarla.
              </Aviso>
            )}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
