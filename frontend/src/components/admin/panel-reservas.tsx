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
import { createContext, useEffect, useMemo, useState } from "react";

import { EncabezadoImpresion } from "./boton-pdf";
import { Desplegable } from "./desplegable";
import { n } from "./graficos";
import { Aviso } from "./marco-admin";
import { Bloque, Esqueleto, TarjetaCifra, Vacio } from "./piezas";
import { adminApi } from "@/lib/admin-api";
import { bonito, comoParrafo } from "@/lib/api";
import type { Filtros } from "@/lib/crm-api";
import { ErrorApi } from "@/lib/pedir";
import {
  tablerosApi,
  type FilaInformeAccion,
  type FilaInformeCruce,
  type FilaInformeOrganizacion,
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
  const p = new URLSearchParams({ pantalla: "reservas" });
  if (cortes?.convenioId) p.set("convenioId", cortes.convenioId);
  if (cortes?.accionFormacionId) p.set("accionFormacionId", cortes.accionFormacionId);
  const ignorados = [
    cortes?.asesorId ? "asesor" : null,
    cortes?.grupoId ? "grupo" : null,
    cortes?.departamentoSepId != null ? "departamento" : null,
  ].filter((x): x is string => x !== null);
  if (ignorados.length) p.set("ignorados", ignorados.join(","));
  return `/admin/control?${p.toString()}`;
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

  return (
    <>
      <ResumenGeneral informe={informe} />
      <Graficas informe={informe} filtros={filtros} />
      <TablaPorAccion informe={informe} />
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

  const accionElegida = filtros.accionFormacionId ?? "";
  const ubicacionElegida = filtros.ubicacionId ?? "";

  /// Lo que está puesto, dicho en el botón del celular: con los
  /// controles plegados, sin esto no se sabría qué recorte se mira.
  const puesto = [
    convenios.find((c) => c.id === gremio)?.sigla ?? convenios.find((c) => c.id === gremio)?.nombre,
    (catalogo?.porAccion ?? []).find((a) => a.accionFormacionId === accionElegida)?.codigo,
    ubicaciones.find((u) => u.ubicacionId === ubicacionElegida)?.nombre
      ? bonito(ubicaciones.find((u) => u.ubicacionId === ubicacionElegida)?.nombre ?? "")
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
 * Las cuatro cifras de arriba, con el gremio en el título.
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
  const organizacionesQueDeben = informe.porOrganizacion.filter((o) => o.sinNombre > 0).length;
  const convenios = informe.recorte.convenios;

  return (
    <Bloque
      titulo={tituloEnPantalla(informe)}
      /// Con un gremio, el título lo dice todo. Con varios, «los dos
      /// gremios» necesita decir cuáles.
      descripcion={
        convenios.length > 1 ? listaEnPalabras(convenios.map((c) => c.sigla ?? c.nombre)) : undefined
      }
      sinRelleno
      acciones={
        /* La lista de trabajo, que se queda como estaba en
           Sistemas de Información. Desde el informe se llega a la
           fila concreta --el contacto, el teléfono-- que aquí no
           se trae. */
        <Link
          href="/admin/reservas"
          className="no-imprimir self-center text-[0.75rem] font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
        >
          Ver el listado
        </Link>
      }
    >
      {/* FLEX Y NO REJILLA. En papel, globals.css aplana toda rejilla
          que cuelgue de un `section` («las rejillas pasan a flujo»), y
          las cuatro cifras salían apiladas en media hoja. El `gap-px`
          sobre la raya de fondo pinta los separadores también cuando
          en un celular pasan a dos por fila. */}
      <div className="flex flex-wrap gap-px bg-hairline">
        <Celda>
          <TarjetaCifra
            etiqueta="Reservas"
            valor={n(t.reservas)}
            pie={`de ${cuenta(t.organizaciones, "organización", "organizaciones")} en ${cuenta(t.acciones, "acción", "acciones")}`}
          />
        </Celda>
        <Celda>
          <TarjetaCifra
            etiqueta="Cupos apartados"
            valor={n(t.cuposConfirmados)}
            pie={t.cuposEnEspera > 0 ? `y ${n(t.cuposEnEspera)} en lista de espera` : "ninguno en lista de espera"}
          />
        </Celda>
        <Celda>
          <TarjetaCifra
            etiqueta="Ya tienen nombre"
            valor={n(conNombre)}
            tono="exito"
            pie={
              t.cuposConfirmados > 0
                ? `${porciento(conNombre, t.cuposConfirmados)} % de los cupos`
                : "sin cupos confirmados"
            }
          />
        </Celda>
        <Celda>
          <TarjetaCifra
            etiqueta="Siguen sin nombre"
            valor={n(t.sinNombre)}
            tono={t.sinNombre > 0 ? "error" : "neutro"}
            pie={
              organizacionesQueDeben > 0
                ? `en ${cuenta(organizacionesQueDeben, "organización", "organizaciones")}`
                : "todas mandaron sus nombres"
            }
          />
        </Celda>
      </div>

      <ComoSeCuentan informe={informe} />
    </Bloque>
  );
}

function Celda({ children }: { children: React.ReactNode }) {
  return <div className="min-w-[150px] flex-1 bg-superficie">{children}</div>;
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
    <details className="group border-t border-hairline">
      <summary className="sin-aro flex cursor-pointer list-none items-center gap-2 px-7 py-2.5 text-[0.75rem] text-texto-suave select-none hover:text-texto">
        <span aria-hidden className="text-[0.5625rem] transition-transform group-open:rotate-90">
          &#9656;
        </span>
        <span>
          <span className="font-medium text-texto">Cómo se cuentan estas cifras</span>
          {rotulo.length > 0 && ` · ${rotulo.join(" · ")}`}
        </span>
      </summary>
      <ul className="list-disc space-y-1 pr-7 pb-3 pl-12 text-[0.75rem] leading-snug text-texto-suave">
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
 */
function Graficas({ informe, filtros }: { informe: InformeReservas; filtros: FiltrosInformeReservas }) {
  return (
    /// `items-start`: cada tarjeta con su alto. Estiradas a la par, la
    /// de columnas copiaba el alto de la lista y quedaba con un 45 % en
    /// blanco --868 px al pulsar «Ver las otras»--. El alto parejo con
    /// las ocho barras lo pone el alto ancho de ALTO_COLUMNAS, no el
    /// estirón.
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start print:flex-row print:items-start">
      <div className="min-w-0 lg:flex-1 print:flex-1">
        <QuienDebeNombres organizaciones={informe.porOrganizacion} />
      </div>
      <div className="min-w-0 lg:flex-1 print:flex-1">
        <CuposPorSemana informe={informe} filtros={filtros} />
      </div>
    </div>
  );
}

/** Cuántas organizaciones enseña la gráfica antes de «Ver las otras». */
const ORGANIZACIONES_EN_GRAFICA = 8;

/**
 * G1 · CUPOS SIN NOMBRE, POR ORGANIZACIÓN: la lista de a quién llamar.
 *
 * Un solo color, el rojo de «Siguen sin nombre» (--error): la misma
 * idea salía en tres colores --el 136 rojo arriba y las barras azul y
 * naranja aquí--, y el par verde/rojo se confunde con deuteranopia.
 *
 * SIN PISTA GRIS DETRÁS. La barra se mide contra la organización que
 * más debe, no contra su propio total, y una pista gris se leía como
 * «los que ya tienen nombre»: Aceros del Norte, 36 de 36, sin un solo
 * nombre, dejaba un 8 % gris; El Faro, 39 de 40, llegaba al 100 %. El
 * dibujo contradecía la cifra de al lado. Sola, la barra es lo que
 * es: un orden de a quién llamar primero; el «de 36» va en letra.
 * El rojo contra el fondo de la tarjeta da 6,3:1 en claro y en
 * oscuro (calculado de --error y --superficie; el mínimo es 3:1).
 *
 * Las barras van en este archivo y no con `ListaBarras` de
 * graficos.tsx, que pinta en el azul de la marca con degradado y no
 * deja cambiarlo. El «Ver las otras N» es el mismo de aquella.
 */
function QuienDebeNombres({ organizaciones }: { organizaciones: FilaInformeOrganizacion[] }) {
  const [todas, setTodas] = useState(false);
  const queDeben = organizaciones.filter((o) => o.sinNombre > 0);
  const alDia = organizaciones.filter((o) => o.sinNombre === 0 && o.cuposConfirmados > 0).length;
  const resto = queDeben.length - ORGANIZACIONES_EN_GRAFICA;
  const visibles = todas || resto <= 0 ? queDeben : queDeben.slice(0, ORGANIZACIONES_EN_GRAFICA);
  /// El tope sale de TODAS y no de las visibles: al abrir la lista la
  /// primera barra no puede encogerse sin que su cifra cambie.
  const tope = Math.max(1, ...queDeben.map((o) => o.sinNombre));

  return (
    <Bloque estirado titulo="Cupos sin nombre, por organización">
      {queDeben.length === 0 ? (
        <p className="py-4 text-[0.8125rem] text-texto-suave">
          Todas las organizaciones mandaron los nombres de sus cupos.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visibles.map((o) => (
            <li key={o.empresaId}>
              <div className="flex items-baseline justify-between gap-3 text-[0.8125rem] leading-snug">
                <span className="min-w-0 truncate" title={o.razonSocial}>
                  {o.razonSocial}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  <span className="font-semibold text-titulo">{n(o.sinNombre)}</span>
                  <span className="ml-1 text-[0.75rem] text-texto-suave">de {n(o.cuposConfirmados)}</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 w-full">
                <div
                  className="barra-sin-nombre h-full rounded-full bg-error"
                  style={{ width: `${Math.max((o.sinNombre / tope) * 100, 1)}%` }}
                />
              </div>
            </li>
          ))}
          {resto > 0 && (
            <li className="no-imprimir pt-1">
              <button
                type="button"
                onClick={() => setTodas((v) => !v)}
                className="text-xs font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
              >
                {todas ? `Ver solo las ${n(ORGANIZACIONES_EN_GRAFICA)} primeras` : `Ver las otras ${n(resto)}`}
              </button>
            </li>
          )}
        </ul>
      )}
      {alDia > 0 && (
        <p className="mt-3 text-[0.75rem] text-texto-suave">
          {cuenta(alDia, "organización ya mandó", "organizaciones ya mandaron")} todos sus nombres.
        </p>
      )}
    </Bloque>
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
 * Alto de la zona de columnas; la cifra de encima va dentro.
 *
 * Dos altos: 140 px apilada (celular, tableta, papel) y, desde 1.024
 * px, el que iguala la tarjeta con la lista de las ocho organizaciones
 * que tiene al lado --antes se estiraba y quedaba medio en blanco--.
 * Van como clases y no como número porque el alto lo decide el ancho
 * de la ventana; las columnas se miden en % de él.
 */
const ALTO_COLUMNAS = "h-[140px] lg:h-[321px] print:h-[140px]";
const ALTO_CIFRA = 18;
/** Lo que ocupa un rótulo como «14 de sept» a 10 px, con aire. */
const ANCHO_ROTULO = 52;

/**
 * Cada cuántas columnas cabe un rótulo, según el ancho de la gráfica.
 *
 * Se decide por el ancho de ESTA caja (`@container`) y no el de la
 * ventana: a 1.024 px la tarjeta va a media pantalla y es más angosta
 * que a 800. Cada escalón usa el ancho MÍNIMO de su tramo, así nunca
 * se montan; el 6 es el hueco entre columnas.
 */
function pasosDeRotulo(columnas: number) {
  const paso = (ancho: number) => Math.max(1, Math.ceil((ANCHO_ROTULO * columnas) / (ancho + 6)));
  return { base: paso(280), sm: paso(384), lg: paso(512), xl2: paso(672) };
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
 */
function CuposPorSemana({ informe, filtros }: { informe: InformeReservas; filtros: FiltrosInformeReservas }) {
  const serie = informe.porDia;
  const hoy = diaDeBogota(informe.generadoEn);
  /// Hasta el «hasta» elegido o hasta hoy, lo que llegue antes: más
  /// allá de hoy no hay nada que dibujar.
  const fin = filtros.hasta && filtros.hasta < hoy ? filtros.hasta : hoy;
  const semanas = cuposPorSemana(serie, fin, hoy);
  const tope = Math.max(1, ...semanas.map((s) => s.cupos));
  const ultima = serie[serie.length - 1]?.dia ?? null;
  const hace = ultima ? diasEntre(ultima, hoy) : 0;
  /// En lo angosto, una fecha cada dos o tres columnas: once rótulos
  /// de «13 jul» en 300 px se montan unos sobre otros.
  const pasos = pasosDeRotulo(semanas.length);
  const iEnCurso = semanas.findIndex((s) => s.enCurso);

  return (
    <Bloque
      estirado
      titulo="Cupos apartados por semana"
      descripcion={
        ultima
          ? `Última reserva el ${diaYMes(ultima)}${hace > 0 ? `, hace ${cuenta(hace, "día", "días")}` : ", hoy"}.`
          : undefined
      }
    >
      {semanas.length === 0 ? (
        <p className="py-4 text-[0.8125rem] text-texto-suave">Todavía no hay reservas que mostrar.</p>
      ) : (
        <div
          className="@container"
          role="img"
          aria-label={`Cupos apartados por semana: ${semanas.map((s) => `semana del ${diaCorto(s.lunes)}, ${n(s.cupos)}${s.enCurso ? " (en curso)" : ""}`).join("; ")}.`}
        >
          <div className={`flex items-end gap-[6px] border-b border-borde ${ALTO_COLUMNAS}`}>
            {semanas.map((s) => {
              /// En % del alto de la zona, menos la cifra: el alto
              /// cambia con la ventana y la proporción no.
              const alto =
                s.cupos > 0 ? `max(2px, calc((100% - ${ALTO_CIFRA}px) * ${s.cupos / tope}))` : "0px";
              return (
                <div
                  key={s.lunes}
                  className="flex h-full max-w-[48px] min-w-0 flex-1 flex-col items-center justify-end"
                  title={`Semana del ${diaYMes(s.lunes)}: ${cuenta(s.cupos, "cupo", "cupos")}${s.enCurso ? " (en curso)" : ""}`}
                >
                  <span
                    className={`text-[0.6875rem] leading-none tabular-nums ${s.cupos > 0 ? "font-semibold text-titulo" : "text-texto-suave"}`}
                    style={{ marginBottom: 3 }}
                  >
                    {n(s.cupos)}
                  </span>
                  <div
                    className={`w-full rounded-t-[4px] ${s.enCurso ? "bg-marca/40" : "bg-marca"}`}
                    style={{ height: alto }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-[6px]" aria-hidden>
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
                  className={`flex max-w-[48px] min-w-0 flex-1 justify-center overflow-visible text-[0.625rem] leading-tight whitespace-nowrap text-texto-suave ${
                    ve(pasos.base) ? "" : "invisible"
                  } ${ve(pasos.sm) ? "@sm:visible" : "@sm:invisible"} ${
                    ve(pasos.lg) ? "@lg:visible" : "@lg:invisible"
                  } ${ve(pasos.xl2) ? "@2xl:visible" : "@2xl:invisible"}`}
                >
                  <span className="shrink-0">{s.enCurso ? "en curso" : diaCorto(s.lunes)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </Bloque>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3 · LA TABLA: POR ACCIÓN, CON SUS ORGANIZACIONES DENTRO
   ═══════════════════════════════════════════════════════════════ */

type GrupoDeAcciones = {
  slug: string;
  sigla: string;
  filas: FilaInformeAccion[];
};

/**
 * Las acciones en el orden de la hoja: por gremio, y dentro de cada
 * uno por código NATURAL (AF2 antes que AF10), para poder cotejarla
 * renglón a renglón con el PDF.
 *
 * La llave es el id: con los dos gremios hay dos «AF1», y agrupar
 * por código los fundía en una fila.
 */
function gruposDeAcciones(informe: InformeReservas): GrupoDeAcciones[] {
  const orden = informe.recorte.convenios.map((c) => c.slug);
  const grupos = new Map<string, GrupoDeAcciones>();
  for (const a of informe.porAccion) {
    const g = grupos.get(a.convenio) ?? { slug: a.convenio, sigla: siglaDe(a), filas: [] };
    g.filas.push(a);
    grupos.set(a.convenio, g);
  }
  for (const g of grupos.values()) g.filas.sort((a, b) => ordenNatural(a.codigo, b.codigo));
  return [...grupos.values()].sort((a, b) => orden.indexOf(a.slug) - orden.indexOf(b.slug));
}

/**
 * UNA SOLA TABLA a todo el ancho: la Tabla 1 del PDF con la Tabla 2
 * dentro.
 *
 * Eran dos bloques --por acción con barras al lado, y por acción y
 * organización con 51 filas abiertas, 3.600 px--. Ahora cada acción
 * lleva «3 organizaciones ▸», que abre sus filas debajo, y la
 * cabecera un «Ver las organizaciones de todas las acciones». Nacen
 * cerradas: diez segundos para entender la pantalla no dan para 51
 * filas. En papel salen todas abiertas (`print:table-row`), así que
 * el PDF lleva las dos tablas de la hoja del cliente en una.
 *
 * Las columnas son las que pidió: con el porcentaje en la tabla («¿si
 * solo dejamos tabla, agregamos la de porcentaje o columnas que se
 * necesiten?», cliente, 21 sep 2026).
 */
function TablaPorAccion({ informe }: { informe: InformeReservas }) {
  const grupos = gruposDeAcciones(informe);
  const varios = grupos.length > 1;
  const t = informe.totales;

  /// El cruce por acción, en el orden del servidor: la organización
  /// que más reservó arriba, como en la tabla dinámica del PDF.
  const cruce = useMemo(() => {
    const m = new Map<string, FilaInformeCruce[]>();
    for (const c of informe.cruce) {
      const lista = m.get(c.accionFormacionId) ?? [];
      lista.push(c);
      m.set(c.accionFormacionId, lista);
    }
    return m;
  }, [informe.cruce]);

  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(() => new Set());
  const conOrganizaciones = informe.porAccion
    .filter((a) => (cruce.get(a.accionFormacionId) ?? []).length > 0)
    .map((a) => a.accionFormacionId);
  const todas = conOrganizaciones.length > 0 && conOrganizaciones.every((id) => abiertas.has(id));
  const alternar = (id: string) =>
    setAbiertas((antes) => {
      const s = new Set(antes);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  return (
    <Bloque
      titulo="Resumen por acción de formación"
      sinRelleno
      /// Con las organizaciones abiertas en papel son hoja y media: el
      /// bloque parte por fila, con la cabecera repetida, en vez de
      /// mudarse entero y dejar una hoja en blanco.
      partible
      acciones={
        conOrganizaciones.length > 0 ? (
          <button
            type="button"
            onClick={() => setAbiertas(todas ? new Set() : new Set(conOrganizaciones))}
            className="no-imprimir self-center text-[0.75rem] font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
          >
            {todas ? "Cerrar las organizaciones" : "Ver las organizaciones de todas las acciones"}
          </button>
        ) : undefined
      }
    >
      {informe.truncado && (
        <p className="mx-7 mt-4 rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
          La tabla muestra las organizaciones de los primeros {n(informe.cruce.length)} pares de{" "}
          {n(t.pares)}; la Suma total sí cuenta todos. Recorte por gremio o por acción para verlos
          enteros.
        </p>
      )}

      <table className="hidden w-full border-collapse sm:table print:table">
        <caption className="sr-only">Resumen por acción de formación, con sus organizaciones</caption>
        <thead>
          <tr className="border-b border-borde">
            <Th className="w-[72px] pl-7">AF</Th>
            <Th>Acción de formación</Th>
            <Th derecha className="w-[84px]">Reservas</Th>
            <Th derecha className="w-[96px]">Cupos apartados</Th>
            <Th derecha className="w-[96px]">Ya tienen nombre</Th>
            <Th derecha className="w-[84px]">% con nombre</Th>
            <Th derecha className="w-[124px] pr-7">Siguen sin nombre</Th>
          </tr>
        </thead>
        {grupos.map((g, i) => (
          <tbody key={g.slug}>
            {varios && <FranjaDeGremio sigla={g.sigla} columnas={COLUMNAS} />}
            {g.filas.map((a) => {
              const filas = cruce.get(a.accionFormacionId) ?? [];
              const abierta = abiertas.has(a.accionFormacionId);
              return (
                <FilasDeLaAccion
                  key={a.accionFormacionId}
                  a={a}
                  organizaciones={filas}
                  abierta={abierta}
                  alAlternar={() => alternar(a.accionFormacionId)}
                />
              );
            })}
            {varios && (
              <FilaDeSuma
                rotulo={`Subtotal ${g.sigla}`}
                reservas={g.filas.reduce((s, a) => s + a.reservas, 0)}
                cupos={g.filas.reduce((s, a) => s + a.cuposConfirmados, 0)}
                sinNombre={g.filas.reduce((s, a) => s + a.sinNombre, 0)}
                suave
              />
            )}
            {/* La «Suma total» va dentro del último `tbody` y no en un
                `tfoot`: Chrome repite el `tfoot` al pie de cada hoja
                impresa, y un «Suma total» a mitad de la tabla se lee
                como que la tabla terminó ahí. */}
            {i === grupos.length - 1 && (
              <FilaDeSuma
                rotulo="Suma total"
                reservas={t.reservas}
                cupos={t.cuposConfirmados}
                sinNombre={t.sinNombre}
              />
            )}
          </tbody>
        ))}
      </table>

      {/* En un celular siete columnas no caben en 300 px: se vuelve
          lista, con la misma puerta a las organizaciones. En papel
          sale siempre la tabla. */}
      <ul className="divide-y divide-hairline sm:hidden print:hidden">
        {grupos.map((g) => (
          <li key={g.slug}>
            {varios && (
              <p className="bg-superficie-alterna px-7 py-2 text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
                {g.sigla}
              </p>
            )}
            <ul className="divide-y divide-hairline">
              {g.filas.map((a) => {
                const filas = cruce.get(a.accionFormacionId) ?? [];
                const abierta = abiertas.has(a.accionFormacionId);
                const con = sillasConNombre(a);
                return (
                  <li key={a.accionFormacionId} className={`px-7 py-3 ${a.reservas === 0 ? "text-texto-suave" : ""}`}>
                    <p className="text-[0.8125rem] leading-snug">
                      <span className="font-mono text-xs text-texto-suave">{a.codigo}</span>{" "}
                      <span className={a.reservas === 0 ? "" : "text-titulo"}>{comoParrafo(a.nombre)}</span>
                    </p>
                    <p className="mt-1 text-[0.75rem] text-texto-suave tabular-nums">
                      {a.reservas === 0
                        ? "Sin reservas todavía"
                        : a.cuposConfirmados === 0
                          ? `${cuenta(a.reservas, "reserva", "reservas")} · ${n(a.cuposEnEspera)} en espera`
                          : `${cuenta(a.reservas, "reserva", "reservas")} · ${cuenta(a.cuposConfirmados, "cupo", "cupos")} · ${n(con)} con nombre (${porciento(con, a.cuposConfirmados)} %) · ${n(a.sinNombre)} sin nombre`}
                      {/* Al final del mismo renglón y no en uno aparte:
                          20 px menos por acción en el celular. */}
                      {filas.length > 0 && (
                        <span className="ml-2 inline-block">
                          <BotonOrganizaciones cuantas={filas.length} abierta={abierta} alAlternar={() => alternar(a.accionFormacionId)} />
                        </span>
                      )}
                    </p>
                    {abierta && filas.length > 0 && (
                      <ul className="mt-2 divide-y divide-hairline border-l-2 border-borde">
                        {filas.map((c) => {
                          const cc = sillasConNombre(c);
                          return (
                            <li key={`${c.accionFormacionId}|${c.empresaId}`} className="py-2 pl-3">
                              <p className="text-[0.8125rem] text-titulo">{c.razonSocial}</p>
                              <p className="mt-0.5 text-[0.75rem] text-texto-suave tabular-nums">
                                {cuenta(c.cuposConfirmados, "cupo", "cupos")} · {n(cc)} con nombre · {n(c.sinNombre)} sin nombre
                                {c.ubicaciones.length > 0 && ` · ${c.ubicaciones.map(bonito).join(" · ")}`}
                              </p>
                              {c.nombresDeMas > 0 && <DeMas c={c} />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        <li className="px-7 py-3 text-[0.8125rem] font-semibold text-titulo tabular-nums">
          Suma total: {cuenta(t.reservas, "reserva", "reservas")} ·{" "}
          {cuenta(t.cuposConfirmados, "cupo", "cupos")} · {n(sillasConNombre(t))} con nombre (
          {porciento(sillasConNombre(t), t.cuposConfirmados)} %) · {n(t.sinNombre)} sin nombre
        </li>
      </ul>
    </Bloque>
  );
}

const COLUMNAS = 7;

function BotonOrganizaciones({
  cuantas,
  abierta,
  alAlternar,
}: {
  cuantas: number;
  abierta: boolean;
  alAlternar: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={abierta}
      onClick={alAlternar}
      className="no-imprimir mt-0.5 inline-flex items-center gap-1 text-[0.71875rem] font-medium whitespace-nowrap text-marca hover:text-marca-fuerte"
    >
      <span className="underline underline-offset-2">{cuenta(cuantas, "organización", "organizaciones")}</span>
      <span aria-hidden className={`text-[0.5625rem] transition-transform ${abierta ? "rotate-90" : ""}`}>
        &#9656;
      </span>
    </button>
  );
}

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

function FranjaDeGremio({ sigla, columnas }: { sigla: string; columnas: number }) {
  return (
    <tr className="break-after-avoid">
      <td
        colSpan={columnas}
        className="bg-superficie-alterna px-3.5 py-2 pl-7 text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase"
      >
        {sigla}
      </td>
    </tr>
  );
}

/// `px-3.5` y NO `px-4`, en todas las celdas de este archivo. En papel,
/// globals.css pone `padding: 0 !important` a todo lo que lleve
/// «px-4» en la clase (`body [class*="px-4"]`, pensada para el
/// envoltorio de la página), y el PDF salía con el código AF y la
/// última cifra pegados al canto de la tabla.
const CELDA = "px-3.5 py-2 align-top text-[0.8125rem]";
const CELDA_CIFRA = `${CELDA} text-right tabular-nums`;

/**
 * La fila de la acción y, debajo, las de sus organizaciones.
 *
 * Las de organizaciones están SIEMPRE en el DOM: cerradas llevan
 * `hidden print:table-row`, así que en pantalla no ocupan nada y en
 * papel salen todas sin depender de que alguien las abra.
 */
function FilasDeLaAccion({
  a,
  organizaciones,
  abierta,
  alAlternar,
}: {
  a: FilaInformeAccion;
  organizaciones: FilaInformeCruce[];
  abierta: boolean;
  alAlternar: () => void;
}) {
  const sinReservas = a.reservas === 0;
  const hayCupos = a.cuposConfirmados > 0;
  const con = sillasConNombre(a);
  return (
    <>
      <tr className={`border-b border-hairline ${sinReservas ? "text-texto-suave" : ""}`}>
        <td className="py-2 pr-2 pl-7 align-top font-mono text-xs text-texto-suave">{a.codigo}</td>
        {/* El nombre ENVUELVE y no se trunca: esto es el papel, y
            «Despliegue de agentes autónomos con…» no dice qué curso
            es. Una acción sin reservas va en gris y en una línea. */}
        <td className={CELDA}>
          <span className={sinReservas ? "" : "text-titulo"}>{comoParrafo(a.nombre)}</span>
          {sinReservas && (
            <span className="text-[0.6875rem]">
              {" · "}
              {a.reservasCanceladas > 0
                ? `sin reservas vigentes, ${cuenta(a.reservasCanceladas, "cancelada", "canceladas")}`
                : "sin reservas todavía"}
            </span>
          )}
          {/* EN LA MISMA LÍNEA que el nombre, no debajo: debajo cada
              acción medía 62 px en vez de 40, y con los dos gremios la
              tabla cerrada pasaba de 1.100 px (medido a 1.600). */}
          {organizaciones.length > 0 && (
            <span className="ml-2 inline-block">
              <BotonOrganizaciones cuantas={organizaciones.length} abierta={abierta} alAlternar={alAlternar} />
            </span>
          )}
        </td>
        <td className={CELDA_CIFRA}>{n(a.reservas)}</td>
        <td className={CELDA_CIFRA}>
          {sinReservas ? "—" : n(a.cuposConfirmados)}
          {/* La reserva en lista de espera: se dice debajo de su
              cifra, en vez de dejar un número que parece un olvido. */}
          {a.cuposEnEspera > 0 && (
            <span className="mt-0.5 block text-[0.6875rem] text-texto-suave">{n(a.cuposEnEspera)} en espera</span>
          )}
        </td>
        <td className={CELDA_CIFRA}>{hayCupos ? n(con) : "—"}</td>
        <td className={CELDA_CIFRA}>{hayCupos ? `${porciento(con, a.cuposConfirmados)} %` : "—"}</td>
        <td className={`${CELDA_CIFRA} pr-7`}>{hayCupos ? n(a.sinNombre) : "—"}</td>
      </tr>
      {organizaciones.map((c) => (
        <FilaCruce key={`${c.accionFormacionId}|${c.empresaId}`} c={c} abierta={abierta} />
      ))}
    </>
  );
}

function FilaCruce({ c, abierta }: { c: FilaInformeCruce; abierta: boolean }) {
  const con = sillasConNombre(c);
  return (
    <tr className={`border-b border-hairline text-[0.78125rem] ${abierta ? "" : "hidden print:table-row"}`}>
      {/* El código en TODAS las filas, en tono suave: si el grupo se
          parte entre dos hojas, la segunda no queda sin saber de qué
          acción son sus filas. */}
      <td className="py-2 pr-2 pl-7 align-top font-mono text-[0.6875rem] text-texto-suave">{c.codigo}</td>
      <td className="py-2 pr-3.5 pl-8 align-top">
        <span className="text-texto">{c.razonSocial}</span>
        {/* Dónde se dicta: es lo que explica los pares que van en 2
            (la misma acción, reservada en dos lugares). */}
        {c.ubicaciones.length > 0 && (
          <span className="mt-0.5 block text-[0.6875rem] text-texto-suave">
            {c.ubicaciones.map(bonito).join(" · ")}
          </span>
        )}
      </td>
      <td className="px-3.5 py-2 text-right align-top tabular-nums">{n(c.reservas)}</td>
      <td className="px-3.5 py-2 text-right align-top tabular-nums">
        {n(c.cuposConfirmados)}
        {c.cuposEnEspera > 0 && (
          <span className="mt-0.5 block text-[0.6875rem] text-texto-suave">{n(c.cuposEnEspera)} en espera</span>
        )}
      </td>
      <td className="px-3.5 py-2 text-right align-top tabular-nums">
        {n(con)}
        {c.nombresDeMas > 0 && <DeMas c={c} />}
      </td>
      <td className="px-3.5 py-2 text-right align-top tabular-nums">
        {c.cuposConfirmados > 0 ? `${porciento(con, c.cuposConfirmados)} %` : "—"}
      </td>
      <td className="py-2 pr-7 pl-3.5 text-right align-top tabular-nums">{n(c.sinNombre)}</td>
    </tr>
  );
}

function FilaDeSuma({
  rotulo,
  reservas,
  cupos,
  sinNombre,
  suave,
}: {
  rotulo: string;
  reservas: number;
  cupos: number;
  sinNombre: number;
  suave?: boolean;
}) {
  const con = Math.max(0, cupos - sinNombre);
  return (
    <tr
      className={
        suave
          ? "border-b border-borde text-texto"
          : "border-t border-borde bg-superficie-alterna font-semibold text-titulo"
      }
    >
      <td className="pl-7" />
      <td className={`${CELDA} ${suave ? "font-medium" : ""}`}>{rotulo}</td>
      <td className={CELDA_CIFRA}>{n(reservas)}</td>
      <td className={CELDA_CIFRA}>{n(cupos)}</td>
      <td className={CELDA_CIFRA}>{n(con)}</td>
      <td className={CELDA_CIFRA}>{cupos > 0 ? `${porciento(con, cupos)} %` : "—"}</td>
      <td className={`${CELDA_CIFRA} pr-7`}>{n(sinNombre)}</td>
    </tr>
  );
}

/**
 * Más personas que cupos en alguna reserva del par. Se dice en vez de
 * recortar la cifra: el dato de la base es ese, y una cifra topada en
 * silencio no se puede ir a corregir.
 */
function DeMas({ c }: { c: FilaInformeCruce }) {
  return (
    <span className="mt-0.5 block text-[0.6875rem] font-normal text-aviso">
      {cuenta(c.nombresDeMas, "persona de más", "personas de más")}
    </span>
  );
}
