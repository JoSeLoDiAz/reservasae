"use client";

/** La tabla del comité: una fila por acción de formación. */

/**
 * ES EL EXCEL DEL CLIENTE, DENTRO DEL CRM.
 *
 * Nos pasó su hoja el 23 de septiembre de 2026 --«esto es como la tabla
 * que te compartí; el resumen es lo gráfico, ya el detalle es la
 * tabla»--, con sus mismas columnas y en su mismo orden. Lo que cambia
 * respecto a la hoja es lo que la hoja no podía hacer:
 *
 * - las cifras salen del sistema, no de un copiado semanal;
 * - donde la hoja decía «#REF!» y «#DIV/0!» aquí va una raya, que es lo
 *   que significan: no hay de dónde calcular;
 * - la fila de totales suma lo que se está viendo.
 *
 * De dónde sale cada columna está en `resumen-por-accion.ts`, que es
 * donde viven las cuentas y sus pruebas.
 */

import { useCallback } from "react";

import { crmApi, type FilaDeAccion } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { Aviso } from "./marco-admin";
import { Bloque, Esqueleto, Vacio } from "./piezas";

const n = (v: number) => v.toLocaleString("es-CO");

/// Los dos bloques de columnas, cada uno de su color. Van en una
/// constante y no escritos doce veces: el día que cambie el criterio,
/// cambia aquí y en la tabla de grupos, que usa las mismas.
/// LAS DOS MITADES DE LA TABLA, y por que llevan clase propia.
///
/// `grupo-entro` y `grupo-inscribio` no pintan texto: pintan la RAYA
/// que separa cada columna (`globals.css`, la cuadricula). El color
/// del rotulo ya decia de que mitad es cada columna, pero en una fila
/// de doce cifras el rotulo queda arriba del todo y a la altura del
/// dato ya no se sabe: «coloreame las separaciones» (cliente, 24 sep
/// 2026).
const ENTRO = "text-center whitespace-nowrap text-marca grupo-entro";
const INSCRIBIO = "text-center whitespace-nowrap text-exito grupo-inscribio";

/// Las mismas dos mitades, en el cuerpo. La clase va en la celda y no
/// en la fila porque la raya es de la COLUMNA.
/**
 * UNA CIFRA CON LA DEL OTRO PERIODO DEBAJO.
 *
 * «Volver dinámico las tarjetas, gráficos y tablas para saber los
 * comparativos» (cliente, 27 sep 2026). Debajo y no al lado: son
 * trece columnas, y dos números en la misma línea las parte todas.
 *
 * La de arriba es la del periodo elegido y manda. La de abajo es la
 * del otro, en gris y más pequeña, con su flecha: ▲ subió, ▼ bajó,
 * = igual. Sin comparación puesta se pinta solo la de arriba, como
 * siempre.
 */
function Cifra({ ahora, antes }: { ahora: number; antes: number | null }) {
  if (antes === null) return <>{n(ahora)}</>;
  const d = ahora - antes;
  return (
    <>
      {n(ahora)}
      <span
        className="block text-[0.6875rem] leading-tight font-normal"
        style={{
          color: d === 0 ? "var(--texto-suave)" : d > 0 ? "var(--exito)" : "var(--error)",
        }}
      >
        {d === 0 ? "=" : d > 0 ? "▲" : "▼"} {n(antes)}
      </span>
    </>
  );
}

const CELDA_ENTRO = "text-center tabular-nums grupo-entro";
const CELDA_ENTRO_TOTAL = "text-center font-medium tabular-nums grupo-entro";
const CELDA_INSCRIBIO = "text-center tabular-nums grupo-inscribio";

/// El porcentaje, o una raya: sin leads no hay conversión, y un 0 %
/// diría que nadie convirtió cuando lo cierto es que nadie llegó.
const tasa = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

