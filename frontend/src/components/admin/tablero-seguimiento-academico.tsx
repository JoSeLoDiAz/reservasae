"use client";

/** Seguimiento académico: el resumen del aula, sin nombres. */

/**
 * LO QUE PIDIÓ EL CLIENTE EL 23 DE SEPTIEMBRE DE 2026, con sus palabras:
 *
 *   «Filtro: acción de formación, grupos (individual o todo).
 *    Resumen: 1. acción de formación (seleccionable), 2. número de
 *    grupos, 3. total de beneficiarios por grupo matriculados,
 *    4. estados de cada uno de los participantes (general o por grupo).
 *    IMPORTANTE: no mostrar las personas, sino los resúmenes o
 *    cantidades».
 *
 * NO SE PINTA UNA SOLA FILA CON NOMBRE, y eso manda sobre todo lo
 * demás: esta pantalla es para mirar cómo va el proyecto en una
 * reunión, y una lista de quinientas personas con su documento
 * encima de la mesa es un problema de tratamiento de datos que nadie
 * pidió. Quien necesita a la persona entra por «Seguimiento del
 * aula», que es la pantalla de trabajo.
 *
 * SALE DEL MISMO SITIO QUE EL AULA --`crmApi.academico`--, a
 * propósito. Con una consulta propia, las dos pantallas darían cifras
 * parecidas y distintas, que es lo primero que hace desconfiar de un
 * panel. Las personas llegan y se cuentan aquí; no se enseñan.
 *
 * LOS ESTADOS LOS MANDA EL LMS. El asesor no los toca: lo suyo queda
 * en sus notas. Por eso aquí no hay ningún botón que cambie nada.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  crmApi,
  ETIQUETA_ACADEMICA,
  type Academico,
  type EstadoAcademico,
  type FilaAcademica,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";
import { tablerosApi } from "@/lib/tableros-api";

import { Desplegable } from "./desplegable";
import { colorEtapa } from "./etapa";
import {
  FiltroDePeriodo,
  PERIODO_INICIAL,
  ventanaDe,
  type Periodo,
} from "./filtro-de-periodo";
import { Donut, n, SERIE } from "./graficos";
import { Aviso } from "./marco-admin";
import { Bloque, Encabezado, Esqueleto, Vacio } from "./piezas";
import { TiradorDeAncho } from "./tabla";

/// «AF1 · GESTIÓN DE LA ATENCIÓN…» llega en un solo texto, y el nombre
/// entero son noventa letras que se comen la primera columna de la
/// tabla. Aquí solo hace falta el código: el nombre ya está arriba, en
/// el desplegable y en la tarjeta de la acción elegida.
const soloElCodigo = (accion: string | null) =>
  accion ? (accion.split("·")[0]?.trim() ?? accion) : null;

/// TODOS es una opción de verdad y no «sin filtro»: el cliente lo dijo
/// así --«grupos (individual o todo)»-- y con el desplegable en blanco
/// nadie sabe si está viendo todo o si se le olvidó elegir.
const TODOS = "";

/**
 * Los seis del aula, EXACTAMENTE LAS TARJETAS DE «Seguimiento del
 * aula» (cliente, 25 sep 2026: «dejemos las mismas tarjetas»).
 *
 * El rótulo sale de `ETIQUETA_ACADEMICA` y el color de `colorEtapa`,
 * los dos compartidos con aquella pantalla: copiar los textos a mano
 * es cómo se acaba con «Sin empezar» aquí y «Sin actividades» allá,
 * que fue justo lo que pasó.
 *
 * En el orden del recorrido y no por tamaño: del que no entró al que
 * ya terminó, para que la fila se lea como un camino.
 */
const ESTADOS: Array<{ clave: keyof Academico["resumen"]; estado: EstadoAcademico }> = [
  { clave: "sinIngreso", estado: "SIN_INGRESO" },
  { clave: "sinEmpezar", estado: "SIN_EMPEZAR" },
  { clave: "atrasados", estado: "ATRASADO" },
  { clave: "alDia", estado: "AL_DIA" },
  { clave: "completados", estado: "COMPLETADO" },
  { clave: "certificados", estado: "CERTIFICADO" },
];

/**
 * Los colores de la torta, y el porqué de pasarlos a mano.
 *
 * El `Donut` los reparte solo si no se los dan, pero entonces esta
 * pantalla no sabría cuál le tocó a cada grupo y el punto de la lista
 * de abajo no podría casar con su tajada. Pasándolos, las dos mitades
 * del bloque salen del mismo sitio.
 *
 * SON TRES Y SE REPITEN CADA TRES GRUPOS. No estorba porque el color
 * aquí no distingue él solo: distingue el PAR color + posición, y la
 * lista va en el mismo orden en que se dibujan las tajadas.
 */
const CICLO = [SERIE.uno, SERIE.dos, SERIE.tres];

