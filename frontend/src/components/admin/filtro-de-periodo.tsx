"use client";

/**
 * EL FILTRO DE PERIODO, UNO SOLO PARA TODOS LOS TABLEROS.
 *
 * «En todos los tableros debo tener filtros, deben funcionar porque lo
 * probé y no es así» (cliente, 27 sep 2026). Y tenía razón: fui a las
 * cinco pantallas del menú ---Tráfico, Control de inscritos, Control
 * de Reservas, Seguimiento Académico y Seguimiento de asesores--- y
 * ninguna tenía un solo selector de periodo. El único que existía
 * vivía en Informes, que no está en ese menú.
 *
 * UNO COMPARTIDO Y NO CINCO. Cinco copias del mismo control empiezan
 * iguales y acaban contestando distinto: es exactamente lo que ya
 * pasó con el control viejo, que quedó escrito en dos sitios y uno de
 * ellos seguía pidiendo CUATRO fechas ---dos del periodo y dos de la
 * comparación--- después de que el cliente lo hiciera quitar.
 *
 * NUNCA MÁS DE DOS FECHAS. «No entiendo por qué si hago comparativa me
 * pide 2 fechas para inicio y 2 para fin» (27 sep 2026). Aquí la
 * comparación no es un desplegable con opciones: cada periodo tiene UN
 * anterior ---ayer, los siete días de antes, el mes pasado--- y esto
 * solo lo enciende o lo apaga. Dos fechas como mucho, y solo cuando se
 * elige «Un rango de fechas».
 *
 * NO TOCA EL SERVIDOR. `Filtros.llegoDesde` y `llegoHasta` ya existían
 * y `crm.service` ya los honra; lo que faltaba era quién los pusiera.
 * Por eso esto cabe en una tarde y no en una semana.
 */

import { useState } from "react";

import { Desplegable } from "./desplegable";
import { ETIQUETA_RANGO, type Rango } from "@/lib/crm-api";

/// Los que se ofrecen, en el orden en que se usan: primero lo de hoy,
/// al final lo que se consulta de tarde en tarde.
export const RANGOS_DEL_PANEL: Rango[] = [
  "TODO",
  "HOY",
  "AYER",
  "SEMANA",
  "MES",
  "MES_PASADO",
  "TRIMESTRE",
  "ANO",
  "PERSONALIZADO",
];

/** Lo que el filtro guarda: el rango y, si es a medida, sus dos fechas. */
export type Periodo = {
  rango: Rango;
  /// Solo se miran con `PERSONALIZADO`. Formato `aaaa-mm-dd`.
  desde: string;
  hasta: string;
};

export const PERIODO_INICIAL: Periodo = { rango: "TODO", desde: "", hasta: "" };

/// Colombia va cinco horas detrás de UTC y no mueve el reloj en todo
/// el año. La misma constante que usa el servidor.
const HORAS_BOGOTA = 5;

/** El día de calendario de Bogotá para un instante, como `aaaa-mm-dd`. */
function diaBogota(cuando: Date): string {
  return new Date(cuando.getTime() - HORAS_BOGOTA * 3600_000)
    .toISOString()
    .slice(0, 10);
}

/** Medianoche de Bogotá de un día, como instante ISO. */
function arranqueDeDia(dia: string): string {
  return `${dia}T05:00:00.000Z`;
}

function sumarDias(dia: string, cuantos: number): string {
  const f = new Date(`${dia}T00:00:00.000Z`);
  f.setUTCDate(f.getUTCDate() + cuantos);
  return f.toISOString().slice(0, 10);
}

function sumarMeses(dia: string, cuantos: number): string {
  const f = new Date(`${dia}T00:00:00.000Z`);
  f.setUTCMonth(f.getUTCMonth() + cuantos);
  return f.toISOString().slice(0, 10);
}

/**
 * El periodo, traducido a lo que entiende el servidor.
 *
 * EN HORA DE BOGOTÁ, no en la del navegador. Un periodo que arranque a
 * medianoche UTC empieza a las siete de la tarde del día anterior en
 * Colombia, y entonces «Hoy» trae los leads de anoche. Es el mismo
 * desfase de cinco horas que descuadró el Excel de leads un día
 * entero, y no se repite aquí.
 *
 * `TODO` no acota: devuelve un objeto vacío para que la llamada salga
 * igual que antes de que existiera este filtro.
 */
