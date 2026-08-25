"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  IconoAbajo,
  IconoArriba,
  IconoBuscar,
  IconoCerrar,
  IconoCheck,
  IconoColumnas,
  IconoFiltro,
  IconoGuardar,
  IconoPapelera,
  IconoVista,
} from "./iconos";

/**
 * La tabla de datos del panel: columnas que se eligen,
 * filtro por columna, orden, vistas guardadas y páginas.
 *
 * Filtra y ordena en el navegador sobre las filas que
 * tiene. Cuando el servidor tiene más de las cargadas lo
 * dice en la barra: filtrar sobre una página y callarlo
 * daría un recuento que parece el total y no lo es.
 *
 * La selección se rige por el filtro, no por la página: la
 * casilla de cabecera marca la página y ofrece ampliar a
 * todas las coincidentes, y lo que deja de coincidir se
 * suelta. Un lote sobre filas que ya no se ven asignaría
 * a quien no debía.
 */

export type TipoFiltro = "texto" | "opciones" | "numero";

export type Columna<T> = {
  clave: string;
  titulo: string;
  /** el valor plano: ordena, filtra y se busca */
  valor: (f: T) => string | number | null;
  /** cómo se pinta; si falta, se pinta el valor */
  pinta?: (f: T) => ReactNode;
  filtro?: TipoFiltro;
  /** si faltan, las opciones salen de los datos */
  opciones?: string[];
  numerica?: boolean;
  ancho?: string;
  /** no se puede quitar: identifica la fila */
  fija?: boolean;
  /** existe pero no sale hasta que la pidan */
  aparte?: boolean;
};

type Orden = { clave: string; asc: boolean } | null;

/// Ancho minimo de una columna estirada a mano. Por debajo de
/// esto la cabecera deja de leerse y no sirve de nada.
const ANCHO_MINIMO = 80;

/**
 * El tirador del borde derecho de una columna.
 *
 * Escucha en `window` y no en el propio elemento: si el raton
 * se adelanta al arrastre -- y con una tabla ancha siempre se
 * adelanta -- el evento cae fuera del tirador y el arrastre se
 * corta a mitad de camino.
 */