const COLOR_ESTADO: Record<EstadoAcademico, string> = {
  SIN_INGRESO: colorEtapa("PERDIDO"),
  SIN_EMPEZAR: colorEtapa("CONTACTADO"),
  ATRASADO: colorEtapa("EN_FORMACION"),
  AL_DIA: colorEtapa("CERTIFICADO"),
  COMPLETADO: colorEtapa("INSCRITO"),
  CERTIFICADO: colorEtapa("CERTIFICADO"),
};

/** La tarjeta del aula: punto de color, rótulo y cifra. */
function TarjetaDeEstado({ estado, valor }: { estado: EstadoAcademico; valor: number }) {
  return (
    <div
      style={{ ["--etapa"]: COLOR_ESTADO[estado] } as React.CSSProperties}
      className="rounded-lg border border-borde bg-superficie px-3.5 py-2 text-left transition hover:border-marca/40 hover:shadow-[0_2px_14px_-6px_rgba(15,23,42,0.28)]"
    >
      <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
        <span className="punto-etapa" aria-hidden />
        <span className="truncate text-texto-suave">{ETIQUETA_ACADEMICA[estado]}</span>
      </span>
      <span className="mt-1 block text-[1.0625rem] leading-none font-bold tabular-nums">
        {n(valor)}
      </span>
    </div>
  );
}