export function ventanaDe(
  p: Periodo,
  ahora = new Date(),
): { llegoDesde?: string; llegoHasta?: string } {
  const hoy = diaBogota(ahora);
  const manana = sumarDias(hoy, 1);

  switch (p.rango) {
    case "TODO":
      return {};
    case "HOY":
      return { llegoDesde: arranqueDeDia(hoy), llegoHasta: arranqueDeDia(manana) };
    case "AYER":
      return {
        llegoDesde: arranqueDeDia(sumarDias(hoy, -1)),
        llegoHasta: arranqueDeDia(hoy),
      };
    case "SEMANA":
      return {
        llegoDesde: arranqueDeDia(sumarDias(manana, -7)),
        llegoHasta: arranqueDeDia(manana),
      };
    case "MES":
      return {
        llegoDesde: arranqueDeDia(sumarDias(manana, -30)),
        llegoHasta: arranqueDeDia(manana),
      };
    case "MES_PASADO": {
      /// El mes natural anterior, del día 1 al día 1. No «los últimos
      /// treinta días»: son dos cosas distintas y el rótulo dice esta.
      const primeroDeEste = `${hoy.slice(0, 7)}-01`;
      return {
        llegoDesde: arranqueDeDia(sumarMeses(primeroDeEste, -1)),
        llegoHasta: arranqueDeDia(primeroDeEste),
      };
    }
    case "TRIMESTRE":
      return {
        llegoDesde: arranqueDeDia(sumarDias(manana, -90)),
        llegoHasta: arranqueDeDia(manana),
      };
    case "ANO":
      return {
        llegoDesde: arranqueDeDia(sumarMeses(manana, -12)),
        llegoHasta: arranqueDeDia(manana),
      };
    case "PERSONALIZADO": {
      /// A MEDIAS NO ACOTA. Con una sola fecha puesta, recortar por
      /// ella enseñaría un periodo que nadie pidió mientras se escribe
      /// la otra; mejor no tocar nada hasta que estén las dos.
      if (!p.desde || !p.hasta) return {};
      return {
        llegoDesde: arranqueDeDia(p.desde),
        /// `hasta` INCLUIDO: quien escribe «al 30» espera que el 30
        /// entre. El servidor corta con `<`, así que se le pasa el
        /// arranque del día siguiente.
        llegoHasta: arranqueDeDia(sumarDias(p.hasta, 1)),
      };
    }
  }
}

/** Cómo se llama el periodo anterior al elegido. Vacío = no tiene. */
export function etiquetaDelAnterior(rango: Rango): string {
  switch (rango) {
    case "HOY":
      return "ayer";
    case "AYER":
      return "anteayer";
    case "SEMANA":
      return "los 7 días de antes";
    case "MES":
      return "los 30 días de antes";
    case "MES_PASADO":
      return "el mes anterior";
    case "TRIMESTRE":
      return "los 90 días de antes";
    case "ANO":
      return "los 12 meses de antes";
    /// «Desde el principio» no tiene anterior, y con dos fechas a
    /// medida tampoco: cuál sería el tramo de antes es una decisión
    /// que nadie tomó.
    default:
      return "";
  }
}

/** El periodo anterior al elegido, de la misma duración. */
export function ventanaAnterior(
  p: Periodo,
  ahora = new Date(),
): { llegoDesde?: string; llegoHasta?: string } {
  const v = ventanaDe(p, ahora);
  if (!v.llegoDesde || !v.llegoHasta) return {};
  const desde = new Date(v.llegoDesde).getTime();
  const hasta = new Date(v.llegoHasta).getTime();
  const dura = hasta - desde;
  return {
    llegoDesde: new Date(desde - dura).toISOString(),
    llegoHasta: v.llegoDesde,
  };
}

/**
 * El control, listo para poner en la cabecera de cualquier tablero.
 *
 * `alComparar` es opcional: el tablero que no sepa comparar no enseña
 * el enlace, en vez de enseñarlo muerto. Un control que no hace nada
 * al pulsarlo es peor que no tenerlo.
 */
/**
 * UN DESPLEGABLE CON SU RÓTULO, igual que «PERIODO».
 *
 * «Esto vacío sin título ni nada, de verdad?» y «esto igual
 * desplegable al lado de Periodo, pero con título» (cliente, 1 oct
 * 2026). Los interruptores de vista eran tiras de botones que se
 * comían una fila entera; pasados a desplegable se quedaban sin
 * nombre, y una casilla suelta que pone «Asesores de inscripciones»
 * no dice si eso es lo que se mira o lo que se filtra.
 *
 * Reusa el `Desplegable` de la casa y el mismo rótulo de 10 px en
 * versalitas del periodo, para que los dos se lean como la misma
 * clase de control y no como dos inventos.
 */
