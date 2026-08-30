"use client";

import { useCallback, useEffect, useState } from "react";

import { IconoFormacion } from "@/components/admin/iconos";
import {
  Aviso,
  Boton,
  CLASE_CONTROL,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import { Esqueleto, Pildora, TarjetaCifra, Vacio } from "@/components/admin/piezas";
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
  const [abierta, setAbierta] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");

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
  const visibles = acciones.filter(
    (a) =>
      !aguja ||
      sinTildes(`${a.codigo} ${a.nombre} ${a.convenio}`).includes(aguja) ||
      a.grupos.some((g) =>
        g.ubicaciones.some((u) => sinTildes(u.nombre).includes(aguja)),
      ),
  );

  const grupos = acciones.flatMap((a) => a.grupos);
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
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Cronograma</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Cuándo empieza y termina cada grupo. De estas fechas depende todo el
          seguimiento académico: sin ellas no se puede medir quién va al día.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* Las cuatro con pie: con una sola frase debajo, esa
          tarjeta media mas alta y la fila quedaba descuadrada. */}
      <div className="grid gap-px border-t border-b border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaCifra
          etiqueta="Grupos"
          valor={grupos.length}
          pie={`en ${acciones.length} acciones de formación`}
          icono={IconoFormacion}
        />
        <TarjetaCifra
          etiqueta="En curso"
          valor={enCurso}
          pie={enCurso > 0 ? "dictándose ahora mismo" : "ninguno ha arrancado todavía"}
          tono="exito"
        />
        <TarjetaCifra
          etiqueta="Por empezar"
          valor={porEmpezar}
          pie={terminados > 0 ? `${terminados} ya terminaron` : "con fecha puesta"}
          tono="neutro"
        />
        <TarjetaCifra
          etiqueta="Sin fechas"
          valor={sinFechas}
          pie={sinFechas > 0 ? "no se puede matricular en ellos" : "todos tienen calendario"}
          tono={sinFechas > 0 ? "error" : "exito"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-borde bg-superficie px-7 py-3">
        <input
          className={`${CLASE_CONTROL} max-w-sm`}
          placeholder="Buscar por código, curso o ciudad…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        {buscar && (
          <button
            type="button"
            onClick={() => setBuscar("")}
            className="sin-aro text-[0.78125rem] text-texto-suave underline-offset-2 transition hover:text-marca hover:underline"
          >
            Quitar la búsqueda
          </button>
        )}
        <span className="ml-auto text-[0.78125rem] text-texto-suave tabular-nums">
          {visibles.length} de {acciones.length} acciones
        </span>
      </div>

      {visibles.length === 0 ? (
        <Vacio titulo="Ninguna formación coincide" icono={IconoFormacion}>
          Pruebe con el código (AF8), parte del nombre o una ciudad.
        </Vacio>
      ) : (
        /// Pegadas, no separadas por hueco.
        ///
        /// Con `space-y-3` se veia el fondo de la pagina entre
        /// fila y fila, y eso se lee como un rayado. La
        /// separacion la hace la raya de cada banda.
        <div>
          {porConvenio.map((b) => (
            <div key={b.convenio}>
              <h2 className="border-b border-hairline bg-superficie-alterna px-7 py-2 text-[0.65625rem] font-semibold tracking-[0.06em] text-marca uppercase">
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
                  abierta={abierta === a.id}
                  alAbrir={() => setAbierta(abierta === a.id ? null : a.id)}
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
  );
}

/** Una acción, plegada. Al abrirla salen sus grupos. */
function Accion({
  accion,
  abierta,
  alAbrir,
  puedeEditar,
  alGuardar,
  alFallar,
}: {
  accion: AccionCronograma;
  abierta: boolean;
  alAbrir: () => void;
  puedeEditar: boolean;
  alGuardar: () => Promise<void>;
  alFallar: (m: string) => void;
}) {
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
        className="flex w-full items-center gap-4 px-7 py-3 text-left transition hover:bg-tabla-fila-resaltada"
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
              "calendario completo"
            )}
          </span>
        </span>

        <span aria-hidden className="shrink-0 text-texto-suave transition-transform" style={{ transform: abierta ? "rotate(180deg)" : undefined }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {abierta && (
        <div className="border-t border-hairline px-7 pt-4 pb-5">
          {accion.grupos.length === 0 ? (
            <p className="text-sm text-texto-suave">
              Esta acción no tiene grupos cargados.
            </p>
          ) : (
            <div className="space-y-3">
              {accion.grupos.map((g) => (
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
    <div className="rounded-xl border border-borde p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            Grupo {grupo.numero}
            <Pildora tono={TONO[grupo.estado]}>
              {ETIQUETA_ESTADO_GRUPO[grupo.estado]}
            </Pildora>
            {grupo.sepGrupoId && (
              <span className="font-mono text-xs text-texto-suave">
                SEP {grupo.sepGrupoId}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-texto-suave">
            {fecha(grupo.fechaInicio)} → {fecha(grupo.fechaFin)}
            {grupo.horario && ` · ${grupo.horario}`}
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="tabular-nums text-texto-suave">
            {grupo.inscritos} de {grupo.cupos}
          </span>
          {puedeEditar && (
            <button
              onClick={() => setEditando(!editando)}
              className="text-marca underline"
            >
              {editando ? "Cerrar" : "Fechas"}
            </button>
          )}
        </div>
      </div>

      {/* dónde se dictará y con cuántos cupos */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {grupo.ubicaciones.map((u) => (
          <Pildora key={u.id} tono="neutro">
            {bonito(u.nombre)} · {u.inscritos}/{u.cupos}
          </Pildora>
        ))}
      </div>

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
