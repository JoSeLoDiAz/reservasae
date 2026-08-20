"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { estiloEtapa } from "@/components/admin/etapa";
import {
  IconoAvance,
  IconoBrecha,
  IconoInscribir,
  IconoUsuarios,
} from "@/components/admin/iconos";
import { Aviso, Boton, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { TarjetaCifra } from "@/components/admin/piezas";
import { ScrollDoble } from "@/components/admin/scroll-doble";
import { columnasDeParticipante } from "@/components/admin/columnas-participante";
import { Tabla } from "@/components/admin/tabla";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  diasDesde,
  ETAPAS_AVANCE,
  ETAPAS_DE_INSCRIPCION,
  ETAPAS_SALIDA,
  ETIQUETA_ETAPA,
  type Etapa,
  type FilaParticipante,
  type Filtros,
  type Resumen,
} from "@/lib/crm-api";

type Vista = "tablero" | "lista" | "metricas";

const VISTAS: Array<{ clave: Vista; etiqueta: string }> = [
  { clave: "tablero", etiqueta: "Tablero" },
  { clave: "lista", etiqueta: "Lista" },
  { clave: "metricas", etiqueta: "Métricas" },
];

// el tablero reparte una carga entre nueve columnas
const POR_CARGA = 300;

export default function PaginaParticipantes() {
  const [vista, setVista] = useState<Vista>("tablero");
  const [buscar, setBuscar] = useState("");
  const [asesorId, setAsesorId] = useState("");
  const [accionFormacionId, setAccionFormacionId] = useState("");
  const [filas, setFilas] = useState<FilaParticipante[] | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const filtros: Filtros = {
      buscar: buscar || undefined,
      asesorId: asesorId || undefined,
      accionFormacionId: accionFormacionId || undefined,
    };
    const [listado, res] = await Promise.all([
      crmApi.listar({ ...filtros, pagina: 1, limite: POR_CARGA }),
      crmApi.resumen(filtros),
    ]);
    setFilas(listado.participantes);
    setTotal(listado.total);
    setResumen(res);
  }, [buscar, asesorId, accionFormacionId]);

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
  const hayFiltro = Boolean(buscar || asesorId || accionFormacionId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inscripciones</h1>
          <p className="mt-1 text-texto-suave">
            Las personas detrás de los cupos. {resumen.total} en total.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/participantes/brecha" className="underline">
            Brecha de nombres
          </Link>
          <Link href="/admin/participantes/academico" className="underline">
            Seguimiento académico
          </Link>
          <Link href="/admin/participantes/carga" className="underline">
            Cargar una lista
          </Link>
          <Link href="/admin/participantes/nuevo">
            <Boton>Inscribir a alguien</Boton>
          </Link>
        </div>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Cifras resumen={resumen} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${CLASE_CONTROL} max-w-xs`}
          placeholder="Buscar por nombre, documento o correo"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />

        <select
          className={`${CLASE_CONTROL} max-w-[13rem]`}
          value={asesorId}
          onChange={(e) => setAsesorId(e.target.value)}
          aria-label="Filtrar por asesor"
        >
          <option value="">Todos los asesores</option>
          {resumen.asesores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre} ({a.total})
            </option>
          ))}
        </select>

        <select
          className={`${CLASE_CONTROL} max-w-[15rem]`}
          value={accionFormacionId}
          onChange={(e) => setAccionFormacionId(e.target.value)}
          aria-label="Filtrar por acción de formación"
        >
          <option value="">Toda la formación</option>
          {resumen.acciones.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigo} · {a.nombre} ({a.total})
            </option>
          ))}
        </select>

        {hayFiltro && (
          <button
            className="text-sm text-marca underline"
            onClick={() => {
              setBuscar("");
              setAsesorId("");
              setAccionFormacionId("");
            }}
          >
            Quitar filtros
          </button>
        )}

        <div className="ml-auto flex rounded-lg border border-borde">
          {VISTAS.map((v) => (
            <button
              key={v.clave}
              onClick={() => setVista(v.clave)}
              className={`px-4 py-2 text-sm ${
                vista === v.clave ? "bg-marca text-marca-texto" : ""
              }`}
            >
              {v.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {!hayAlguien && (
        <Tarjeta
          titulo={hayFiltro ? "Nadie coincide con ese filtro" : "Todavía no hay nadie inscrito"}
          descripcion={
            hayFiltro
              ? "Pruebe a quitar alguno."
              : "Aquí van a aparecer las personas conforme se capturen."
          }
        >
          <p className="text-sm text-texto-suave">
            El sistema hoy sabe cuántos cupos reservó cada empresa, pero no quiénes son.
            Ese es exactamente el hueco que cierra esta pantalla.
          </p>
        </Tarjeta>
      )}

      {hayAlguien && vista === "tablero" && (
        <ScrollDoble>
          <div className="flex gap-4">
            {[...ETAPAS_DE_INSCRIPCION, ...ETAPAS_SALIDA].map((etapa) => {
              const suyas = filas.filter((f) => f.etapa === etapa);
              const enLaEtapa = cuenta.get(etapa) ?? 0;
              const ocultas = enLaEtapa - suyas.length;

              return (
                <section
                  key={etapa}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => arrastrando && mover(arrastrando, etapa)}
                  style={estiloEtapa(etapa)}
                  className="w-72 shrink-0"
                >
                  <header
                    className="mb-3 flex items-center justify-between border-b-2 pb-2"
                    style={{ borderColor: "var(--etapa)" }}
                  >
                    <h2
                      className="text-xs font-semibold tracking-wide uppercase"
                      style={{ color: "var(--etapa)" }}
                    >
                      {ETIQUETA_ETAPA[etapa]}
                    </h2>
                    <span
                      className="flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 font-mono text-xs"
                      style={{ color: "var(--etapa)", borderColor: "var(--etapa)" }}
                    >
                      {enLaEtapa}
                    </span>
                  </header>

                  <div className="space-y-2">
                    {suyas.map((f) => (
                      <article
                        key={f.id}
                        draggable
                        onDragStart={() => setArrastrando(f.id)}
                        onDragEnd={() => setArrastrando(null)}
                        className="cursor-grab rounded-lg border border-borde border-l-[3px] bg-superficie p-3 active:cursor-grabbing"
                        style={{ borderLeftColor: "var(--etapa)" }}
                      >
                        <Link href={`/admin/participantes/${f.id}`} className="block">
                          <p className="font-mono text-[10.5px] text-texto-suave">
                            {f.documento}
                          </p>
                          <p className="mt-0.5 font-medium">{f.nombre}</p>
                          {f.accion && (
                            <p className="mt-1 text-xs text-texto-suave">{f.accion}</p>
                          )}
                          {f.ubicacion && (
                            <p className="text-xs text-texto-suave">{f.ubicacion}</p>
                          )}
                          <footer className="mt-2 flex items-center justify-between gap-2 text-xs text-texto-suave">
                            <span>{f.asesor?.nombre ?? "Sin asignar"}</span>
                            <span className="font-mono" title="días en el sistema">
                              {diasDesde(f.creadoEn)} d
                            </span>
                          </footer>
                        </Link>
                      </article>
                    ))}

                    {suyas.length === 0 && (
                      <p className="rounded-lg border border-dashed border-borde py-5 text-center text-xs text-texto-suave">
                        Sin personas
                      </p>
                    )}

                    {ocultas > 0 && (
                      <p className="pt-1 text-center text-xs text-texto-suave">
                        y {ocultas} más — afine la búsqueda
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </ScrollDoble>
      )}

      {hayAlguien && vista === "lista" && (
        <ListaParticipantes
          filas={filas}
          total={total}
          asesores={resumen.asesores}
          alCambiar={cargar}
        />
      )}

      {hayAlguien && vista === "metricas" && <Metricas resumen={resumen} />}
    </div>
  );
}

// las cifras de arriba

function Cifras({ resumen }: { resumen: Resumen }) {
  const de = (etapa: Etapa) => resumen.etapas.find((e) => e.etapa === etapa)?.total ?? 0;

  const enProceso = ETAPAS_AVANCE.filter((e) => e !== "CERTIFICADO").reduce(
    (s, e) => s + de(e),
    0,
  );
  const salidas = ETAPAS_SALIDA.reduce((s, e) => s + de(e), 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <TarjetaCifra etiqueta="Personas" valor={resumen.total} icono={IconoUsuarios} />
      <TarjetaCifra
        etiqueta="En proceso"
        valor={enProceso}
        pie="aún no certificadas"
        icono={IconoAvance}
        tono="aviso"
      />
      <TarjetaCifra
        etiqueta="Inscritas"
        valor={de("MATRICULADO")}
        icono={IconoInscribir}
      />
      <TarjetaCifra
        etiqueta="Sin asesor"
        valor={resumen.sinAsesor ?? 0}
        pie="nadie las está llamando"
        icono={IconoBrecha}
        tono={(resumen.sinAsesor ?? 0) > 0 ? "aviso" : "neutro"}
      />
      <TarjetaCifra
        etiqueta="No interesados"
        valor={salidas}
        pie="perdieron interés, se retiraron o no aprobaron"
        icono={IconoBrecha}
        tono={salidas > 0 ? "error" : "neutro"}
      />
    </div>
  );
}

// metricas

function Metricas({ resumen }: { resumen: Resumen }) {
  const mayor = Math.max(1, ...resumen.etapas.map((e) => e.total));
  const conAsesor = resumen.asesores.reduce((s, a) => s + a.total, 0);
  const mayorAsesor = Math.max(1, ...resumen.asesores.map((a) => a.total), resumen.sinAsesor);
  const mayorAccion = Math.max(1, ...resumen.acciones.map((a) => a.total));

  return (
    <div className="space-y-4">
      <Tarjeta
        titulo="Personas por etapa"
        descripcion="Dónde está cada quien ahora mismo. No es un embudo: quien llega a certificado deja de contar en matriculado."
      >
        <div className="space-y-2">
          {resumen.etapas.map((e) => (
            <div
              key={e.etapa}
              style={estiloEtapa(e.etapa)}
              className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3 text-sm"
            >
              <span>{ETIQUETA_ETAPA[e.etapa]}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-superficie-alterna">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.round((e.total / mayor) * 100)}%`,
                    background: "var(--etapa)",
                  }}
                />
              </span>
              <span className="text-right font-mono text-texto-suave">{e.total}</span>
            </div>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Cartera por asesor"
        descripcion={`${conAsesor} con asesor asignado; ${resumen.sinAsesor} sin asignar.`}
      >
        <div className="space-y-2">
          {[
            ...resumen.asesores,
            ...(resumen.sinAsesor > 0
              ? [{ id: "_", nombre: "Sin asignar", total: resumen.sinAsesor }]
              : []),
          ].map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3 text-sm"
            >
              <span>{a.nombre}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-superficie-alterna">
                <span
                  className="block h-full rounded-full bg-marca"
                  style={{ width: `${Math.round((a.total / mayorAsesor) * 100)}%` }}
                />
              </span>
              <span className="text-right font-mono text-texto-suave">{a.total}</span>
            </div>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Personas por acción de formación" descripcion="Dónde se concentra la captura.">
        <div className="space-y-2">
          {resumen.acciones.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3 text-sm"
            >
              <span className="truncate" title={`${a.codigo} · ${a.nombre}`}>
                {a.codigo} · {a.nombre}
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-superficie-alterna">
                <span
                  className="block h-full rounded-full bg-marca"
                  style={{ width: `${Math.round((a.total / mayorAccion) * 100)}%` }}
                />
              </span>
              <span className="text-right font-mono text-texto-suave">{a.total}</span>
            </div>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

/** La lista, con columnas a elegir y asignación por lote. */
function ListaParticipantes({
  filas,
  total,
  asesores,
  alCambiar,
}: {
  filas: FilaParticipante[];
  total: number;
  asesores: Array<{ id: string; nombre: string }>;
  alCambiar: () => Promise<void>;
}) {
  const [aviso, setAviso] = useState<string | null>(null);

  const columnas = useMemo(() => columnasDeParticipante(), []);

  return (
    <div className="space-y-3">
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

      <Tabla
        id="participantes"
        columnas={columnas}
        filas={filas}
        clave={(f) => f.id}
        total={total}
        seleccion
        accionesLote={(ids, limpiar) => (
          <AsignarLote
            ids={ids}
            asesores={asesores}
            alTerminar={async (n) => {
              limpiar();
              setAviso(`${n} ${n === 1 ? "ficha" : "fichas"} con asesor nuevo.`);
              await alCambiar();
            }}
          />
        )}
      />
    </div>
  );
}

/** El desplegable de asesor sobre la selección. */
function AsignarLote({
  ids,
  asesores,
  alTerminar,
}: {
  ids: string[];
  asesores: Array<{ id: string; nombre: string }>;
  alTerminar: (cambiadas: number) => Promise<void>;
}) {
  const [trabajando, setTrabajando] = useState(false);

  async function asignar(asesorId: string | null) {
    setTrabajando(true);
    try {
      const r = await crmApi.asignarAsesorEnLote(ids, asesorId);
      await alTerminar(r.cambiadas);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span>Asignar a</span>
      <select
        disabled={trabajando}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          e.currentTarget.value = "";
          if (v === "") return;
          void asignar(v === "NADIE" ? null : v);
        }}
        className={`${CLASE_CONTROL} max-w-[13rem] py-1.5 text-sm`}
      >
        <option value="">Elija un asesor…</option>
        {asesores.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
        <option value="NADIE">— Quitarles el asesor —</option>
      </select>
    </label>
  );
}
