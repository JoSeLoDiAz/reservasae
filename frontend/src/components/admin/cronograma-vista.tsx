"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { comoDia, fechaDeCalendario } from "@/lib/dia-de-calendario";

import { IconoFormacion } from "@/components/admin/iconos";
import {
  Aviso,
  Boton,
  CLASE_CONTROL,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import { Cifra, Esqueleto, Pildora, Vacio } from "@/components/admin/piezas";
import { Desplegable } from "@/components/admin/desplegable";
import {
  alcanza,
  cronogramaApi,
  ETIQUETA_SESION,
  LLEVA_DIA,
  type SesionDeGrupo,
  type TipoDeSesion,
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

/// Vive en `lib/dia-de-calendario`, no aquí: estaba resuelto
/// en esta función y olvidado en `fecha`, dos líneas abajo.

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

const fecha = (f: string | null) => fechaDeCalendario(f);

/// Como se lee una sesion en la tarjeta.
///
/// El dia solo se pinta cuando la sesion lo tiene, y eso es lo
/// que pidio el cliente: la presencial no lo lleva --el grupo ya
/// dice cuando es-- y la PAT tampoco, porque vale para todos los
/// dias salvo los que tienen uno propio.
function comoSeLee(s: SesionDeGrupo): string {
  const cuando = s.dia ? `${fecha(s.dia)}, ` : "";
  const donde = s.ubicacion ? ` · ${bonito(s.ubicacion.nombre)}` : "";
  return `${ETIQUETA_SESION[s.tipo]}: ${cuando}de ${s.horaInicio} a ${s.horaFin}${donde}`;
}

/// Lo que se teclea. El dia va como texto del `<input date>`.
type SesionEnEdicion = {
  tipo: TipoDeSesion;
  dia: string;
  horaInicio: string;
  horaFin: string;
  ubicacionId: string;
};

/// Cual de los dias es esta sesion, o nada.
///
/// Se cuenta SOLO entre las que llevan dia. Una PAT numerada
/// diria que es el dia 2, y no es ningun dia: es la hora de
/// conexion de todos los demas.
function numeroDeDia(todas: SesionDeGrupo[], una: SesionDeGrupo): number | null {
  const conDia = todas.filter((s) => s.dia);
  if (conDia.length < 2 || !una.dia) return null;
  return conDia.findIndex((s) => s.id === una.id) + 1;
}

/// Lo que sale en la celda del PDF.
const sesionesEnUnaLinea = (ses: SesionDeGrupo[]) =>
  ses.length ? ses.map(comoSeLee).join(" · ") : "—";

/// Para el <input type="date">, que quiere aaaa-mm-dd.
const paraCampo = (f: string | null) => (f ? f.slice(0, 10) : "");

/**
 * Las fechas de cada grupo, para la pestania «Cronograma» de Acciones.
 *
 * Era una pagina aparte, y su lista de acciones era LA MISMA que la de
 * «Acciones de formacion»: agrupada igual, con el mismo buscador. El
 * comentario del codigo viejo ya lo decia --«son las dos caras de la
 * misma lista»--. La diferencia real es el zoom: alli cada accion es
 * una fila con su interruptor de publicar, aqui se abre y da sus grupos
 * y sus fechas.
 *
 * Quien puede EDITAR sigue siendo el mismo:  mira
 * configuracion:ESCRIBIR, y el backend lo exige aparte.
 */
export function CronogramaVista() {
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
      {/* 8 px abajo y no 24: el margen que pidió conservar, no un
          hueco («baja más la tabla, obviamente conservando un
          margen», 12 sep 2026).

          Aquí NO va el `min-h-0 grow` que se le puso al catálogo:
          esto no es una tabla con scroll propio, es una lista de
          acordeones que se abren. Que scrollee la página es lo
          correcto cuando el contenido crece al abrirlo. */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-2">
        <div className="no-imprimir">
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            Aquí se ponen las fechas de cada grupo —cuándo empieza y cuándo
            termina— y sus sesiones: la presencial, la sincrónica o la conexión
            PAT. Sin fechas no se puede saber si sus participantes van al día.
            Matricular sí se puede: las fechas avisan, no bloquean.
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
          pie={deTotal(grupos.length) ?? "con su fecha y su sesión"}
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
          /// `min-w-[8rem]` y no 170: con el mínimo alto era el
          /// buscador el que empujaba al resto fuera de la fila.
          className="h-[34px] min-w-[8rem] flex-[2] rounded-lg border border-campo-borde bg-campo-fondo px-3 text-[0.78125rem] outline-none transition focus:border-campo-foco"
          placeholder="Buscar por código, curso o ciudad…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />

        {/* TODOS ELÁSTICOS, PARA QUE QUEPAN EN UNA FILA.

            Estaban en anchos fijos --430 + 160 + 170 + 170, más el
            buscador y dos botones-- y eso pasa de 1.300 px: en un
            portátil «Estados» y «Exportar a PDF» se caían al
            segundo renglón. «Debes dejarlo en una sola fila, no
            como está» (cliente, 12 sep 2026).

            Con `flex-1 min-w-0` cada uno pide cero y se reparte lo
            que hay, así que la fila se adapta en vez de partirse.
            Y se puede hacer porque el disparador de `Desplegable`
            lleva `w-full` y su etiqueta va en `truncate`: al
            encogerlo recorta el texto, no lo desborda. El de las
            acciones se lleva doble ración porque su etiqueta es la
            más larga de las cuatro. */}
        <div className="min-w-0 flex-[2]">
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

        <div className="min-w-0 flex-1">
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

        <div className="min-w-0 flex-1">
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

        <div className="min-w-0 flex-1">
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

        {/* `shrink-0`: los botones no se encogen. Lo que cede es
            lo que tiene texto que se puede recortar, no la acción. */}
        <button
          type="button"
          onClick={exportarPdf}
          /// Rojo de PDF, como los demás botones de exportar
          /// (12 sep 2026). Ver `BotonPdf`.
          className="sin-aro inline-flex h-[34px] shrink-0 items-center rounded-lg bg-pdf px-3.5 text-[0.78125rem] font-semibold whitespace-nowrap text-pdf-texto transition hover:bg-pdf-fuerte"
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
                {a.inscritos} de {a.tope} cupos
              </h2>
              <table className="tabla-datos w-full">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Estado</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Sesión sincrónica</th>
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
                      <td className="envuelve">{sesionesEnUnaLinea(g.sesiones)}</td>
                      <td className="envuelve">
                        {g.ubicaciones.map((u) => bonito(u.nombre)).join(", ") || "—"}
                      </td>
                      <td className="tabular-nums">
                        {g.inscritos} de {g.tope}
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
              <h2 className="border-b border-borde bg-marca-suave px-7 py-2.5 text-[0.65625rem] font-bold tracking-[0.06em] text-marca uppercase">
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
            {accion.tope} cupos
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
  const [dias, setDias] = useState(grupo.dias ?? "");
  const [sesiones, setSesiones] = useState<SesionEnEdicion[]>(() =>
    grupo.sesiones.map((x) => ({
      tipo: x.tipo,
      dia: paraCampo(x.dia),
      horaInicio: x.horaInicio,
      horaFin: x.horaFin,
      ubicacionId: x.ubicacionId ?? "",
    })),
  );
  const [guardando, setGuardando] = useState(false);
  const [editandoCupos, setEditandoCupos] = useState(false);
  /// El fallo se pinta DENTRO del editor. Mandarlo arriba del
  /// todo deja el boton pareciendo que no hace nada: le paso a
  /// quien carga el cronograma con un fin anterior al inicio.
  const [falla, setFalla] = useState<string | null>(null);

  function cambiar(i: number, parte: Partial<SesionEnEdicion>) {
    setSesiones(sesiones.map((x, j) => (j === i ? { ...x, ...parte } : x)));
  }

  async function guardar() {
    setGuardando(true);
    setFalla(null);
    try {
      await cronogramaApi.actualizarGrupo(grupo.id, {
        fechaInicio: inicio || null,
        fechaFin: fin || null,
        dias,
        sesiones: sesiones.map((x) => ({
          tipo: x.tipo,
          /// La que no lleva dia lo manda nulo aunque haya
          /// quedado algo escrito al cambiar de tipo.
          dia: LLEVA_DIA[x.tipo] ? x.dia || null : null,
          horaInicio: x.horaInicio,
          horaFin: x.horaFin,
          ubicacionId: x.ubicacionId || null,
        })),
      });
      await alGuardar();
      setEditando(false);
    } catch (e) {
      setFalla((e as ErrorApi).message);
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
          {grupo.inscritos} de {grupo.tope}
        </span>
      </div>

      <p className="mt-1.5 text-[0.78125rem] text-texto-suave">
        {fecha(grupo.fechaInicio)} → {fecha(grupo.fechaFin)}
        {grupo.dias && ` · ${grupo.dias}`}
      </p>

      {/* Las sesiones, una por linea: un bootcamp lleva dos y
          una hibrida lleva la presencial mas la conexion. */}
      {grupo.sesiones.length === 0 ? (
        <p className="mt-1 text-[0.78125rem] text-texto-suave">Sin sesiones</p>
      ) : (
        grupo.sesiones.map((x) => (
          <p key={x.id} className="mt-1 text-[0.78125rem] text-texto-suave">
            <span className="font-semibold text-titulo">
              {ETIQUETA_SESION[x.tipo]}
              {/* «dia 1 / dia 2» solo en las que TIENEN dia y solo
                  si hay varias: en un bootcamp las dos presenciales
                  se leian iguales. Numerar la PAT seria mentir --no
                  es un dia, es la hora de todos los demas. */}
              {numeroDeDia(grupo.sesiones, x) && ` · día ${numeroDeDia(grupo.sesiones, x)}`}:
            </span>{" "}
            {x.dia ? `${fecha(x.dia)}, ` : ""}
            de {x.horaInicio} a {x.horaFin}
            {x.ubicacion && ` · ${bonito(x.ubicacion.nombre)}`}
          </p>
        ))
      )}

      {/* dónde se dictará y con cuántos cupos */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {grupo.ubicaciones.map((u) => (
          <Pildora key={u.id} tono="neutro">
            {bonito(u.nombre)} · {u.inscritos}/{u.tope}
          </Pildora>
        ))}
      </div>

      {puedeEditar && (
        /// Las acciones al pie y no arriba: alli competian con la
        /// cifra de cupos y en columna estrecha las partian.
        <div className="no-imprimir mt-2.5 flex flex-wrap gap-4">
          <button
            onClick={() => {
              setFalla(null);
              setEditando(!editando);
            }}
            className="sin-aro text-[0.78125rem] font-semibold text-marca underline-offset-2 transition hover:underline"
          >
            {editando ? "Cerrar" : "Editar fechas"}
          </button>
          <button
            onClick={() => setEditandoCupos(!editandoCupos)}
            className="sin-aro text-[0.78125rem] font-semibold text-marca underline-offset-2 transition hover:underline"
          >
            {editandoCupos ? "Cerrar" : "Editar cupos"}
          </button>
        </div>
      )}

      {editandoCupos && (
        <div className="mt-4 border-t border-borde pt-4">
          <p className="mb-3 text-[0.71875rem] text-texto-suave">
            Lo <strong className="font-medium">comprometido</strong> es lo que se le
            prometió al SENA por esta sede; el <strong className="font-medium">tope</strong>{" "}
            incluye el sobrecupo. Sumarle a una sede y restarle a otra recalcula solo el
            total de la acción en esa ciudad.
          </p>
          <div className="flex flex-col gap-3">
            {grupo.ubicaciones.map((u) => (
              <CuposDeLaSede
                key={u.id}
                sede={u}
                alGuardar={alGuardar}
                alFallar={alFallar}
              />
            ))}
          </div>
        </div>
      )}

      {editando && (
        <div className="mt-4 border-t border-borde pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
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
              <span className="mb-1 block text-xs font-medium">Días</span>
              <input
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                placeholder="lunes a sábado"
                className={CLASE_CONTROL}
              />
            </label>
          </div>

          <div className="mt-4 border-t border-borde pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[0.8125rem] font-semibold text-titulo">
                Sesiones del grupo
              </p>
              <button
                type="button"
                onClick={() =>
                  setSesiones([
                    ...sesiones,
                    {
                      tipo: "PRESENCIAL",
                      dia: "",
                      horaInicio: "",
                      horaFin: "",
                      ubicacionId: "",
                    },
                  ])
                }
                className="sin-aro text-[0.78125rem] font-semibold text-marca underline-offset-2 transition hover:underline"
              >
                Agregar sesión
              </button>
            </div>
            <p className="mt-0.5 mb-3 text-xs text-texto-suave">
              Un bootcamp lleva dos; una híbrida, la presencial más la conexión
              PAT. El día va solo en las que lo llevan, y cae dentro de las fechas
              de arriba.
            </p>

            {sesiones.length === 0 && (
              <p className="mb-3 text-xs text-texto-suave">
                Este grupo todavía no tiene sesiones.
              </p>
            )}

            {sesiones.map((x, i) => (
              <div key={i} className="mb-3 grid gap-3 sm:grid-cols-5">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">
                    Tipo
                    {LLEVA_DIA[x.tipo] &&
                      sesiones.filter((o) => LLEVA_DIA[o.tipo]).length > 1 &&
                      ` · día ${sesiones.filter((o) => LLEVA_DIA[o.tipo]).indexOf(x) + 1}`}
                  </span>
                  <select
                    value={x.tipo}
                    onChange={(e) =>
                      cambiar(i, { tipo: e.target.value as TipoDeSesion })
                    }
                    className={CLASE_CONTROL}
                  >
                    <option value="PRESENCIAL">Sesión presencial</option>
                    <option value="SINCRONICA">Sesión sincrónica</option>
                    <option value="PAT">Conexión PAT</option>
                  </select>
                </label>

                {/* El dia solo donde lo lleva. Pintarlo apagado
                    invitaria a llenarlo para nada. */}
                {LLEVA_DIA[x.tipo] ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium">Día</span>
                    <input
                      type="date"
                      value={x.dia}
                      min={inicio || undefined}
                      max={fin || undefined}
                      onChange={(e) => cambiar(i, { dia: e.target.value })}
                      className={CLASE_CONTROL}
                    />
                  </label>
                ) : (
                  <p className="self-end pb-2 text-xs text-texto-suave">
                    {x.tipo === "PAT"
                      ? "Todos los días del grupo, salvo los que tengan día propio."
                      : "En las fechas del grupo."}
                  </p>
                )}

                {/* DONDE. Solo lo que cubre el grupo: un foro
                    hibrido se dicta en una sede aunque la accion
                    alcance seis departamentos. */}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">Dónde</span>
                  <select
                    value={x.ubicacionId}
                    onChange={(e) => cambiar(i, { ubicacionId: e.target.value })}
                    className={CLASE_CONTROL}
                  >
                    <option value="">Sin definir</option>
                    {grupo.ubicaciones.map((u) => (
                      <option key={u.ubicacionId} value={u.ubicacionId}>
                        {bonito(u.nombre)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium">
                    Hora de inicio
                  </span>
                  <input
                    type="time"
                    value={x.horaInicio}
                    onChange={(e) => cambiar(i, { horaInicio: e.target.value })}
                    className={CLASE_CONTROL}
                  />
                </label>

                <div className="flex items-end gap-2">
                  <label className="block grow">
                    <span className="mb-1 block text-xs font-medium">Hora de fin</span>
                    <input
                      type="time"
                      value={x.horaFin}
                      onChange={(e) => cambiar(i, { horaFin: e.target.value })}
                      className={CLASE_CONTROL}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSesiones(sesiones.filter((_, j) => j !== i))}
                    className="sin-aro pb-2 text-[0.78125rem] font-semibold text-error underline-offset-2 transition hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Boton type="button" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
            {falla && (
              <p className="mt-2 rounded-lg border border-error/30 bg-error-suave p-3 text-sm text-error">
                {falla}
              </p>
            )}
            <p className="mt-2 text-xs text-texto-suave">
              Cambiar estas fechas mueve el «va al día» de todo el grupo en el
              seguimiento académico. La sesión no bloquea nada: sale en el
              cronograma y en el seguimiento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Los cupos de un grupo en UNA sede, editables.
 *
 * Hasta ahora esto solo entraba por la semilla: si el proyecto sumaba
 * plazas en un departamento y las quitaba en otro, tocaba el Excel y
 * volver a sembrar. El total de la acción en esa ciudad lo recalcula el
 * servidor como la suma de sus sedes, así que no hay forma de dejar las
 * dos cifras separadas desde aquí.
 */
function CuposDeLaSede({
  sede,
  alGuardar,
  alFallar,
}: {
  sede: { id: string; nombre: string; cupos: number; tope: number; inscritos: number };
  alGuardar: () => Promise<void>;
  alFallar: (m: string) => void;
}) {
  const [base, setBase] = useState(String(sede.cupos));
  const [tope, setTope] = useState(String(sede.tope));
  const [guardando, setGuardando] = useState(false);

  const cambio = base !== String(sede.cupos) || tope !== String(sede.tope);

  async function guardar() {
    setGuardando(true);
    try {
      await cronogramaApi.actualizarCupos(sede.id, {
        cuposBase: Number(base),
        cuposMaximos: Number(tope),
      });
      await alGuardar();
    } catch (e) {
      alFallar((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-hairline p-3">
      <p className="min-w-[9rem] grow text-[0.78125rem] font-medium text-titulo">
        {bonito(sede.nombre)}
        <span className="ml-2 font-normal text-texto-suave tabular-nums">
          {sede.inscritos} dentro
        </span>
      </p>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Comprometido</span>
        <input
          type="number"
          min={0}
          value={base}
          onChange={(e) => setBase(e.target.value)}
          className={`${CLASE_CONTROL} w-[6rem]`}
          aria-label={`Cupos comprometidos en ${sede.nombre}`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Tope</span>
        <input
          type="number"
          min={0}
          value={tope}
          onChange={(e) => setTope(e.target.value)}
          className={`${CLASE_CONTROL} w-[6rem]`}
          aria-label={`Tope de cupos en ${sede.nombre}`}
        />
      </label>

      <button
        onClick={guardar}
        disabled={!cambio || guardando}
        className="sin-aro rounded-lg bg-marca px-3 py-1.5 text-[0.78125rem] font-semibold text-blanco transition disabled:opacity-40"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