export function TableroSeguimientoAcademico() {
  const [accionFormacionId, setAccion] = useState(TODOS);
  const [grupoId, setGrupo] = useState(TODOS);

  /// EL PERIODO, con el control compartido de los demás tableros: es el
  /// mismo dato ---cuándo llegó la persona--- y escribirlo aquí otra vez
  /// es cómo se acaba con cinco filtros que contestan distinto. Arranca
  /// en «TODO» para que la pantalla siga abriendo con todo, que es lo
  /// que ya hacía.
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL);

  /**
   * Los cupos apartados de cada acción, para poder decir «142 de 160».
   *
   * SALEN DEL INFORME DE RESERVAS, que es de donde salen en Control de
   * Reservas: el aula sabe cuánta gente hay dentro, no cuántos cupos
   * se apartaron. Contarlos por mi cuenta daría una tercera cifra
   * parecida a las otras dos.
   *
   * Se pide UNA VEZ y sin recorte: es un catálogo, no una cifra de la
   * pantalla, y con el filtro puesto devolvería solo la acción elegida
   * --y al soltarlo habría que volver a pedirlo--. Si falla, la
   * pantalla se pinta igual con lo matriculado: el aula no depende de
   * las reservas para tener sentido.
   */
  /**
   * EL AULA SIN NINGÚN CORTE, para la lista de acciones.
   *
   * Con una acción elegida el servidor devuelve solo esa, así que la
   * lista se quedaría con una entrada y no habría desde dónde pulsar
   * la siguiente ---el mismo defecto que ya costó una vuelta en los
   * desplegables de Control de Reservas---. Se pide una vez.
   */
  const [catalogo, setCatalogo] = useState<Academico | null>(null);
  useEffect(() => {
    let vigente = true;
    crmApi.academico({}).then(
      (c) => {
        if (vigente) setCatalogo(c);
      },
      () => {
        // sin catálogo, la lista sale del recorte; se nota al filtrar
      },
    );
    return () => {
      vigente = false;
    };
  }, []);

  const [cuposPorAccion, setCupos] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    let vigente = true;
    tablerosApi.informeReservas({}).then(
      (i) => {
        if (!vigente) return;
        setCupos(new Map(i.porAccion.map((a) => [a.accionFormacionId, a.cuposConfirmados])));
      },
      () => {
        // sin cupos, las barras se quedan con lo matriculado
      },
    );
    return () => {
      vigente = false;
    };
  }, []);

  const filtros = useMemo(
    () => ({
      accionFormacionId: accionFormacionId || undefined,
      grupoId: grupoId || undefined,
      /// Con «TODO» esto no añade nada ---devuelve `{}`---, así que la
      /// llamada sale igual que antes de que existiera el filtro.
      ...ventanaDe(periodo),
    }),
    [accionFormacionId, grupoId, periodo],
  );
  /// El periodo entra en la clave POR SUS TRES CAMPOS y no por la
  /// ventana ya calculada: las fechas de `ventanaDe` se mueven con el
  /// reloj, y una clave que cambia sola vuelve a pedir los datos sin que
  /// nadie haya tocado nada.
  const clave = `${accionFormacionId}|${grupoId}|${periodo.rango}|${periodo.desde}|${periodo.hasta}`;
  const cargar = useCallback(() => crmApi.academico(filtros), [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const vivos = useDatosVivos<Academico>(cargar, { clave: `tablero-academico:${clave}` });

  /// El catálogo sale de la MISMA respuesta, así que al elegir una
  /// acción el desplegable de grupos se queda solo con los suyos sin
  /// pedir nada más. Y los grupos se recortan a mano por si la
  /// respuesta trae los de todas.
  const acciones = vivos.datos?.acciones ?? [];
  const grupos = (vivos.datos?.grupos ?? []).filter(
    (g) => !accionFormacionId || g.accionFormacionId === accionFormacionId,
  );

  /// NO HACE FALTA SOLTAR EL GRUPO A MANO: el desplegable de la acción
  /// ya lo hace al cambiar (`alElegir`). Estuvo aquí como red de
  /// seguridad, primero suelto en el render y después en un efecto, y
  /// las dos formas son un cambio de estado durante el pintado: React
  /// lo canta en la consola y el linter lo rechaza. Una red que no
  /// atrapa nada y ensucia la consola no es una red.


  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6 [&>header]:mx-0 [&>header]:mb-0">
      <Encabezado compacto titulo="Seguimiento académico" />

      {/* LOS DOS FILTROS, con la MISMA tarjeta que «Control de
          Reservas»: `px-4 py-3 sm:py-3.5`. Estuvo en `px-7` para que su
          texto empezara donde el del título, y con eso dejaba de
          parecerse a la pantalla que sirve de referencia. Entre las dos
          cosas manda parecerse. */}
      <div className="rounded-xl border border-borde bg-superficie px-4 py-3 sm:py-3.5">
        <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Filtros
        </p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}
        >
          <Desplegable
            alto={34}
            marcador="Acción de formación"
            etiquetaAria="Acción de formación"
            valor={accionFormacionId}
            opciones={[
              { valor: TODOS, etiqueta: "Todas las acciones" },
              ...acciones.map((a) => ({
                valor: a.id,
                etiqueta: `${a.codigo} · ${a.nombre}`,
              })),
            ]}
            alElegir={(v) => {
              setAccion(v);
              setGrupo(TODOS);
            }}
          />
          <Desplegable
            alto={34}
            marcador="Grupos"
            etiquetaAria="Grupo"
            valor={grupoId}
            opciones={[
              { valor: TODOS, etiqueta: "Todos los grupos" },
              ...grupos.map((g) => ({ valor: g.id, etiqueta: `Grupo ${g.numero}` })),
            ]}
            alElegir={setGrupo}
          />
          {/* EL PERIODO, EN LA MISMA REJILLA que los dos desplegables:
              es un filtro más de esta tarjeta y en una caja aparte se
              leería como si recortara otra cosa.

              SIN `alComparar`: este tablero no sabe comparar todavía, y
              un enlace que no hace nada al pulsarlo es peor que no
              tenerlo. */}
          <FiltroDePeriodo periodo={periodo} alCambiar={setPeriodo} />
        </div>
      </div>

      {vivos.error && <Aviso tipo="error">{vivos.error}</Aviso>}
      {!vivos.datos && !vivos.error && <Esqueleto />}

      {vivos.datos && (
        <Cuerpo
          datos={vivos.datos}
          catalogo={catalogo}
          grupoElegido={grupoId}
          accionElegida={accionFormacionId}
          /// Pulsar la que ya está puesta la suelta: es la única
          /// puerta de salida que se prueba sola. Y suelta el grupo,
          /// como hace el desplegable de arriba.
          alElegirAccion={(id) => {
            setAccion((v) => (v === id ? TODOS : id));
            setGrupo(TODOS);
          }}
          cuposPorAccion={cuposPorAccion}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   EL CUERPO
   ══════════════════════════════════════════════════════════════════ */

/**
 * «Evocar el mismo diseño de Control de inscritos, pero sin tanta
 * cosa» (cliente, 25 sep 2026). De ahí salen las cuatro piezas y su
 * orden: resumen, cupos contra inscritos, dos gráficas y la tabla que
 * él dibujó.
 *
 * ANTES ERAN CUATRO BLOQUES QUE DECÍAN LO MISMO TRES VECES: una tira
 * de cifras, «Estado LMS», «Causales de Retiro» y una tabla de
 * matriculados por grupo. Los tres primeros son el mismo dato --dónde
 * está la gente-- partido en tres cajas con tres bordes, y el cuarto
 * es la última columna de la tabla que él pidió.
 */
function Cuerpo({
  datos,
  catalogo,
  grupoElegido,
  accionElegida,
  alElegirAccion,
  cuposPorAccion,
}: {
  datos: Academico;
  /**
   * El aula SIN NINGÚN CORTE, para la lista de acciones.
   *
   * No puede salir de `datos`: con una acción elegida, el servidor
   * devuelve solo esa, la lista se queda con una entrada y no habría
   * desde dónde pulsar la siguiente. Es la misma regla que ya siguen
   * los desplegables de Control de Reservas, y el mismo defecto que
   * ya costó una vuelta allí.
   */
  catalogo: Academico | null;
  grupoElegido: string;
  accionElegida: string;
  alElegirAccion: (id: string) => void;
  /// Nulo mientras no llega, o si falló: la pantalla se pinta igual y
  /// las barras se quedan con lo matriculado. El aula no depende del
  /// informe de reservas para tener sentido.
  cuposPorAccion: Map<string, number> | null;
}) {
  /// LOS HOOKS, ANTES DE CUALQUIER `return`.
  ///
  /// Estaban más abajo, junto a la tabla que los usa, y eso los
  /// dejaba detrás del «no hay nadie matriculado»: el día que el
  /// filtro se queda sin gente, React llama a tres hooks menos y
  /// se le descuadra el orden para siempre. Aquí arriba se llaman
  /// siempre, salga la tabla o no.
  /// AJUSTAR EL ANCHO DE LAS COLUMNAS, arrastrando el borde.
  ///
  /// Vacío = cada columna mide por su contenido. En cuanto se toca
  /// una, se congelan todas ---medidas como estaban--- y la tabla
  /// pasa a `fixed`: si no, mover una columna reparte el sobrante
  /// entre las demás y se mueven solas. Doble clic las suelta.
  const [anchos, setAnchos] = useState<Record<string, number>>({});

  /// El alto de la tabla, para que la línea del tirador baje hasta
  /// la última fila y pare ahí. Con un ref de función, como en
  /// `Tabla`: la tabla no existe hasta que hay filas.
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

  const r = datos.resumen;
  if (r.total === 0) {
    return (
      <Vacio titulo="No hay nadie matriculado en este recorte">
        Pruebe con otra acción de formación, o con todos los grupos.
      </Vacio>
    );
  }

  const personas = datos.personas as FilaAcademica[];

  /* ── las columnas de actividad ──────────────────────────────────
     Salen de la gente que llegó y no de un catálogo: así la tabla
     enseña las actividades del recorte que se está mirando y no las
     de cursos que aquí no salen. En el orden del curso --`orden`--,
     porque la tabla es un camino y no un ranking. */
  const actividades = new Map<string, { orden: number; titulo: string }>();
  /// Qué actividades tiene CADA ACCIÓN: dos acciones no llevan el
  /// mismo temario, y una celda vacía no es lo mismo que un cero.
  const actividadesDeAccion = new Map<string, Set<string>>();
  for (const p of personas) {
    const clave = p.accionFormacionId ?? "—";
    const suyas = actividadesDeAccion.get(clave) ?? new Set<string>();
    for (const a of p.actividades) {
      if (!actividades.has(a.titulo)) {
        actividades.set(a.titulo, { orden: a.orden, titulo: a.titulo });
      }
      suyas.add(a.titulo);
    }
    actividadesDeAccion.set(clave, suyas);
  }
  const columnas = [...actividades.values()].sort(
    (a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo),
  );

  /* ── una fila por grupo ─────────────────────────────────────────
     Los grupos salen del catálogo y no de la gente: un grupo abierto
     sin nadie matriculado es justo lo que hay que ver, y contando
     solo a los que llegaron desaparecería de la tabla. */
  type Fila = {
    llave: string;
    accionId: string;
    codigo: string;
    grupo: number | null;
    sinIngreso: number;
    sinActividad: number;
    hechas: Map<string, number>;
    total: number;
  };
  const nuevaFila = (accionId: string, codigo: string, grupo: number | null): Fila => ({
    llave: `${accionId}|${grupo ?? "—"}`,
    accionId,
    codigo,
    grupo,
    sinIngreso: 0,
    sinActividad: 0,
    hechas: new Map(),
    total: 0,
  });

  const filas = new Map<string, Fila>();
  const codigoDeAccion = new Map(datos.acciones.map((a) => [a.id, a.codigo]));
  for (const g of datos.grupos) {
    if (grupoElegido && g.id !== grupoElegido) continue;
    /// EL SERVIDOR MANDA TODOS LOS GRUPOS, también con una acción
    /// elegida ---el desplegable de arriba los recorta por su cuenta,
    /// por eso no se había notado---. Sin este corte, al pulsar una
    /// acción la tabla seguía con las quince filas y las siete de las
    /// otras acciones salían en cero: se lee como que el filtro no
    /// hizo nada.
    if (accionElegida && (g.accionFormacionId ?? "—") !== accionElegida) continue;
    const accionId = g.accionFormacionId ?? "—";
    const f = nuevaFila(accionId, codigoDeAccion.get(accionId) ?? "—", g.numero);
    filas.set(f.llave, f);
  }
  for (const p of personas) {
    const accionId = p.accionFormacionId ?? "—";
    const llave = `${accionId}|${p.grupo ?? "—"}`;
    const f =
      filas.get(llave) ??
      nuevaFila(accionId, codigoDeAccion.get(accionId) ?? soloElCodigo(p.accion) ?? "—", p.grupo);
    filas.set(llave, f);
    f.total += 1;
    if (p.estado === "SIN_INGRESO") f.sinIngreso += 1;
    if (p.estado === "SIN_EMPEZAR") f.sinActividad += 1;
    for (const a of p.actividades) {
      if (a.completada) f.hechas.set(a.titulo, (f.hechas.get(a.titulo) ?? 0) + 1);
    }
  }

  /// EL DESEMPATE ES EL ID DE LA ACCIÓN Y NO SOLO EL CÓDIGO, y sin
  /// él la tabla salía con «Total AF1» dos y tres veces. Cada código
  /// existe DOS VECES --uno por gremio, y no significan lo mismo--,
  /// así que ordenando solo por código las filas de las dos acciones
  /// se intercalan y las tandas se parten en trozos.
  const ordenadas = [...filas.values()].sort(
    (a, b) =>
      a.codigo.localeCompare(b.codigo) ||
      a.accionId.localeCompare(b.accionId) ||
      (a.grupo ?? 0) - (b.grupo ?? 0),
  );

  /// Qué códigos están repartidos entre dos acciones DE LAS QUE SE
  /// ESTÁN VIENDO. Solo esos llevan el nombre detrás: con un gremio
  /// solo a la vista, repetirlo en cada fila es ruido.
  const porCodigo = new Map<string, Set<string>>();
  for (const f of ordenadas) {
    const s = porCodigo.get(f.codigo) ?? new Set<string>();
    s.add(f.accionId);
    porCodigo.set(f.codigo, s);
  }
  const nombreDeAccion = new Map(datos.acciones.map((a) => [a.id, a.nombre]));
  const ambiguo = (codigo: string) => (porCodigo.get(codigo)?.size ?? 0) > 1;

  /// Agrupadas por acción para poder cerrar cada tanda con su total,
  /// que es como la dibujó: «TOTAL AF» debajo de sus ocho grupos.
  const porAccion: Array<{ accionId: string; codigo: string; filas: Fila[] }> = [];
  for (const f of ordenadas) {
    const ultima = porAccion[porAccion.length - 1];
    if (ultima && ultima.accionId === f.accionId) ultima.filas.push(f);
    else porAccion.push({ accionId: f.accionId, codigo: f.codigo, filas: [f] });
  }

  const sumar = (fs: Fila[]): Fila => {
    const t = nuevaFila("", "", null);
    for (const f of fs) {
      t.total += f.total;
      t.sinIngreso += f.sinIngreso;
      t.sinActividad += f.sinActividad;
      for (const [k, v] of f.hechas) t.hechas.set(k, (t.hechas.get(k) ?? 0) + v);
    }
    return t;
  };
  const general = sumar(ordenadas);

  /// El rótulo de un grupo, en UN solo sitio: lo piden la tajada de
  /// la torta y el renglón de la lista, y escrito dos veces es como
  /// se acaba con una leyenda que no dice lo mismo que su dibujo.
  /// LO QUE IDENTIFICA, DELANTE; el nombre de la acción, al final.
  ///
  /// La leyenda del anillo corta por la derecha, y con el nombre por
  /// delante ---noventa letras--- todas las líneas salían iguales:
  /// «AF2 · ARQUITECTURA FINANCIERA: VISUALIZACION PREDICTIVA Y…» y ni
  /// el grupo ni el avance se veían. Puesto al final, lo que se come
  /// la tijera es lo único que sobra; el rótulo entero sigue en el
  /// `title`.
  ///
  /// Y el nombre solo va cuando hace falta: con un gremio a la vista
  /// los códigos no se repiten y repetirlo en treinta líneas es ruido.
  const rotuloDeGrupo = (g: {
    codigo: string;
    grupo: number | null;
    accionId: string;
    medio: number;
  }) =>
    `${g.codigo} Grupo ${g.grupo ?? "—"} · avance ${Math.round(g.medio)} %` +
    (ambiguo(g.codigo) ? ` · ${nombreDeAccion.get(g.accionId) ?? ""}` : "");

  /* ── cómo va cada grupo: el avance medio ──────────────────────── */
  const avance = ordenadas
    .filter((f) => f.total > 0)
    .map((f) => {
      const suyas = personas.filter(
        (p) => (p.accionFormacionId ?? "—") === f.accionId && (p.grupo ?? null) === f.grupo,
      );
      const medio = suyas.reduce((t, p) => t + p.porcentaje, 0) / (suyas.length || 1);
      return {
        llave: f.llave,
        codigo: f.codigo,
        accionId: f.accionId,
        grupo: f.grupo,
        medio,
        gente: suyas.length,
      };
    })
    .sort((a, b) => b.medio - a.medio);

  /* ── cupos contra inscritos ───────────────────────────────────── */
  /// De la lista completa, no del recorte: ver arriba, en `catalogo`.
  const base = catalogo ?? datos;
  const inscritosPorAccion = new Map<string, number>();
  for (const p of base.personas as FilaAcademica[]) {
    const k = p.accionFormacionId ?? "—";
    inscritosPorAccion.set(k, (inscritosPorAccion.get(k) ?? 0) + 1);
  }
  const accionesConCifras = base.acciones
    .map((a) => ({
      id: a.id,
      codigo: a.codigo,
      nombre: a.nombre,
      inscritos: inscritosPorAccion.get(a.id) ?? 0,
      cupos: cuposPorAccion?.get(a.id) ?? null,
    }))
    .filter((a) => a.inscritos > 0 || (a.cupos ?? 0) > 0)
    .sort((a, b) => Math.max(b.cupos ?? 0, b.inscritos) - Math.max(a.cupos ?? 0, a.inscritos));
  const topeCupos = Math.max(
    1,
    ...accionesConCifras.map((a) => Math.max(a.cupos ?? 0, a.inscritos)),
  );

  /// Lo que cada rótulo necesita para dejarse ajustar. En un solo
  /// sitio: son seis llamadas y repetir cinco props en cada una es
  /// como se acaba con una columna que no se puede mover.
  const ajuste = (clave: string) => ({
    clave,
    ancho: anchos[clave],
    alto: altoTabla,
    alEmpezar: (medidas: Record<string, number>) => setAnchos(medidas),
    alArrastrar: (px: number) => setAnchos((v) => ({ ...v, [clave]: px })),
    alSoltarDobleClic: () => setAnchos({}),
  });

  /// Centradas, como sus rótulos: una cifra a la derecha bajo un
  /// rótulo centrado se lee descolgada de su columna.
  const celda = "px-3 py-1.5 text-center tabular-nums whitespace-nowrap";

  return (
    <>
      {/* 1 · RESUMEN GENERAL --------------------------------------
          Las tres tiras que antes eran tres bloques con tres bordes:
          lo grueso, dónde está quien sigue dentro, y por qué se fue
          quien ya no está. Siguen siendo renglones distintos --que es
          como las pidió el 23 sep-- pero dentro de una sola caja. */}
      {/* LAS SEIS DEL AULA Y NADA MÁS.

          «Dejemos las mismas tarjetas de Seguimiento del aula» era
          eso y solo eso: las seis. Yo entendí «añade las seis» y
          dejé CATORCE --cuatro de resumen, las seis, y las cuatro
          causales--: «este chorrero no son las tarjetas que te digo»
          (cliente, 25 sep 2026).

          NO SE PIERDE NADA. Los matriculados están en el centro de la
          torta, los grupos son las filas de la tabla, y las cuatro
          causales se leen restando: quien no está en uno de los seis
          estados salió del aula. Catorce cifras para decir eso es lo
          que hacía que no se leyera ninguna. */}
      <Bloque titulo="Resumen general">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ESTADOS.map((e) => (
            <TarjetaDeEstado key={e.clave} estado={e.estado} valor={r[e.clave]} />
          ))}
        </div>
      </Bloque>

      {/* 2 · CUPOS E INSCRITOS POR ACCIÓN -------------------------- */}
      {/* «ACCIONES DE FORMACIÓN» y no «Cupos e inscritos por acción»
          (cliente, 25 sep 2026). Es el nombre de lo que la lista ES;
          los cupos y los inscritos son lo que enseña de cada una, y
          eso ya se lee en la propia fila.

          Y CADA FILA AMARRA EL FILTRO: «si clickea una, esto amarra
          los filtros, funciona algo similar a Gestión de reservas».
          Pulsar una acción es lo mismo que elegirla en el desplegable
          de arriba, así que las cuatro piezas de la pantalla se
          recortan a la vez. Volver a pulsarla lo suelta.

          `imprimible`: en papel, globals.css esconde todo `button`
          que no la lleve, y sin ella esta lista salía en blanco. */}

      {/* 3 · LAS ACCIONES Y SUS GRUPOS, EN UNA SOLA CAJA ----------

          «Fusiona Acciones de Formación y Avance por Grupo: arriba
          las acciones, abajo el avance» (cliente, 26 sep 2026).

          Y tiene sentido leerlas juntas: la lista de arriba es el
          filtro ---se pulsa una acción y todo se recorta--- y el
          anillo de abajo es lo que queda dentro de esa elección.
          Separadas en dos cajas, la de la derecha parecía otra cosa
          en vez de la consecuencia de la de la izquierda. */}
      <Bloque titulo="Acciones de Formación">
          <ul className="space-y-2.5">
            {accionesConCifras.map((a) => {
              const tope = Math.max(a.cupos ?? 0, a.inscritos);
              const suya = accionElegida === a.id;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => alElegirAccion(a.id)}
                    aria-pressed={suya}
                    className={`imprimible -mx-2 block w-full rounded-lg px-2 py-1 text-left transition hover:bg-superficie-alterna ${
                      suya ? "bg-marca-suave" : ""
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3 text-[0.8125rem] leading-snug">
                      <span
                        className={`min-w-0 truncate ${suya ? "font-semibold text-marca-fuerte" : ""}`}
                        title={a.nombre}
                      >
                        <span className="font-mono text-xs font-normal text-texto-suave">
                          {a.codigo}
                        </span>{" "}
                        {a.nombre}
                      </span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums">
                        <span className="font-semibold text-titulo">{n(a.inscritos)}</span>
                        {a.cupos !== null && (
                          <span className="text-[0.75rem] text-texto-suave"> de {n(a.cupos)}</span>
                        )}
                      </span>
                    </span>
                    {/* La verde DENTRO de la gris: los matriculados son
                        una parte de los cupos apartados, no una cantidad
                        que se le sume. */}
                    <span className="mt-1 block h-2.5 w-full overflow-hidden rounded-full bg-superficie-alterna">
                      <span
                        className="block h-full rounded-full bg-marca/25"
                        style={{ width: `${Math.max((tope / topeCupos) * 100, 1)}%` }}
                      >
                        <span
                          className="block h-full rounded-full bg-exito"
                          style={{ width: `${tope > 0 ? (a.inscritos / tope) * 100 : 0}%` }}
                        />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

        {/* ABAJO, EL AVANCE POR GRUPO. Lleva rótulo propio aunque
            comparta caja: sin él, el anillo quedaría colgando de
            «Acciones de Formación», que es otra cosa. */}
        <div className="mt-4 border-t border-borde pt-4">
          <p className="mb-3 text-[0.8125rem] font-semibold text-titulo">
            Avance por Grupo
          </p>
            {/* EL ANILLO CON SU LEYENDA AL LADO, como el de «Datos
                completos» que él señaló (25 sep 2026: «así no, como la
                segunda captura»).

                Estuvo con `soloDibujo` y una lista de barras debajo:
                con treinta y un grupos eran sesenta y dos renglones
                para decir lo que la leyenda dice en treinta y uno, y
                el anillo quedaba arriba, suelto, sin nada que lo
                explicara al lado.

                EL AVANCE VA EN EL RÓTULO de cada tajada. La cifra de
                la derecha es lo que el anillo reparte ---cuánto pesa
                ese grupo en el total---, y el avance es otra cosa: si
                no se dice cuál es cuál, dos porcentajes en la misma
                línea no se pueden leer. */}
            <Donut
              tamano={188}
              datos={avance.map((g, i) => ({
                etiqueta: rotuloDeGrupo(g),
                valor: g.gente,
                color: CICLO[i % CICLO.length],
              }))}
              /// Sin `centro`: el anillo pone la suma de sus tajadas,
              /// que es la única cifra que no puede contradecirlas.
              /// Pasándole `resumen.total` decía 420 y dibujaba 300.
              detalleCentro="matriculados"
              vacio="Todavía no hay grupos con participantes."
            />
        </div>
      </Bloque>

      {/* 4 · LA TABLA QUE DIBUJÓ ---------------------------------- */}
      <Bloque
        sinRelleno
        partible
        titulo="Consolidado Avance Acción de Formación"
        descripcion={
          accionElegida
            ? nombreDeAccion.get(accionElegida)
            : "Todas las acciones. Pulse una arriba para quedarse solo con ella."
        }
      >
        <div className="caja-scroll overflow-x-auto">
          {/* OCUPA EL ANCHO, PERO REPARTIENDO PAREJO.

              Aquí se probaron los dos extremos y los dos se ven mal.
              Con `w-full` y reparto automático, el sobrante se va a
              la columna del rótulo más largo: «AF» quedaba como una
              franja vacía. Midiendo solo por contenido, la tabla se
              queda corta y deja media pantalla en blanco a la
              derecha ---«visualmente se ve fatal» (cliente, 27 sep
              2026)---.

              `table-fixed` es el que hace las dos cosas: ocupa todo
              el ancho Y reparte a partes iguales, sin mirar lo largo
              que sea cada rótulo. Los porcentajes de `Cab` son lo
              único que se sale del reparto: el código de la acción y
              el grupo llevan texto y las demás llevan una cifra de
              dos dígitos.

              EN PORCENTAJE Y NO EN PÍXELES, para que escale: la misma
              tabla tiene que servir en un portátil y en una pantalla
              de 1.920. Y arrastrar una columna sigue funcionando
              encima de esto ---el px que se fija manda sobre su
              porcentaje---.

              LO QUE ERA: cada columna medía lo suyo.

              Estirarla obliga a que alguna columna se trague el
              sobrante, y en 1.600 px son cientos de píxeles: con el
              filtro en una sola acción, «AF» quedaba como una franja
              vacía con un «AF2» flotando en mitad ---«¿pero qué es
              eso?» (cliente, 26 sep 2026)---. Midiendo por contenido
              no hay sobrante que repartir y las trece columnas salen
              parejas. El `overflow-x-auto` de fuera responde cuando
              no cabe, que es lo que ya hacía.

              CON CUADRÍCULA, como «Cupos e inscritos por acción»
              (cliente, 26 sep 2026: «con líneas de separación como
              control de inscritos»). Trece columnas de cifras sin
              raya vertical se leen en diagonal. */}
          <table
            ref={tablaRef}
            className="tabla-cuadricula w-full table-fixed"
          >
            <thead className="border-b border-borde">
              <tr>
                {/* EL COLOR VA POR LO QUE MIDE LA COLUMNA, no por
                    adorno: en ámbar lo que va mal ---quien no entró y
                    quien entró y no hizo nada---, en el color de la
                    casa el avance por unidad, en verde el cierre y en
                    negro el total, que no es avance sino cuánta gente
                    hay. La misma lectura que las tarjetas de arriba. */}
                <Cab parte="18%" {...ajuste("af")}>
                  AF
                </Cab>
                <Cab parte="8%" {...ajuste("grupo")}>
                  Grupo
                </Cab>
                <Cab {...ajuste("sinIngreso")} tono="text-aviso">
                  Sin ingreso
                </Cab>
                <Cab {...ajuste("sinActividad")} tono="text-aviso">
                  Sin actividad
                </Cab>
                {columnas.map((c) => (
                  <Cab
                    key={c.titulo}
                    {...ajuste(c.titulo)}
                    tono={/eval/i.test(c.titulo) ? "text-exito" : "text-marca"}
                  >
                    {c.titulo}
                  </Cab>
                ))}
                <Cab {...ajuste("total")} tono="text-titulo">
                  Total pax
                </Cab>
              </tr>
            </thead>
            <tbody>
              {porAccion.map((tanda, i) => {
                const t = sumar(tanda.filas);
                /// La banda alterna separa una acción de la siguiente
                /// sin meter una fila de título por medio. Él las
                /// pintó de verde y rosa; aquí va el tono de la casa,
                /// que es el mismo recurso sin inventarse una paleta.
                const banda = i % 2 === 1 ? "bg-superficie-alterna/50" : "";
                return (
                  <Fragment key={tanda.accionId}>
                    {tanda.filas.map((f) => (
                      <tr key={f.llave} className={`border-b border-hairline ${banda}`}>
                        {/* `truncate`: con ancho fijo, un nombre
                            largo se salía de su celda por encima de
                            la raya de la siguiente. */}
                        <td className="truncate px-3 py-1.5 whitespace-nowrap">
                          <span className="font-mono text-xs text-texto-suave">{f.codigo}</span>
                          {ambiguo(f.codigo) && (
                            <span
                              className="ml-2 inline-block max-w-40 truncate align-bottom text-[0.6875rem] text-texto-suave"
                              title={nombreDeAccion.get(f.accionId) ?? ""}
                            >
                              {nombreDeAccion.get(f.accionId) ?? ""}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">G{f.grupo ?? "—"}</td>
                        <td className={celda}>{f.sinIngreso || ""}</td>
                        <td className={celda}>{f.sinActividad || ""}</td>
                        {columnas.map((c) => (
                          <td key={c.titulo} className={celda}>
                            {actividadesDeAccion.get(f.accionId)?.has(c.titulo)
                              ? f.hechas.get(c.titulo) || 0
                              : "—"}
                          </td>
                        ))}
                        <td className={`${celda} font-semibold`}>{f.total}</td>
                      </tr>
                    ))}
                    <tr className={`border-b border-borde font-semibold ${banda}`}>
                      <td className="px-3 py-1.5 whitespace-nowrap" colSpan={2}>
                        Total {tanda.codigo}
                        {ambiguo(tanda.codigo) && (
                          <span
                            className="ml-2 inline-block max-w-40 truncate align-bottom text-[0.6875rem] font-normal text-texto-suave"
                            title={nombreDeAccion.get(tanda.accionId) ?? ""}
                          >
                            {nombreDeAccion.get(tanda.accionId) ?? ""}
                          </span>
                        )}
                      </td>
                      <td className={celda}>{t.sinIngreso}</td>
                      <td className={celda}>{t.sinActividad}</td>
                      {columnas.map((c) => (
                        <td key={c.titulo} className={celda}>
                          {actividadesDeAccion.get(tanda.accionId)?.has(c.titulo)
                            ? t.hechas.get(c.titulo) || 0
                            : "—"}
                        </td>
                      ))}
                      <td className={celda}>{t.total}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Bloque>
    </>
  );
}

/**
 * Un rótulo de la cabecera.
 *
 * CENTRADO Y CON COLOR (cliente, 26 sep 2026: «color en los títulos:
 * títulos y textos y centrados»). El color no es adorno: dice de qué
 * es cada columna sin subir la vista, que es el mismo motivo por el
 * que Control de inscritos colorea sus separaciones.
 */
function Cab({
  children,
  tono = "text-texto-suave",
  parte,
  clave,
  ancho,
  alto,
  alEmpezar,
  alArrastrar,
  alSoltarDobleClic,
}: {
  children: React.ReactNode;
  tono?: string;
  /// Su parte del ancho, en porcentaje. Sin ella, `table-fixed` le
  /// da la parte que sobra a partes iguales, que es lo que quieren
  /// las columnas de cifras.
  parte?: string;
  clave: string;
  ancho?: number;
  alto: number | null;
  alEmpezar: (medidas: Record<string, number>) => void;
  alArrastrar: (px: number) => void;
  alSoltarDobleClic: () => void;
}) {
  return (
    <th
      scope="col"
      data-columna={clave}
      /// El px del arrastre manda sobre el porcentaje: quien mueve
      /// una columna a mano espera que se quede donde la dejó.
      style={ancho ? { width: ancho } : parte ? { width: parte } : undefined}
      className={`relative px-3 py-2 text-center align-bottom text-[0.625rem] font-semibold tracking-[0.08em] uppercase ${tono}`}
    >
      {children}
      {/* EL MISMO TIRADOR QUE GESTIÓN DE LEADS. Se agarra el borde
          derecho de la columna, en la cabecera o a la altura de
          cualquier fila, y se arrastra. Doble clic y todas vuelven a
          ajustarse solas. */}
      <TiradorDeAncho
        titulo={typeof children === "string" ? children : clave}
        alto={alto}
        alEmpezar={alEmpezar}
        alArrastrar={alArrastrar}
        alSoltarDobleClic={alSoltarDobleClic}
      />
    </th>
  );
}
