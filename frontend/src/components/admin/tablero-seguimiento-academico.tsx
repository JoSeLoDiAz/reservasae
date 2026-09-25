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

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

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
import { Donut, n } from "./graficos";
import { Aviso } from "./marco-admin";
import { Bloque, CifraCompacta, Encabezado, Esqueleto, Vacio } from "./piezas";

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

/// Las cuatro salidas. Van aparte porque no son un punto del camino:
/// son cuatro maneras de bajarse de él, y mezclarlas con las de arriba
/// haría que la fila no sumara la gente del aula.
const SALIDAS = [
  { clave: "desertaron", etiqueta: "Desertó", etapa: "DESERTO" },
  { clave: "abandonaron", etiqueta: "Abandonó", etapa: "ABANDONO" },
  { clave: "retirados", etiqueta: "Retirado", etapa: "RETIRADO" },
  { clave: "noAprobaron", etiqueta: "No aprobó", etapa: "NO_APROBO" },
] as const;

export function TableroSeguimientoAcademico() {
  const [accionFormacionId, setAccion] = useState(TODOS);
  const [grupoId, setGrupo] = useState(TODOS);

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
    }),
    [accionFormacionId, grupoId],
  );
  const clave = `${accionFormacionId}|${grupoId}`;
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
  const r = datos.resumen;
  if (r.total === 0) {
    return (
      <Vacio titulo="No hay nadie matriculado en este recorte">
        Pruebe con otra acción de formación, o con todos los grupos.
      </Vacio>
    );
  }

  const personas = datos.personas as FilaAcademica[];
  const salidas = r.desertaron + r.abandonaron + r.retirados + r.noAprobaron;

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

  /* ── el embudo: hasta dónde llega la gente ────────────────────── */
  const embudo = columnas.map((c) => {
    /// El divisor es quién TIENE esa actividad, no el total: con dos
    /// temarios distintos a la vista, dividir por todos haría que una
    /// actividad que solo existe en una acción saliera siempre baja.
    const conElla = personas.filter((p) =>
      actividadesDeAccion.get(p.accionFormacionId ?? "—")?.has(c.titulo),
    ).length;
    return { titulo: c.titulo, hechas: general.hechas.get(c.titulo) ?? 0, de: conElla };
  });

  /* ── cómo va cada grupo: el avance medio ──────────────────────── */
  const avance = ordenadas
    .filter((f) => f.total > 0)
    .map((f) => {
      const suyas = personas.filter(
        (p) => (p.accionFormacionId ?? "—") === f.accionId && (p.grupo ?? null) === f.grupo,
      );
      const medio = suyas.reduce((t, p) => t + p.porcentaje, 0) / (suyas.length || 1);
      return { llave: f.llave, codigo: f.codigo, grupo: f.grupo, medio, gente: suyas.length };
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

  const celda = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";

  return (
    <>
      {/* 1 · RESUMEN GENERAL --------------------------------------
          Las tres tiras que antes eran tres bloques con tres bordes:
          lo grueso, dónde está quien sigue dentro, y por qué se fue
          quien ya no está. Siguen siendo renglones distintos --que es
          como las pidió el 23 sep-- pero dentro de una sola caja. */}
      <Bloque titulo="Resumen general">
        <div className="flex flex-wrap gap-2">
          <CifraCompacta etiqueta="Grupos" valor={n(grupoElegido ? 1 : ordenadas.length)} />
          <CifraCompacta etiqueta="Matriculados" valor={n(r.total)} />
          <CifraCompacta
            etiqueta="Siguen en formación"
            valor={n(r.enFormacion)}
            color="var(--exito)"
            detalle={r.total > 0 ? `${Math.round((r.enFormacion / r.total) * 100)} %` : undefined}
          />
          <CifraCompacta
            etiqueta="Salieron del aula"
            valor={n(salidas)}
            color={salidas > 0 ? "var(--error)" : undefined}
            detalle={r.total > 0 ? `${Math.round((salidas / r.total) * 100)} %` : undefined}
          />
        </div>

        {/* LAS SEIS DEL AULA, con su punto de color y su medida: las
            dos pantallas enseñan el mismo reparto y con dos diseños
            distintos parecían dos cosas. */}
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ESTADOS.map((e) => (
            <TarjetaDeEstado key={e.clave} estado={e.estado} valor={r[e.clave]} />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {SALIDAS.map((sa) => (
            <CifraCompacta
              key={sa.clave}
              etiqueta={sa.etiqueta}
              valor={n(r[sa.clave])}
              detalle={r.total > 0 ? `${Math.round((r[sa.clave] / r.total) * 100)} %` : undefined}
            />
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
      </Bloque>

      {/* 3 · LAS DOS GRÁFICAS ------------------------------------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="min-w-0 lg:flex-1">
          <Bloque estirado titulo="Avance por Unidades Temáticas">
            <ul className="space-y-2.5">
              {embudo.map((e) => (
                <li key={e.titulo}>
                  <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="min-w-0 truncate" title={e.titulo}>
                      {e.titulo}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-semibold text-titulo">{n(e.hechas)}</span>
                      <span className="text-[0.75rem] text-texto-suave"> de {n(e.de)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-superficie-alterna">
                    <div
                      className="h-full rounded-full bg-marca"
                      style={{ width: `${e.de > 0 ? (e.hechas / e.de) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Bloque>
        </div>

        <div className="min-w-0 lg:flex-1">
          <Bloque estirado titulo="Avance por Grupo">
            {/* LA TORTA DE LOS GRUPOS (cliente, 25 sep 2026). Es lo
                que un anillo sabe decir y una barra no: cuánto pesa
                cada grupo DENTRO del total. El avance de cada uno
                sigue debajo, en su barra, porque un porcentaje por
                grupo no se puede leer en una tajada. */}
            <Donut
              tamano={168}
              datos={avance.map((g) => ({
                etiqueta: `${g.codigo} · Grupo ${g.grupo ?? "—"}`,
                valor: g.gente,
              }))}
              centro={n(r.total)}
              detalleCentro={r.total === 1 ? "matriculado" : "matriculados"}
              soloDibujo
              vacio="Todavía no hay grupos con gente dentro."
            />
            <ul className="mt-4 space-y-2.5">
              {avance.map((g) => (
                <li key={g.llave}>
                  <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-texto-suave">{g.codigo}</span> Grupo{" "}
                      {g.grupo ?? "—"}
                      <span className="ml-2 text-[0.75rem] text-texto-suave">
                        {n(g.gente)} matriculados
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {Math.round(g.medio)} %
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-superficie-alterna">
                    <div
                      className="h-full rounded-full bg-exito"
                      style={{ width: `${Math.max(g.medio, 1)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Bloque>
        </div>
      </div>

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
          <table className="w-full">
            <thead className="border-b border-borde">
              <tr>
                <Cab>AF</Cab>
                <Cab>Grupo</Cab>
                <Cab derecha>Sin ingreso</Cab>
                <Cab derecha>Sin actividad</Cab>
                {columnas.map((c) => (
                  <Cab key={c.titulo} derecha>
                    {c.titulo}
                  </Cab>
                ))}
                <Cab derecha>Total pax</Cab>
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
                        <td className="px-3 py-1.5 whitespace-nowrap">
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

              <tr className="border-t-2 border-borde font-semibold">
                <td className="px-3 py-1.5" colSpan={2}>
                  Total general
                </td>
                <td className={celda}>{general.sinIngreso}</td>
                <td className={celda}>{general.sinActividad}</td>
                {columnas.map((c) => (
                  <td key={c.titulo} className={celda}>
                    {general.hechas.get(c.titulo) || 0}
                  </td>
                ))}
                <td className={celda}>{general.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Bloque>
    </>
  );
}

function Cab({ children, derecha }: { children: React.ReactNode; derecha?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 align-bottom text-[0.625rem] font-semibold tracking-[0.08em] text-texto-suave uppercase ${
        derecha ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
