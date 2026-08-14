"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso, Boton, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  diasDesde,
  ETAPAS_AVANCE,
  ETAPAS_SALIDA,
  ETIQUETA_ETAPA,
  type Etapa,
  type FilaParticipante,
  type Resumen,
} from "@/lib/crm-api";

type Vista = "tablero" | "lista";

export default function PaginaParticipantes() {
  const [vista, setVista] = useState<Vista>("tablero");
  const [buscar, setBuscar] = useState("");
  const [filas, setFilas] = useState<FilaParticipante[] | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    // el tablero necesita todas las etapas a la vez
    const [listado, res] = await Promise.all([
      crmApi.listar({ buscar: buscar || undefined, pagina: 1 }),
      crmApi.resumen({ buscar: buscar || undefined }),
    ]);
    setFilas(listado.participantes);
    setTotal(listado.total);
    setResumen(res);
  }, [buscar]);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  async function mover(id: string, etapa: Etapa) {
    setError(null);
    const fila = filas?.find((f) => f.id === id);
    if (!fila || fila.etapa === etapa) return;

    let motivo: string | undefined;
    if (ETAPAS_SALIDA.includes(etapa)) {
      const escrito = window.prompt(
        `¿Por qué pasa a «${ETIQUETA_ETAPA[etapa]}»? Es obligatorio.`,
      );
      if (!escrito?.trim()) return;
      motivo = escrito.trim();
    }

    try {
      await crmApi.cambiarEtapa(id, etapa, motivo);
      await cargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }

  if (!filas || !resumen) {
    return <p className="text-texto-suave">Cargando…</p>;
  }

  const cuenta = new Map(resumen.etapas.map((e) => [e.etapa, e.total]));
  const hayAlguien = resumen.total > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inscripciones</h1>
          <p className="mt-1 text-texto-suave">
            Las personas detrás de los cupos. {resumen.total} en total.
          </p>
        </div>
        <Link href="/admin/participantes/nuevo">
          <Boton>Inscribir a alguien</Boton>
        </Link>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${CLASE_CONTROL} max-w-md`}
          placeholder="Buscar por nombre, documento o correo"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <div className="flex rounded-lg border border-borde">
          {(["tablero", "lista"] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-4 py-2 text-sm capitalize ${
                vista === v ? "bg-marca text-marca-texto" : ""
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {!hayAlguien && (
        <Tarjeta
          titulo="Todavía no hay nadie inscrito"
          descripcion="Aquí van a aparecer las personas conforme se capturen."
        >
          <p className="text-sm text-texto-suave">
            El sistema hoy sabe cuántos cupos reservó cada empresa, pero no quiénes son.
            Ese es exactamente el hueco que cierra esta pantalla.
          </p>
        </Tarjeta>
      )}

      {hayAlguien && vista === "tablero" && (
        <div className="caja-scroll overflow-x-auto pb-2">
          <div className="flex gap-4" style={{ minWidth: "max-content" }}>
            {[...ETAPAS_AVANCE, ...ETAPAS_SALIDA].map((etapa) => {
              const suyas = filas.filter((f) => f.etapa === etapa);
              const esSalida = ETAPAS_SALIDA.includes(etapa);

              return (
                <section
                  key={etapa}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => arrastrando && mover(arrastrando, etapa)}
                  className={`w-72 shrink-0 rounded-xl border p-3 ${
                    esSalida
                      ? "border-borde bg-superficie-alterna"
                      : "border-borde bg-superficie"
                  }`}
                >
                  <header className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-medium">{ETIQUETA_ETAPA[etapa]}</h2>
                    <span className="rounded-full bg-superficie-alterna px-2 py-0.5 text-xs">
                      {cuenta.get(etapa) ?? 0}
                    </span>
                  </header>

                  <div className="space-y-2">
                    {suyas.map((f) => (
                      <article
                        key={f.id}
                        draggable
                        onDragStart={() => setArrastrando(f.id)}
                        onDragEnd={() => setArrastrando(null)}
                        className="cursor-grab rounded-lg border border-borde bg-superficie p-3 active:cursor-grabbing"
                      >
                        <Link href={`/admin/participantes/${f.id}`} className="block">
                          <p className="font-medium">{f.nombre}</p>
                          <p className="mt-0.5 font-mono text-xs text-texto-suave">
                            {f.documento}
                          </p>
                          {f.accion && (
                            <p className="mt-1 text-xs text-texto-suave">{f.accion}</p>
                          )}
                          <footer className="mt-2 flex items-center gap-2 text-xs text-texto-suave">
                            <span title="días en el sistema">
                              {diasDesde(f.creadoEn)} d
                            </span>
                            {f.notas > 0 && <span>· {f.notas} notas</span>}
                            {!f.asesor && <span>· sin asesor</span>}
                          </footer>
                        </Link>
                      </article>
                    ))}

                    {suyas.length === 0 && (
                      <p className="py-6 text-center text-xs text-texto-suave">
                        Sin personas
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {hayAlguien && vista === "lista" && (
        <div className="caja-scroll overflow-x-auto">
          <table className="tabla-datos">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Etapa</th>
                <th>Acción de formación</th>
                <th>Ubicación</th>
                <th>Asesor</th>
                <th>Días</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/admin/participantes/${f.id}`} className="underline">
                      {f.nombre}
                    </Link>
                  </td>
                  <td className="font-mono text-sm">{f.documento}</td>
                  <td>{ETIQUETA_ETAPA[f.etapa]}</td>
                  <td>{f.accion ?? "—"}</td>
                  <td>{f.ubicacion ?? "—"}</td>
                  <td>{f.asesor?.nombre ?? "Sin asignar"}</td>
                  <td>{diasDesde(f.creadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > filas.length && (
            <p className="mt-3 text-sm text-texto-suave">
              Mostrando {filas.length} de {total}. Afine la búsqueda para ver el resto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
