"use client";

/**
 * «Reservas»: el informe de Control de Inscritos › Informes.
 *
 * De dónde viene: el cliente armaba a mano en Google Sheets una
 * hoja «RESERVAS ADECOPRIA» con dos tablas --cuántas reservas por
 * acción de formación, y cuántas por organización dentro de cada
 * acción-- y la imprimía. Pidió verla aquí detrás del botón «Ver
 * reservas» del bloque «Cupos apartados por empresas» (cliente, 21
 * sep 2026).
 *
 * EL ORDEN ES: CIFRAS, GRÁFICAS, TABLA. La primera versión seguía la
 * hoja --total, tabla por acción con barras al lado, tabla por
 * organización de 3.600 px y la línea acumulada al final-- y el
 * cliente la devolvió: «No entiendo nada Reservas. Se ve tantas
 * tablas … las gráficas arriba, tablas abajo» (21 sep 2026). Así que:
 *
 *   1. las cuatro cifras, con el gremio dicho en el título;
 *   2. dos gráficas que se leen solas: a quién pedirle nombres y
 *      cuándo se apartaron los cupos, por semana;
 *   3. UNA tabla por acción, con las organizaciones de cada acción
 *      DENTRO y cerradas. En papel salen abiertas: el PDF lleva las
 *      dos tablas de su hoja en una.
 *
 * Debajo de la tabla, nada: una gráfica al final es la que no se ve.
 *
 * Todo sale de UNA respuesta (`tablerosApi.informeReservas`). Con
 * una por tabla, cada cambio de filtro disparaba esperas distintas y
 * durante un segundo se veía media pantalla nueva y media vieja.
 *
 * Ni un rótulo ni un número del PDF está escrito aquí: el título del
 * papel sale de las siglas del recorte. Su AF1 no es el AF1 de esta
 * base, y un informe que trae la hoja del cliente pegada a mano
 * cuadra el día que se escribe y miente desde el siguiente.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createContext, useEffect, useMemo, useRef, useState } from "react";

import { EncabezadoImpresion } from "./boton-pdf";
import { Desplegable } from "./desplegable";
import { n } from "./graficos";
import { Aviso } from "./marco-admin";
import { Bloque, CifraCompacta, Esqueleto, Vacio } from "./piezas";
import { adminApi } from "@/lib/admin-api";
import { bonito, comoParrafo } from "@/lib/api";
import type { Filtros } from "@/lib/crm-api";
import { ErrorApi } from "@/lib/pedir";
import {
  tablerosApi,
  type FilaInformeCruce,
  type FiltrosInformeReservas,
  type InformeReservas,
  type PuntoSerie,
} from "@/lib/tableros-api";

/* ═══════════════════════════════════════════════════════════════
   EL ENLACE DESDE CONTROL
   ═══════════════════════════════════════════════════════════════ */

/**
 * Los cortes que tiene puestos la pantalla «Proceso de inscripción».
 *
 * Existe por el botón «Ver reservas»: lo pinta `ReservasSinNombre`,
 * y a esa pieza `panel-proceso.tsx` solo le pasa `control`, que no
 * dice qué gremio estaba filtrado. Sin esto se hacía clic en los 149
 * cupos de ADECOPRIA y el informe abría con los 539 de los dos
 * gremios: otra vez la sensación de «no funciona». La página de
 * Control ya tiene esos cortes en su estado (`alCambiarFiltros`) y
 * los pone aquí; quien pinta el enlace los lee sin que nadie en
 * medio tenga que pasarlos de mano en mano.
 */
export const ContextoRecorteDeControl = createContext<Filtros | null>(null);

/**
 * La dirección del informe con el recorte de Control puesto.
 *
 * Solo viajan el gremio y la acción: son los dos cortes que una
 * reserva tiene de verdad. El asesor, el grupo y el departamento son
 * de la ficha de una PERSONA, no de una reserva --unirlos al informe
 * daría cero o el informe entero según cómo se escribiera el JOIN--.
 * Si estaban puestos se dice con `ignorados`, y el informe avisa de
 * que aquí no aplican.
 */
export function enlaceAlInforme(cortes: Filtros | null | undefined): string {
  /// Sin `pantalla`: el informe de reservas tiene su propia ruta desde
  /// el 22 sep 2026, y la dirección ya dice cuál es.
  const p = new URLSearchParams();
  if (cortes?.convenioId) p.set("convenioId", cortes.convenioId);
  if (cortes?.accionFormacionId) p.set("accionFormacionId", cortes.accionFormacionId);
  const ignorados = [
    cortes?.asesorId ? "asesor" : null,
    cortes?.grupoId ? "grupo" : null,
    cortes?.departamentoSepId != null ? "departamento" : null,
  ].filter((x): x is string => x !== null);
  if (ignorados.length) p.set("ignorados", ignorados.join(","));
  return `/admin/informes/reservas?${p.toString()}`;
}

/* ═══════════════════════════════════════════════════════════════
   LOS FILTROS VIVEN EN LA DIRECCIÓN
   ═══════════════════════════════════════════════════════════════ */

/**
 * Por qué en la dirección y no en un `useState`: el botón «Ver
 * reservas» llega con el recorte en la consulta, y lo hace DESDE
 * Control mismo, sin volver a montar nada. Con el estado aparte
 * habría que copiar la dirección al estado en un efecto --y
 * acordarse de volver a copiarla en cada clic--; leyéndola, el
 * enlace y los desplegables son la misma fuente. De paso, pegar la
 * dirección en un chat o imprimir reproduce el mismo recorte.
 */
function filtrosDeLaDireccion(p: URLSearchParams): FiltrosInformeReservas {
  const texto = (clave: string) => p.get(clave)?.trim() || undefined;
  const casilla = p.get("incluirCanceladas");
  return {
    convenioId: texto("convenioId"),
    convenio: texto("convenio"),
    accionFormacionId: texto("accionFormacionId"),
    ubicacionId: texto("ubicacionId"),
    departamento: texto("departamento"),
    empresaId: texto("empresaId"),
    desde: texto("desde"),
    hasta: texto("hasta"),
    incluirCanceladas: casilla === "true" || casilla === "1",
  };
}

/**
 * Escribe el recorte en la dirección SIN navegar.
 *
 * `replaceState` y no `router.replace`: el informe no necesita que
 * el servidor vuelva a pintar nada, y Next escucha estas llamadas y
 * mantiene `useSearchParams` al día. Reemplaza y no apila: cambiar
 * de acción cinco veces no son cinco pasos atrás.
 *
 * `ignorados` se cae en cuanto se toca cualquier filtro: habla de
 * cómo se LLEGÓ desde Control, y después de elegir algo aquí ya no
 * describe lo que se ve.
 */
function escribirEnLaDireccion(cambios: Partial<Record<keyof FiltrosInformeReservas, string | undefined>> | "limpiar") {
  const p = new URLSearchParams(window.location.search);
  p.delete("ignorados");
  if (cambios === "limpiar") {
    for (const clave of CLAVES_DEL_INFORME) p.delete(clave);
  } else {
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) p.set(clave, valor);
      else p.delete(clave);
    }
  }
  p.set("pantalla", "reservas");
  window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
}

const CLAVES_DEL_INFORME = [
  "convenioId",
  "convenio",
  "accionFormacionId",
  "ubicacionId",
  "departamento",
  "empresaId",
  "desde",
  "hasta",
  "incluirCanceladas",
] as const;

/* ═══════════════════════════════════════════════════════════════
   FECHAS: días de Bogotá como texto
   ═══════════════════════════════════════════════════════════════ */

/// Los días llegan como «AAAA-MM-DD» de Bogotá. Se leen a medianoche
/// UTC y se escriben en UTC: así ninguna zona los corre un día. Leer
/// «2026-06-23» con la zona del navegador en Bogotá lo pintaba «22
/// de junio», que es el defecto de siempre con fechas sin hora.
const FORMATO_LARGO = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const FORMATO_DIA_MES = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const FORMATO_CORTO = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
/// «hoy» es el día de Bogotá del instante en que el servidor armó el
/// informe, no el del reloj del navegador: si alguien imprime una
/// respuesta que quedó en pantalla desde ayer, la serie termina donde
/// terminan sus datos.
const FORMATO_DIA_BOGOTA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function aFecha(dia: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
const diaLargo = (dia: string) => FORMATO_LARGO.format(aFecha(dia));
const diaYMes = (dia: string) => FORMATO_DIA_MES.format(aFecha(dia));
/// Sin el punto de la abreviatura: «23 jun.» al pie de un gráfico se
/// lee como el final de una frase.
const diaCorto = (dia: string) => FORMATO_CORTO.format(aFecha(dia)).replace(".", "");
const diaDeBogota = (iso: string) => FORMATO_DIA_BOGOTA.format(new Date(iso));
function sumarDias(dia: string, k: number): string {
  const f = aFecha(dia);
  f.setUTCDate(f.getUTCDate() + k);
  return f.toISOString().slice(0, 10);
}
const diasEntre = (a: string, b: string) =>
  Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86_400_000);

/// El lunes de la semana de un día: las semanas del gráfico empiezan
/// en lunes, como el calendario con el que se trabaja aquí.
function lunesDe(dia: string): string {
  const f = aFecha(dia);
  return sumarDias(dia, -((f.getUTCDay() + 6) % 7));
}

/// «del 14 al 21 de septiembre de 2026» y no «del 14 de septiembre de
/// 2026 al 21 de septiembre de 2026»: el mes y el año repetidos
/// alargan la frase sin decir nada, y en el subtítulo del papel la
/// partían en dos renglones.
function rangoEnPalabras(desde: string | null, hasta: string | null): string | null {
  if (desde && hasta) {
    if (desde === hasta) return `el ${diaLargo(desde)}`;
    const [a1, m1, d1] = desde.split("-");
    const [a2, m2] = hasta.split("-");
    if (a1 === a2 && m1 === m2) return `del ${Number(d1)} al ${diaLargo(hasta)}`;
    if (a1 === a2) return `del ${diaLargo(desde).replace(/ de \d{4}$/, "")} al ${diaLargo(hasta)}`;
    return `del ${diaLargo(desde)} al ${diaLargo(hasta)}`;
  }
  if (desde) return `desde el ${diaLargo(desde)}`;
  if (hasta) return `hasta el ${diaLargo(hasta)}`;
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   UTILIDADES DEL INFORME
   ═══════════════════════════════════════════════════════════════ */

/** «AF2» antes que «AF10», como en la hoja del cliente. */
const ordenNatural = (a: string, b: string) =>
  a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

/// El porcentaje redondeado a entero, IGUAL que el bloque «Cupos
/// apartados por empresas» (Math.round). Con un decimal aquí y
/// entero allá, se hacía clic en «9 %» y se llegaba a «8,5 %»: la
/// misma cifra dicha distinto se lee como otra cifra.
function porciento(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((parte / total) * 100));
}

