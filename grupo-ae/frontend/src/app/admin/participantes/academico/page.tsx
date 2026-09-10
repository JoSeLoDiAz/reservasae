"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { colorEtapa, estiloEtapa } from "@/components/admin/etapa";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { PanelAcademico } from "@/components/admin/panel-academico";
import { TableroAcademico } from "@/components/admin/tablero-academico";
import { Desplegable } from "@/components/admin/desplegable";
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

/**
 * Seguimiento académico: UN solo cuadro.
 *
 * Eran tres pantallas para la misma pregunta: «Avance» persona
 * a persona, «Tablero académico» por acción, grupo y asesor, y
 * un «Proceso» que se añadió después con los gráficos. Tres
 * sitios donde mirar cómo va el aula son tres sitios donde la
 * cifra puede no coincidir, y cada uno enlazaba a los otros en
 * su propio subtítulo --la señal de que nunca debieron ser
 * tres--.
 *
 * Ahora es una sola columna que se lee de arriba abajo: los
 * filtros, en qué estado está cada quien, los gráficos que
 * cuentan cómo va eso, y al final la lista con nombre y
 * apellido.
 *
 * Y UN SOLO juego de filtros manda sobre todo. Es lo que
 * permite juntarlo: con el filtro de una acción puesto, el
 * embudo, las tasas y la lista hablan de la misma gente. Dos
 * juegos de filtros en una pantalla —uno para los gráficos y
 * otro para la tabla— es como se acaba comparando un
 * numerador con un denominador que no le corresponde.
 */
/**
 * Las DOS hojas de Gestión Académica, con sus pestañas.
 *
 * «Tablero académico» era una pantalla del menú y se fusionó
 * aquí; su ruta quedó redirigiendo. Pero el tablero contesta
 * otra cosa --cómo va cada acción, cada grupo y cada asesor,
 * con sus cortes y su aviso de medibles-- y esa lectura se
 * perdió: el componente seguía escrito y no lo pintaba nadie.
 *
 * Vuelve como pestaña y no como pantalla aparte, que es el
 * mismo patrón de Control de Inscritos: dos vistas de la misma
 * cosa comparten cabecera, y así no hay dos entradas de menú
 * que compitan. «Seguimiento» sigue siendo la primera, que es
 * la que se abre a diario.
 */
const HOJAS = [
  { clave: "seguimiento", etiqueta: "Seguimiento" },
  { clave: "tablero", etiqueta: "Tablero académico" },
] as const;

type Hoja = (typeof HOJAS)[number]["clave"];

