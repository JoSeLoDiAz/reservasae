"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  historicoDeCargas,
  type CargaDelHistorico,
  type OpcionOferta,
} from "@/lib/crm-api";
import { Desplegable } from "@/components/admin/desplegable";

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
  NUEVA: "Se importará",
  PERSONA_CONOCIDA: "Ya registrada en el sistema",
  REPETIDA: "Duplicada en el archivo",
  DESCARTADA: "No se importará",
};

export default function PaginaCarga() {
  const router = useRouter();
  const [convenios, setConvenios] = useState<
    Array<{ id: string; nombre: string; sigla: string | null }>
  >([]);
  const [ofertas, setOfertas] = useState<OpcionOferta[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [accionId, setAccionId] = useState("");
  const [ofertaId, setOfertaId] = useState("");
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [deArchivo, setDeArchivo] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [historico, setHistorico] = useState<CargaDelHistorico[] | null>(null);
  const [falloHistorico, setFalloHistorico] = useState<string | null>(null);
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

  /// El desplegable ensenaba `ofertas` en crudo, y una oferta es
  /// accion x sede: AF1 salia seis veces, una por departamento.
  /// Se elige el CURSO, y la sede solo cuando hay mas de una.
  const acciones = useMemo(() => {
    const m = new Map<string, { id: string; etiqueta: string; sedes: OpcionOferta[] }>();
    for (const o of ofertas) {
      const y = m.get(o.accionFormacionId);
      if (y) y.sedes.push(o);
      else m.set(o.accionFormacionId, { id: o.accionFormacionId, etiqueta: o.etiqueta, sedes: [o] });
    }
    return [...m.values()];
  }, [ofertas]);

  const sedes = acciones.find((a) => a.id === accionId)?.sedes ?? [];

  /// Con una sola sede no hay nada que elegir: se fija sola. Un
  /// desplegable de una sola opcion es un paso que no decide nada.
  useEffect(() => {
    if (sedes.length === 1) setOfertaId(sedes[0].id);
    else if (!sedes.some((o) => o.id === ofertaId)) setOfertaId("");
  }, [accionId, sedes, ofertaId]);

  const verHistorico = useCallback(() => {
    void historicoDeCargas(convenioId || undefined)
      .then((h) => {
        setHistorico(h);
        setFalloHistorico(null);
      })
      .catch((e) => {
        setHistorico([]);
        setFalloHistorico((e as ErrorApi).message);
      });
  }, [convenioId]);

  useEffect(verHistorico, [verHistorico]);

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
      setNombreArchivo(f.name);
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
    <div className="pb-10">
      <header className="border-b border-borde bg-superficie px-7 pt-[18px] pb-[22px]">
        <Link
          href="/admin/participantes"
          className="inline-flex items-center gap-1 text-[0.75rem] text-texto-suave transition hover:text-marca"
        >
          <span aria-hidden="true">&larr;</span> Gestión de leads
        </Link>
        <h1 className="mt-2 text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
          Importar participantes
        </h1>
        <p className="mt-1 text-texto-suave">
          Cargue el archivo remitido por la organización, o pegue los datos desde una hoja
          de cálculo. El sistema valida cada registro y presenta el resultado antes de
          crear nada.
        </p>
      </header>

      {error && (
        <div className="px-7 pt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <Tarjeta
        titulo="Paso 1 · Destino de los registros"
        descripcion="Determina a qué convenio quedan asociados los participantes. La acción de formación puede asignarse ahora o más adelante, desde cada lead."
      >
        <div
          className={
            "grid gap-x-7 gap-y-4 " +
            (sedes.length > 1
              ? "lg:grid-cols-[280px_minmax(0,1fr)_270px]"
              : "lg:grid-cols-[280px_minmax(0,1fr)]")
          }
        >
          <Campo etiqueta="Convenio">
            <Desplegable
              marcador="Seleccione un convenio"
              valor={convenioId}
              opciones={convenios.map((c) => ({
                valor: c.id,
                etiqueta: c.sigla ?? c.nombre,
                detalle: c.sigla ? c.nombre : undefined,
              }))}
              alElegir={(v) => {
                setConvenioId(v);
                setAccionId("");
                setOfertaId("");
                setPrevia(null);
              }}
            />
          </Campo>

          <Campo etiqueta="Acción de formación">
            <Desplegable
              marcador="Sin asignar por el momento"
              valor={accionId}
              desactivado={!convenioId}
              opciones={[
                { valor: "", etiqueta: "Sin asignar por el momento" },
                ...acciones.map((a) => ({
                  valor: a.id,
                  etiqueta: a.etiqueta,
                  detalle:
                    a.sedes.length === 1
                      ? `Grupo único · ${a.sedes[0].ubicacion} · ${a.sedes[0].disponibles} cupos`
                      : `${a.sedes.length} grupos`,
                })),
              ]}
              alElegir={(v) => {
                setAccionId(v);
                setPrevia(null);
              }}
            />
          </Campo>

          {sedes.length > 1 && (
            <Campo etiqueta="Grupo">
              <Desplegable
                marcador="Seleccione el grupo"
                valor={ofertaId}
                opciones={sedes.map((o) => ({
                  valor: o.id,
                  etiqueta: o.ubicacion,
                  detalle: `${o.disponibles} cupos disponibles`,
                }))}
                alElegir={(v) => {
                  setOfertaId(v);
                  setPrevia(null);
                }}
              />
            </Campo>
          )}
        </div>

        {accionId && sedes.length === 1 && (
          <p className="mt-3 text-[0.78125rem] text-texto-suave">
            Esta acción tiene un solo grupo, en {sedes[0].ubicacion}, con{" "}
            {sedes[0].disponibles} cupos disponibles.
          </p>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Paso 2 · Origen de los datos"
        descripcion="Se admiten archivos .xlsx y .csv. Deben contener las ocho columnas indicadas, en ese orden; si la primera fila corresponde a los encabezados, se omite automáticamente."
      >
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-borde bg-superficie-alterna px-4 py-3">
            <p className="text-[0.78125rem] whitespace-nowrap text-texto-suave">
              <span className="font-semibold text-titulo">Columnas requeridas:</span>{" "}
              tipo de documento · número de documento · primer nombre · segundo nombre ·
              primer apellido · segundo apellido · correo electrónico · teléfono celular
            </p>
          </div>

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
              "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-dashed px-5 py-4 transition " +
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
              className="sin-aro inline-flex h-[32px] items-center rounded-[9px] bg-marca px-[13px] text-[0.78125rem] font-semibold whitespace-nowrap text-marca-texto transition hover:bg-marca-fuerte disabled:cursor-not-allowed disabled:bg-campo-borde disabled:text-texto-suave"
            >
              {ocupado ? "Leyendo el archivo…" : "Seleccionar archivo"}
            </button>

            <a
              href="/api/admin/participantes/carga/plantilla"
              className="sin-aro inline-flex h-[32px] items-center rounded-[9px] border border-campo-borde bg-superficie px-[13px] text-[0.78125rem] font-semibold whitespace-nowrap text-titulo no-underline transition hover:border-marca"
            >
              Descargar plantilla
            </a>

            <span className="text-[0.78125rem] text-texto-suave">
              {deArchivo
                ? `Archivo procesado: ${deArchivo}. Verifique el contenido antes de continuar.`
                : "También puede arrastrar el archivo hasta aquí."}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-[0.78125rem] font-semibold text-titulo">
              Datos por procesar
            </p>
            <textarea
              className={`${CLASE_CONTROL} min-h-56 font-mono text-[0.78125rem] leading-relaxed`}
              placeholder="Pegue aquí las celdas copiadas de la hoja de cálculo, o cargue el archivo con el botón de arriba."
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setDeArchivo(null);
                setNombreArchivo(null);
                setPrevia(null);
              }}
            />
          </div>

          <div className="pt-1">
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
              {ocupado ? "Validando…" : "Validar registros"}
            </Boton>
          </div>
        </div>
      </Tarjeta>

      {previa && (
        <Tarjeta
          titulo={`Paso 3 · Validación de ${previa.total} ${previa.total === 1 ? "registro" : "registros"}`}
          descripcion={`${previa.creables} se importarán. ${previa.conocidas} corresponden a personas ya registradas, ${previa.repetidas} están duplicadas en el archivo y ${previa.descartadas} no cumplen los requisitos mínimos.`}
        >
          <div className="space-y-5">
            <div className="caja-scroll max-h-96 overflow-auto rounded-lg border border-borde">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.filas.map((f) => (
                    <tr key={f.linea}>
                      <td className="tabular-nums">{f.linea}</td>
                      <td className="font-mono">
                        {f.sigla} {f.numeroDocumento || "—"}
                      </td>
                      <td>
                        {f.primerNombre} {f.primerApellido}
                      </td>
                      <td>{f.correo ?? f.celular ?? "—"}</td>
                      <td>
                        <p
                          className={
                            f.estado === "DESCARTADA" || f.estado === "REPETIDA"
                              ? "font-semibold text-error"
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
                        origenDeCarga: nombreArchivo ? "ARCHIVO" : "PEGADO",
                        nombreArchivo: nombreArchivo ?? undefined,
                      }),
                    });
                    const res = (await r.json()) as {
                      creados: number;
                      fallos: Array<{ linea: number; motivo: string }>;
                    };
                    verHistorico();
                    if (res.fallos?.length) {
                      setError(
                        `Se importaron ${res.creados} registros. ${res.fallos.length} no se pudieron crear: ` +
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
                {ocupado
                  ? "Importando…"
                  : `Importar ${previa.creables} ${previa.creables === 1 ? "participante" : "participantes"}`}
              </Boton>
            ) : (
              <Aviso tipo="error">
                Ningún registro del archivo cumple los requisitos mínimos. Corrija los
                datos y vuelva a cargarlos.
              </Aviso>
            )}
          </div>
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Historial de importaciones"
        descripcion="Cada carga confirmada queda registrada con su responsable, su origen y su resultado. Se conservan las cien más recientes del ámbito."
      >
        {historico === null ? (
          <p className="text-[0.78125rem] text-texto-suave">Consultando…</p>
        ) : falloHistorico ? (
          <Aviso tipo="error">
            No se pudo consultar el historial: {falloHistorico}. Mientras esto falle,
            confirmar una importación también fallará, porque el registro se escribe
            antes de crear a nadie.
          </Aviso>
        ) : historico.length === 0 ? (
          <p className="text-[0.78125rem] text-texto-suave">
            Todavía no se ha registrado ninguna importación en este ámbito. La primera
            que confirme aparecerá aquí.
          </p>
        ) : (
          <div className="caja-scroll max-h-80 overflow-auto rounded-lg border border-borde">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Responsable</th>
                  <th>Origen</th>
                  <th>Convenio</th>
                  <th>Acción de formación</th>
                  <th>Registros</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap tabular-nums">
                      {new Date(c.creadoEn).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td>{c.autor}</td>
                    <td>
                      {c.origen === "ARCHIVO" ? (
                        <>
                          Archivo
                          {c.nombreArchivo && (
                            <span className="block text-xs text-texto-suave">
                              {c.nombreArchivo}
                            </span>
                          )}
                        </>
                      ) : (
                        "Pegado"
                      )}
                    </td>
                    <td>{c.convenio}</td>
                    <td>{c.destino ?? "Sin asignar"}</td>
                    <td className="tabular-nums">{c.filas}</td>
                    <td>
                      <span className="font-semibold text-exito tabular-nums">
                        {c.creados} importados
                      </span>
                      {/* Lo que NO entro se dice y no se calla: un
                          historico que solo cuenta los aciertos no
                          sirve para reconstruir que paso. */}
                      {(c.yaExistian > 0 ||
                        c.duplicados > 0 ||
                        c.descartados > 0 ||
                        c.fallidos > 0) && (
                        <span className="block text-xs text-texto-suave tabular-nums">
                          {[
                            c.yaExistian > 0 && `${c.yaExistian} ya existían`,
                            c.duplicados > 0 && `${c.duplicados} duplicados`,
                            c.descartados > 0 && `${c.descartados} descartados`,
                            c.fallidos > 0 && `${c.fallidos} con error`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
