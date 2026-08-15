"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { PildoraEtapa } from "@/components/admin/etapa";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  type Academico,
  crmApi,
  type EstadoAcademico,
  ETIQUETA_ACADEMICA,
  type FilaAcademica,
} from "@/lib/crm-api";

// el color sale del token de la etapa que le corresponde
const COLOR: Record<EstadoAcademico, string> = {
  AL_DIA: "var(--etapa-certificado)",
  ATRASADO: "var(--etapa-en-formacion)",
  PARADO: "var(--etapa-perdido)",
  CERTIFICADO: "var(--etapa-matriculado)",
  SALIO: "var(--etapa-retirado)",
  SIN_EMPEZAR: "var(--etapa-contactado)",
  SIN_FECHAS: "var(--etapa-nuevo)",
};

const ORDEN: EstadoAcademico[] = [
  "PARADO",
  "ATRASADO",
  "AL_DIA",
  "CERTIFICADO",
  "SIN_EMPEZAR",
  "SIN_FECHAS",
  "SALIO",
];

function fecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export default function PaginaAcademico() {
  const [filtro, setFiltro] = useState<EstadoAcademico | "">("");
  const [buscar, setBuscar] = useState("");
  const [accionFormacionId, setAccion] = useState("");
  const [grupoId, setGrupo] = useState("");
  const [asesorId, setAsesor] = useState("");

  const cargar = useCallback(
    () =>
      crmApi.academico({
        buscar: buscar || undefined,
        accionFormacionId: accionFormacionId || undefined,
        grupoId: grupoId || undefined,
        asesorId: asesorId || undefined,
      }),
    [buscar, accionFormacionId, grupoId, asesorId],
  );

  // se refresca solo; un fallo conserva lo ultimo bueno.
  // la clave hace que un filtro nuevo se pida al momento
  const vivos = useDatosVivos<Academico>(cargar, {
    clave: `${buscar}|${accionFormacionId}|${grupoId}|${asesorId}`,
  });
  const datos = vivos.datos;

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!datos) return <p className="text-texto-suave">Cargando…</p>;

  const { resumen, criterio } = datos;
  const visibles = filtro
    ? datos.personas.filter((p) => p.estado === filtro)
    : datos.personas;

  const cuenta: Record<EstadoAcademico, number> = {
    AL_DIA: resumen.alDia,
    ATRASADO: resumen.atrasados,
    PARADO: resumen.parados,
    CERTIFICADO: resumen.certificados,
    SALIO: resumen.salieron,
    SIN_EMPEZAR: resumen.sinEmpezar,
    SIN_FECHAS: resumen.sinFechas,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Seguimiento académico</h1>
          <p className="mt-1 text-texto-suave">
            Quién va al día y quién no, contra el calendario de su grupo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <IndicadorActualizacion
            actualizadoEn={vivos.actualizadoEn}
            refrescando={vivos.refrescando}
            desactualizado={vivos.desactualizado}
            alRefrescar={vivos.refrescar}
          />
          <Link href="/admin/participantes" className="underline">
            Volver a inscripciones
          </Link>
        </div>
      </header>

      <p className="text-sm text-texto-suave">
        «Atrasado» es llevar {criterio.tolerancia} actividades obligatorias o más por
        debajo de lo que tocaría a estas alturas del grupo. «Parado» es no entrar al
        aula desde hace {criterio.diasParado} días o más. Si el grupo no tiene fechas
        no se juzga: se dice que faltan.
      </p>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ORDEN.map((estado) => (
          <button
            key={estado}
            onClick={() => setFiltro(filtro === estado ? "" : estado)}
            style={{ ["--etapa"]: COLOR[estado] } as React.CSSProperties}
            className={`rounded-xl border p-4 text-left transition ${
              filtro === estado ? "border-2" : "border-borde"
            } bg-superficie`}
            aria-pressed={filtro === estado}
          >
            <span className="flex items-center gap-2 text-xs tracking-wide uppercase">
              <span className="punto-etapa" aria-hidden />
              <span className="text-texto-suave">{ETIQUETA_ACADEMICA[estado]}</span>
            </span>
            <span className="mt-2 block font-mono text-3xl font-semibold">
              {cuenta[estado]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${CLASE_CONTROL} max-w-xs`}
          placeholder="Buscar por nombre o documento"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />

        <select
          className={`${CLASE_CONTROL} max-w-[15rem]`}
          value={accionFormacionId}
          onChange={(e) => {
            setAccion(e.target.value);
            // el grupo cuelga de la accion: si cambia, sobra
            setGrupo("");
          }}
          aria-label="Filtrar por acción de formación"
        >
          <option value="">Toda la formación</option>
          {datos.acciones.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigo} · {a.nombre}
            </option>
          ))}
        </select>

        <select
          className={`${CLASE_CONTROL} max-w-[11rem]`}
          value={grupoId}
          onChange={(e) => setGrupo(e.target.value)}
          aria-label="Filtrar por grupo"
        >
          <option value="">Todos los grupos</option>
          {datos.grupos
            .filter((g) => !accionFormacionId || g.accionFormacionId === accionFormacionId)
            .map((g) => (
              <option key={g.id} value={g.id}>
                Grupo {g.numero}
              </option>
            ))}
        </select>

        <select
          className={`${CLASE_CONTROL} max-w-[13rem]`}
          value={asesorId}
          onChange={(e) => setAsesor(e.target.value)}
          aria-label="Filtrar por asesor"
        >
          <option value="">Todos los asesores</option>
          {datos.asesores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>

        {(filtro || accionFormacionId || grupoId || asesorId || buscar) && (
          <button
            className="text-sm text-marca underline"
            onClick={() => {
              setFiltro("");
              setAccion("");
              setGrupo("");
              setAsesor("");
              setBuscar("");
            }}
          >
            Quitar filtros
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <Tarjeta
          titulo="Nadie aquí"
          descripcion="Solo aparece quien ya entró en formación."
        >
          <p className="text-sm text-texto-suave">
            El avance llega del aula; mientras nadie esté en formación, esta pantalla
            está vacía a propósito.
          </p>
        </Tarjeta>
      ) : (
        <div className="caja-scroll overflow-x-auto">
          <table className="tabla-datos">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Acción y grupo</th>
                <th>Etapa</th>
                <th>Asesor</th>
                <th>Avance</th>
                <th>Va</th>
                <th>Último acceso</th>
                <th>Termina</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/participantes/${p.id}`} className="underline">
                      {p.nombre}
                    </Link>
                    <span className="block font-mono text-xs text-texto-suave">
                      {p.documento}
                    </span>
                  </td>
                  <td>
                    {p.accion ?? "—"}
                    <span className="block text-xs text-texto-suave">
                      {p.grupo ? `Grupo ${p.grupo}` : "Sin grupo asignado"}
                      {p.horario ? ` · ${p.horario}` : ""}
                    </span>
                  </td>
                  <td>
                    <PildoraEtapa etapa={p.etapa} />
                  </td>
                  <td className="text-sm">
                    {p.asesor?.nombre ?? (
                      <span className="text-texto-suave">Sin asignar</span>
                    )}
                  </td>
                  <td>
                    <Barra fila={p} />
                  </td>
                  <td>
                    <span
                      className="pildora-etapa"
                      style={{ ["--etapa"]: COLOR[p.estado] } as React.CSSProperties}
                    >
                      <span className="punto-etapa" aria-hidden />
                      {ETIQUETA_ACADEMICA[p.estado]}
                    </span>
                  </td>
                  <td className="text-sm">
                    {p.diasSinEntrar === null
                      ? "Nunca entró"
                      : p.diasSinEntrar === 0
                        ? "Hoy"
                        : `Hace ${p.diasSinEntrar} d`}
                  </td>
                  <td className="text-sm">{fecha(p.fechaFin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Lo hecho, con la marca de lo que tocaría hoy. */
function Barra({ fila }: { fila: FilaAcademica }) {
  const hechoPct = fila.total > 0 ? (fila.hechas / fila.total) * 100 : 0;
  const esperadoPct =
    fila.esperadas !== null && fila.total > 0 ? (fila.esperadas / fila.total) * 100 : null;

  return (
    <div className="min-w-40">
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-superficie-alterna"
        style={{ ["--etapa"]: COLOR[fila.estado] } as React.CSSProperties}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${hechoPct}%`, background: "var(--etapa)" }}
        />
        {esperadoPct !== null && (
          <span
            // donde debería ir hoy
            className="absolute top-0 h-full w-0.5 bg-texto"
            style={{ left: `${Math.min(100, esperadoPct)}%` }}
            aria-hidden
          />
        )}
      </div>
      <span className="mt-1 block font-mono text-xs text-texto-suave">
        {fila.hechas}/{fila.total}
        {fila.esperadas !== null && ` · tocaría ${fila.esperadas}`}
      </span>
    </div>
  );
}