function TiradorDeAncho({
  titulo,
  alEmpezar,
  alArrastrar,
  alSoltarDobleClic,
}: {
  titulo: string;
  /// Los anchos de todas las columnas, medidos justo antes de
  /// arrastrar. Sin esto la tabla reparte a su gusto.
  alEmpezar: (anchos: Record<string, number>) => void;
  alArrastrar: (px: number) => void;
  alSoltarDobleClic: () => void;
}) {
  function empezar(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    const celda = e.currentTarget.parentElement;
    if (!celda) return;

    const fila = celda.parentElement;
    if (fila) {
      const medidas: Record<string, number> = {};
      for (const th of Array.from(fila.children)) {
        const clave = (th as HTMLElement).dataset.columna;
        if (clave) medidas[clave] = Math.round(th.getBoundingClientRect().width);
      }
      alEmpezar(medidas);
    }

    const desdeX = e.clientX;
    const desdeAncho = celda.getBoundingClientRect().width;

    const mover = (ev: PointerEvent) => {
      alArrastrar(Math.max(ANCHO_MINIMO, Math.round(desdeAncho + ev.clientX - desdeX)));
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    // sin esto el arrastre va seleccionando el texto de la tabla
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }

  return (
    <div
      onPointerDown={empezar}
      onDoubleClick={(e) => {
        e.stopPropagation();
        alSoltarDobleClic();
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Ajustar el ancho de ${titulo}. Doble clic para dejarlo automático.`}
      title="Arrastre para ajustar. Doble clic para dejarlo automático."
      className="absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none select-none hover:bg-marca/30"
    />
  );
}

type Vista = {
  nombre: string;
  visibles: string[];
  filtros: Record<string, string>;
  orden: Orden;
};

type Guardado = {
  visibles?: string[];
  vistas?: Vista[];
  /// Clave de columna -> ancho en px, el que dejo el usuario.
  anchos?: Record<string, number>;
};

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const texto = (v: string | number | null) => (v === null ? "" : String(v));

function leer(id: string): Guardado {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("tabla:" + id) ?? "{}") as Guardado;
  } catch {
    return {};
  }
}

function escribir(id: string, g: Guardado) {
  try {
    localStorage.setItem("tabla:" + id, JSON.stringify(g));
  } catch {
    // sin localStorage la tabla sigue sirviendo
  }
}

export function Tabla<T>({
  id,
  columnas,
  filas,
  clave,
  total,
  porPagina = 50,
  alClic,
  vacio,
  acciones,
  seleccion,
  accionesLote,
  alCargarTodo,
}: {
  id: string;
  columnas: Columna<T>[];
  filas: T[] | null;
  clave: (f: T) => string;
  /** cuántas hay en el servidor, si son más */
  total?: number;
  porPagina?: number;
  alClic?: (f: T) => void;
  vacio?: ReactNode;
  acciones?: ReactNode;
  seleccion?: boolean;
  accionesLote?: (ids: string[], limpiar: () => void) => ReactNode;
  alCargarTodo?: () => void;
}) {
  const porDefecto = useMemo(
    () => columnas.filter((c) => !c.aparte).map((c) => c.clave),
    [columnas],
  );

  const [visibles, setVisibles] = useState<string[]>(porDefecto);
  /// Lo que el usuario estiro a mano. Vacio = el ancho que
  /// decida la tabla sola.
  const [anchos, setAnchos] = useState<Record<string, number>>({});
  const [vistas, setVistas] = useState<Vista[]>([]);
  const [listo, setListo] = useState(false);

  const [buscar, setBuscar] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [orden, setOrden] = useState<Orden>(null);
  const [pagina, setPagina] = useState(1);
  const [panel, setPanel] = useState<"columnas" | "filtros" | "vistas" | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  // localStorage no existe en el servidor: leerlo en el
  // estado inicial rompe la hidratacion
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const g = leer(id);
    if (g.anchos) setAnchos(g.anchos);
    const validas = (g.visibles ?? []).filter((c) =>
      columnas.some((x) => x.clave === c),
    );
    if (validas.length) setVisibles(validas);
    setVistas(g.vistas ?? []);
    setListo(true);
  }, [id, columnas]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (listo) escribir(id, { visibles, vistas, anchos });
  }, [id, visibles, vistas, listo]);

  // al cambiar el filtro se vuelve a la primera pagina.
  // Ajustar el estado durante el render, no en un efecto:
  // asi no hay un pintado intermedio con la pagina mala
  const firma = JSON.stringify([buscar, filtros, orden]);
  const [firmaVista, setFirmaVista] = useState(firma);
  if (firma !== firmaVista) {
    setFirmaVista(firma);
    setPagina(1);
  }

  const enPantalla = useMemo(
    () =>
      visibles
        .map((c) => columnas.find((x) => x.clave === c))
        .filter((c): c is Columna<T> => !!c),
    [visibles, columnas],
  );

  // los valores de cada fila, calculados una vez
  const conValores = useMemo(() => {
    if (!filas) return null;
    return filas.map((f) => {
      const v: Record<string, string | number | null> = {};
      for (const c of columnas) v[c.clave] = c.valor(f);
      return { f, v, id: clave(f) };
    });
  }, [filas, columnas, clave]);

  const opcionesDe = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of columnas) {
      if (c.filtro !== "opciones") continue;
      if (c.opciones) {
        m.set(c.clave, c.opciones);
        continue;
      }
      const vistos = new Set<string>();
      for (const r of conValores ?? []) {
        const t = texto(r.v[c.clave]);
        if (t) vistos.add(t);
      }
      m.set(c.clave, [...vistos].sort((a, b) => a.localeCompare(b, "es")));
    }
    return m;
  }, [columnas, conValores]);

  const filtradas = useMemo(() => {
    if (!conValores) return null;
    const q = sinTildes(buscar.trim());
    const activos = Object.entries(filtros).filter(([, v]) => v !== "");

    let r = conValores.filter(({ v }) => {
      for (const [col, valor] of activos) {
        const def = columnas.find((c) => c.clave === col);
        const celda = texto(v[col]);
        if (def?.filtro === "opciones") {
          if (celda !== valor) return false;
        } else if (def?.filtro === "numero") {
          if (!cumpleNumero(Number(v[col]), valor)) return false;
        } else if (!sinTildes(celda).includes(sinTildes(valor))) return false;
      }
      if (!q) return true;
      // el buscador mira lo que esta a la vista
      return enPantalla.some((c) => sinTildes(texto(v[c.clave])).includes(q));
    });

    if (orden) {
      const def = columnas.find((c) => c.clave === orden.clave);
      const signo = orden.asc ? 1 : -1;
      const o = orden;
      r = [...r].sort((a, b) => {
        const x = a.v[o.clave];
        const y = b.v[o.clave];
        // los vacios al final, se ordene como se ordene
        if (x === null || x === "") return 1;
        if (y === null || y === "") return -1;
        if (def?.numerica) return (Number(x) - Number(y)) * signo;
        return String(x).localeCompare(String(y), "es", { numeric: true }) * signo;
      });
    }
    return r;
  }, [conValores, filtros, buscar, orden, columnas, enPantalla]);

  const paginas = Math.max(1, Math.ceil((filtradas?.length ?? 0) / porPagina));
  const enPagina = filtradas?.slice((pagina - 1) * porPagina, pagina * porPagina) ?? [];

  // lo marcado que sigue coincidiendo
  const vigentes = useMemo(
    () =>
      marcadas.size === 0
        ? []
        : (filtradas ?? []).filter((r) => marcadas.has(r.id)).map((r) => r.id),
    [filtradas, marcadas],
  );

  // un filtro nuevo suelta lo viejo
  const firmaFiltro = JSON.stringify([buscar, filtros]);
  const [firmaMarcas, setFirmaMarcas] = useState(firmaFiltro);
  if (firmaFiltro !== firmaMarcas) {
    setFirmaMarcas(firmaFiltro);
    if (vigentes.length !== marcadas.size) setMarcadas(new Set(vigentes));
  }

  const hayFiltro = buscar !== "" || Object.values(filtros).some((v) => v !== "");
  const chips = Object.entries(filtros).filter(([, v]) => v !== "");

  function limpiar() {
    setBuscar("");
    setFiltros({});
  }

  function mover(clave: string, paso: number) {
    setVisibles((v) => {
      const i = v.indexOf(clave);
      const j = i + paso;
      if (i < 0 || j < 0 || j >= v.length) return v;
      const copia = [...v];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  function alternar(c: Columna<T>) {
    if (c.fija) return;
    setVisibles((v) =>
      v.includes(c.clave) ? v.filter((x) => x !== c.clave) : [...v, c.clave],
    );
  }

  function ordenarPor(c: Columna<T>) {
    setOrden((o) =>
      o?.clave !== c.clave
        ? { clave: c.clave, asc: true }
        : o.asc
          ? { clave: c.clave, asc: false }
          : null,
    );
  }

  const marcadasAqui = enPagina.filter((r) => marcadas.has(r.id)).length;
  const nFiltradas = filtradas?.length ?? 0;
  const paginaEntera = enPagina.length > 0 && marcadasAqui === enPagina.length;
  const todasLasQueCoinciden = nFiltradas > 0 && vigentes.length === nFiltradas;
  // sin filtro puesto, «coinciden» no dice nada
  const cuales = hayFiltro ? "que coinciden con el filtro" : "los leads";
  // hay mas en el servidor sin cargar
  const totalServidor =
    total !== undefined && total > (filas?.length ?? 0) ? total : null;

  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      <Barra
        buscar={buscar}
        setBuscar={setBuscar}
        panel={panel}
        setPanel={setPanel}
        nFiltros={chips.length}
        nColumnas={enPantalla.length}
        acciones={acciones}
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(([col, valor]) => {
            const def = columnas.find((c) => c.clave === col);
            const fuera = !visibles.includes(col);
            return (
              <span
                key={col}
                className="inline-flex items-center gap-1.5 rounded-full border border-marca/30 bg-marca-suave px-2.5 py-1 text-xs"
                title={fuera ? "Su columna está oculta y el filtro sigue puesto" : undefined}
              >
                <strong className="font-medium">{def?.titulo ?? col}</strong>
                <span className="text-texto-suave">{valor}</span>
                {fuera && <span className="text-texto-suave">· oculta</span>}
                <button
                  type="button"
                  onClick={() => setFiltros((f) => ({ ...f, [col]: "" }))}
                  aria-label={"Quitar el filtro de " + (def?.titulo ?? col)}
                  className="opacity-60 hover:opacity-100"
                >
                  <IconoCerrar tamano={12} />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={limpiar}
            className="text-xs text-texto-suave underline hover:text-texto"
          >
            Quitar todos
          </button>
        </div>
      )}

      {panel === "columnas" && (
        <PanelColumnas
          columnas={columnas}
          visibles={visibles}
          alternar={alternar}
          mover={mover}
          restablecer={() => setVisibles(porDefecto)}
          cerrar={() => setPanel(null)}
        />
      )}

      {panel === "vistas" && (
        <PanelVistas
          vistas={vistas}
          setVistas={setVistas}
          actual={{ nombre: "", visibles, filtros, orden }}
          aplicar={(v) => {
            setVisibles(v.visibles.filter((c) => columnas.some((x) => x.clave === c)));
            setFiltros(v.filtros);
            setOrden(v.orden);
            setPanel(null);
          }}
          cerrar={() => setPanel(null)}
        />
      )}

      {seleccion && vigentes.length > 0 && accionesLote && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-marca/30 bg-marca-suave px-4 py-2.5">
          <span className="text-sm font-medium">
            {vigentes.length.toLocaleString("es-CO")}{" "}
            {vigentes.length === 1 ? "seleccionada" : "seleccionadas"}
            <span className="font-normal text-texto-suave">
              {" · "}
              {todasLasQueCoinciden
                ? hayFiltro
                  ? "todas las " + cuales
                  : "todos " + cuales
                : "de " + nFiltradas.toLocaleString("es-CO") + " " + cuales}
            </span>
          </span>

          {/* todas las filtradas, no la pagina */}
          {paginaEntera && nFiltradas > vigentes.length && (
            <button
              type="button"
              onClick={() => setMarcadas(new Set((filtradas ?? []).map((r) => r.id)))}
              className="text-sm font-medium text-marca underline"
            >
              Seleccionar {hayFiltro ? "las" : ""} {nFiltradas.toLocaleString("es-CO")}{" "}
              {hayFiltro ? cuales : "leads"}
            </button>
          )}

          {todasLasQueCoinciden && nFiltradas > enPagina.length && (
            <button
              type="button"
              onClick={() => setMarcadas(new Set(enPagina.map((r) => r.id)))}
              className="text-sm text-texto-suave underline hover:text-texto"
            >
              Solo las {enPagina.length} de esta página
            </button>
          )}

          {todasLasQueCoinciden && totalServidor !== null && (
            <span className="rounded-full bg-aviso-suave px-2.5 py-1 text-xs text-aviso">
              Sobre las {(filas?.length ?? 0).toLocaleString("es-CO")} cargadas de{" "}
              {totalServidor.toLocaleString("es-CO")}
            </span>
          )}

          {accionesLote(vigentes, () => setMarcadas(new Set()))}
          <button
            type="button"
            onClick={() => setMarcadas(new Set())}
            className="ml-auto text-xs text-texto-suave underline"
          >
            Quitar la selección
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-borde bg-superficie shadow-sm">
        {/* Se estira con su contenedor en vez de llevar un tope
            fijo: con `max-h` quedaba media pantalla en blanco
            debajo cuando la ventana era alta. */}
        <div className="caja-scroll min-h-0 flex-1 overflow-auto">
            <table
              className="tabla-datos w-full text-sm"
              style={
                Object.keys(anchos).length > 0
                  ? { tableLayout: "fixed" }
                  : undefined
              }
            >
            <thead className="sticky top-0 z-10">
              <tr>
                {seleccion && (
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar las de esta página"
                      checked={enPagina.length > 0 && marcadasAqui === enPagina.length}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            marcadasAqui > 0 && marcadasAqui < enPagina.length;
                        }
                      }}
                      onChange={(e) => {
                        const poner = e.target.checked;
                        setMarcadas((m) => {
                          const n = new Set(m);
                          for (const r of enPagina) {
                            if (poner) n.add(r.id);
                            else n.delete(r.id);
                          }
                          return n;
                        });
                      }}
                    />
                  </th>
                )}
                {enPantalla.map((c) => (
                  <th
                    key={c.clave}
                    data-columna={c.clave}
                    style={
                      anchos[c.clave]
                        ? { width: anchos[c.clave] }
                        : c.ancho
                          ? { width: c.ancho }
                          : undefined
                    }
                    className={
                      "relative" + (c.numerica ? " text-right" : "")
                    }
                    aria-sort={
                      orden?.clave === c.clave
                        ? orden.asc
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor(c)}
                      className={
                        "inline-flex items-center gap-1 hover:opacity-70 " +
                        (c.numerica ? "flex-row-reverse" : "")
                      }
                    >
                      {c.titulo}
                      {orden?.clave === c.clave &&
                        (orden.asc ? <IconoArriba tamano={13} /> : <IconoAbajo tamano={13} />)}
                    </button>

                    <TiradorDeAncho
                      titulo={c.titulo}
                      alEmpezar={(medidas) =>
                        setAnchos((a) =>
                          Object.keys(a).length > 0 ? a : medidas,
                        )
                      }
                      alArrastrar={(px) =>
                        setAnchos((a) => ({ ...a, [c.clave]: px }))
                      }
                      alSoltarDobleClic={() =>
                        setAnchos((a) => {
                          const resto = { ...a };
                          delete resto[c.clave];
                          return resto;
                        })
                      }
                    />
                  </th>
                ))}
              </tr>
              {panel === "filtros" && (
                <tr className="[&_th]:py-2 [&_th]:normal-case [&_th]:tracking-normal">
                  {seleccion && <th />}
                  {enPantalla.map((c) => (
                    <th key={c.clave}>
                      {c.filtro ? (
                        <CampoFiltro
                          columna={c}
                          valor={filtros[c.clave] ?? ""}
                          opciones={opcionesDe.get(c.clave) ?? []}
                          alCambiar={(v) => setFiltros((f) => ({ ...f, [c.clave]: v }))}
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {enPagina.map(({ f, v, id: fid }) => (
                <tr
                  key={fid}
                  onClick={alClic ? () => alClic(f) : undefined}
                  className={alClic ? "cursor-pointer" : undefined}
                >
                  {seleccion && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Seleccionar esta fila"
                        checked={marcadas.has(fid)}
                        onChange={() =>
                          setMarcadas((m) => {
                            const n = new Set(m);
                            if (n.has(fid)) n.delete(fid);
                            else n.add(fid);
                            return n;
                          })
                        }
                      />
                    </td>
                  )}
                  {enPantalla.map((c) => (
                    <td
                      key={c.clave}
                      className={c.numerica ? "text-right tabular-nums" : undefined}
                    >
                      {c.pinta ? c.pinta(f) : texto(v[c.clave])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtradas !== null && filtradas.length === 0 && (
          <div className="p-10 text-center text-sm text-texto-suave">
            {hayFiltro ? (
              <>
                Nada coincide con lo que buscó.{" "}
                <button type="button" onClick={limpiar} className="underline">
                  Quitar los filtros
                </button>
              </>
            ) : (
              (vacio ?? "Todavía no hay nada aquí.")
            )}
          </div>
        )}

        {filtradas === null && (
          <div className="p-10 text-center text-sm text-texto-suave">Cargando…</div>
        )}
      </div>

      <Pie
        mostradas={enPagina.length}
        filtradas={filtradas?.length ?? 0}
        cargadas={filas?.length ?? 0}
        total={total}
        pagina={pagina}
        paginas={paginas}
        setPagina={setPagina}
        alCargarTodo={alCargarTodo}
      />
    </div>
  );
}

/** Acepta «>10», «<=5», «3-8» o un número suelto. */
function cumpleNumero(n: number, expr: string): boolean {
  if (Number.isNaN(n)) return false;
  const e = expr.replace(/\s/g, "");
  const rango = /^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/.exec(e);
  if (rango) return n >= Number(rango[1]) && n <= Number(rango[2]);
  const comp = /^(>=|<=|>|<|=)?(-?\d+(?:\.\d+)?)$/.exec(e);
  // lo que no se entiende no filtra nada
  if (!comp) return true;
  const v = Number(comp[2]);
  switch (comp[1]) {
    case ">":
      return n > v;
    case ">=":
      return n >= v;
    case "<":
      return n < v;
    case "<=":
      return n <= v;
    default:
      return n === v;
  }
}

function Barra({
  buscar,
  setBuscar,
  panel,
  setPanel,
  nFiltros,
  nColumnas,
  acciones,
}: {
  buscar: string;
  setBuscar: (v: string) => void;
  panel: string | null;
  setPanel: (p: "columnas" | "filtros" | "vistas" | null) => void;
  nFiltros: number;
  nColumnas: number;
  acciones?: ReactNode;
}) {
  const boton = (activo: boolean) =>
    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition " +
    (activo
      ? "border-marca bg-marca-suave text-marca"
      : "border-borde bg-superficie hover:bg-superficie-alterna");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[13rem] flex-1">
        <span className="sr-only">Buscar en la tabla</span>
        <IconoBuscar
          tamano={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave"
        />
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar en lo que está a la vista…"
          className="w-full rounded-xl border border-campo-borde bg-campo-fondo py-2 pl-9 pr-3 text-sm outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25"
        />
      </label>

      <button
        type="button"
        onClick={() => setPanel(panel === "filtros" ? null : "filtros")}
        className={boton(panel === "filtros" || nFiltros > 0)}
      >
        <IconoFiltro tamano={15} />
        Filtros
        {nFiltros > 0 && (
          <span className="rounded-full bg-marca px-1.5 text-xs text-marca-texto">
            {nFiltros}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setPanel(panel === "columnas" ? null : "columnas")}
        className={boton(panel === "columnas")}
      >
        <IconoColumnas tamano={15} />
        Columnas
        <span className="text-texto-suave">{nColumnas}</span>
      </button>

      <button
        type="button"
        onClick={() => setPanel(panel === "vistas" ? null : "vistas")}
        className={boton(panel === "vistas")}
      >
        <IconoVista tamano={15} />
        Vistas
      </button>

      {acciones}
    </div>
  );
}

function CampoFiltro<T>({
  columna,
  valor,
  opciones,
  alCambiar,
}: {
  columna: Columna<T>;
  valor: string;
  opciones: string[];
  alCambiar: (v: string) => void;
}) {
  const clases =
    "w-full min-w-[6rem] rounded-lg border border-campo-borde bg-campo-fondo px-2 py-1 text-xs font-normal text-texto outline-none focus:border-campo-foco";

  if (columna.filtro === "opciones") {
    return (
      <select
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className={clases}
        aria-label={"Filtrar por " + columna.titulo}
      >
        <option value="">Todas</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      placeholder={columna.filtro === "numero" ? ">10, 3-8…" : "contiene…"}
      className={clases}
      aria-label={"Filtrar por " + columna.titulo}
    />
  );
}

function PanelColumnas<T>({
  columnas,
  visibles,
  alternar,
  mover,
  restablecer,
  cerrar,
}: {
  columnas: Columna<T>[];
  visibles: string[];
  alternar: (c: Columna<T>) => void;
  mover: (clave: string, paso: number) => void;
  restablecer: () => void;
  cerrar: () => void;
}) {
  const puestas = visibles
    .map((c) => columnas.find((x) => x.clave === c))
    .filter((c): c is Columna<T> => !!c);
  const fuera = columnas.filter((c) => !visibles.includes(c.clave));

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Qué columnas se ven</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={restablecer}
            className="text-xs text-texto-suave underline"
          >
            Como venía
          </button>
          <button type="button" onClick={cerrar} aria-label="Cerrar">
            <IconoCerrar tamano={16} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-suave">
            A la vista · en este orden
          </p>
          <ul className="space-y-1">
            {puestas.map((c, i) => (
              <li
                key={c.clave}
                className="flex items-center gap-2 rounded-lg border border-borde px-2.5 py-1.5 text-sm"
              >
                <span className="flex-1 truncate">{c.titulo}</span>
                <button
                  type="button"
                  onClick={() => mover(c.clave, -1)}
                  disabled={i === 0}
                  aria-label={"Subir " + c.titulo}
                  className="opacity-60 hover:opacity-100 disabled:opacity-20"
                >
                  <IconoArriba tamano={14} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(c.clave, 1)}
                  disabled={i === puestas.length - 1}
                  aria-label={"Bajar " + c.titulo}
                  className="opacity-60 hover:opacity-100 disabled:opacity-20"
                >
                  <IconoAbajo tamano={14} />
                </button>
                <button
                  type="button"
                  onClick={() => alternar(c)}
                  disabled={c.fija}
                  aria-label={c.fija ? c.titulo + " no se puede quitar" : "Quitar " + c.titulo}
                  title={c.fija ? "Sin ella no se sabe de quién es la fila" : undefined}
                  className="opacity-60 hover:opacity-100 disabled:opacity-20"
                >
                  <IconoCerrar tamano={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-suave">
            Disponibles · {fuera.length}
          </p>
          {fuera.length === 0 ? (
            <p className="text-sm text-texto-suave">Están todas puestas.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {fuera.map((c) => (
                <li key={c.clave}>
                  <button
                    type="button"
                    onClick={() => alternar(c)}
                    className="rounded-lg border border-borde px-2.5 py-1.5 text-sm transition hover:border-marca hover:bg-marca-suave"
                  >
                    + {c.titulo}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelVistas({
  vistas,
  setVistas,
  actual,
  aplicar,
  cerrar,
}: {
  vistas: Vista[];
  setVistas: (v: Vista[]) => void;
  actual: Vista;
  aplicar: (v: Vista) => void;
  cerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) return;
    setVistas([...vistas.filter((v) => v.nombre !== n), { ...actual, nombre: n }]);
    setNombre("");
    campo.current?.blur();
  }

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Vistas guardadas</h3>
        <button type="button" onClick={cerrar} aria-label="Cerrar">
          <IconoCerrar tamano={16} />
        </button>
      </div>

      <p className="mb-3 text-xs text-texto-suave">
        Una vista guarda las columnas, su orden y los filtros. Queda en este
        navegador: es su forma de mirar, no la de todos.
      </p>

      {vistas.length > 0 && (
        <ul className="mb-3 space-y-1">
          {vistas.map((v) => {
            const n = Object.values(v.filtros).filter(Boolean).length;
            return (
              <li key={v.nombre} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => aplicar(v)}
                  className="flex flex-1 items-center gap-2 rounded-lg border border-borde px-2.5 py-1.5 text-left text-sm transition hover:border-marca hover:bg-marca-suave"
                >
                  <IconoCheck tamano={14} className="text-texto-suave" />
                  <span className="flex-1 truncate">{v.nombre}</span>
                  <span className="text-xs text-texto-suave">
                    {v.visibles.length} columnas
                    {n > 0 && " · " + n + (n === 1 ? " filtro" : " filtros")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setVistas(vistas.filter((x) => x.nombre !== v.nombre))}
                  aria-label={"Borrar la vista " + v.nombre}
                  className="opacity-60 hover:opacity-100"
                >
                  <IconoPapelera tamano={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={guardar} className="flex gap-2">
        <input
          ref={campo}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Guardar como… (p. ej. «Mis leads sin contactar»)"
          className="flex-1 rounded-lg border border-campo-borde bg-campo-fondo px-2.5 py-1.5 text-sm outline-none focus:border-campo-foco"
        />
        <button
          type="submit"
          disabled={!nombre.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3 py-1.5 text-sm text-marca-texto disabled:opacity-40"
        >
          <IconoGuardar tamano={15} />
          Guardar
        </button>
      </form>
    </div>
  );
}

function Pie({
  mostradas,
  filtradas,
  cargadas,
  total,
  pagina,
  paginas,
  setPagina,
  alCargarTodo,
}: {
  mostradas: number;
  filtradas: number;
  cargadas: number;
  total?: number;
  pagina: number;
  paginas: number;
  setPagina: (n: number) => void;
  alCargarTodo?: () => void;
}) {
  const faltan = total !== undefined && total > cargadas;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-texto-suave">
      <span>
        {mostradas > 0 && (
          <>
            <strong className="font-medium text-texto">
              {filtradas.toLocaleString("es-CO")}
            </strong>{" "}
            {filtradas === 1 ? "fila" : "filas"}
            {filtradas !== cargadas && " de " + cargadas.toLocaleString("es-CO")}
          </>
        )}
      </span>

      {faltan && (
        <span className="rounded-full bg-aviso-suave px-2.5 py-1 text-aviso">
          Filtrando sobre {cargadas.toLocaleString("es-CO")} de{" "}
          {total.toLocaleString("es-CO")}
          {alCargarTodo && (
            <button type="button" onClick={alCargarTodo} className="ml-1.5 underline">
              cargar todas
            </button>
          )}
        </span>
      )}

      {paginas > 1 && (
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPagina(pagina - 1)}
            disabled={pagina === 1}
            className="rounded-lg border border-borde px-2 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            {pagina} de {paginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina(pagina + 1)}
            disabled={pagina === paginas}
            className="rounded-lg border border-borde px-2 py-1 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