/**
 * Los cupos que YA tienen nombre, contados como sillas.
 *
 * No es `conNombre`: `conNombre` cuenta personas, y en la base hay
 * reservas con más personas que cupos (Logística Sur Express, 12
 * para 10). Las sillas llenas son los cupos menos los que siguen sin
 * nombre, que el servidor ya acota reserva por reserva. Es la MISMA
 * cuenta del bloque «Cupos apartados por empresas» (control.ts,
 * `cuentaDeNombres`): con los dos gremios, 43 y 496, en la tarjeta,
 * en la tabla y en Control. Antes la tarjeta decía 493 (cupos menos
 * personas) y la tabla de debajo sumaba 496.
 */
const sillasConNombre = (f: { cuposConfirmados: number; sinNombre: number }) =>
  Math.max(0, f.cuposConfirmados - f.sinNombre);

/// «1 reserva», «2 reservas». La lista del celular decía «1 ya tienen
/// nombre», medido a 390 px: el plural fijo delata una plantilla.
function cuenta(valor: number, uno: string, varios: string): string {
  return `${n(valor)} ${valor === 1 ? uno : varios}`;
}

function siglaDe(f: { convenioSigla: string | null; convenio: string }) {
  return f.convenioSigla ?? f.convenio;
}

/** «Reservas ADECOPRIA», o «Reservas BRITCHAM ADEE y ADECOPRIA». */
function tituloDelInforme(informe: InformeReservas | null): string {
  const siglas = (informe?.recorte.convenios ?? []).map((c) => c.sigla ?? c.nombre);
  if (siglas.length === 0) return "Reservas";
  if (siglas.length === 1) return `Reservas ${siglas[0]}`;
  return `Reservas ${siglas.slice(0, -1).join(", ")} y ${siglas[siglas.length - 1]}`;
}

/**
 * El gremio dicho en el TÍTULO, en pantalla: «Reservas de ADECOPRIA»
 * o «Reservas de los dos gremios».
 *
 * Antes solo salía en el papel. El cliente vio 149 en Control con
 * ADECOPRIA puesto y 539 aquí sin él, y ninguna de las dos
 * pantallas decía de qué gremio hablaba: las dos cifras son ciertas,
 * pero se leían como un error de cuenta (21 sep 2026). El
 * desplegable de gremio no basta: desaparece cuando el catálogo no
 * carga.
 */
function tituloEnPantalla(informe: InformeReservas): string {
  const c = informe.recorte.convenios;
  if (c.length === 1) return `Reservas de ${c[0].sigla ?? c[0].nombre}`;
  if (c.length === 2) return "Reservas de los dos gremios";
  return `Reservas de los ${n(c.length)} gremios`;
}

/**
 * El recorte dicho con palabras, para el subtítulo del papel. Un
 * papel que dice «16 reservas» sin decir de qué acción ni de qué
 * fechas no se puede contrastar con nada.
 */
function recorteEnPalabras(informe: InformeReservas): string {
  const r = informe.recorte;
  return [
    "Resumen general de reservas",
    r.accion ? `${r.accion.codigo} · ${comoParrafo(r.accion.nombre)}` : "todas las acciones de formación",
    r.ubicacion ? `se dicta en ${bonito(r.ubicacion.nombre)}` : "todos los lugares",
    rangoEnPalabras(r.desde, r.hasta) ?? "todas las fechas",
    r.incluyeCanceladas ? "con las canceladas" : "sin las canceladas",
  ].join(" · ");
}

type Respuesta = { clave: string; informe: InformeReservas };
type Fallo = { clave: string; intento: number; mensaje: string };
type GremioDeLaSesion = { id: string; slug: string; sigla: string | null; nombre: string };

/**
 * Lo que se le dice a quien mira cuando el informe no llega.
 *
 * El mensaje del servidor salía tal cual: «Internal server error», en
 * inglés y en una caja rosada, y para el cliente que mira en vivo eso
 * es «está caído». Solo se deja pasar el del limitador (429), que ya
 * viene traducido en `pedir` y dice cuánto esperar; lo demás --un 500,
 * la red caída-- se dice en español y con la salida: «Reintentar».
 */
function mensajeDeFallo(e: unknown): string {
  if (e instanceof ErrorApi && e.estado === 429) return e.message;
  if (e instanceof ErrorApi && e.estado === 403) {
    return "Su cuenta no tiene permiso para ver este informe.";
  }
  return "No se pudo cargar el informe de reservas. Intente de nuevo en un momento.";
}

/* ═══════════════════════════════════════════════════════════════
   EL PANEL
   ═══════════════════════════════════════════════════════════════ */

export function PanelReservas() {
  const direccion = useSearchParams();
  /// La clave es la consulta ENTERA de los siete filtros: cualquier
  /// cambio en uno pide de nuevo, y NADA MÁS lo hace. Los filtros salen
  /// de la clave y no del objeto de la dirección: ese objeto cambia con
  /// cualquier parámetro --al caerse `ignorados`, por ejemplo-- y cada
  /// cambio volvía a pedir el mismo informe.
  const clave = JSON.stringify(filtrosDeLaDireccion(new URLSearchParams(direccion.toString())));
  const filtros = useMemo(() => JSON.parse(clave) as FiltrosInformeReservas, [clave]);
  const ignorados = (direccion.get("ignorados") ?? "").split(",").filter(Boolean);

  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [fallo, setFallo] = useState<Fallo | null>(null);
  /**
   * QUÉ SE PUEDE ELEGIR: el informe sin ningún corte, pedido una vez.
   *
   * Las listas de los desplegables no pueden salir de la respuesta
   * recortada: al elegir AF2, `porAccion` trae solo AF2 y el
   * desplegable se quedaba con una sola opción --para pasar de AF2 a
   * AF3 había que quitar el filtro primero--. De esta respuesta NO se
   * pinta ninguna cifra: solo nombres, así que no puede producir
   * media pantalla vieja y media nueva.
   */
  const [catalogo, setCatalogo] = useState<InformeReservas | null>(null);
  /**
   * LOS GREMIOS DE LA SESIÓN, por si el informe no llega.
   *
   * El catálogo es el mismo informe sin cortes: si el servidor falla,
   * fallan los dos y el desplegable de gremio desaparecía --quedaban
   * acción y «Dónde se dicta», vacíos--. Esta lista sale de otra
   * puerta (/admin/convenios, recortada al ámbito de la sesión) y se
   * pide SOLO cuando el catálogo falló.
   */
  const [gremiosDeRespaldo, setGremiosDeRespaldo] = useState<GremioDeLaSesion[]>([]);
  /// Sube con «Reintentar»: vuelve a pedir el informe --y el catálogo,
  /// si faltaba-- sin tocar los filtros de la dirección.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (catalogo) return;
    let vigente = true;
    tablerosApi.informeReservas({}).then(
      (c) => {
        if (vigente) setCatalogo(c);
      },
      () => {
        // sin catálogo, las listas salen de la respuesta en pantalla,
        // y el gremio, de la lista de la sesión
        adminApi.convenios().then(
          (gs) => {
            if (vigente) setGremiosDeRespaldo(gs);
          },
          () => {
            // sin esto tampoco: el desplegable espera al reintento
          },
        );
      },
    );
    return () => {
      vigente = false;
    };
  }, [catalogo, intento]);

  useEffect(() => {
    /// Solo manda la última: elegir dos filtros seguidos no puede
    /// dejar pintada la respuesta del primero si llega después.
    let vigente = true;
    tablerosApi.informeReservas(filtros).then(
      (informe) => {
        if (vigente) {
          setRespuesta({ clave, informe });
          setFallo(null);
        }
      },
      (e: unknown) => {
        if (vigente) setFallo({ clave, intento, mensaje: mensajeDeFallo(e) });
      },
    );
    return () => {
      vigente = false;
    };
  }, [clave, filtros, intento]);

  /**
   * EL PAPEL LLEVA TODO ABIERTO.
   *
   * Un `details` cerrado no se imprime --Chrome saca su cabecera y
   * nada más--, y el PDF perdía «Cómo se cuentan estas cifras». Antes
   * de imprimir se abren todos los del informe, y después se cierran
   * los que se abrieron aquí: quien lo tenía abierto lo encuentra
   * abierto. Las filas de organizaciones de la tabla no dependen de
   * esto: se imprimen siempre por CSS (`print:table-row`).
   */
  useEffect(() => {
    let abiertosParaImprimir: HTMLDetailsElement[] = [];
    /// Se ACUMULA y no se reemplaza: un segundo `beforeprint` antes
    /// del `afterprint` (pasa al generar el PDF desde el navegador
    /// automatizado) encontraba todo abierto, vaciaba la lista y el
    /// plegable se quedaba abierto después de imprimir.
    const antes = () => {
      const cerrados = [
        ...document.querySelectorAll<HTMLDetailsElement>(".informe-de-reservas details:not([open])"),
      ];
      for (const d of cerrados) d.open = true;
      abiertosParaImprimir = [...abiertosParaImprimir, ...cerrados];
    };
    const despues = () => {
      for (const d of abiertosParaImprimir) d.open = false;
      abiertosParaImprimir = [];
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", despues);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", despues);
    };
  }, []);

  const informe = respuesta?.informe ?? null;
  /// Del intento en curso: al pulsar «Reintentar» el aviso se va y
  /// vuelve el esqueleto, para que se vea que algo está pasando.
  const falloActual = fallo?.clave === clave && fallo.intento === intento ? fallo : null;
  /// Mientras llega la siguiente, se conserva la anterior atenuada:
  /// vaciar la pantalla en cada cambio de filtro se lee como que se
  /// rompió, y media pantalla nueva con media vieja, como que miente.
  const refrescando = informe !== null && respuesta?.clave !== clave && !falloActual;

  const hayFiltro = CLAVES_DEL_INFORME.some((k) =>
    k === "incluirCanceladas" ? filtros.incluirCanceladas : Boolean(filtros[k]),
  );

  return (
    /// `resumen-impreso` hereda el ajuste de papel del Resumen, sin
    /// tocar globals.css: tablas que reparten por contenido, filas más
    /// bajas y NINGÚN bloque que se mude entero.
    <div className="informe-de-reservas resumen-impreso flex flex-col gap-3">
      {/* DOS AJUSTES DE PAPEL QUE NO SON DE ESTE ARCHIVO, acotados a
          cuando el informe está montado.

          1 · El armazón del panel (`.marco-panel`) mide la altura de
          la VENTANA con un estilo en línea, y en papel ninguna regla
          lo suelta: el pie «Gestionado por Grupo AE» quedaba pintado
          ENCIMA de las filas de la tabla que caían ahí.

          2 · Un plegable que siga cerrado --si el navegador imprime
          sin avisar con `beforeprint`-- saca su cabecera sola, sin
          nada debajo. Mejor que no salga. */}
      <style>{`@media print{.marco-panel:has(.informe-de-reservas){height:auto!important}.informe-de-reservas details.bloque-entero:not([open]){display:none!important}}`}</style>

      {/* Solo en el papel: en la hoja no están los filtros, y sin esto
          el PDF empezaría por un número sin decir de qué gremio ni de
          qué fechas es. */}
      {informe && (
        <EncabezadoImpresion
          titulo={tituloDelInforme(informe)}
          subtitulo={recorteEnPalabras(informe)}
        />
      )}

      <TarjetaDeFiltros
        filtros={filtros}
        catalogo={catalogo ?? informe}
        gremiosDeRespaldo={gremiosDeRespaldo}
        hayFiltro={hayFiltro}
      />

      {/* A la vista y en una línea: explica por qué aquí no se
          recorta por lo que estaba puesto en Control. */}
      {ignorados.length > 0 && (
        <p className="no-imprimir rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
          <strong className="font-semibold">
            En Control estaban puestos {listaEnPalabras(ignorados.map(nombreDeIgnorado))}.
          </strong>{" "}
          Aquí no aplican: un cupo es de la organización, no de un asesor, un grupo ni un
          departamento. Los cupos y los nombres son los mismos que allá.
        </p>
      )}

      {falloActual && (
        <Aviso tipo="error">
          <span role="alert">
            {informe
              ? `${falloActual.mensaje.replace(/\.$/, "")}. Lo que ve es del recorte anterior.`
              : falloActual.mensaje}
          </span>
          <button
            type="button"
            onClick={() => setIntento((k) => k + 1)}
            className="ml-2 font-semibold underline underline-offset-2"
          >
            Reintentar
          </button>
          {hayFiltro && (
            <button
              type="button"
              onClick={() => escribirEnLaDireccion("limpiar")}
              className="ml-2 font-semibold underline underline-offset-2"
            >
              Quitar los filtros
            </button>
          )}
        </Aviso>
      )}

      {!informe && !falloActual && <Esqueleto conCifras filas={6} />}

      {informe && (
        <div
          aria-busy={refrescando}
          className={`flex flex-col gap-3 transition-opacity ${refrescando ? "opacity-55" : ""}`}
        >
          <CuerpoDelInforme informe={informe} filtros={filtros} />
        </div>
      )}
    </div>
  );
}