export function ElegirConRotulo({
  rotulo,
  valor,
  opciones,
  alElegir,
  ancho = "11.5rem",
}: {
  rotulo: string;
  valor: string;
  opciones: { valor: string; etiqueta: string }[];
  alElegir: (v: string) => void;
  ancho?: string;
}) {
  /// EL RÓTULO VA DENTRO, en la primera línea de la lista. Fuera
  /// costaba sitio en la fila y gritaba; ver el porqué en `Desplegable`.
  return (
    <div style={{ minWidth: ancho }}>
      <Desplegable
        alto={30}
        rotulo={rotulo}
        etiquetaAria={rotulo}
        valor={valor}
        opciones={opciones}
        alElegir={alElegir}
      />
    </div>
  );
}

export function FiltroDePeriodo({
  periodo,
  alCambiar,
  comparando,
  alComparar,
}: {
  periodo: Periodo;
  alCambiar: (p: Periodo) => void;
  /// Si ahora mismo se está comparando. Sin `alComparar` se ignora.
  comparando?: boolean;
  alComparar?: (si: boolean) => void;
}) {
  const anterior = etiquetaDelAnterior(periodo.rango);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[0.625rem] font-bold tracking-[0.08em] uppercase text-texto-suave">
        Periodo
      </p>

      <div className="min-w-[11.5rem]">
        <Desplegable
          alto={30}
          etiquetaAria="Periodo"
          valor={periodo.rango}
          opciones={RANGOS_DEL_PANEL.map((r) => ({
            valor: r,
            etiqueta: ETIQUETA_RANGO[r],
          }))}
          alElegir={(v) =>
            alCambiar({
              ...periodo,
              rango: v as Rango,
              /// Salir de «un rango de fechas» borra las suyas: dejarlas
              /// puestas hace que volver a entrar enseñe un periodo que
              /// nadie acaba de elegir.
              ...(v === "PERSONALIZADO" ? {} : { desde: "", hasta: "" }),
            })
          }
        />
      </div>

      {/* LAS DOS FECHAS, Y NUNCA MÁS DE DOS. */}
      {periodo.rango === "PERSONALIZADO" && (
        <>
          <input
            type="date"
            aria-label="Desde"
            title="Desde"
            value={periodo.desde}
            max={periodo.hasta || undefined}
            onChange={(e) => alCambiar({ ...periodo, desde: e.target.value })}
            className="h-[30px] rounded-lg border border-borde bg-superficie px-2 text-[0.8125rem]"
          />
          <input
            type="date"
            aria-label="Hasta"
            title="Hasta"
            value={periodo.hasta}
            min={periodo.desde || undefined}
            onChange={(e) => alCambiar({ ...periodo, hasta: e.target.value })}
            className="h-[30px] rounded-lg border border-borde bg-superficie px-2 text-[0.8125rem]"
          />
          {(!periodo.desde || !periodo.hasta) && (
            <span className="text-[0.78125rem] text-aviso">
              Faltan las dos fechas: se está mostrando todo.
            </span>
          )}
        </>
      )}

      {/* COMPARAR ES SÍ O NO, no un desplegable con opciones. Cada
          periodo tiene UN anterior y esto solo lo enciende o lo apaga.
          Así no hay forma de acabar pidiendo cuatro fechas. */}
      {alComparar && anterior && (
        <>
          {comparando ? (
            <span className="flex items-center gap-2 text-[0.78125rem] text-texto">
              Comparando con{" "}
              <strong className="font-semibold text-titulo">{anterior}</strong>
              <button
                type="button"
                onClick={() => alComparar(false)}
                className="text-texto-suave underline underline-offset-2 hover:text-texto"
              >
                quitar
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => alComparar(true)}
              className="text-[0.78125rem] text-marca underline underline-offset-2"
            >
              Comparar con {anterior}
            </button>
          )}
        </>
      )}

      {/* QUITAR LO ELEGIDO, que si no hay que acordarse de cuál era el
          de siempre. Sale solo cuando hay algo que quitar. */}
      {periodo.rango !== "TODO" && (
        <button
          type="button"
          onClick={() => alCambiar(PERIODO_INICIAL)}
          className="text-[0.78125rem] text-texto-suave underline underline-offset-2 hover:text-texto"
        >
          Quitar el periodo
        </button>
      )}
    </div>
  );
}
