"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

import { IconoFormacion } from "@/components/admin/iconos";
import {
  Aviso,
  Boton,
  CLASE_CONTROL,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import { Esqueleto, Pildora, TarjetaCifra, Vacio } from "@/components/admin/piezas";
import { Desplegable } from "@/components/admin/desplegable";
import {
  alcanza,
  cronogramaApi,
  ETIQUETA_ESTADO_GRUPO,
  type AccionCronograma,
  type EstadoGrupo,
  type GrupoCronograma,
} from "@/lib/admin-api";
import { bonito, ErrorApi } from "@/lib/api";

/// Solo el dia y el mes: el año se repite en las 67 filas y
/// no distingue nada. En la fila abierta sí va completo.
const CORTA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

/** De cuando a cuando va una accion, mirando todos sus grupos. */
function ventanaDe(grupos: GrupoCronograma[]) {
  const inicios = grupos.map((g) => g.fechaInicio).filter(Boolean) as string[];
  const fines = grupos.map((g) => g.fechaFin).filter(Boolean) as string[];
  if (!inicios.length && !fines.length) return null;
  const desde = inicios.length ? inicios.slice().sort()[0] : null;
  const hasta = fines.length ? fines.slice().sort().at(-1)! : null;
  return { desde, hasta };
}

/// Las fechas del cronograma se TECLEAN (2026-09-01), asi que se
/// leen por sus tres numeros y no con `new Date`, que las
/// interpreta en UTC y en Bogota devuelve el dia anterior. Es la
/// misma distincion instante/calendario del backend.
function comoDia(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

const rango = (v: { desde: string | null; hasta: string | null }) =>
  v.desde && v.hasta
    ? `${CORTA.format(comoDia(v.desde))} – ${CORTA.format(comoDia(v.hasta))}`
    : v.desde
      ? `desde el ${CORTA.format(comoDia(v.desde))}`
      : `hasta el ${CORTA.format(comoDia(v.hasta!))}`;

const TONO: Record<EstadoGrupo, "marca" | "exito" | "aviso" | "error" | "neutro"> = {
  SIN_FECHAS: "error",
  POR_EMPEZAR: "neutro",
  EN_CURSO: "exito",
  TERMINADO: "marca",
};

const fecha = (f: string | null) =>
  f ? new Date(f).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/// Para el <input type="date">, que quiere aaaa-mm-dd.
const paraCampo = (f: string | null) => (f ? f.slice(0, 10) : "");

export default function PaginaCronograma() {
  const { admin } = useAdmin();
  const [acciones, setAcciones] = useState<AccionCronograma[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [buscar, setBuscar] = useState("");
  const [gremio, setGremio] = useState("");
  const [estado, setEstado] = useState("");
  const [accionId, setAccionId] = useState("");
  const [numeroGrupo, setNumeroGrupo] = useState("");


  // por el permiso, no por el rol de cuenta: quien
  // configura la formacion es el lider de sistemas
  const puedeEditar = alcanza(admin.permisos?.configuracion, "ESCRIBIR");

  const cargar = useCallback(async () => {
    try {
      setAcciones(await cronogramaApi.listar());
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);


  if (!acciones) return <Esqueleto conCifras filas={4} />;

  const sinTildes = (t: string) =>
    t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const aguja = sinTildes(buscar.trim());
  const grupos = acciones.flatMap((a) => a.grupos);

  const visibles = acciones.filter((a) => {
    const coincide =
      !aguja ||
      sinTildes(`${a.codigo} ${a.nombre} ${a.convenio}`).includes(aguja) ||
      a.grupos.some((g) =>
        g.ubicaciones.some((u) => sinTildes(u.nombre).includes(aguja)),
      );
    /// El estado y el numero son de un GRUPO, no de la accion:
    /// se deja la accion que tenga al menos uno que cumpla.
    /// Esconder la accion entera ocultaria los que si cumplen.
    const porEstado = !estado || a.grupos.some((g) => g.estado === estado);
    const porNumero =
      !numeroGrupo || a.grupos.some((g) => String(g.numero) === numeroGrupo);
    return (
      coincide &&
      (!gremio || a.convenio === gremio) &&
      (!accionId || a.id === accionId) &&
      porEstado &&
      porNumero
    );
  });

  const gremios = [...new Set(acciones.map((a) => a.convenio))];
  const numeros = [...new Set(grupos.map((g) => g.numero))].sort((x, y) => x - y);
  const hayFiltro = Boolean(aguja || gremio || estado || accionId || numeroGrupo);

  /// Las cifras cuentan lo que se esta VIENDO. Antes contaban
  /// siempre el total y al lado aparecia un «15 de 15» suelto que
  /// no se sabia a que se referia: la cifra y el filtro decian
  /// cosas distintas.
  const gruposVisibles = visibles.flatMap((a) =>
    a.grupos.filter(
      (g) =>
        (!estado || g.estado === estado) &&
        (!numeroGrupo || String(g.numero) === numeroGrupo),
    ),
  );
  const cuenta = (e: EstadoGrupo) =>
    gruposVisibles.filter((g) => g.estado === e).length;
  const deTotal = (n: number) => (hayFiltro ? `de ${n} en total` : null);

  function limpiar() {
    setBuscar("");
    setGremio("");
    setEstado("");
    setAccionId("");
    setNumeroGrupo("");
  }

  /// Se imprime y ya: lo que sale en papel NO son las tarjetas
  /// de la pantalla sino la tabla de abajo, que sale entera
  /// siempre. Antes se abrian los 67 acordeones y el PDF eran
  /// once hojas de fichas donde no se encontraba nada.
  function exportarPdf() {
    window.print();
  }

  const enCurso = grupos.filter((g) => g.estado === "EN_CURSO").length;
  const porEmpezar = grupos.filter((g) => g.estado === "POR_EMPEZAR").length;
  const sinFechas = grupos.filter((g) => g.estado === "SIN_FECHAS").length;
  const terminados = grupos.filter((g) => g.estado === "TERMINADO").length;

  /// Agrupadas por gremio, como en Formacion. Sin esto los
  /// codigos vuelven a empezar en AF1 a mitad de la lista y
  /// parecen repetidos.
  const porConvenio = visibles.reduce<Array<{ convenio: string; acciones: AccionCronograma[] }>>(
    (bloques, a) => {
      const y = bloques.find((b) => b.convenio === a.convenio);
      if (y) y.acciones.push(a);
      else bloques.push({ convenio: a.convenio, acciones: [a] });
      return bloques;
    },
    [],
  );

  return (
    <div>
      {/* Todo lo de abajo va sobre el FONDO de la pagina y con
          margen a los lados, no en una banda blanca a sangre. Es
          lo que hace que las tarjetas blancas se vean: sobre
          `superficie` eran blanco sobre blanco. Igual que en
          Gestion de leads. */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-6">
        <div className="no-imprimir">
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            Cronograma
          </h1>
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            Aquí se ponen las fechas de cada grupo: cuándo empieza y cuándo termina. Un
            grupo sin fechas no se puede matricular, y de sus participantes no se puede
            saber si van al día.
          </p>
        </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* Las mismas tarjetas de Gestion de leads: sueltas, con
          su borde y su curva, y con sombra solo al pasar por
          encima. Cuentan lo que se esta VIENDO. */}
      <div className="no-imprimir flex flex-wrap gap-2.5">
        <Cifra
          etiqueta="Acciones de formación"
          valor={visibles.length}
          pie={deTotal(acciones.length) ?? `en ${gremios.length} convenios`}
        />
        <Cifra
          etiqueta="Grupos"
          valor={gruposVisibles.length}
          pie={deTotal(grupos.length) ?? "con su fecha y su horario"}
        />
        <Cifra
          etiqueta="En curso"
          valor={cuenta("EN_CURSO")}
          color="var(--exito)"
          pie="dictándose hoy"
        />
        <Cifra
          etiqueta="Por empezar"
          valor={cuenta("POR_EMPEZAR")}
          color="var(--titulo)"
          pie="ya tienen fecha"
        />
        <Cifra
          etiqueta="Sin fechas"
          valor={cuenta("SIN_FECHAS")}
          color={cuenta("SIN_FECHAS") > 0 ? "var(--error)" : "var(--exito)"}
          pie={
            cuenta("SIN_FECHAS") > 0
              ? "hay que ponérselas"
              : "no falta ninguna"
          }
        />
      </div>

      <div className="no-imprimir flex flex-wrap items-center gap-2.5">
        {/* Crece con lo que sobre: asi no queda hueco muerto
            entre el ultimo filtro y el boton de la derecha. */}
        <input
          className="h-[34px] min-w-[170px] flex-1 rounded-lg border border-campo-borde bg-campo-fondo px-3 text-[0.78125rem] outline-none transition focus:border-campo-foco"
          placeholder="Buscar por código, curso o ciudad…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />

        {/* Todo lo que se puede filtrar sin teclear nada. */}
        <div className="w-[430px]">
          <Desplegable
            alto={34}
            marcador="Acciones de formación"
            valor={accionId}
            opciones={[
              { valor: "", etiqueta: "Acciones de formación" },
              ...acciones.map((a) => ({
                valor: a.id,
                etiqueta: `${a.codigo} · ${bonito(a.nombre)}`,
                detalle: `${a.convenio} · ${a.grupos.length} grupos`,
              })),
            ]}
            alElegir={setAccionId}
          />
        </div>

        <div className="w-[160px]">
          <Desplegable
            alto={34}
            marcador="Grupos"
            valor={numeroGrupo}
            opciones={[
              { valor: "", etiqueta: "Grupos" },
              ...numeros.map((n) => ({
                valor: String(n),
                etiqueta: `Grupo ${n}`,
                detalle: `${grupos.filter((g) => g.numero === n).length} acciones`,
              })),
            ]}
            alElegir={setNumeroGrupo}
          />
        </div>

        <div className="w-[170px]">
          <Desplegable
            alto={34}
            marcador="Convenios"
            valor={gremio}
            opciones={[
              { valor: "", etiqueta: "Convenios" },
              ...gremios.map((g) => ({
                valor: g,
                etiqueta: g,
                detalle: `${acciones.filter((a) => a.convenio === g).length} acciones`,
              })),
            ]}
            alElegir={setGremio}
          />
        </div>

        <div className="w-[170px]">
          <Desplegable
            alto={34}
            marcador="Estados"
            valor={estado}
            opciones={[
              { valor: "", etiqueta: "Estados" },
              ...(["EN_CURSO", "POR_EMPEZAR", "TERMINADO", "SIN_FECHAS"] as EstadoGrupo[]).map(
                (e) => ({
                  valor: e,
                  etiqueta: ETIQUETA_ESTADO_GRUPO[e],
                  detalle: `${grupos.filter((g) => g.estado === e).length} grupos`,
                }),
              ),
            ]}
            alElegir={setEstado}
          />
        </div>

        {hayFiltro && (
          <button
            type="button"
            onClick={limpiar}
            className="sin-aro inline-flex h-[34px] items-center rounded-lg border border-borde bg-superficie px-3.5 text-[0.78125rem] font-semibold whitespace-nowrap text-titulo transition hover:border-marca"
          >
            Quitar filtros
          </button>
        )}

        <button
          type="button"
          onClick={exportarPdf}
          className="sin-aro inline-flex h-[34px] items-center rounded-lg border border-borde bg-superficie px-3.5 text-[0.78125rem] font-semibold whitespace-nowrap text-titulo transition hover:border-marca"
        >
          Exportar a PDF
        </button>
      </div>

      {/* Lo que sale en el PDF, y NADA mas: es «ver el
          cronograma», no un informe con portada. */}
      <div className="solo-impresion">
        <p className="titulo-impreso">
          Cronograma · {gruposVisibles.length} grupos en {visibles.length} acciones de
          formación
        </p>

        {/* Un bloque por accion: la accion es un TITULO y debajo
            solo sus grupos. La fila que cruzaba la tabla obligaba
            a repetir la cabecera de columnas y dejaba la primera
            hoja en blanco. */}
        {visibles.map((a) => {
          const suyos = a.grupos.filter(
            (g) =>
              (!estado || g.estado === estado) &&
              (!numeroGrupo || String(g.numero) === numeroGrupo),
          );
          if (!suyos.length) return null;
          return (
            <section key={a.id} className="bloque-de-accion">
              <h2 className="titulo-de-accion">
                {a.convenio} · {a.codigo} · {bonito(a.nombre)} · {a.horas} horas ·{" "}
                {a.inscritos} de {a.cupos} cupos
              </h2>
              <table className="tabla-datos w-full">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Estado</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Horario</th>
                    <th>Sedes</th>
                    <th>Inscritos</th>
                  </tr>
                </thead>
                <tbody>
                  {suyos.map((g) => (
                    <tr key={g.id}>
                      <td className="tabular-nums">Grupo {g.numero}</td>
                      <td>{ETIQUETA_ESTADO_GRUPO[g.estado]}</td>
                      <td className="tabular-nums">{fecha(g.fechaInicio)}</td>
                      <td className="tabular-nums">{fecha(g.fechaFin)}</td>
                      <td>{g.horario ?? "—"}</td>
                      <td>
                        {g.ubicaciones.map((u) => bonito(u.nombre)).join(", ") || "—"}
                      </td>
                      <td className="tabular-nums">
                        {g.inscritos} de {g.cupos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <Vacio titulo="Sin resultados" icono={IconoFormacion}>
          Ninguna acción de formación coincide con los criterios aplicados. Pruebe con
          el código (AF8), parte del nombre o una ciudad.
        </Vacio>
      ) : (
        /// Pegadas, no separadas por hueco.
        ///
        /// Con `space-y-3` se veia el fondo de la pagina entre
        /// fila y fila, y eso se lee como un rayado. La
        /// separacion la hace la raya de cada banda.
        <div className="no-imprimir overflow-hidden rounded-lg border border-borde bg-superficie">
          {porConvenio.map((b) => (
            <div key={b.convenio} className="border-t border-borde first:border-t-0">
              <h2 className="border-b border-borde bg-superficie-alterna px-7 py-2.5 text-[0.65625rem] font-semibold tracking-[0.06em] text-marca uppercase">
                {b.convenio}
                <span className="ml-2 font-normal tracking-normal text-texto-suave normal-case">
                  {b.acciones.length}{" "}
                  {b.acciones.length === 1 ? "acción" : "acciones"}
                </span>
              </h2>
              {b.acciones.map((a) => (
                <Accion
                  key={a.id}
                  accion={a}
                  estado={estado}
                  numeroGrupo={numeroGrupo}
                  abierta={abiertas.has(a.id)}
                  alAbrir={() =>
                    setAbiertas((v) => {
                      const n = new Set(v);
                      if (!n.delete(a.id)) n.add(a.id);
                      return n;
                    })
                  }
                  puedeEditar={puedeEditar}
                  alGuardar={cargar}
                  alFallar={setError}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/**
 * La tarjeta de cifra de Gestión de leads, tal cual: suelta, con
 * su borde y su curva, y sombra solo al pasar por encima — que es
 * lo único que puede flotar en el contenido.
 */
function Cifra({
  etiqueta,
  valor,
  pie,
  color = "var(--titulo)",
}: {
  etiqueta: string;
  valor: number;
  pie?: string | null;
  color?: string;
}) {
  return (
    <div
      className={
        "min-w-[150px] flex-1 rounded-lg border border-borde bg-superficie px-3.5 py-2 transition " +
        "hover:border-marca/40 hover:shadow-[0_2px_14px_-6px_rgba(15,23,42,0.28)]"
      }
    >
      <div className="truncate leading-none text-texto-suave" style={{ fontSize: "0.6875rem" }} title={etiqueta}>
        {etiqueta}
      </div>
      <div className="mt-1 font-bold leading-none tabular-nums" style={{ fontSize: "1.0625rem", color }}>
        {valor}
      </div>
      {pie && (
        <div className="mt-1 truncate leading-none text-texto-suave" style={{ fontSize: "0.6875rem" }}>
          {pie}
        </div>
      )}
    </div>
  );
}

/** Una acción, plegada. Al abrirla salen sus grupos. */
function Accion({
  accion,
  estado,
  numeroGrupo,
  abierta,
  alAbrir,
  puedeEditar,
  alGuardar,
  alFallar,
}: {
  accion: AccionCronograma;
  estado: string;
  numeroGrupo: string;
  abierta: boolean;
  alAbrir: () => void;
  puedeEditar: boolean;
  alGuardar: () => Promise<void>;
  alFallar: (m: string) => void;
}) {
  /// Los mismos filtros dentro: abrir una accion filtrada por
  /// «sin fechas» y ver los ocho grupos seria contradecir el
  /// filtro que la trajo hasta aqui.
  const suyos = accion.grupos.filter(
    (g) =>
      (!estado || g.estado === estado) &&
      (!numeroGrupo || String(g.numero) === numeroGrupo),
  );
  const ventana = ventanaDe(accion.grupos);
  const enCurso = accion.grupos.filter((g) => g.estado === "EN_CURSO").length;

  return (
    <section className="overflow-hidden border-t border-hairline bg-superficie">
      <button
        onClick={alAbrir}
        aria-expanded={abierta}
        /// 12px arriba y abajo, 28 a los lados: la medida de
        /// fila del prototipo. Con `p-5` cada fila ocupaba
        /// medio tercio mas y en pantalla cabian cinco donde
        /// caben ocho.
        className="sin-aro flex w-full items-center gap-4 px-7 py-3 text-left transition hover:bg-tabla-fila-resaltada"
      >
        <span className="min-w-0 grow">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.65625rem] font-semibold tracking-[0.05em] text-texto-suave">{accion.codigo}</span>
            <span className="text-[0.84375rem] font-semibold text-titulo">{bonito(accion.nombre)}</span>
            {!accion.visible && <Pildora tono="neutro">Sin publicar</Pildora>}
          </span>
          <span className="mt-0.5 block text-[0.71875rem] text-texto-suave">
            {accion.horas} horas · {accion.grupos.length}{" "}
            {accion.grupos.length === 1 ? "grupo" : "grupos"} · {accion.inscritos} de{" "}
            {accion.cupos} cupos
          </span>
        </span>

        {/* Lo que la pantalla promete y callaba hasta abrirla:
            CUANDO. Iba todo el hueco vacio hasta el chevron. */}
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-[0.78125rem] font-semibold text-titulo tabular-nums">
            {ventana ? rango(ventana) : "Sin fechas"}
          </span>
          <span className="mt-0.5 block text-[0.71875rem] text-texto-suave">
            {accion.sinFechas > 0 ? (
              <span className="font-semibold text-error">
                {accion.sinFechas}{" "}
                {accion.sinFechas === 1 ? "grupo sin fecha" : "grupos sin fechas"}
              </span>
            ) : enCurso > 0 ? (
              <span className="font-semibold text-exito">
                {enCurso} en curso
              </span>
            ) : (
              `${accion.grupos.length} ${accion.grupos.length === 1 ? "grupo" : "grupos"} con fecha`
            )}
          </span>
        </span>

        <span aria-hidden className="no-imprimir shrink-0 text-texto-suave transition-transform" style={{ transform: abierta ? "rotate(180deg)" : undefined }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {abierta && (
        <div className="border-t border-hairline bg-superficie-alterna px-7 pt-4 pb-5">
          {suyos.length === 0 ? (
            <p className="text-[0.78125rem] text-texto-suave">
              No hay grupos que coincidan con los filtros aplicados.
            </p>
          ) : (
            /// En dos columnas: ocho grupos apilados dejaban la
            /// pagina larguisima y la mitad derecha vacia.
            <div className="grid gap-3 xl:grid-cols-2">
              {suyos.map((g) => (
                <Grupo
                  key={g.id}
                  grupo={g}
                  puedeEditar={puedeEditar}
                  alGuardar={alGuardar}
                  alFallar={alFallar}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Grupo({
  grupo,
  puedeEditar,
  alGuardar,
  alFallar,
}: {
  grupo: GrupoCronograma;
  puedeEditar: boolean;
  alGuardar: () => Promise<void>;
  alFallar: (m: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [inicio, setInicio] = useState(paraCampo(grupo.fechaInicio));
  const [fin, setFin] = useState(paraCampo(grupo.fechaFin));
  const [horario, setHorario] = useState(grupo.horario ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await cronogramaApi.actualizarGrupo(grupo.id, {
        fechaInicio: inicio || null,
        fechaFin: fin || null,
        horario,
      });
      await alGuardar();
      setEditando(false);
    } catch (e) {
      alFallar((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="imprimible-bloque rounded-lg border border-borde bg-superficie p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[0.84375rem] font-semibold text-titulo">
            Grupo {grupo.numero}
          </span>
          <Pildora tono={TONO[grupo.estado]}>
            {ETIQUETA_ESTADO_GRUPO[grupo.estado]}
          </Pildora>
          {grupo.sepGrupoId && (
            <span className="font-mono text-[0.6875rem] text-texto-suave">
              SEP {grupo.sepGrupoId}
            </span>
          )}
        </p>
        <span className="shrink-0 text-[0.78125rem] text-texto-suave tabular-nums">
          {grupo.inscritos} de {grupo.cupos}
        </span>
      </div>

      <p className="mt-1.5 text-[0.78125rem] text-texto-suave">
        {fecha(grupo.fechaInicio)} → {fecha(grupo.fechaFin)}
        {grupo.horario && ` · ${grupo.horario}`}
      </p>

      {/* dónde se dictará y con cuántos cupos */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {grupo.ubicaciones.map((u) => (
          <Pildora key={u.id} tono="neutro">
            {bonito(u.nombre)} · {u.inscritos}/{u.cupos}
          </Pildora>
        ))}
      </div>

      {puedeEditar && (
        /// La accion al pie y no arriba: alli competia con la
        /// cifra de cupos y en columna estrecha las partia.
        <button
          onClick={() => setEditando(!editando)}
          className="sin-aro no-imprimir mt-2.5 text-[0.78125rem] font-semibold text-marca underline-offset-2 transition hover:underline"
        >
          {editando ? "Cerrar" : "Editar fechas"}
        </button>
      )}

      {editando && (
        <div className="mt-4 grid gap-3 border-t border-borde pt-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Empieza</span>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={CLASE_CONTROL}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Termina</span>
            <input
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className={CLASE_CONTROL}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Horario</span>
            <input
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              placeholder="Lunes a viernes, 2 a 5 p. m."
              className={CLASE_CONTROL}
            />
          </label>

          <div className="sm:col-span-3">
            <Boton type="button" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar fechas"}
            </Boton>
            <p className="mt-2 text-xs text-texto-suave">
              Cambiar estas fechas mueve el «va al día» de todo el grupo en el
              seguimiento académico.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