function nombreDeIgnorado(clave: string): string {
  if (clave === "asesor") return "el asesor";
  if (clave === "grupo") return "el grupo";
  if (clave === "departamento") return "el departamento";
  return clave;
}

function listaEnPalabras(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/* ── lo que se pinta cuando hay respuesta ─────────────────────── */

function CuerpoDelInforme({
  informe,
  filtros,
}: {
  informe: InformeReservas;
  filtros: FiltrosInformeReservas;
}) {
  /**
   * QUÉ DEPARTAMENTO TIENE LA TABLA ABIERTA (cliente, 25 sep 2026).
   *
   * Vive aquí y no dentro de la gráfica porque lo que abre no es
   * suyo: la gráfica ocupa media fila y la tabla de seguimiento son
   * siete columnas, que solo caben debajo y a todo lo ancho.
   */
  const [departamento, setDepartamento] = useState<string | null>(null);
  const t = informe.totales;
  const r = informe.recorte;

  /// Un gremio que no es de su ámbito devuelve el informe vacío con
  /// `recorte.convenios` vacío, nunca el del otro gremio. Se dice
  /// así: una fila de ceros se lee como que no cargó.
  if (r.convenios.length === 0) {
    return (
      <Vacio titulo="Ese gremio no está entre los suyos">
        Su cuenta no ve las reservas del gremio que trae la dirección.{" "}
        <BotonQuitar alPulsar={() => escribirEnLaDireccion("limpiar")}>
          Ver todos sus gremios
        </BotonQuitar>
      </Vacio>
    );
  }

  if (t.reservas === 0) {
    const rango = rangoEnPalabras(r.desde, r.hasta);
    const deQue = [
      r.convenios.length === 1 ? `de ${r.convenios[0].sigla ?? r.convenios[0].nombre}` : null,
      r.accion ? `en ${r.accion.codigo}` : null,
      r.ubicacion ? `que se dicte en ${bonito(r.ubicacion.nombre)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <Vacio titulo={rango ? "No hay reservas en estas fechas" : "No hay reservas en este recorte"}>
        {rango
          ? `${rango.charAt(0).toUpperCase()}${rango.slice(1)} no se hizo ninguna reserva${deQue ? ` ${deQue}` : ""}.`
          : `No hay ninguna reserva${deQue ? ` ${deQue}` : ""}.`}
        {t.reservasCanceladas > 0 &&
          ` Hay ${n(t.reservasCanceladas)} ${t.reservasCanceladas === 1 ? "cancelada" : "canceladas"}, que no cuentan.`}
        {rango ? (
          <BotonQuitar alPulsar={() => escribirEnLaDireccion({ desde: undefined, hasta: undefined })}>
            Quitar las fechas
          </BotonQuitar>
        ) : (
          <BotonQuitar alPulsar={() => escribirEnLaDireccion("limpiar")}>
            Quitar los filtros
          </BotonQuitar>
        )}
      </Vacio>
    );
  }

  /// Se comprueba contra las barras que hay delante en vez de
  /// borrarse en un efecto: al cambiar el recorte llega otro informe,
  /// y el departamento que estaba abierto puede que ya no tenga
  /// barra. Derivado, no hay un instante con la tabla de un
  /// departamento que la gráfica ya no enseña.
  const abierto =
    departamento && informe.porDepartamento.some((d) => d.departamento === departamento)
      ? departamento
      : null;

  return (
    <>
      {/* TRES PIEZAS Y NO CINCO (cliente, 23 sep 2026). Salieron
          «Resumen por acción de formación» --que decía lo mismo que el
          seguimiento, pero sumado-- y «Cupos sin nombre, por
          organización», cuya lista es la columna «Pendientes» de la
          tabla de abajo. Lo que queda: las cifras, las dos gráficas en
          una fila, y la tabla con la que se trabaja. */}
      <ResumenGeneral informe={informe} />
      <Graficas
        informe={informe}
        filtros={filtros}
        abierto={abierto}
        alPulsar={(d) => setDepartamento((v) => (v === d ? null : d))}
      />
      <SeguimientoDeUnDepartamento
        departamento={abierto}
        filtros={filtros}
        alCerrar={() => setDepartamento(null)}
      />
      {/* EN PAPEL LA TABLA SIGUE SALIENDO, Y ENTERA. Es la tabla con
          la que se trabaja y la razón de imprimir esta pantalla: si
          se fuera con el clic, el PDF quedaría en cifras y gráficas.
          Con un departamento abierto se imprime ESE, que es lo que se
          está mirando, y esta no se repite. */}
      {!abierto && (
        <div className="hidden print:block">
          <Seguimiento informe={informe} />
        </div>
      )}
    </>
  );
}

function BotonQuitar({ alPulsar, children }: { alPulsar: () => void; children: React.ReactNode }) {
  return (
    <span className="mt-3 block">
      <button
        type="button"
        onClick={alPulsar}
        className="rounded-lg border border-marca/30 px-2.5 py-1 text-[0.75rem] font-semibold text-marca transition hover:bg-marca-suave"
      >
        {children}
      </button>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FILTROS
   ═══════════════════════════════════════════════════════════════ */

/**
 * La tarjeta de filtros, en el mismo lenguaje que la de «Proceso de
 * inscripción»: un control que se ve distinto que sus vecinos
 * obliga a aprenderlo aparte.
 *
 * En UNA fila de controles de 34 px. El renglón de letra pequeña que
 * explicaba «dónde se dicta» y la hora de Bogotá se fue a «Cómo se
 * cuentan estas cifras», al pie de las cifras.
 *
 * En un celular los seis controles ocupaban ~230 px y empujaban las
 * cifras hasta y=516: ahí van detrás de un botón «Filtros ·
 * ADECOPRIA» que nace cerrado y dice lo que está puesto.
 */
function TarjetaDeFiltros({
  filtros,
  catalogo,
  gremiosDeRespaldo,
  hayFiltro,
}: {
  filtros: FiltrosInformeReservas;
  catalogo: InformeReservas | null;
  gremiosDeRespaldo: GremioDeLaSesion[];
  hayFiltro: boolean;
}) {
  const [abiertos, setAbiertos] = useState(false);
  /// Sin informe --el servidor falló--, la lista de la sesión: el
  /// gremio no puede desaparecer justo cuando hay que cambiarlo.
  const convenios = useMemo(
    () => catalogo?.recorte.convenios ?? gremiosDeRespaldo,
    [catalogo, gremiosDeRespaldo],
  );
  /// El gremio elegido por id, o por slug si el enlace lo trajo así
  /// (el listado y el Excel filtran por slug). Si llegan los dos,
  /// manda el id, igual que en el servidor.
  const gremio =
    filtros.convenioId ?? convenios.find((c) => c.slug === filtros.convenio)?.id ?? "";
  const slugDelGremio = convenios.find((c) => c.id === gremio)?.slug ?? filtros.convenio;
  const varios = convenios.length > 1;

  const acciones = useMemo(
    () =>
      [...(catalogo?.porAccion ?? [])]
        .filter((a) => !slugDelGremio || a.convenio === slugDelGremio)
        .sort((a, b) => {
          const ia = convenios.findIndex((c) => c.slug === a.convenio);
          const ib = convenios.findIndex((c) => c.slug === b.convenio);
          return ia - ib || ordenNatural(a.codigo, b.codigo);
        }),
    [catalogo, slugDelGremio, convenios],
  );

  const ubicaciones = useMemo(
    () =>
      [...(catalogo?.porUbicacion ?? [])].sort((a, b) =>
        ordenNatural(bonito(a.nombre), bonito(b.nombre)),
      ),
    [catalogo],
  );

  /**
   * LOS DEPARTAMENTOS Y LAS INSTITUCIONES SALEN DEL CATÁLOGO, NO DEL
   * INFORME FILTRADO.
   *
   * Es la misma regla que ya siguen la acción y la ubicación, y está
   * aquí por un defecto concreto: si la lista saliera de lo que se
   * está viendo, al elegir «Antioquia» el desplegable se quedaría con
   * una sola entrada --Antioquia-- y no habría manera de salir sin
   * limpiar todos los filtros.
   */
  const departamentos = useMemo(
    () =>
      [...(catalogo?.porDepartamento ?? [])].sort((a, b) =>
        ordenNatural(bonito(a.departamento), bonito(b.departamento)),
      ),
    [catalogo],
  );

  const instituciones = useMemo(
    () =>
      [...(catalogo?.porOrganizacion ?? [])].sort((a, b) =>
        ordenNatural(bonito(a.razonSocial), bonito(b.razonSocial)),
      ),
    [catalogo],
  );

  const accionElegida = filtros.accionFormacionId ?? "";
  const ubicacionElegida = filtros.ubicacionId ?? "";
  const departamentoElegido = filtros.departamento ?? "";
  const institucionElegida = filtros.empresaId ?? "";

  /// Lo que está puesto, dicho en el botón del celular: con los
  /// controles plegados, sin esto no se sabría qué recorte se mira.
  const puesto = [
    convenios.find((c) => c.id === gremio)?.sigla ?? convenios.find((c) => c.id === gremio)?.nombre,
    (catalogo?.porAccion ?? []).find((a) => a.accionFormacionId === accionElegida)?.codigo,
    ubicaciones.find((u) => u.ubicacionId === ubicacionElegida)?.nombre
      ? bonito(ubicaciones.find((u) => u.ubicacionId === ubicacionElegida)?.nombre ?? "")
      : undefined,
    departamentoElegido ? bonito(departamentoElegido) : undefined,
    instituciones.find((i) => i.empresaId === institucionElegida)?.razonSocial
      ? bonito(instituciones.find((i) => i.empresaId === institucionElegida)?.razonSocial ?? "")
      : undefined,
    rangoEnPalabras(filtros.desde ?? null, filtros.hasta ?? null) ?? undefined,
    filtros.incluirCanceladas ? "con canceladas" : undefined,
  ].filter(Boolean);

  const quitar = hayFiltro && (
    <button
      type="button"
      onClick={() => escribirEnLaDireccion("limpiar")}
      className="ml-3 font-normal tracking-normal text-texto-suave underline normal-case hover:text-texto"
    >
      Quitar filtros
    </button>
  );

  return (
    <div className="no-imprimir rounded-xl border border-borde bg-superficie px-4 py-3 sm:py-3.5">
      {/* En el celular, la puerta; desde 640 px, el rótulo de siempre. */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <button
          type="button"
          aria-expanded={abiertos}
          onClick={() => setAbiertos((v) => !v)}
          className="sin-aro flex min-w-0 grow items-center gap-2 text-left text-[0.78125rem] font-semibold text-titulo"
        >
          <span aria-hidden className={`text-[0.625rem] text-texto-suave transition-transform ${abiertos ? "rotate-90" : ""}`}>
            &#9656;
          </span>
          <span className="min-w-0 truncate">
            Filtros{puesto.length > 0 ? ` · ${puesto.join(" · ")}` : ""}
          </span>
        </button>
        {hayFiltro && (
          <button
            type="button"
            onClick={() => escribirEnLaDireccion("limpiar")}
            className="shrink-0 text-[0.6875rem] text-texto-suave underline hover:text-texto"
          >
            Quitar
          </button>
        )}
      </div>
      <p className="mb-2.5 hidden text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase sm:block">
        Filtros
        {quitar}
      </p>

      {/* FLEX CON BASES, NO REJILLA DE COLUMNAS IGUALES: cada control
          pide lo que necesita --la acción, el doble; una fecha, lo de
          una fecha-- y en escritorio caben los seis en una fila. */}
      <div className={`mt-3 flex-wrap gap-2 sm:mt-0 sm:flex ${abiertos ? "flex" : "hidden"}`}>
        {/* El gremio solo cuando hay más de uno: con uno solo ofrece
            elegir lo único que hay. */}
        {varios && (
          <div className="min-w-0 flex-[1_1_180px]">
            <Desplegable
              alto={34}
              marcador="Gremios"
              etiquetaAria="Gremio"
              valor={gremio}
              opciones={[
                { valor: "", etiqueta: "Gremios" },
                ...convenios.map((c) => ({ valor: c.id, etiqueta: c.sigla ?? c.nombre, detalle: c.nombre })),
              ]}
              alElegir={(v) => {
                const slug = convenios.find((c) => c.id === v)?.slug;
                const accion = (catalogo?.porAccion ?? []).find(
                  (a) => a.accionFormacionId === accionElegida,
                );
                escribirEnLaDireccion({
                  /// Se suelta el slug: si se quedara, al volver a
                  /// «Gremios» seguiría filtrando por el que trajo el
                  /// enlace y el desplegable parecería no hacer nada.
                  convenioId: v || undefined,
                  convenio: undefined,
                  /// Una acción de otro gremio con este elegido es un
                  /// recorte contradictorio que sale en cero.
                  accionFormacionId: accion && slug && accion.convenio !== slug ? undefined : accionElegida || undefined,
                });
              }}
            />
          </div>
        )}

        <div className="min-w-0 flex-[2_1_260px]">
          <Desplegable
            alto={34}
            marcador="Acción de formación"
            etiquetaAria="Acción de formación"
            valor={accionElegida}
            opciones={[
              { valor: "", etiqueta: "Acción de formación" },
              ...acciones.map((a) => ({
                valor: a.accionFormacionId,
                etiqueta: `${a.codigo} · ${comoParrafo(a.nombre)}`,
                /// Con los dos gremios hay dos «AF1»: la sigla es lo
                /// que los distingue en la lista.
                detalle: [varios ? siglaDe(a) : null, a.reservas === 0 ? "sin reservas" : null]
                  .filter(Boolean)
                  .join(" · ") || undefined,
              })),
            ]}
            alElegir={(v) => escribirEnLaDireccion({ accionFormacionId: v || undefined })}
          />
        </div>

        <div className="min-w-0 flex-[1_1_180px]">
          <Desplegable
            alto={34}
            marcador="Dónde se dicta"
            etiquetaAria="Dónde se dicta"
            valor={ubicacionElegida}
            opciones={[
              { valor: "", etiqueta: "Dónde se dicta" },
              ...ubicaciones.map((u) => ({
                valor: u.ubicacionId,
                etiqueta: bonito(u.nombre),
                /// «BOGOTÁ» y «BOGOTÁ D.C» son dos ubicaciones: la
                /// ciudad y el departamento.
                detalle: u.tipo === "CIUDAD" ? "Ciudad" : "Departamento",
              })),
            ]}
            alElegir={(v) => escribirEnLaDireccion({ ubicacionId: v || undefined })}
          />
        </div>

        {/* DEPARTAMENTO, que es un escalón por encima de «Dónde se
            dicta» (cliente, 23 sep 2026). Los dos conviven: en
            «Dónde se dicta» Medellín y Antioquia son dos entradas
            distintas, y quien quiere ver Antioquia entera las
            necesita juntas. */}
        <div className="min-w-0 flex-[1_1_180px]">
          <Desplegable
            alto={34}
            marcador="Departamento"
            etiquetaAria="Departamento"
            valor={departamentoElegido}
            opciones={[
              { valor: "", etiqueta: "Departamento" },
              ...departamentos.map((d) => ({
                valor: d.departamento,
                etiqueta: bonito(d.departamento),
                detalle: `${n(d.cuposConfirmados)} ${d.cuposConfirmados === 1 ? "cupo" : "cupos"}`,
              })),
            ]}
            alElegir={(v) => escribirEnLaDireccion({ departamento: v || undefined })}
          />
        </div>

        <div className="min-w-0 flex-[2_1_240px]">
          <Desplegable
            alto={34}
            marcador="Institución"
            etiquetaAria="Institución"
            valor={institucionElegida}
            opciones={[
              { valor: "", etiqueta: "Institución" },
              ...instituciones.map((i) => ({
                valor: i.empresaId,
                etiqueta: bonito(i.razonSocial),
                /// El NIT en la segunda línea: dos sedes de la misma
                /// red se llaman casi igual y es lo único que las
                /// separa a simple vista.
                detalle: [i.nit, `${n(i.cuposConfirmados)} cupos`].filter(Boolean).join(" · "),
              })),
            ]}
            alElegir={(v) => escribirEnLaDireccion({ empresaId: v || undefined })}
          />
        </div>

        <CajaDeFecha
          rotulo="Desde"
          valor={filtros.desde ?? ""}
          max={filtros.hasta}
          alCambiar={(v) => escribirEnLaDireccion({ desde: v || undefined })}
        />
        <CajaDeFecha
          rotulo="Hasta"
          valor={filtros.hasta ?? ""}
          min={filtros.desde}
          alCambiar={(v) => escribirEnLaDireccion({ hasta: v || undefined })}
        />

        <label className="flex h-[34px] flex-none cursor-pointer items-center gap-2 px-1 text-[0.78125rem] whitespace-nowrap text-texto">
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-marca"
            checked={Boolean(filtros.incluirCanceladas)}
            onChange={(e) =>
              escribirEnLaDireccion({ incluirCanceladas: e.target.checked ? "true" : undefined })
            }
          />
          Incluir las canceladas
        </label>
      </div>
    </div>
  );
}

/**
 * Una fecha con su rótulo DENTRO de la caja.
 *
 * Una caja de fecha vacía dice «dd/mm/aaaa» y nada más: dos seguidas
 * no dicen cuál es el principio. Con el rótulo encima la fila dejaba
 * de medir 34 px, como los desplegables de al lado, y se descuadraba.
 */
function CajaDeFecha({
  rotulo,
  valor,
  min,
  max,
  alCambiar,
}: {
  rotulo: string;
  valor: string;
  min?: string;
  max?: string;
  alCambiar: (v: string) => void;
}) {
  return (
    <label
      className={
        "flex h-[34px] min-w-0 flex-[1_1_150px] items-center gap-1.5 rounded-lg border pr-1 pl-3 transition " +
        "focus-within:border-campo-foco focus-within:ring-2 focus-within:ring-campo-foco/25 " +
        (valor ? "border-marca/45 bg-marca-suave" : "border-campo-borde bg-campo-fondo")
      }
    >
      <span className={`shrink-0 text-[0.6875rem] ${valor ? "font-semibold text-marca" : "text-texto-suave"}`}>
        {rotulo}
      </span>
      <input
        type="date"
        value={valor}
        min={min}
        max={max}
        onChange={(e) => alCambiar(e.target.value)}
        aria-label={`Reservas hechas ${rotulo.toLowerCase()}`}
        className="min-w-0 grow bg-transparent text-[0.78125rem] text-texto outline-none"
      />
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1 · LAS CUATRO CIFRAS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Las cinco cifras de arriba.
 *
 * DESNUDAS SOBRE LA PÁGINA, SIN `Bloque` (cliente, 24 sep 2026:
 * «sigue igual?»). Estuvieron dentro de uno, y eso las metía en una
 * caja con cabecera lavanda y otra fila enmarcada debajo: caja dentro
 * de caja dentro de caja.
 *
 * Medido contra las dos tiras que él sí aprobó --«Gestión de leads» y
 * «Seguimiento académico»-- la TARJETA era idéntica: 51 px de alto,
 * relleno 8/14, hueco 8. Lo que no se parecía era el MARCO: allí las
 * tarjetas cuelgan de la página, sin título encima ni borde alrededor.
 * Y el alto nunca fue el problema --la tira aprobada del académico
 * mide 66 px y ésta medía 51--, así que medirlo no respondía nada.
 *
 * Las tres últimas son, al dígito, las del bloque «Cupos apartados
 * por empresas» desde el que se hace clic, en su orden y con sus
 * colores: eso es lo que convierte «no pasó nada» en «llegué a lo
 * que pulsé». Las dos cuentan por cupo y reserva por reserva.
 *
 * Los párrafos de letra pequeña que colgaban de aquí --canceladas,
 * fechas, personas de más-- se fueron a UNA línea cerrada al pie:
 * «todo como cargado, como saturado» (cliente). Nada se perdió; el
 * rótulo de la línea ya dice lo que más pesa.
 */
function ResumenGeneral({ informe }: { informe: InformeReservas }) {
  const t = informe.totales;
  const conNombre = sillasConNombre(t);
  /// Los que tuvieron nombre y ya no están dentro: retirados,
  /// desertores y no aprobados. `Math.max` porque las dos cifras
  /// vienen de consultas distintas y un desfase de un segundo no
  /// puede pintar un negativo en la pantalla del comité.
  const descartados = Math.max(0, conNombre - t.dentro);
  const convenios = informe.recorte.convenios;

  return (
    <section className="flex flex-col gap-2">
      {/* EL GREMIO, EN VOZ BAJA Y NO COMO TÍTULO DE BLOQUE. Tiene que
          seguir dicho en alguna parte: el desplegable de gremio no
          basta --desaparece cuando el catálogo no carga-- y una
          captura o un PDF que empiece por un número sin decir de quién
          es no se puede contrastar con nada. Pero va con el peso de un
          pie de foto, no de una cabecera, que es lo que enmarcaba. */}
      <div className="flex items-baseline justify-between gap-3 text-[0.75rem] leading-none">
        <span className="truncate font-medium text-texto">
          {tituloEnPantalla(informe)}
          {convenios.length > 1 && (
            <span className="font-normal text-texto-suave">
              {" · "}
              {listaEnPalabras(convenios.map((c) => c.sigla ?? c.nombre))}
            </span>
          )}
        </span>
        {/* La lista de trabajo, que se queda como estaba en Sistemas
            de Información. Desde el informe se llega a la fila
            concreta --el contacto, el teléfono-- que aquí no se trae. */}
        <Link
          href="/admin/reservas"
          className="no-imprimir shrink-0 font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
        >
          Ver el listado
        </Link>
      </div>

      {/* FLEX Y NO REJILLA. En papel, globals.css aplana toda rejilla
          que cuelgue de un `section` («las rejillas pasan a flujo»), y
          las cifras salían apiladas en media hoja. */}
      <div className="flex flex-wrap gap-2">
        {/* LA COLA DE LA CIFRA ES UN PORCENTAJE O NADA. En las dos
            tiras aprobadas ninguna cola es una frase; aquí había tres
            clases distintas en cinco tarjetas --«+34 en espera», «8 %»,
            «en 24 org.»-- y eso es lo que se leía como desorden. Los
            cupos en espera ya salen en el rótulo de «Cómo se cuentan
            estas cifras», que está justo debajo, y qué organizaciones
            deben nombres es la columna «Pendientes» de la tabla. */}
        <CifraCompacta etiqueta="Instituciones" valor={n(t.organizaciones)} />
        <CifraCompacta etiqueta="Reservas" valor={n(t.reservas)} />
        <CifraCompacta etiqueta="Cupos apartados" valor={n(t.cuposConfirmados)} />
        {/* LAS TRES DE LA OCUPACIÓN, y por qué son tres y no una
            (cliente, 24 sep 2026: «cupos ocupados / cupos confirmados
            inscritos / y adiciona descartados»).

            «Confirmados inscritos» cuenta el cupo que llegó a tener
            una persona matriculada detrás, SE HAYA QUEDADO O NO: es la
            que alimenta la brecha de nombres y la que se le reporta al
            SENA. «Ocupados» descuenta a quien se retiró o desertó: es
            la silla que de verdad está ocupada hoy. Y «Descartados» es
            justo la diferencia entre las dos.

            Las tres son ciertas y por eso NUNCA se llaman igual. El
            tipo del informe lo deja escrito: `conNombre` incluye a
            quien se fue y `dentro` no. Antes solo se enseñaba la
            primera, con el nombre «Ya tienen nombre», y la deserción
            no se veía en esta pantalla: había que ir a Académica. */}
        <CifraCompacta
          etiqueta="Cupos confirmados inscritos"
          valor={n(conNombre)}
          detalle={t.cuposConfirmados > 0 ? `${porciento(conNombre, t.cuposConfirmados)} %` : undefined}
        />
        <CifraCompacta
          etiqueta="Cupos ocupados"
          valor={n(t.dentro)}
          color="var(--exito)"
          detalle={t.cuposConfirmados > 0 ? `${porciento(t.dentro, t.cuposConfirmados)} %` : undefined}
        />
        <CifraCompacta
          etiqueta="Descartados"
          valor={n(descartados)}
          detalle={conNombre > 0 ? `${porciento(descartados, conNombre)} %` : undefined}
        />
        <CifraCompacta
          etiqueta="Siguen sin nombre"
          valor={n(t.sinNombre)}
          color={t.sinNombre > 0 ? "var(--error)" : undefined}
          detalle={
            t.cuposConfirmados > 0 ? `${porciento(t.sinNombre, t.cuposConfirmados)} %` : undefined
          }
        />
      </div>

      <ComoSeCuentan informe={informe} />
    </section>
  );
}

/**
 * «Cómo se cuentan estas cifras»: todo lo que antes colgaba en letra
 * pequeña, en una línea cerrada. El rótulo lleva lo que mueve una
 * cifra (canceladas fuera, cupos en espera, personas de más) para
 * que nadie tenga que abrirla para saber que existe.
 */
function ComoSeCuentan({ informe }: { informe: InformeReservas }) {
  const t = informe.totales;
  const incluye = informe.recorte.incluyeCanceladas;
  const primera = informe.porDia[0]?.dia ?? null;
  const ultima = informe.porDia[informe.porDia.length - 1]?.dia ?? null;
  const deMas = informe.cruce.filter((c) => c.nombresDeMas > 0);

  const rotulo = [
    t.reservasCanceladas > 0
      ? incluye
        ? cuenta(t.reservasCanceladas, "cancelada dentro", "canceladas dentro")
        : cuenta(t.reservasCanceladas, "cancelada fuera", "canceladas fuera")
      : null,
    t.cuposEnEspera > 0 ? cuenta(t.cuposEnEspera, "cupo en espera", "cupos en espera") : null,
    t.nombresDeMas > 0 ? cuenta(t.nombresDeMas, "persona de más", "personas de más") : null,
  ].filter(Boolean);

  return (
    <details className="group">
      <summary className="sin-aro flex cursor-pointer list-none items-center gap-2 py-1 text-[0.75rem] text-texto-suave select-none hover:text-texto">
        <span aria-hidden className="text-[0.5625rem] transition-transform group-open:rotate-90">
          &#9656;
        </span>
        <span>
          <span className="font-medium text-texto">Cómo se cuentan estas cifras</span>
          {rotulo.length > 0 && ` · ${rotulo.join(" · ")}`}
        </span>
      </summary>
      <ul className="list-disc space-y-1 pb-2 pl-9 text-[0.75rem] leading-snug text-texto-suave">
        <li>
          {/* Ocultar, nunca eliminar: las canceladas no entran en las
              cifras, pero la cifra de las que se cayeron se ve. */}
          {incluye
            ? t.reservasCanceladas > 0
              ? `Estas cifras incluyen ${cuenta(t.reservasCanceladas, "reserva cancelada", "reservas canceladas")}, que ya no tienen cupos (${n(t.cuposCancelados)} se cayeron).`
              : "No hay reservas canceladas en este recorte."
            : t.reservasCanceladas > 0
              ? `Fuera de estas cifras: ${cuenta(t.reservasCanceladas, "reserva cancelada", "reservas canceladas")} (${n(t.cuposCancelados)} cupos). Con la casilla «Incluir las canceladas» entran en la tabla.`
              : "Ninguna reserva cancelada en este recorte."}
        </li>
        {t.cuposEnEspera > 0 && (
          <li>
            Los {n(t.cuposEnEspera)} cupos en lista de espera no cuentan como apartados hasta que se
            confirmen.
          </li>
        )}
        <li>
          «Ya tienen nombre» es un cupo con una persona que llegó a matricularse, aunque después se
          haya retirado. Se cuenta reserva por reserva, igual que en «Cupos apartados por
          empresas».
        </li>
        {t.nombresDeMas > 0 && (
          <li>
            {cuenta(t.nombresDeMas, "persona inscrita", "personas inscritas")} por encima de lo que
            reservó su organización
            {deMas.length > 0 &&
              `: ${deMas.map((c) => `${c.razonSocial} en ${c.codigo}, ${n(c.nombresDeMas)}`).join("; ")}`}
            . No llenan cupos de otras.
          </li>
        )}
        {primera && ultima && (
          <li>
            {primera !== ultima
              ? `Primera reserva el ${diaLargo(primera)}; la última, el ${diaLargo(ultima)}.`
              : `Todas se hicieron el ${diaLargo(primera)}.`}{" "}
            Las fechas son las del día en que se hizo la reserva, en hora de Bogotá.
          </li>
        )}
        <li>«Dónde se dicta» es la ciudad o el departamento del curso, no el de la organización.</li>
      </ul>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2 · LAS DOS GRÁFICAS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Dos gráficas, lado a lado desde 1.024 px y una bajo otra en el
 * celular. Solo dos: a quién pedirle nombres, y cuándo se apartaron
 * los cupos. Las barras azul y naranja «con y sin nombre» que iban
 * al lado de la tabla se fueron: la tabla ya lleva el porcentaje, y
 * la misma cifra en dos formas a un palmo se leía como dos cifras.
 *
 * En papel también van lado a lado, salvo con más de
 * `SEMANAS_EN_MEDIA_HOJA` semanas: a media hoja la gráfica tiene unos
 * 460 px, y en papel no hay desplazamiento que salve las cifras de
 * columnas más angostas. Entonces van una bajo otra, a todo el ancho.
 */
const SEMANAS_EN_MEDIA_HOJA = 16;

function Graficas({
  informe,
  filtros,
  abierto,
  alPulsar,
}: {
  informe: InformeReservas;
  filtros: FiltrosInformeReservas;
  /** El departamento con la tabla abierta, o nulo. */
  abierto: string | null;
  alPulsar: (departamento: string) => void;
}) {
  const apiladasEnPapel = semanasDelInforme(informe, filtros).length > SEMANAS_EN_MEDIA_HOJA;
  /// `print:flex-none` al apilarlas: el `lg:flex-1` de la pantalla
  /// también vale en papel (la hoja pasa de 1.024 px) y en columna
  /// repartiría el alto en vez del ancho.
  const cadaUna = `min-w-0 lg:flex-1 ${apiladasEnPapel ? "print:flex-none" : "print:flex-1"}`;
  return (
    /// LAS DOS DEL MISMO ALTO, Y LA DE SEMANAS CRECE CON LA OTRA. «Si en
    /// Cupos sin nombre se ven los que faltan, que se alargue Cupos
    /// apartados por semana y se reduzca cuando se cierre» (cliente, 22
    /// sep 2026). Antes iban con `items-start` porque, estiradas, la de
    /// columnas copiaba el alto de la lista y quedaba con un 45 % en
    /// blanco --868 px al pulsar «Ver las otras»--. Ahora lo que se
    /// estira es la ZONA DE LAS COLUMNAS (`flex-1` en ALTO_COLUMNAS): el
    /// alto de más se lo llevan las barras y no un hueco. En papel sigue
    /// cada una con su alto, porque allí sale todo abierto.
    <div
      className={`flex flex-col gap-3 lg:flex-row lg:items-stretch ${
        apiladasEnPapel ? "print:flex-col print:items-stretch" : "print:flex-row print:items-start"
      }`}
    >
      <div className={cadaUna}>
        <PorDepartamento informe={informe} abierto={abierto} alPulsar={alPulsar} />
      </div>
      <div className={cadaUna}>
        <CuposPorSemana informe={informe} filtros={filtros} />
      </div>
    </div>
  );
}

type Semana = { lunes: string; cupos: number; enCurso: boolean };

/**
 * Los cupos de cada semana, de la semana de la primera reserva a la
 * de hoy (o a la del «hasta» elegido). El servidor manda solo los
 * días con algo; las semanas vacías se rellenan aquí con cero,
 * porque una semana sin reservas es justo lo que la gráfica tiene
 * que enseñar.
 */
function cuposPorSemana(serie: PuntoSerie[], fin: string, hoy: string): Semana[] {
  if (serie.length === 0) return [];
  const semanas = new Map<string, number>();
  const ultima = lunesDe(fin < serie[serie.length - 1].dia ? serie[serie.length - 1].dia : fin);
  /// Tope de 160 semanas (tres años): una fecha rara en la base no
  /// puede colgar la pantalla dibujando columnas.
  for (let l = lunesDe(serie[0].dia), k = 0; l <= ultima && k < 160; l = sumarDias(l, 7), k++) {
    semanas.set(l, 0);
  }
  for (const d of serie) {
    const l = lunesDe(d.dia);
    if (semanas.has(l)) semanas.set(l, (semanas.get(l) ?? 0) + d.cupos);
  }
  const deHoy = lunesDe(hoy);
  return [...semanas].map(([lunes, cupos]) => ({ lunes, cupos, enCurso: lunes === deHoy }));
}

/**
 * Las semanas que pinta la gráfica: hasta el «hasta» elegido o hasta
 * hoy, lo que llegue antes, porque más allá de hoy no hay nada que
 * dibujar. Va aparte porque la piden dos: la gráfica, y `Graficas`,
 * que con ella decide si en papel caben lado a lado.
 */
function semanasDelInforme(informe: InformeReservas, filtros: FiltrosInformeReservas): Semana[] {
  const hoy = diaDeBogota(informe.generadoEn);
  const fin = filtros.hasta && filtros.hasta < hoy ? filtros.hasta : hoy;
  return cuposPorSemana(informe.porDia, fin, hoy);
}

/**
 * Alto de la zona de columnas; la cifra de encima va dentro.
 *
 * Dos altos: 140 px apilada (celular, tableta, papel) y, desde 1.024
 * px, el que iguala la tarjeta con la lista de las ocho organizaciones
 * que tiene al lado --antes se estiraba y quedaba medio en blanco--.
 * Van como clases y no como número porque el alto lo decide el ancho
 * de la ventana; las columnas se miden en % de él.
 */
const ALTO_COLUMNAS =
  "h-[140px] lg:h-auto lg:min-h-[321px] lg:flex-1 print:h-[140px] print:min-h-0 print:flex-none";
const ALTO_CIFRA = 18;
/** Lo que ocupa un rótulo como «14 de sept» a 10 px, con aire. */
const ANCHO_ROTULO = 52;

/**
 * El ancho de la columna dentro de su tramo.
 *
 * Cada semana es un tramo `flex-1` sin hueco --los tramos se reparten
 * la caja entera-- y la columna va centrada en el suyo: el 78 % del
 * tramo, así que el hueco crece y mengua con ella. Con un hueco fijo
 * de 10 px, treinta semanas en 720 px dejaban columnas de 14 px
 * separadas por 10: más hueco que columna. Nunca menos de 4 px de
 * hueco, y nunca más de 80 px de columna: con tres semanas a partes
 * iguales salían bloques de 230 px; con el tope, lo que sobra queda
 * repartido alrededor de cada una y no amontonado a la derecha.
 *
 * Las fechas de debajo van en tramos iguales: caen bajo su columna
 * sin tener que repetir nada.
 */
const ANCHO_COLUMNA = "min(80px, calc(100% - max(4px, 22%)))";
/**
 * Por debajo de este paso (de centro a centro de columna) ya son
 * hilos: en vez de estrecharlas más, la caja se desplaza de lado.
 */
const PASO_MINIMO = 20;
/// Lo que mide la cifra de encima (0,6875 rem, Raleway), medido en el
/// navegador: el «1» 5,2 px, el punto de miles 2,4 y los demás dígitos
/// hasta 6,8 --Raleway no trae cifras de ancho fijo, así que
/// `tabular-nums` no las iguala--. Se toma el más ancho para todos
/// menos el «1»: quedarse corto es lo que las monta.
const ANCHO_DIGITO = 6.8;
const ANCHO_UNO = 5.2;
const ANCHO_PUNTO = 2.4;

function anchoDeCifra(valor: number): number {
  let ancho = 0;
  for (const c of n(valor)) ancho += c === "1" ? ANCHO_UNO : /\d/.test(c) ? ANCHO_DIGITO : ANCHO_PUNTO;
  return ancho;
}

/**
 * El paso más corto con el que las cifras de encima no se montan: la
 * mitad de cada una de dos vecinas, más 3 px de aire.
 *
 * Sale de LOS DATOS y no de un número fijo: «133» junto a «95» cabe en
 * 20 px, «1.250» junto a «980» pide 28. Con un mínimo fijo que cubriera
 * los miles, a 390 px las catorce semanas de hoy ya se desplazaban sin
 * necesitarlo; y con 4 px de aire también, en una ventana de escritorio
 * de 390 px, donde la barra de la página se come 15.
 */
function pasoMinimo(semanas: Semana[]): number {
  let paso = PASO_MINIMO;
  for (let i = 1; i < semanas.length; i++) {
    paso = Math.max(paso, (anchoDeCifra(semanas[i - 1].cupos) + anchoDeCifra(semanas[i].cupos)) / 2 + 3);
  }
  return Math.ceil(paso);
}

/**
 * Cada cuántas columnas cabe un rótulo, según el ancho de la gráfica.
 *
 * Se decide por el ancho de ESTA caja (`@container`) y no el de la
 * ventana: a 1.024 px la tarjeta va a media pantalla y es más angosta
 * que a 800. Cada escalón usa el ancho MÍNIMO de su tramo, así nunca
 * se montan; el primero, 220, es la caja de un celular de 320 px.
 *
 * De centro a centro de columna hay ancho / columnas, pero nunca menos
 * que `pasoMin`: por debajo la caja se desplaza y las columnas dejan
 * de estrecharse.
 */
function pasosDeRotulo(columnas: number, pasoMin: number) {
  const paso = (ancho: number) => Math.max(1, Math.ceil(ANCHO_ROTULO / Math.max(pasoMin, ancho / columnas)));
  return { base: paso(220), xs2: paso(288), sm: paso(384), lg: paso(512), xl2: paso(672) };
}

/// En papel no hay desplazamiento: la gráfica mide lo que dé la hoja,
/// A4 apaisado con 8 mm de margen (globals.css). Medido con medios de
/// impresión: 467 px a media hoja y 1.004 apilada; se toma algo menos.
const ANCHO_PAPEL_MEDIO = 460;
const ANCHO_PAPEL_ENTERO = 1000;

/**
 * Cómo sale en papel, donde la caja no se desplaza y el suelo de
 * `pasoMin` no existe: con muchas semanas las columnas quedan más
 * juntas que en pantalla.
 *
 * - `pasoRotulo`: cada cuántas columnas cabe una fecha a ESE ancho.
 *   Los escalones de `pasosDeRotulo` cuentan con el suelo, y en papel,
 *   con 53 semanas, las fechas se montaban 7 px.
 * - `apretada`: si ni así caben las cifras acostadas. Entonces van de
 *   pie, escritas de abajo arriba como en las gráficas densas, y la
 *   zona les guarda el alto de la más larga (`altoCifra`).
 */
function comoSaleEnPapel(semanas: Semana[], pasoMin: number) {
  const ancho = semanas.length > SEMANAS_EN_MEDIA_HOJA ? ANCHO_PAPEL_ENTERO : ANCHO_PAPEL_MEDIO;
  const paso = ancho / Math.max(1, semanas.length);
  return {
    pasoRotulo: Math.max(1, Math.ceil(ANCHO_ROTULO / paso)),
    apretada: paso < pasoMin,
    altoCifra: Math.ceil(Math.max(0, ...semanas.map((s) => anchoDeCifra(s.cupos)))) + 4,
  };
}

/**
 * Si el rótulo de la columna `i` se ve con este paso. «En curso» sale
 * siempre; el rótulo que le queda a menos de un paso se calla, porque
 * a 390 px se leía «14 deen curso» (los dos montados 25 px).
 */
function rotuloVisible(i: number, paso: number, enCurso: number): boolean {
  if (i === enCurso) return true;
  return i % paso === 0 && (enCurso < 0 || i > enCurso || enCurso - i >= paso);
}

/**
 * G2 · CUPOS APARTADOS POR SEMANA, en columnas.
 *
 * Reemplaza la línea acumulada día a día: casi plana, con el punto
 * del final estirado en óvalo por un svg que se deformaba al ancho
 * --y al final de la pantalla, donde «veo el gráfico al final»
 * (cliente) era una queja--. Por semana se ve de un golpe cuándo se
 * reservó y desde cuándo no.
 *
 * Columnas en HTML y SIN svg: nada que se estire. Cada una lleva su
 * cifra encima, porque el papel no tiene puntero; la semana en curso
 * va más clara y dice «en curso», porque aún puede crecer; las
 * vacías, un 0 sobre la base.
 *
 * LAS COLUMNAS SE REPARTEN TODO EL ANCHO. Iban a 48 px fijos, y con
 * las once semanas de ADECOPRIA llenaban 588 px de una caja de 720 (a
 * 1.600 px): «que se adapte a lo que tiene, porque se pierde espacio»
 * (cliente, 21 sep 2026). Ahora cada semana es un tramo `flex-1`, así
 * que las columnas se estrechan solas a medida que llegan semanas; con
 * muy pocas las frena el tope de `ANCHO_COLUMNA`, y con muchas, antes
 * de volverse hilos, la caja se desplaza de lado (`pasoMinimo`).
 */
function CuposPorSemana({ informe, filtros }: { informe: InformeReservas; filtros: FiltrosInformeReservas }) {
  const serie = informe.porDia;
  const hoy = diaDeBogota(informe.generadoEn);
  const semanas = semanasDelInforme(informe, filtros);
  const tope = Math.max(1, ...semanas.map((s) => s.cupos));
  const ultima = serie[serie.length - 1]?.dia ?? null;
  const hace = ultima ? diasEntre(ultima, hoy) : 0;
  const pasoMin = pasoMinimo(semanas);
  /// En lo angosto, una fecha cada dos o tres columnas: once rótulos
  /// de «13 jul» en 300 px se montan unos sobre otros.
  const pasos = pasosDeRotulo(semanas.length, pasoMin);
  const papel = comoSaleEnPapel(semanas, pasoMin);
  const iEnCurso = semanas.findIndex((s) => s.enCurso);
  const caja = useRef<HTMLDivElement>(null);

  /// Si no caben y la caja se desplaza, que abra por el final: la
  /// semana en curso y las de antes son las que se vienen a mirar, y
  /// la primera columna cortada a la izquierda ya dice que hay más.
  useEffect(() => {
    const c = caja.current;
    if (c && c.scrollWidth > c.clientWidth) c.scrollLeft = c.scrollWidth;
  }, [semanas.length]);

  return (
    <Bloque
      estirado
      titulo="Cupos reservados por semana"
      descripcion={
        ultima
          ? `Última reserva el ${diaYMes(ultima)}${hace > 0 ? `, hace ${cuenta(hace, "día", "días")}` : ", hoy"}.`
          : undefined
      }
    >
      {semanas.length === 0 ? (
        <p className="py-4 text-[0.8125rem] text-texto-suave">Todavía no hay reservas que mostrar.</p>
      ) : (
        <div className="@container lg:flex lg:h-full lg:flex-col print:block">
          {/* La caja que se desplaza invade el relleno del bloque
              (`-mx-7 px-7`, el mismo px-7 de `Bloque`): el rótulo de
              la primera columna y el «en curso» de la última sobresalen
              de su columna, y una caja con `overflow` los cortaba por
              la mitad en el borde de la gráfica. En papel no se
              desplaza nada: sale entera, al ancho que haya. */}
          <div
            ref={caja}
            role="img"
            aria-label={`Cupos reservados por semana: ${semanas.map((s) => `semana del ${diaCorto(s.lunes)}, ${n(s.cupos)}${s.enCurso ? " (en curso)" : ""}`).join("; ")}.`}
            className="-mx-7 overflow-x-auto px-7 lg:flex lg:flex-1 lg:flex-col print:block print:overflow-visible"
          >
            <div
              className="min-w-(--ancho-minimo) lg:flex lg:flex-1 lg:flex-col print:block print:min-w-0"
              style={{ "--ancho-minimo": `${semanas.length * pasoMin}px` } as React.CSSProperties}
            >
              {/* `--alto-cifra`: lo que la zona guarda encima de la columna
                  más alta para su cifra. En papel apretado las cifras van
                  de pie y piden el alto de la más larga. */}
              <div
                className={`flex items-end border-b border-borde ${ALTO_COLUMNAS} ${
                  papel.apretada ? "print:[--alto-cifra:var(--alto-cifra-papel)]" : ""
                }`}
                style={
                  papel.apretada ? ({ "--alto-cifra-papel": `${papel.altoCifra}px` } as React.CSSProperties) : undefined
                }
              >
                {semanas.map((s) => {
                  /// En % del alto de la zona, menos la cifra: el alto
                  /// cambia con la ventana y la proporción no.
                  const alto =
                    s.cupos > 0 ? `max(2px, calc((100% - var(--alto-cifra, ${ALTO_CIFRA}px)) * ${s.cupos / tope}))` : "0px";
                  return (
                    <div
                      key={s.lunes}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                      title={`Semana del ${diaYMes(s.lunes)}: ${cuenta(s.cupos, "cupo", "cupos")}${s.enCurso ? " (en curso)" : ""}`}
                    >
                      <span
                        className={`text-[0.6875rem] leading-none whitespace-nowrap tabular-nums ${s.cupos > 0 ? "font-semibold text-titulo" : "text-texto-suave"} ${
                          papel.apretada ? "print:rotate-180 print:[writing-mode:vertical-rl]" : ""
                        }`}
                        style={{ marginBottom: 3 }}
                      >
                        {n(s.cupos)}
                      </span>
                      <div
                        className={`rounded-t-[4px] ${s.enCurso ? "bg-marca/40" : "bg-marca"}`}
                        style={{ height: alto, width: ANCHO_COLUMNA }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 flex" aria-hidden>
                {semanas.map((s, i) => {
                  const ve = (paso: number) => rotuloVisible(i, paso, iEnCurso);
                  /// `flex justify-center` y no `text-center`: el texto es
                  /// más ancho que su columna, y un texto que desborda no
                  /// se centra --arrancaba en el borde izquierdo y acababa
                  /// bajo la columna siguiente--. El flex sí reparte lo que
                  /// sobra a los dos lados.
                  return (
                    <span
                      key={s.lunes}
                      className={`flex min-w-0 flex-1 justify-center overflow-visible text-[0.625rem] leading-tight whitespace-nowrap text-texto-suave ${
                        ve(pasos.base) ? "" : "invisible"
                      } ${ve(pasos.xs2) ? "@2xs:visible" : "@2xs:invisible"} ${
                        ve(pasos.sm) ? "@sm:visible" : "@sm:invisible"
                      } ${ve(pasos.lg) ? "@lg:visible" : "@lg:invisible"} ${
                        ve(pasos.xl2) ? "@2xl:visible" : "@2xl:invisible"
                      } ${ve(papel.pasoRotulo) ? "print:visible" : "print:invisible"}`}
                    >
                      <span className="shrink-0">{s.enCurso ? "en curso" : diaCorto(s.lunes)}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </Bloque>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3 · LA TABLA: POR ACCIÓN, CON SUS ORGANIZACIONES DENTRO
   ═══════════════════════════════════════════════════════════════ */

function Th({
  children,
  derecha,
  className = "",
}: {
  children: React.ReactNode;
  derecha?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-3.5 py-2.5 align-bottom text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase ${
        derecha ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

/// `px-3.5` y NO `px-4`, en todas las celdas de este archivo. En papel,
/// globals.css pone `padding: 0 !important` a todo lo que lleve
/// «px-4» en la clase (`body [class*="px-4"]`, pensada para el
/// envoltorio de la página), y el PDF salía con el código AF y la
/// última cifra pegados al canto de la tabla.
const CELDA = "px-3.5 py-2 align-top text-[0.8125rem]";
const CELDA_CIFRA = `${CELDA} text-right tabular-nums`;

/* ═══════════════════════════════════════════════════════════════
   4 · DESGLOSE POR DEPARTAMENTO
   ═══════════════════════════════════════════════════════════════ */

/**
 * «Desglose Departamentos» (cliente, 23 sep 2026).
 *
 * UN ESCALÓN POR ENCIMA DE «Dónde se dicta». En ese filtro, la ciudad
 * de Medellín y el departamento de Antioquia son dos entradas
 * distintas; aquí van en la misma barra, que es como se mira la
 * cobertura del proyecto.
 *
 * DOS BARRAS Y NO UNA: los cupos apartados en gris y los que ya
 * tienen nombre en verde, encima. Con una sola barra de cupos no se
 * ve dónde está lo que falta por llenar, que es justo para lo que se
 * mira este bloque en septiembre.
 */
/** Cuántos departamentos enseña antes de «Ver los otros». */
const DEPARTAMENTOS_EN_GRAFICA = 8;

function PorDepartamento({
  informe,
  abierto,
  alPulsar,
}: {
  informe: InformeReservas;
  abierto: string | null;
  alPulsar: (departamento: string) => void;
}) {
  /// Se corta en ocho y se abre desde aquí, no desde quien llama: el
  /// corte es cosa de esta lista, y así abrir esta no abre la de al
  /// lado. Nace cerrada.
  const [todos, setTodos] = useState(false);
  const filas = informe.porDepartamento;

  /// El tope sale de TODAS las filas, no de las visibles: si saliera
  /// de las visibles, al abrir la lista la primera barra se encogería
  /// sin que su cifra hubiera cambiado.
  const tope = Math.max(1, ...filas.map((d) => d.cuposConfirmados));
  const resto = filas.length - DEPARTAMENTOS_EN_GRAFICA;
  const visibles = todos || resto <= 0 ? filas : filas.slice(0, DEPARTAMENTOS_EN_GRAFICA);

  return (
    <Bloque
      estirado
      titulo="Cupos por departamento"
      descripcion="Dónde se dictan los cursos de las reservas. En verde, los cupos que ya tienen una persona detrás. Pulse uno para ver su seguimiento debajo."
    >
      {filas.length === 0 && (
        <p className="py-4 text-[0.8125rem] text-texto-suave">
          Ninguna reserva de este recorte tiene sede con departamento.
        </p>
      )}
      <ul className="space-y-2.5">
        {visibles.map((d) => {
          const suya = abierto === d.departamento;
          return (
            <li key={d.departamento}>
              {/* LA BARRA ENTERA ES LA PUERTA, no un enlace al lado:
                  lo que se quiere pulsar es el departamento, y un
                  blanco de 18 px dentro de una fila de 40 se falla.

                  `imprimible`: en papel, globals.css esconde todo
                  `button` que no la lleve --son controles--, y sin
                  ella la gráfica salía en blanco en el PDF. */}
              <button
                type="button"
                onClick={() => alPulsar(d.departamento)}
                aria-expanded={suya}
                className={`imprimible -mx-2 block w-full rounded-lg px-2 py-1 text-left transition hover:bg-superficie-alterna ${
                  suya ? "bg-marca-suave" : ""
                }`}
              >
                <span className="flex items-baseline justify-between gap-3 text-[0.8125rem] leading-snug">
                  <span
                    className={`min-w-0 truncate ${suya ? "font-semibold text-marca-fuerte" : ""}`}
                    title={bonito(d.departamento)}
                  >
                    {bonito(d.departamento)}
                    <span className="ml-2 text-[0.75rem] font-normal text-texto-suave">
                      {cuenta(d.organizaciones, "institución", "instituciones")}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums">
                    <span className="font-semibold text-titulo">{n(d.cuposConfirmados)}</span>
                    <span className="ml-1 text-[0.75rem] text-texto-suave">
                      {d.cuposConfirmados === 1 ? "cupo" : "cupos"}
                    </span>
                  </span>
                </span>
                {/* La barra verde va DENTRO de la gris, no al lado: son
                    una parte y su todo, y dos barras hermanas se leerían
                    como dos cantidades que se suman. */}
                <span className="mt-1 block h-2.5 w-full overflow-hidden rounded-full bg-superficie-alterna">
                  <span
                    className="block h-full rounded-full bg-marca/25"
                    style={{ width: `${Math.max((d.cuposConfirmados / tope) * 100, 1)}%` }}
                  >
                    <span
                      className="block h-full rounded-full bg-exito"
                      style={{
                        width: `${d.cuposConfirmados > 0 ? (d.conNombre / d.cuposConfirmados) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {resto > 0 && (
          <li className="no-imprimir pt-1">
            {/* DICE CUÁNTOS Y ADÓNDE LLEVA. «Y 7 más» sin puerta es un
                renglón de texto muerto. */}
            <button
              type="button"
              onClick={() => setTodos((v) => !v)}
              className="text-xs font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
            >
              {todos
                ? `Ver solo los ${n(DEPARTAMENTOS_EN_GRAFICA)} primeros`
                : `Ver los otros ${n(resto)}`}
            </button>
          </li>
        )}
      </ul>
    </Bloque>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5 · SEGUIMIENTO: LO APARTADO CONTRA LO QUE LLEGÓ
   ═══════════════════════════════════════════════════════════════ */

/**
 * «Cuántos se han inscrito sobre la reserva: cantidad apartada vs
 * cuántos llegaron, en tabla de seguimiento» (cliente, 23 sep 2026).
 *
 * DOS COLUMNAS Y NO UNA CELDA «0/16». Su maqueta llevaba las dos
 * cifras juntas en la misma casilla —«quizás dos columnas, reserva y
 * cupos ocupados»—, y partidas se pueden ordenar, sumar y leer a lo
 * ancho sin hacer la división de cabeza.
 *
 * UNA FILA POR INSTITUCIÓN Y ACCIÓN, que es exactamente lo que ya
 * calcula el informe (`cruce`). La matriz con una columna por AF
 * hacía catorce columnas con las dos cifras, y en un portátil se leía
 * desplazándose a ciegas; así cabe, se puede filtrar por acción
 * arriba, y cada fila tiene sitio para lo que de verdad hacía falta:
 * cuánto le queda de plazo.
 *
 * EL PLAZO ES LO NUEVO. «Contexto a más tardar el 30 de septiembre,
 * avisar 2 semanas antes que ya no van a participar». El estado lo
 * calcula el servidor (`plazo-de-reservas.ts`) para que la pantalla y
 * el papel no puedan discrepar.
 */
const SEMAFORO: Record<
  FilaInformeCruce["estadoPlazo"],
  { texto: string; clase: string }
> = {
  COMPLETA: { texto: "Completa", clase: "text-exito" },
  EN_PLAZO: { texto: "En plazo", clase: "text-texto-suave" },
  POR_VENCER: { texto: "Por vencer", clase: "text-aviso" },
  VENCIDA: { texto: "Vencida", clase: "text-error" },
};

/**
 * Cómo se llama la barra de las sedes sin departamento.
 *
 * Espejo de `SIN_DEPARTAMENTO` en
 * `backend/src/tableros/informe-de-reservas.ts`. Aquí hace falta
 * porque no es un departamento y en una frase se nota: «lo apartado
 * en Sin departamento» no es español.
 */
const SIN_DEPARTAMENTO = "Sin departamento";

function comoSeLlama(departamento: string): string {
  return departamento === SIN_DEPARTAMENTO
    ? "las sedes sin departamento"
    : bonito(departamento);
}

function Seguimiento({
  informe,
  departamento,
  alCerrar,
}: {
  informe: InformeReservas;
  /** Puesto, la tabla es la de ese departamento y lleva su nombre. */
  departamento?: string;
  alCerrar?: () => void;
}) {
  const filas = informe.cruce;
  if (filas.length === 0) return null;

  const dias = diasEntre(informe.plazo.hoy, informe.plazo.entregaNombres);
  const t = filas.reduce(
    (a, f) => ({
      cuposConfirmados: a.cuposConfirmados + f.cuposConfirmados,
      conNombre: a.conNombre + f.conNombre,
      sinNombre: a.sinNombre + f.sinNombre,
    }),
    { cuposConfirmados: 0, conNombre: 0, sinNombre: 0 },
  );

  return (
    <Bloque
      sinRelleno
      partible
      titulo="Seguimiento de las reservas"
      descripcion={
        departamento
          ? `Lo que apartó cada institución en ${comoSeLlama(departamento)}, acción por acción, y cuántos cupos ya tienen persona.`
          : "Cuántos cupos apartó cada institución en cada acción y cuántos ya tienen persona."
      }
      acciones={alCerrar && <BotonCerrarSeguimiento alPulsar={alCerrar} />}
    >
      {/* EL PLAZO, ARRIBA Y EN UNA LÍNEA. Va antes de la tabla y no en
          el pie porque es la razón de mirarla en septiembre. */}
      <p
        className={`border-b border-hairline px-3.5 py-2.5 text-[0.75rem] leading-snug ${
          dias < 0 ? "text-error" : dias <= informe.plazo.diasDeAviso ? "text-aviso" : "text-texto-suave"
        }`}
      >
        <strong className="font-semibold">
          Las instituciones tienen hasta el {diaLargo(informe.plazo.entregaNombres)} para
          entregar los nombres de sus cupos.
        </strong>{" "}
        {dias > 0
          ? `Quedan ${cuenta(dias, "día", "días")}.`
          : dias === 0
            ? "Hoy es el último día."
            : `El plazo venció hace ${cuenta(-dias, "día", "días")}.`}{" "}
        Quien no vaya a participar tiene que avisarlo con {informe.plazo.diasDeAviso} días de
        antelación para que sus cupos se puedan volver a ofrecer.
      </p>

      <div className="caja-scroll overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-borde">
            <tr>
              <Th className="pl-7">Institución</Th>
              <Th>AF</Th>
              <Th>Dónde se dicta</Th>
              <Th derecha>Cupos reservados</Th>
              <Th derecha>Cupos ocupados</Th>
              {/* «Cupos pendientes» y no «Pendientes»: el cliente lo
                  pidió en el listado de reservas (25 sep 2026) y esta
                  tabla es de donde se copiaron esos rótulos. Cambiar
                  una y dejar la otra volvería a dar dos nombres para
                  la misma cifra. */}
              <Th derecha>Cupos pendientes</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={`${f.accionFormacionId}|${f.empresaId}`} className="border-b border-hairline">
                <td className={`${CELDA} pl-7`}>
                  <span className="font-medium">{bonito(f.razonSocial)}</span>
                  <span className="block text-[0.6875rem] text-texto-suave">{f.nit}</span>
                </td>
                <td className={`${CELDA} font-mono text-xs whitespace-nowrap`} title={f.accion}>
                  {f.codigo}
                </td>
                <td className={CELDA}>
                  {f.ubicaciones.length > 0 ? f.ubicaciones.map(bonito).join(", ") : "—"}
                </td>
                <td className={CELDA_CIFRA}>{n(f.cuposConfirmados)}</td>
                <td className={`${CELDA_CIFRA} font-semibold text-exito`}>{n(f.conNombre)}</td>
                <td className={`${CELDA_CIFRA} ${f.sinNombre > 0 ? "text-error" : ""}`}>
                  {n(f.sinNombre)}
                </td>
                <td className={CELDA}>
                  <span className={`text-[0.75rem] font-semibold ${SEMAFORO[f.estadoPlazo].clase}`}>
                    {SEMAFORO[f.estadoPlazo].texto}
                  </span>
                </td>
              </tr>
            ))}

            <tr className="border-t-2 border-borde font-semibold">
              <td className={`${CELDA} pl-7`} colSpan={3}>
                Suma total
              </td>
              <td className={CELDA_CIFRA}>{n(t.cuposConfirmados)}</td>
              <td className={`${CELDA_CIFRA} text-exito`}>{n(t.conNombre)}</td>
              <td className={CELDA_CIFRA}>{n(t.sinNombre)}</td>
              <td className={CELDA} />
            </tr>
          </tbody>
        </table>
      </div>
    </Bloque>
  );
}

function BotonCerrarSeguimiento({ alPulsar }: { alPulsar: () => void }) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      className="no-imprimir shrink-0 text-[0.75rem] font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
    >
      Cerrar
    </button>
  );
}

