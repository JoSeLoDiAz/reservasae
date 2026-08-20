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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Cronograma</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Cuándo empieza y termina cada grupo. De estas fechas depende todo el
          seguimiento académico: sin ellas no se puede medir quién va al día.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaCifra etiqueta="Grupos" valor={grupos.length} icono={IconoFormacion} />
        <TarjetaCifra etiqueta="En curso" valor={enCurso} tono="exito" />
        <TarjetaCifra etiqueta="Por empezar" valor={porEmpezar} tono="neutro" />
        <TarjetaCifra
          etiqueta="Sin fechas"
          valor={sinFechas}
          pie={sinFechas > 0 ? "no se puede matricular en ellos" : "todos tienen calendario"}
          tono={sinFechas > 0 ? "error" : "exito"}
        />
      </div>

      <input
        className={`${CLASE_CONTROL} max-w-md`}
        placeholder="Buscar por código, curso o ciudad…"
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
      />

      {visibles.length === 0 ? (
        <Vacio titulo="Ninguna formación coincide" icono={IconoFormacion}>
          Pruebe con el código (AF8), parte del nombre o una ciudad.
        </Vacio>
      ) : (
        <div className="space-y-3">
          {visibles.map((a) => (
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
  return (
    <section className="overflow-hidden rounded-2xl border border-borde bg-superficie shadow-sm">
      <button
        onClick={alAbrir}
        aria-expanded={abierta}
        className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-superficie-alterna"
      >
        <span className="min-w-0 grow">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-texto-suave">{accion.codigo}</span>
            <span className="font-medium">{bonito(accion.nombre)}</span>
            {!accion.visible && <Pildora tono="neutro">Sin publicar</Pildora>}
            {accion.sinFechas > 0 && (
              <Pildora tono="error">
                {accion.sinFechas} {accion.sinFechas === 1 ? "grupo" : "grupos"} sin fechas
              </Pildora>
            )}
          </span>
          <span className="mt-1 block text-sm text-texto-suave">
            {accion.convenio} · {accion.horas} horas · {accion.grupos.length}{" "}
            {accion.grupos.length === 1 ? "grupo" : "grupos"} · {accion.inscritos} de{" "}
            {accion.cupos} cupos
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-texto-suave">
          {abierta ? "▴" : "▾"}
        </span>
      </button>

      {abierta && (
        <div className="border-t border-borde p-5 pt-4">
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
