"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { colorEtapa, estiloEtapa } from "@/components/admin/etapa";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { SelectorBuscable } from "@/components/admin/selector-buscable";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  type Academico,
  crmApi,
  type EstadoAcademico,
  AYUDA_ACADEMICA,
  ETIQUETA_ACADEMICA,
  AYUDA_ETAPA,
  type Etapa,
  ETIQUETA_ETAPA,
  type FilaAcademica,
} from "@/lib/crm-api";

// el color sale del token de la etapa que le corresponde
const COLOR: Record<EstadoAcademico, string> = {
  SIN_INGRESO: colorEtapa("PERDIDO"),
  SIN_EMPEZAR: colorEtapa("CONTACTADO"),
  ATRASADO: colorEtapa("EN_FORMACION"),
  AL_DIA: colorEtapa("CERTIFICADO"),
  COMPLETADO: colorEtapa("INSCRITO"),
  CERTIFICADO: colorEtapa("CERTIFICADO"),
};

/// De lo más urgente a lo que no pide nada.
const ORDEN: EstadoAcademico[] = [
  "SIN_INGRESO",
  "ATRASADO",
  "AL_DIA",
  "COMPLETADO",
  "CERTIFICADO",
  "SIN_EMPEZAR",
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
  const [salida, setSalida] = useState<Etapa | "">("");
  const [accionAbierta, setAccionAbierta] = useState<string | null>(null);
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
  if (!datos) return <Esqueleto conCifras />;

  const { resumen, criterio } = datos;
  // los dos filtros son excluyentes: un estado de ritmo es
  // de quien sigue dentro, y una salida de quien ya no
  const visibles = salida
    ? datos.personas.filter((p) => p.etapa === salida)
    : filtro
    ? datos.personas.filter((p) => !p.salio && p.estado === filtro)
    : datos.personas;

  // las salidas no son estados de ritmo: van por su etapa
  const SALIDAS: Array<[Etapa, number]> = [
    ["DESERTO", resumen.desertaron],
    ["ABANDONO", resumen.abandonaron],
    ["RETIRADO", resumen.retirados],
    ["NO_APROBO", resumen.noAprobaron],
  ];

  const cuenta: Record<EstadoAcademico, number> = {
    SIN_INGRESO: resumen.sinIngreso,
    SIN_EMPEZAR: resumen.sinEmpezar,
    ATRASADO: resumen.atrasados,
    AL_DIA: resumen.alDia,
    COMPLETADO: resumen.completados,
    CERTIFICADO: resumen.certificados,
  };

  // por acción y dentro por grupo: el acordeón
  const porAccion = new Map<
    string,
    { titulo: string; grupos: Map<number, FilaAcademica[]> }
  >();
  for (const p of visibles) {
    const clave = p.accionFormacionId ?? "sin-accion";
    if (!porAccion.has(clave)) {
      porAccion.set(clave, {
        titulo: p.accion ?? "Sin acción de formación",
        grupos: new Map(),
      });
    }
    const grupos = porAccion.get(clave)!.grupos;
    // -1 para los que no tienen grupo: van al final
    const ng = p.grupo ?? -1;
    if (!grupos.has(ng)) grupos.set(ng, []);
    grupos.get(ng)!.push(p);
  }

  // AF1, AF2… AF10: por el número, no alfabético, que
  // pondría AF10 antes que AF2
  const numeroDe = (titulo: string) => {
    const m = /AF\s*(\d+)/i.exec(titulo);
    return m ? Number(m[1]) : 999;
  };
  const accionesOrdenadas = [...porAccion.entries()].sort(([, a], [, b]) => {
    const d = numeroDe(a.titulo) - numeroDe(b.titulo);
    // el codigo se repite entre convenios: desempata el nombre
    return d !== 0 ? d : a.titulo.localeCompare(b.titulo, "es");
  });

  // 67 grupos: el numero no distingue
  const gruposBuscables = datos.grupos
    .filter((g) => !accionFormacionId || g.accionFormacionId === accionFormacionId)
    .map((g) => {
      const suya = datos.acciones.find((a) => a.id === g.accionFormacionId);
      return {
        id: g.id,
        etiqueta: `Grupo ${g.numero}`,
        detalle: suya ? `${suya.codigo} · ${suya.nombre}` : "Sin acción de formación",
      };
    });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seguimiento académico</h1>
          <p className="mt-1 text-texto-suave">
            Quién va al día y quién no, contra el calendario de su grupo.
          </p>
          {resumen.analizadas < resumen.total && (
            <p className="mt-2 inline-block rounded-full bg-aviso-suave px-3 py-1 text-sm text-aviso">
              Hay {resumen.total.toLocaleString("es-CO")} personas en el aula y se están
              mirando las {resumen.analizadas.toLocaleString("es-CO")} más recientes. Filtre
              por acción o por grupo para ver el resto.
            </p>
          )}
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
        Cada estado dice qué hacer: <strong>Sin ingreso</strong> nunca entró,{" "}
        <strong>Sin arrancar</strong> entró y no aprobó nada,{" "}
        <strong>Parado</strong> lleva {criterio.diasParado} días sin volver, y{" "}
        <strong>Atrasado</strong> va {criterio.tolerancia} actividades o más por
        debajo de lo que tocaría. Se certifica con el{" "}
        {Math.round(criterio.minimoParaCertificar * 100)} % de lo obligatorio
        aprobado. Si el grupo no tiene fechas no se juzga: se dice que no ha empezado.
      </p>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ORDEN.map((estado) => (
          <button
            key={estado}
            onClick={() => {
              setSalida("");
              setFiltro(filtro === estado ? "" : estado);
            }}
            style={{ ["--etapa"]: COLOR[estado] } as React.CSSProperties}
            className={`rounded-2xl border bg-superficie p-4 text-left shadow-sm transition hover:shadow-md ${
              filtro === estado ? "border-2" : "border-borde"
            }`}
            aria-pressed={filtro === estado}
          >
            <span className="flex items-center gap-2 text-xs tracking-wide uppercase">
              <span className="punto-etapa" aria-hidden />
              <span className="text-texto-suave">{ETIQUETA_ACADEMICA[estado]}</span>
            </span>
            <span className="mt-2 block text-3xl font-bold tabular-nums">
              {cuenta[estado]}
            </span>
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Quienes salieron del aula{" "}
          <span className="font-normal text-texto-suave">
            — no se miden por ritmo: cuenta por qué se fueron
          </span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SALIDAS.map(([etapa, n]) => (
            <button
              key={etapa}
              onClick={() => {
                setFiltro("");
                setSalida(salida === etapa ? "" : etapa);
              }}
              aria-pressed={salida === etapa}
              style={estiloEtapa(etapa)}
              className={`rounded-2xl border bg-superficie p-4 text-left shadow-sm transition hover:shadow-md ${
                salida === etapa ? "border-2" : "border-borde"
              }`}
            >
              <span className="flex items-center gap-2 text-xs tracking-wide uppercase">
                <span className="punto-etapa" aria-hidden />
                <span className="text-texto-suave">{ETIQUETA_ETAPA[etapa]}</span>
              </span>
              <span className="mt-2 block text-3xl font-bold tabular-nums">{n}</span>
              {AYUDA_ETAPA[etapa] && (
                <span className="mt-1 block text-xs text-texto-suave">
                  {AYUDA_ETAPA[etapa]}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${CLASE_CONTROL} max-w-xs`}
          placeholder="Buscar por nombre o documento"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />

        <SelectorBuscable
          clase="w-full sm:w-[17rem]"
          etiqueta="Filtrar por acción de formación"
          valor={accionFormacionId}
          alElegir={(id) => {
            setAccion(id);
            // el grupo cuelga de la accion: si cambia, sobra
            setGrupo("");
          }}
          vacio="Toda la formación"
          marcador="AF8, inteligencia artificial…"
          opciones={datos.acciones.map((a) => ({
            id: a.id,
            etiqueta: `${a.codigo} · ${a.nombre}`,
          }))}
        />

        <SelectorBuscable
          clase="w-full sm:w-[14rem]"
          etiqueta="Filtrar por grupo"
          valor={grupoId}
          alElegir={setGrupo}
          vacio="Todos los grupos"
          marcador="Número de grupo, AF8, nombre…"
          opciones={gruposBuscables}
        />

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

        {(filtro || salida || accionFormacionId || grupoId || asesorId || buscar) && (
          <button
            className="text-sm text-marca underline"
            onClick={() => {
              setFiltro("");
              setSalida("");
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
        <div className="space-y-3">
          {accionesOrdenadas.map(([clave, { titulo, grupos }]) => (
            <AccionAcordeon
              key={clave}
              titulo={titulo}
              grupos={grupos}
              abierta={accionAbierta === clave}
              alAbrir={() => setAccionAbierta(accionAbierta === clave ? null : clave)}
            />
          ))}
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

/** Una acción plegada; dentro, sus grupos con su gente. */
function AccionAcordeon({
  titulo,
  grupos,
  abierta,
  alAbrir,
}: {
  titulo: string;
  grupos: Map<number, FilaAcademica[]>;
  abierta: boolean;
  alAbrir: () => void;
}) {
  const gente = [...grupos.values()].flat();
  const alerta = gente.filter((p) =>
    ["SIN_INGRESO", "SIN_ARRANCAR", "PARADO", "ATRASADO"].includes(p.estado),
  ).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-borde bg-superficie shadow-sm">
      <button
        onClick={alAbrir}
        aria-expanded={abierta}
        className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-superficie-alterna"
      >
        <span className="min-w-0 grow">
          <span className="block font-medium">{titulo}</span>
          <span className="mt-1 block text-sm text-texto-suave">
            {grupos.size} {grupos.size === 1 ? "grupo" : "grupos"} · {gente.length}{" "}
            {gente.length === 1 ? "persona" : "personas"}
            {alerta > 0 && (
              <span className="text-error"> · {alerta} necesitan atención</span>
            )}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-texto-suave">
          {abierta ? "▴" : "▾"}
        </span>
      </button>

      {abierta && (
        <div className="space-y-2 border-t border-borde p-4">
          {[...grupos.entries()]
            // por número; el "sin grupo" (-1) al final
            .sort(([a], [b]) => (a < 0 ? 1 : b < 0 ? -1 : a - b))
            .map(([numero, personas]) => (
              <GrupoAcordeon key={numero} numero={numero} personas={personas} />
            ))}
        </div>
      )}
    </section>
  );
}

function GrupoAcordeon({
  numero,
  personas,
}: {
  numero: number;
  personas: FilaAcademica[];
}) {
  const [abierto, setAbierto] = useState(false);
  const uno = personas[0];
  const alerta = personas.filter((p) =>
    ["SIN_INGRESO", "SIN_ARRANCAR", "PARADO", "ATRASADO"].includes(p.estado),
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-borde">
      <button
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-superficie-alterna"
      >
        <span className="min-w-0 grow">
          <span className="font-medium">
            {numero < 0 ? "Sin grupo" : `Grupo ${numero}`}
          </span>
          <span className="ml-2 text-sm text-texto-suave">
            {personas.length} {personas.length === 1 ? "persona" : "personas"}
            {uno.fechaInicio && ` · ${fecha(uno.fechaInicio)} → ${fecha(uno.fechaFin)}`}
            {uno.horario && ` · ${uno.horario}`}
          </span>
          {alerta > 0 && (
            <span className="ml-2 text-sm text-error">· {alerta} por atender</span>
          )}
        </span>
        <span aria-hidden className="shrink-0 text-texto-suave">
          {abierto ? "▴" : "▾"}
        </span>
      </button>

      {!abierto ? null : (
      <div className="caja-scroll overflow-x-auto border-t border-borde">
        <table className="tabla-datos">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Asesor</th>
              <th>Avance</th>
              <th>Va</th>
              <th>Último acceso</th>
            </tr>
          </thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/participantes/${p.id}`} className="underline">
                    {p.nombre}
                  </Link>
                  <span className="block font-mono text-xs text-texto-suave">
                    {p.documento}
                  </span>
                </td>
                <td className="text-sm">{p.asesor?.nombre ?? "—"}</td>
                <td className="min-w-44">
                  <Barra fila={p} />
                </td>
                <td>
                  <span
                    style={{ ["--etapa"]: COLOR[p.estado] } as React.CSSProperties}
                    className="pildora-etapa"
                    title={AYUDA_ACADEMICA[p.estado]}
                  >
                    {ETIQUETA_ACADEMICA[p.estado]}
                  </span>
                </td>
                <td className="text-sm whitespace-nowrap">
                  {p.ultimoAcceso ? fecha(p.ultimoAcceso) : "nunca"}
                  {p.diasSinEntrar !== null && p.diasSinEntrar >= 14 && (
                    <span className="block text-xs text-error">
                      hace {p.diasSinEntrar} días
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