export default function PaginaAcademica() {
  const [hoja, setHoja] = useState<Hoja>("seguimiento");

  return (
    <div className="flex flex-col gap-3 px-4 pt-3">
      <div
        role="tablist"
        aria-label="Qué mirar"
        className="flex gap-1 self-start rounded-lg border border-borde bg-superficie p-1"
      >
        {HOJAS.map((h) => (
          <button
            key={h.clave}
            role="tab"
            aria-selected={hoja === h.clave}
            onClick={() => setHoja(h.clave)}
            className={`sin-aro rounded-md px-4 py-1.5 text-[0.78125rem] font-semibold transition ${
              hoja === h.clave
                ? "bg-marca-suave text-marca"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            {h.etiqueta}
          </button>
        ))}
      </div>

      {/* Montado y desmontado, no escondido: cada hoja pide sus
          propios datos cada treinta segundos, y dejarlas las dos
          vivas dobla las consultas para enseñar una. */}
      {hoja === "seguimiento" ? <Seguimiento /> : <TableroAcademico />}
    </div>
  );
}

function Seguimiento() {
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

  const hayFiltro = Boolean(
    filtro || salida || accionFormacionId || grupoId || asesorId || buscar,
  );

  function quitarFiltros() {
    setFiltro("");
    setSalida("");
    setAccion("");
    setGrupo("");
    setAsesor("");
    setBuscar("");
  }

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
    /// La misma forma que Control de Inscritos, y a propósito:
    /// son las dos pantallas donde coordinación viene a mirar
    /// cómo va la cosa, y hasta ahora cada una tenía la suya.
    /// Cabecera sin banda, filtros en su tarjeta y una sola
    /// fila, y de ahí para abajo bloques.
    ///
    /// Sin `px-4 pt-3`: los pone la página, que ahora envuelve
    /// las dos hojas. Repetirlos aquí duplicaba el margen.
    <div className="flex flex-col gap-3 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            Seguimiento académico
          </h1>
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            Todo el paso por el aula, de matriculado a certificado — quién va al
            día y quién no, contra el calendario de su grupo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <IndicadorActualizacion
            actualizadoEn={vivos.actualizadoEn}
            refrescando={vivos.refrescando}
            desactualizado={vivos.desactualizado}
            alRefrescar={vivos.refrescar}
          />
          <Link
            href="/admin/participantes"
            className="text-[0.78125rem] text-texto-suave underline hover:text-texto"
          >
            Volver a inscripciones
          </Link>
        </div>
      </header>

      {/* Prosa, y solo cuando pasa: no cabe en la tarjeta de
          filtros porque no es un filtro, es una advertencia
          sobre lo que se está mirando. */}
      {resumen.analizadas < resumen.total && (
        <p className="rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
          <strong className="font-semibold">
            Se están mirando las {resumen.analizadas.toLocaleString("es-CO")} más
            recientes
          </strong>{" "}
          de {resumen.total.toLocaleString("es-CO")} en el aula. Filtre por acción
          o por grupo para ver el resto.
        </p>
      )}

      {/* ── 1 · Filtros ──
          Los cuatro en UNA fila y dentro de su tarjeta, como en
          Control de Inscritos: mandan todos sobre la misma
          pantalla, y sueltos en una línea parecía que cada uno
          gobernaba otra cosa. */}
      <div className="rounded-xl border border-borde bg-superficie px-4 py-3.5">
        <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Filtros
          <span className="ml-2.5 font-normal tracking-normal text-marca normal-case">
            <strong className="font-semibold tabular-nums">
              {resumen.analizadas.toLocaleString("es-CO")}
            </strong>{" "}
            {resumen.analizadas === 1 ? "persona" : "personas"} en el aula
          </span>
          {hayFiltro && (
            <button
              onClick={quitarFiltros}
              className="ml-3 font-normal tracking-normal text-texto-suave underline normal-case hover:text-texto"
            >
              Limpiar
            </button>
          )}
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className={CLASE_CONTROL}
            placeholder="Buscar por nombre o documento"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />

          <SelectorBuscable
            clase="w-full"
            etiqueta="Acción de formación"
            valor={accionFormacionId}
            alElegir={(id) => {
              setAccion(id);
              // el grupo cuelga de la accion: si cambia, sobra
              setGrupo("");
            }}
            vacio="Formación"
            marcador="AF8, inteligencia artificial…"
            opciones={datos.acciones.map((a) => ({
              id: a.id,
              etiqueta: `${a.codigo} · ${a.nombre}`,
            }))}
          />

          <SelectorBuscable
            clase="w-full"
            etiqueta="Grupo"
            valor={grupoId}
            alElegir={setGrupo}
            vacio="Grupos"
            marcador="Número de grupo, AF8, nombre…"
            opciones={gruposBuscables}
          />

          <Desplegable
            alto={34}
            marcador="Asesores"
            valor={asesorId}
            alElegir={setAsesor}
            opciones={[
              { valor: "", etiqueta: "Asesores" },
              ...datos.asesores.map((a) => ({ valor: a.id, etiqueta: a.nombre })),
            ]}
          />
        </div>

        {/* Los estados, DENTRO de la misma tarjeta que los
            filtros y separados por una raya.

            Eran dos tarjetas y antes diez cajas sueltas. Y son
            lo mismo: pulsar un estado ES filtrar. Tenerlos en
            cajas distintas decía que eran dos cosas, y por eso
            la pantalla parecía tener el doble de sitios donde
            mirar de los que tiene. */}
        <p className="mt-3.5 border-t border-hairline pt-3 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          En qué estado está cada quien
          <span className="ml-2.5 font-normal tracking-normal normal-case">
            pulse uno para quedarse solo con esa gente
          </span>
        </p>

        <div className="mt-2.5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ORDEN.map((estado) => (
            <button
              key={estado}
              onClick={() => {
                setSalida("");
                setFiltro(filtro === estado ? "" : estado);
              }}
              style={{ ["--etapa"]: COLOR[estado] } as React.CSSProperties}
              className={`rounded-lg border bg-superficie px-3 py-2.5 text-left transition hover:border-campo-borde ${
                filtro === estado ? "border-marca bg-marca-suave" : "border-borde"
              }`}
              aria-pressed={filtro === estado}
            >
              <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
                <span className="punto-etapa" aria-hidden />
                <span className="truncate text-texto-suave">
                  {ETIQUETA_ACADEMICA[estado]}
                </span>
              </span>
              <span className="mt-1 block text-xl font-bold tabular-nums">
                {cuenta[estado]}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3.5 border-t border-hairline pt-3 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Y quiénes salieron del aula
          <span className="ml-2.5 font-normal tracking-normal normal-case">
            no se miden por ritmo: cuenta por qué se fueron
          </span>
        </p>

        <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SALIDAS.map(([etapa, cuantos]) => (
            <button
              key={etapa}
              onClick={() => {
                setFiltro("");
                setSalida(salida === etapa ? "" : etapa);
              }}
              aria-pressed={salida === etapa}
              style={estiloEtapa(etapa)}
              className={`rounded-lg border bg-superficie px-3 py-2.5 text-left transition hover:border-campo-borde ${
                salida === etapa ? "border-marca bg-marca-suave" : "border-borde"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
                <span className="punto-etapa" aria-hidden />
                <span className="truncate text-texto-suave">
                  {ETIQUETA_ETAPA[etapa]}
                </span>
              </span>
              <span className="mt-1 block text-xl font-bold tabular-nums">
                {cuantos}
              </span>
              {AYUDA_ETAPA[etapa] && (
                <span className="mt-0.5 block text-[0.6875rem] text-texto-suave">
                  {AYUDA_ETAPA[etapa]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* La metodología, al pie y en pequeño. Es lo que hay
            que poder consultar cuando una cifra sorprende, no lo
            primero que se lee al entrar. */}
        <p className="mt-3.5 border-t border-hairline pt-3 text-[0.71875rem] leading-relaxed text-texto-suave">
          <strong className="font-semibold">Sin ingreso</strong> nunca entró,{" "}
          <strong className="font-semibold">Sin empezar</strong> es que su grupo
          aún no arrancó o no tiene fechas, y{" "}
          <strong className="font-semibold">Atrasado</strong> va{" "}
          {criterio.tolerancia} actividades o más por debajo de lo que tocaría a
          estas alturas. Se certifica con el{" "}
          {Math.round(criterio.minimoParaCertificar * 100)} % de lo obligatorio
          aprobado, y se considera parado a los {criterio.diasParado} días sin
          volver.
        </p>
      </div>

      {/* Los gráficos, entre los estados y la lista.
          Es el sitio que les toca por la pregunta que responde
          cada cosa: arriba «cuántos hay en cada estado», aquí
          «cómo va eso y qué hay que atender», y abajo «quiénes
          son». Van con los MISMOS filtros de arriba, así que al
          acotar por una acción el embudo se acota con ella.

          Y con el reparto por estado ya puesto arriba, el panel
          no lo repite: sus donuts miran otra cosa --el peso de
          cada estado y por qué puerta se sale--. */}
      <PanelAcademico datos={datos} />

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
    <section className="overflow-hidden border-b border-borde bg-superficie">
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