export function TablaPorAccion({
  alElegir,
  elegida,
  ventanaResuelta = true,
  recorte,
  recorteAnterior,
  rotuloAnterior,
}: {
  /// Los cinco filtros y la ventana, los mismos de arriba.
  recorte?: Record<string, unknown>;
  /**
   * EL MISMO RECORTE PERO DEL PERIODO CON EL QUE SE COMPARA.
   *
   * «Es realmente volver dinámico las tarjetas, gráficos y TABLAS
   * para saber los comparativos» (cliente, 27 sep 2026). Hasta hoy
   * solo comparaban las cuatro cifras de arriba, y esta tabla ---que
   * es el bloque más grande de la pantalla--- enseñaba un periodo y
   * ninguno más.
   *
   * Nulo = no hay comparación puesta, y la tabla sale como siempre.
   */
  recorteAnterior?: Record<string, unknown> | null;
  /**
   * SI LA CABECERA YA RESOLVIO EL PERIODO.
   *
   * Falso = todavia no ha contestado, y entonces este bloque NO
   * pregunta: el servidor, sin ventana, no filtra, y salia el
   * historico completo bajo el rotulo «Hoy» ---el «25» que reporto
   * el cliente el 5 oct 2026---.
   *
   * Y es «ya contesto», no «hay dos fechas»: con el periodo en
   * «Desde el principio» la respuesta es que NO hay ventana, y eso
   * es una respuesta. Mirando las fechas, la pantalla se quedaba en
   * esqueleto para siempre.
   */
  ventanaResuelta?: boolean;
  /// Cómo se llama ese periodo, para poder decirlo en la cabecera.
  rotuloAnterior?: string | null;
  /// La pantalla la usa para abrir el detalle por grupos: la fila
  /// entera es el botón.
  alElegir?: (fila: FilaDeAccion) => void;
  elegida?: string | null;
}) {
  const clave = JSON.stringify(recorte ?? {});
  const claveAntes = JSON.stringify(recorteAnterior ?? null);

  /// LAS DOS EN LA MISMA CONSULTA. Dos `useDatosVivos` separados se
  /// refrescan cada uno por su lado, y durante un instante la tabla
  /// enseñaría el periodo nuevo contra el anterior viejo: dos filas
  /// que no son comparables con cara de serlo.
  const cargar = useCallback(
    async (): Promise<{ ahora: FilaDeAccion[]; antes: FilaDeAccion[] | null }> => {
      const [ahora, antes] = await Promise.all([
        crmApi.resumenPorAccion(recorte ?? {}),
        recorteAnterior ? crmApi.resumenPorAccion(recorteAnterior) : null,
      ]);
      return { ahora, antes };
    },
    [clave, claveAntes], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const listo = ventanaResuelta;
  const vivos = useDatosVivos<{ ahora: FilaDeAccion[]; antes: FilaDeAccion[] | null }>(
    cargar,
    { clave: `resumen-por-accion:${clave}:${claveAntes}`, activo: listo },
  );

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;

  const filas = vivos.datos.ahora;
  /// La fila de cada acción en el otro periodo, por su id. Una acción
  /// puede no existir allí ---nació después---: entonces no hay con
  /// qué comparar y no se pinta nada, en vez de un cero que diría
  /// que no entró nadie.
  const antesPorAccion = new Map(
    (vivos.datos.antes ?? []).map((f) => [f.accionFormacionId, f]),
  );
  const comparando = vivos.datos.antes !== null;
  /// La fila de esta acción en el otro periodo, o nulo si no la hay.
  const antesDe = (f: FilaDeAccion) =>
    comparando ? (antesPorAccion.get(f.accionFormacionId) ?? null) : null;
  if (filas.length === 0) {
    return (
      <Vacio titulo="Todavía no hay acciones de formación">
        Se crean en Oferta formativa; aquí aparecen con sus cupos en cuanto tengan grupos.
      </Vacio>
    );
  }

  /// Los totales, sumados de lo que se ve. La conversión del total se
  /// recalcula --no se promedian porcentajes-- porque una acción con
  /// tres leads pesaría igual que una con mil.
  const t = filas.reduce(
    (a, f) => ({
      meta: a.meta + f.meta,
      cuposReservados: a.cuposReservados + f.cuposReservados,
      campanaDigital: a.campanaDigital + f.campanaDigital,
      totalLeads: a.totalLeads + f.totalLeads,
      inscritosReservas: a.inscritosReservas + f.inscritosReservas,
      inscritosCampana: a.inscritosCampana + f.inscritosCampana,
      totalInscritos: a.totalInscritos + f.totalInscritos,
      cuposDisponibles: a.cuposDisponibles + f.cuposDisponibles,
    }),
    {
      meta: 0,
      cuposReservados: 0,
      campanaDigital: 0,
      totalLeads: 0,
      inscritosReservas: 0,
      inscritosCampana: 0,
      totalInscritos: 0,
      cuposDisponibles: 0,
    },
  );

  return (
    <Bloque
      sinRelleno
      /// NO «Por acción de formación» a secas: así se llama una de las
      /// donas que el cliente mandó quitar, y dos bloques con el mismo
      /// nombre en la misma pantalla es justo lo que hace dudar de cuál
      /// se está mirando.
      titulo="Cupos e inscritos por acción"
    >
      {/* DE QUÉ PERIODO ES LA CIFRA DE ABAJO. Sin esto, la segunda
          cifra de cada celda es un número sin dueño: es lo que ya
          pasó con las tarjetas. */}
      {comparando && rotuloAnterior && (
        <p className="px-7 pb-2 text-[0.78125rem] text-texto-suave">
          Debajo de cada cifra, la misma de{" "}
          <strong className="font-medium text-titulo">{rotuloAnterior}</strong>.
        </p>
      )}

      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos tabla-cuadricula w-full">
          <thead>
            {/* LOS RÓTULOS CENTRADOS Y EN DOS COLORES (cliente, 23 sep
                2026): azul el bloque de lo que ENTRÓ --reservados,
                pauta y su total-- y verde el de lo que se INSCRIBIÓ.
                Son las dos mitades de la tabla y así se ven de un
                vistazo sin leer los nombres.

                Y las CIFRAS también van centradas, no a la derecha:
                un rótulo centrado encima de un número pegado al canto
                es la desalineación que el cliente ya señaló una vez. */}
            <tr>
              <th>AF</th>
              <th className="w-full">Nombre</th>
              <th className="text-center whitespace-nowrap">Meta</th>
              <th className={ENTRO}>Cupos reservados</th>
              <th className={ENTRO}>Leads Pauta</th>
              <th className={ENTRO}>Total leads</th>
              <th className={INSCRIBIO}>Inscritos reservas</th>
              <th className={INSCRIBIO}>Inscritos Pauta</th>
              <th className={INSCRIBIO}>Total inscritos</th>
              <th className="text-center whitespace-nowrap">Conversión</th>
              <th className="text-center whitespace-nowrap">Cupos disponibles</th>
              <th className="text-center whitespace-nowrap">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.accionFormacionId}
                onClick={alElegir ? () => alElegir(f) : undefined}
                className={
                  (alElegir ? "cursor-pointer hover:bg-superficie-alterna " : "") +
                  (elegida === f.accionFormacionId ? "bg-marca-suave" : "")
                }
              >
                <td className="font-mono text-xs whitespace-nowrap">{f.codigo}</td>
                <td className="min-w-[18rem]">{f.nombre}</td>
                {/* LA META NO SE COMPARA: es lo comprometido con el
                    SENA y no cambia con el periodo. Ponerle una
                    flecha diría que subió o bajó cuando es la misma. */}
                <td className="text-center tabular-nums">{n(f.meta)}</td>
                <td className={CELDA_ENTRO}>
                  <Cifra
                    ahora={f.cuposReservados}
                    antes={antesDe(f)?.cuposReservados ?? null}
                  />
                </td>
                <td className={CELDA_ENTRO}>
                  <Cifra
                    ahora={f.campanaDigital}
                    antes={antesDe(f)?.campanaDigital ?? null}
                  />
                </td>
                <td className={CELDA_ENTRO_TOTAL}>
                  <Cifra ahora={f.totalLeads} antes={antesDe(f)?.totalLeads ?? null} />
                </td>
                <td className={CELDA_INSCRIBIO}>
                  <Cifra
                    ahora={f.inscritosReservas}
                    antes={antesDe(f)?.inscritosReservas ?? null}
                  />
                </td>
                <td className={CELDA_INSCRIBIO}>
                  <Cifra
                    ahora={f.inscritosCampana}
                    antes={antesDe(f)?.inscritosCampana ?? null}
                  />
                </td>
                <td className="text-center font-semibold text-exito tabular-nums grupo-inscribio">
                  <Cifra
                    ahora={f.totalInscritos}
                    antes={antesDe(f)?.totalInscritos ?? null}
                  />
                </td>
                <td className="text-center tabular-nums">{tasa(f.conversion)}</td>
                {/* En rojo cuando ya se pasó: es el «−4» de su hoja, y
                    dice que esa acción entregó más cupos de los
                    comprometidos. */}
                <td
                  className={
                    "text-center font-medium tabular-nums " +
                    (f.cuposDisponibles < 0 ? "text-error" : "")
                  }
                >
                  {n(f.cuposDisponibles)}
                </td>
                <td>
                  <span
                    className={
                      "text-[0.75rem] font-semibold " +
                      (f.estado === "CERRADO" ? "text-error" : "text-exito")
                    }
                  >
                    {f.estado === "CERRADO" ? "Cerrado" : "Abierto"}
                  </span>
                </td>
              </tr>
            ))}

            <tr className="border-t-2 border-borde font-semibold">
              <td colSpan={2}>Total</td>
              <td className="text-center tabular-nums">{n(t.meta)}</td>
              {/* LAS CLASES DE LAS DOS MITADES, TAMBIÉN AQUÍ. Sin
                  ellas la raya de color se paraba en la última fila
                  de datos y la de totales quedaba suelta, como si no
                  fuera de la misma tabla. */}
              <td className={CELDA_ENTRO}>{n(t.cuposReservados)}</td>
              <td className={CELDA_ENTRO}>{n(t.campanaDigital)}</td>
              <td className={CELDA_ENTRO}>{n(t.totalLeads)}</td>
              <td className={CELDA_INSCRIBIO}>{n(t.inscritosReservas)}</td>
              <td className={CELDA_INSCRIBIO}>{n(t.inscritosCampana)}</td>
              <td className="text-center text-exito tabular-nums grupo-inscribio">
                {n(t.totalInscritos)}
              </td>
              <td className="text-center tabular-nums">
                {tasa(t.totalLeads > 0 ? t.totalInscritos / t.totalLeads : null)}
              </td>
              <td className="text-center tabular-nums">{n(t.cuposDisponibles)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

    </Bloque>
  );
}