/**
 * La tabla de seguimiento de UN departamento, colgada del clic en su
 * barra (cliente, 25 sep 2026).
 *
 * SE LE PIDE AL SERVIDOR, NO SE RECORTA AQUÍ. Las filas del cruce
 * traen las ubicaciones donde se dicta --«Medellín»--, no el
 * departamento, así que en el navegador no hay con qué separar
 * Antioquia de Atlántico. Y aunque lo hubiera: `estadoPlazo` lo
 * calcula el servidor sobre el `sinNombre` de la fila ENTERA, y una
 * fila recortada sin recalcularlo diría «Completa» de una institución
 * a la que le faltan nombres en otro departamento. El mismo informe
 * con `departamento` puesto llega cuadrado, y la regla del plazo
 * sigue viviendo en un solo sitio.
 *
 * NO TOCA LOS FILTROS DE LA DIRECCIÓN. Poniendo el departamento
 * arriba, la gráfica se quedaría con la única barra que el servidor
 * devolvería --la que se acaba de pulsar-- y no habría desde dónde
 * pulsar la siguiente. Es el mismo defecto que el desplegable de
 * departamentos ya evita pintándose desde el catálogo.
 */
function SeguimientoDeUnDepartamento({
  departamento,
  filtros,
  alCerrar,
}: {
  /** Nulo: no hay ninguno abierto y esto no pinta nada. */
  departamento: string | null;
  filtros: FiltrosInformeReservas;
  alCerrar: () => void;
}) {
  /// Lo ya pedido, por recorte. Abrir y cerrar el mismo departamento
  /// tres veces son tres informes idénticos, y este no es una
  /// consulta barata --además de que el servidor limita a 60 por
  /// minuto y ahí caben también los cambios de filtro--.
  const pedidos = useRef(new Map<string, InformeReservas>());
  const clave = departamento ? JSON.stringify({ ...filtros, departamento }) : null;
  const [informe, setInforme] = useState<InformeReservas | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    if (!clave) return;
    const guardado = pedidos.current.get(clave);
    /// En el mismo paso que se lanza la petición: si se dejara el
    /// informe anterior puesto, al pasar de un departamento a otro se
    /// vería un segundo la tabla del primero con el título del
    /// segundo.
    setInforme(guardado ?? null);
    setFallo(null);
    if (guardado) return;

    let vigente = true;
    tablerosApi.informeReservas(JSON.parse(clave) as FiltrosInformeReservas).then(
      (i) => {
        if (!vigente) return;
        pedidos.current.set(clave, i);
        setInforme(i);
      },
      (e) => {
        if (vigente) setFallo(mensajeDeFallo(e));
      },
    );
    return () => {
      vigente = false;
    };
  }, [clave]);

  if (!departamento) return null;
  const cerrar = <BotonCerrarSeguimiento alPulsar={alCerrar} />;

  if (fallo) {
    return (
      <Bloque titulo="Seguimiento de las reservas" acciones={cerrar}>
        <p className="text-[0.8125rem] text-error">{fallo}</p>
      </Bloque>
    );
  }

  if (!informe) {
    return (
      <Bloque
        titulo="Seguimiento de las reservas"
        descripcion={`Buscando lo apartado en ${comoSeLlama(departamento)}…`}
        acciones={cerrar}
      >
        {/* Tres renglones del alto de las filas de la tabla: así la
            página no pega un salto cuando llega la respuesta. */}
        <div className="space-y-3" aria-hidden>
          <span className="sr-only" aria-live="polite">
            Cargando el seguimiento
          </span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded-full bg-current/10" />
          ))}
        </div>
      </Bloque>
    );
  }

  if (informe.cruce.length === 0) {
    return (
      <Bloque titulo="Seguimiento de las reservas" acciones={cerrar}>
        <p className="text-[0.8125rem] text-texto-suave">
          Ninguna reserva de este recorte se dicta en {comoSeLlama(departamento)}.
        </p>
      </Bloque>
    );
  }

  return <Seguimiento informe={informe} departamento={departamento} alCerrar={alCerrar} />;
}
