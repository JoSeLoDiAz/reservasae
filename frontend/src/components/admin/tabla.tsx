"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

/// Los tamaños de página que se ofrecen. Sin 200 ni 500: a
/// partir de ahí la tabla pesa más de lo que ayuda, y para
/// llevarse todo está «Descargar en Excel».
const TAMANOS = [10, 25, 50, 100];

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

/// Por debajo de esto no fue un arrastre, fue un clic.
const HOLGURA_DEL_CLIC = 3;

/// Lo que se espera antes de dar un clic por sencillo. Es el
/// mismo respiro que usa el sistema para distinguirlo del
/// doble.
const ESPERA_DOBLE_CLIC = 250;

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
  alto,
  alEmpezar,
  alArrastrar,
  alSoltarDobleClic,
}: {
  titulo: string;
  /// El alto de la tabla entera, medido. La linea baja hasta
  /// la ultima fila y no mas: pasarse deja una raya flotando
  /// sobre el blanco de la tarjeta.
  alto: number | null;
  /// Los anchos de todas las columnas, medidos justo antes de
  /// arrastrar. Sin esto la tabla reparte a su gusto.
  alEmpezar: (anchos: Record<string, number>) => void;
  alArrastrar: (px: number) => void;
  alSoltarDobleClic: () => void;
}) {
  /// Un clic pendiente de saber si era doble.
  const clicPendiente = useRef<ReturnType<typeof setTimeout> | null>(null);

  function empezar(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    const tirador = e.currentTarget;
    const celda = tirador.parentElement;
    if (!celda) return;

    // se miden ANTES de tocar nada, pero no se aplican
    // todavia: si esto acaba siendo un clic y no un arrastre,
    // la tabla no tiene por que quedarse con los anchos
    // congelados
    const fila = celda.parentElement;
    const medidas: Record<string, number> = {};
    if (fila) {
      for (const th of Array.from(fila.children)) {
        const clave = (th as HTMLElement).dataset.columna;
        if (clave) medidas[clave] = Math.round(th.getBoundingClientRect().width);
      }
    }

    const desdeX = e.clientX;
    const desdeAncho = celda.getBoundingClientRect().width;
    let arrastro = false;

    const mover = (ev: PointerEvent) => {
      // tres pixeles de holgura: la mano tiembla al pulsar, y
      // sin margen cualquier clic contaria como arrastre
      if (!arrastro) {
        if (Math.abs(ev.clientX - desdeX) < HOLGURA_DEL_CLIC) return;
        arrastro = true;
        if (fila) alEmpezar(medidas);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }
      alArrastrar(Math.max(ANCHO_MINIMO, Math.round(desdeAncho + ev.clientX - desdeX)));
    };

    const soltar = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (arrastro) return;

      /// No arrastro: entonces era un clic, y ese clic no es
      /// suyo.
      ///
      /// La linea baja por toda la tabla, asi que se pone
      /// delante de veinte columnas de filas que SI se pueden
      /// pulsar para abrir el lead. Sin esto, el cinco por
      /// ciento del ancho de la tabla queda muerto: uno pulsa
      /// sobre una fila, justo en el borde entre dos columnas,
      /// y no pasa nada.
      ///
      /// Se aparta un momento para ver que hay debajo y se le
      /// pasa el clic. Con un respiro antes, por si venia un
      /// segundo clic: el doble clic es suyo y lo cancela.
      // solo puede haber UNO en cola. Un doble clic suelta
      // dos veces, y sin esto el primero se colaba: el
      // cancelar de mas abajo solo alcanzaba al segundo
      if (clicPendiente.current) clearTimeout(clicPendiente.current);

      clicPendiente.current = setTimeout(() => {
        clicPendiente.current = null;
        tirador.style.pointerEvents = "none";
        const debajo = document.elementFromPoint(ev.clientX, ev.clientY);
        tirador.style.pointerEvents = "";
        debajo?.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            clientX: ev.clientX,
            clientY: ev.clientY,
          }),
        );
      }, ESPERA_DOBLE_CLIC);
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }

  return (
    <div
      onPointerDown={empezar}
      onDoubleClick={(e) => {
        e.stopPropagation();
        // el clic que estaba en cola era la primera mitad de
        // este doble clic: no debe llegar a la fila
        if (clicPendiente.current) {
          clearTimeout(clicPendiente.current);
          clicPendiente.current = null;
        }
        alSoltarDobleClic();
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Ajustar el ancho de ${titulo}. Doble clic para que todas las columnas vuelvan a ajustarse solas.`}
      title="Arrastre para ajustar. Doble clic: todas vuelven a automático."
      style={{ height: alto ?? "100%" }}
      /// Baja por toda la tabla, no solo por la cabecera.
      ///
      /// El borde entre dos columnas se agarra donde uno lo
      /// tenga delante: en la fila catorce, sin subir hasta el
      /// titulo. Es como se ajusta una hoja de calculo, y es
      /// lo que la mano espera.
      ///
      /// `top-0` cuelga de la cabecera, que va pegada arriba;
      /// asi la linea acompana el desplazamiento sin calcular
      /// nada. El contenedor la recorta, y por eso puede
      /// medir mas de lo que se ve.
      ///
      /// Ocho pixeles: la banda justa del borde, donde no hay
      /// texto que pulsar. Se ve solo al acercarse.
      className="absolute top-0 right-0 z-20 w-2 cursor-col-resize touch-none select-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-transparent hover:before:bg-marca"
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
  sinDescarga,
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
  /** La pantalla ya trae su propia descarga, del servidor. */
  sinDescarga?: boolean;
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

  /**
   * Cuántas filas por página, elegible y recordado.
   *
   * Antes era fijo. Quien revisa de a poquitos quiere 10 y
   * quien barre una lista entera quiere 100; obligarlos a los
   * dos al mismo número hace que uno de ellos pagine veinte
   * veces. Se recuerda por tabla: la de leads y la de
   * empresas no se usan igual.
   */
  const [tamano, setTamano] = useState(porPagina);

  useEffect(() => {
    try {
      const guardado = Number(
        window.localStorage.getItem(`tabla:${id}:porPagina`),
      );
      if (TAMANOS.includes(guardado)) setTamano(guardado);
    } catch {
      // navegador sin almacenamiento: se queda con el de por defecto
    }
  }, [id]);

  function cambiarTamano(n: number) {
    setTamano(n);
    // a la primera: la página 7 de 10 no existe si ahora hay 3
    setPagina(1);
    try {
      window.localStorage.setItem(`tabla:${id}:porPagina`, String(n));
    } catch {
      // no poder recordarlo no es motivo para no cambiarlo
    }
  }
  const [panel, setPanel] = useState<"columnas" | "filtros" | "vistas" | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  /// El alto de la tabla, para que la linea de ajustar el
  /// ancho baje hasta la ultima fila y pare ahi.
  ///
  /// Se engancha con un ref de funcion y no con un efecto:
  /// la tabla no existe hasta que hay filas, y un efecto con
  /// lista de dependencias vacia correria antes de tiempo y
  /// no volveria a mirar. Asi el observador se pone justo
  /// cuando el elemento aparece y se quita cuando se va.
  const observador = useRef<ResizeObserver | null>(null);
  const [altoTabla, setAltoTabla] = useState<number | null>(null);

  const tablaRef = useCallback((el: HTMLTableElement | null) => {
    observador.current?.disconnect();
    observador.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    setAltoTabla(el.offsetHeight);
    observador.current = new ResizeObserver(() => setAltoTabla(el.offsetHeight));
    observador.current.observe(el);
  }, []);

  // localStorage no existe en el servidor: leerlo en el
  // estado inicial rompe la hidratacion
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const g = leer(id);
    /// Lo guardado se limpia al leerlo.
    ///
    /// La clave no distingue el tamaño de pantalla: unos
    /// anchos ajustados en un monitor grande se restauraban
    /// tal cual en un portátil. Y si una columna dejó de
    /// existir, su ancho seguía sumando. Ahora se descartan
    /// las que ya no están y ninguna baja del mínimo legible.
    if (g.anchos) {
      setAnchos(
        Object.fromEntries(
          Object.entries(g.anchos)
            .filter(([c]) => columnas.some((x) => x.clave === c))
            .map(([c, px]) => [c, Math.max(ANCHO_MINIMO, Math.round(px))]),
        ),
      );
    }
    const validas = (g.visibles ?? []).filter((c) =>
      columnas.some((x) => x.clave === c),
    );
    if (validas.length) setVisibles(validas);
    setVistas(g.vistas ?? []);
    setListo(true);
  }, [id, columnas]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /// `anchos` va en las dependencias, y esa es la corrección.
  ///
  /// Se guardaba en el objeto pero no estaba en la lista, así
  /// que estirar una columna no disparaba el efecto: el ancho
  /// se veía en pantalla y se perdía al recargar. Solo
  /// quedaba grabado si uno tocaba después Columnas o Vistas,
  /// que sí disparan. Por eso parecía que a veces se acordaba
  /// y a veces no.
  useEffect(() => {
    if (listo) escribir(id, { visibles, vistas, anchos });
  }, [id, visibles, vistas, anchos, listo]);

  // al cambiar el filtro se vuelve a la primera pagina.
  // Ajustar el estado durante el render, no en un efecto:
  // asi no hay un pintado intermedio con la pagina mala
  const firma = JSON.stringify([buscar, filtros, orden]);
  const [firmaVista, setFirmaVista] = useState(firma);
  if (firma !== firmaVista) {
    setFirmaVista(firma);
    setPagina(1);
  }

  /// Lo que pide una columna para que su título se lea en
  /// dos renglones. Menos que esto y vuelve el problema.
  const ANCHO_COMODO = 150;

  const enPantalla = useMemo(
    () =>
      visibles
        .map((c) => columnas.find((x) => x.clave === c))
        .filter((c): c is Columna<T> => !!c),
    [visibles, columnas],
  );

  /// La suma de lo que piden las columnas visibles.
  ///
  /// Si el usuario ajustó una a mano, manda su ancho: lo
  /// arrastró él y respetarlo es lo mínimo. Las demás piden
  /// lo cómodo.
  const anchoMinimoTabla = useMemo(
    () =>
      enPantalla.reduce(
        (suma, c) => suma + (anchos[c.clave] ?? c.ancho ?? ANCHO_COMODO),
        seleccion ? 40 : 0,
      ),
    [enPantalla, anchos, seleccion],
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

  const paginas = Math.max(1, Math.ceil((filtradas?.length ?? 0) / tamano));
  const enPagina = filtradas?.slice((pagina - 1) * tamano, pagina * tamano) ?? [];

  /// Si al filtrar quedan menos páginas de las que había, la
  /// que se estaba viendo puede no existir: se vuelve a la
  /// última que sí. Sin esto la tabla queda en blanco y
  /// parece que el filtro no encontró nada.
  useEffect(() => {
    if (pagina > paginas) setPagina(paginas);
  }, [pagina, paginas]);

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
  // sin filtro no dice nada
  const cuales = hayFiltro ? "que coinciden con el filtro" : "los leads";
  // hay mas en el servidor sin cargar
  const totalServidor =
    total !== undefined && total > (filas?.length ?? 0) ? total : null;

  return (
    <div className="flex min-h-0 grow flex-col gap-2">
      <Barra
        buscar={buscar}
        setBuscar={setBuscar}
        panel={panel}
        setPanel={setPanel}
        nFiltros={chips.length}
        nColumnas={enPantalla.length}
        acciones={acciones}
        alDescargar={
          sinDescarga || !filtradas || filtradas.length === 0
            ? undefined
            : () => bajarCsv(id, enPantalla, filtradas)
        }
      />

      {/* La paginación va ARRIBA, con los botones.
          Abajo obligaba a bajar toda la tabla para cambiar de
          página o de tamaño, y con cincuenta filas eso son dos
          pantallas de rueda para volver a subir. Aquí está
          donde se decide qué se está mirando. */}
      <Pie
        mostradas={enPagina.length}
        filtradas={filtradas?.length ?? 0}
        cargadas={filas?.length ?? 0}
        total={total}
        pagina={pagina}
        paginas={paginas}
        setPagina={setPagina}
        tamano={tamano}
        setTamano={cambiarTamano}
        alCargarTodo={alCargarTodo}
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
            <span className="whitespace-nowrap font-semibold text-xs text-aviso">
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

      {/* La tabla se queda con el alto que sobre y scrollea por
          dentro. Para que esto funcione, la pantalla que la use
          tiene que ser `flex min-h-0 grow flex-col`: si es un
          bloque normal, la tabla crece sin límite, la página
          entera se va hacia arriba al bajar, y hay que
          devolverse hasta arriba para poder filtrar. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-borde bg-superficie">
        {/* Se estira con su contenedor en vez de llevar un tope
            fijo: con `max-h` quedaba media pantalla en blanco
            debajo cuando la ventana era alta. */}
        {/* `overscroll-contain`: al llegar al final de la tabla, la
            rueda del ratón NO sigue empujando la página. Sin esto
            uno terminaba de bajar las filas y de un tirón se iba
            toda la pantalla, dejando media ventana en blanco y los
            filtros arriba fuera de alcance. */}
        <div className="caja-scroll min-h-0 flex-1 overflow-auto overscroll-contain">
            <table
              ref={tablaRef}
              /// Los carriles verticales solo cuando hay muchas
              /// columnas.
              ///
              /// Con 22 el ojo salta en horizontal y necesita el
              /// carril para saber en cual va. Con cinco o seis
              /// no aporta nada y ensucia: son rayas que no
              /// separan nada que no separara ya el espacio.
              className={`tabla-datos w-full text-sm${
                enPantalla.length > 8 ? " con-carriles" : ""
              }`}
              style={{
                /// El suelo de la tabla entera.
                ///
                /// `w-full` sola dice «ocupa lo que haya», y
                /// con veinte columnas eso es repartir el
                /// ancho de la ventana entre veinte: a 45 px
                /// cada una. Con este mínimo, cuando no caben
                /// la tabla se DESBORDA y el contenedor de
                /// arriba —que ya tiene `overflow-auto`— la
                /// deja recorrer en horizontal, que es lo que
                /// uno espera de una tabla ancha.
                ///
                /// Con pocas columnas el mínimo es menor que
                /// la tarjeta, gana `w-full` y sigue
                /// llenándola como hasta ahora.
                minWidth: anchoMinimoTabla,
                ...(Object.keys(anchos).length > 0
                  ? { tableLayout: "fixed" as const }
                  : null),
              }}
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
                      alto={altoTabla}
                      alEmpezar={(medidas) =>
                        setAnchos((a) =>
                          Object.keys(a).length > 0 ? a : medidas,
                        )
                      }
                      alArrastrar={(px) =>
                        setAnchos((a) => ({ ...a, [c.clave]: px }))
                      }
                      /// Doble clic: TODAS vuelven a
                      /// automatico, no solo esta.
                      ///
                      /// Soltar una sola dejaba a la tabla en
                      /// `fixed` con el resto clavado, y la
                      /// recien soltada se quedaba con las
                      /// migajas de ancho que sobraran. En vez
                      /// de ajustarse, se aplastaba.
                      ///
                      /// Vaciando el mapa entero la tabla
                      /// vuelve a repartir sola, que es lo
                      /// unico que de verdad «ajusta todas».
                      /// Y es la salida de emergencia cuando
                      /// uno dejo los anchos hechos un lio.
                      alSoltarDobleClic={() => setAnchos({})
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
  alDescargar,
}: {
  buscar: string;
  setBuscar: (v: string) => void;
  panel: string | null;
  setPanel: (p: "columnas" | "filtros" | "vistas" | null) => void;
  nFiltros: number;
  nColumnas: number;
  acciones?: ReactNode;
  alDescargar?: () => void;
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

      {alDescargar && (
        <button
          type="button"
          onClick={alDescargar}
          className="rounded-xl bg-marca px-4 py-2 text-sm font-medium text-marca-texto transition hover:bg-marca-fuerte"
        >
          Descargar en Excel
        </button>
      )}

      {acciones}
    </div>
  );
}

/**
 * Baja a Excel lo que se está viendo.
 *
 * Lo que se está viendo, literalmente: las filas que pasaron
 * el filtro y las columnas que están puestas, en el orden en
 * que se ven. Bajar «todo» cuando la pantalla enseña un
 * recorte obliga a filtrar otra vez en Excel, que es de donde
 * uno venía huyendo.
 *
 * Va con punto y coma y con BOM porque el Excel en español
 * abre la coma como separador decimal: con comas, «1,5» se
 * parte en dos celdas y las tildes salen rotas.
 */
function bajarCsv<T>(
  nombre: string,
  columnas: Columna<T>[],
  /// Los valores ya calculados: la tabla los tiene desde que
  /// filtra y ordena, y volver a llamar a `valor()` por cada
  /// celda repetiría ese trabajo para nada.
  filas: Array<{ v: Record<string, string | number | null> }>,
) {
  const escapar = (v: string | number | null) => {
    const t = v === null || v === undefined ? "" : String(v);
    // comilla doble dentro se duplica, que es como lo lee Excel
    return `"${t.replace(/"/g, '""')}"`;
  };

  const lineas = [
    columnas.map((c) => escapar(c.titulo)).join(";"),
    ...filas.map((f) => columnas.map((c) => escapar(f.v[c.clave])).join(";")),
  ];

  // El BOM (U+FEFF) va delante: sin el, Excel abre el
  // archivo en la codificacion del sistema y se come las
  // tildes. Se escribe por codigo y no como caracter para
  // que no se pierda al copiar el archivo de un lado a otro.
  const BOM = String.fromCharCode(0xfeff);
  const SALTO = String.fromCharCode(13, 10);

  const blob = new Blob([BOM + lineas.join(SALTO)], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
    <div className="rounded-2xl border border-borde bg-superficie p-4">
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
    <div className="rounded-2xl border border-borde bg-superficie p-4">
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

/// Un botón de paginar. Los cinco iguales, para que la fila no
/// parezca cinco cosas distintas.
function BotonPagina({
  alPulsar,
  apagado,
  titulo,
  children,
}: {
  alPulsar: () => void;
  apagado: boolean;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      disabled={apagado}
      title={titulo}
      aria-label={titulo}
      className="rounded-lg border border-borde px-2 py-1 transition hover:bg-superficie-alterna disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
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
  tamano,
  setTamano,
  alCargarTodo,
}: {
  mostradas: number;
  filtradas: number;
  cargadas: number;
  total?: number;
  pagina: number;
  paginas: number;
  setPagina: (n: number) => void;
  tamano: number;
  setTamano: (n: number) => void;
  alCargarTodo?: () => void;
}) {
  const faltan = total !== undefined && total > cargadas;
  /// Cuántas quedaron atrás: es lo que convierte «25 filas» en
  /// «Mostrando 26–50».
  const desde = (pagina - 1) * tamano;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-texto-suave">
      {/* Corto: «26–50 / 175».

          Decía «Mostrando 26–50 de 175», que es la misma
          información en el triple de ancho. Arriba, al lado de
          los botones, ese ancho es sitio que le quita a la
          tabla; y quien mira una paginación entiende la barra
          sin que se lo expliquen. */}
      <span className="tabular-nums">
        {mostradas > 0 && (
          <>
            <strong className="font-medium text-texto">
              {(desde + 1).toLocaleString("es-CO")}–
              {(desde + mostradas).toLocaleString("es-CO")}
            </strong>
            {" / "}
            <strong className="font-medium text-texto">
              {filtradas.toLocaleString("es-CO")}
            </strong>
            {filtradas !== cargadas &&
              ` (de ${cargadas.toLocaleString("es-CO")})`}
          </>
        )}
      </span>

      {faltan && (
        <span className="whitespace-nowrap font-semibold text-aviso">
          Filtrando sobre {cargadas.toLocaleString("es-CO")} de{" "}
          {total.toLocaleString("es-CO")}
          {alCargarTodo && (
            <button type="button" onClick={alCargarTodo} className="ml-1.5 underline">
              cargar todas
            </button>
          )}
        </span>
      )}

      {/* El selector se ve siempre, aunque hoy quepa todo en una
          página: es lo que deja BAJAR a 10 cuando hay 40 filas y
          uno quiere revisarlas de a poquitos. Escondiéndolo
          cuando `paginas === 1` no habría forma de llegar a él. */}
      {filtradas > 0 && (
        <label className="flex items-center gap-2">
          <span>Por página:</span>
          <select
            value={tamano}
            onChange={(e) => setTamano(Number(e.target.value))}
            aria-label="Cuántas filas por página"
            className="rounded-lg border border-borde bg-superficie px-2 py-1 text-xs"
          >
            {TAMANOS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      {paginas > 1 && (
        <div className="ml-auto flex items-center gap-1.5">
          <BotonPagina
            alPulsar={() => setPagina(1)}
            apagado={pagina === 1}
            titulo="Primera página"
          >
            «
          </BotonPagina>
          <BotonPagina
            alPulsar={() => setPagina(pagina - 1)}
            apagado={pagina === 1}
            titulo="Página anterior"
          >
            Anterior
          </BotonPagina>

          <span className="px-1 tabular-nums">
            <strong className="font-medium text-texto">{pagina}</strong> de{" "}
            {paginas.toLocaleString("es-CO")}
          </span>

          <BotonPagina
            alPulsar={() => setPagina(pagina + 1)}
            apagado={pagina === paginas}
            titulo="Página siguiente"
          >
            Siguiente
          </BotonPagina>
          <BotonPagina
            alPulsar={() => setPagina(paginas)}
            apagado={pagina === paginas}
            titulo="Última página"
          >
            »
          </BotonPagina>
        </div>
      )}
    </div>
  );
}
