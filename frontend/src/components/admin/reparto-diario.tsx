"use client";

/**
 * EL CUADRO DE DIANITA: la meta repartida por asesor y por día.
 *
 * «Que sea relacional con Proyección Inscripciones, detallándolo o
 * trazándolo con cuadro de ejemplo de Dianita» (cliente, 30 sep 2026).
 * Y el ejemplo que mandó es este, tal cual:
 *
 *        449   29/09   30/09   1/10   2/10   5/10   TOTAL
 *   JULIETH     40      50      45     45     45     225
 *   KATHE       45      45      45     45     45     225
 *                                             TOTAL  450
 *
 * SUS CIFRAS CUADRAN SOLAS CON LO QUE YA CALCULA EL SISTEMA, y por eso
 * esto no inventa una regla nueva: 449 que faltan, entre 2 asesoras,
 * son 225 cada una; entre 5 días, 45 al día. Lo mismo que sale aquí.
 * Las de Julieth ---40 y 50 los dos primeros días--- son un ajuste a
 * mano suyo sobre esos 45; el cuadro dice cuánto toca, no impide
 * repartirlo de otra forma.
 *
 * POR QUÉ LA CUENTA VA AL REVÉS DE LO QUE PARECE. No se divide la meta
 * entre los días y luego entre los asesores: se divide entre los
 * asesores PRIMERO y se redondea, y ESE número se divide entre los
 * días y se redondea otra vez. Redondear dos veces hacia arriba es lo
 * que hace que el total del cuadro (450) quede por encima de la meta
 * (449) en vez de por debajo. Al revés, repartir 449 entre 10 celdas
 * daría 45 por celda ---parece igual--- pero con otros números se
 * queda corto, y una meta que se queda corta no es una meta.
 *
 * TODO ENTERO. «Nada en decimal, debe ser en número entero» (cliente,
 * 26 sep 2026): nadie llama a media persona.
 *
 * LOS DÍAS SON DE TRABAJO, LUNES A SÁBADO. Es la regla que él fijó el
 * 26 sep para todas las metas de este panel, y la misma que usa el
 * servidor. El cuadro de Dianita salta el sábado 3 de octubre, así que
 * ahí cuenta cinco días donde este cuadro cuenta seis: con seis, la
 * cifra diaria baja. Se dice en pantalla para que se vea de dónde sale
 * y pueda corregirse si manda el calendario de ella.
 */

import { useMemo } from "react";

/// Colombia va cinco horas detrás de UTC y no mueve el reloj.
const HORAS_BOGOTA = 5;

function hoyBogota(ahora = new Date()): Date {
  const d = new Date(ahora.getTime() - HORAS_BOGOTA * 3600_000);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Los días de trabajo que quedan, de mañana al cierre, con su fecha.
 *
 * ARRANCA MAÑANA Y NO HOY, como el cuadro de Dianita: el suyo empieza
 * el 29 y lo hizo el 28. Lo de hoy ya está en marcha; lo que se
 * reparte es lo que queda por delante.
 *
 * Se topa en sesenta columnas: un cierre a un año daría trescientas y
 * la tabla dejaría de leerse. Si se topa, se dice.
 */
export function diasDeTrabajoHasta(
  cierre: Date,
  ahora = new Date(),
  tope = 60,
): { dias: Date[]; topado: boolean } {
  const dias: Date[] = [];
  const f = hoyBogota(ahora);
  const fin = hoyBogota(cierre);
  let topado = false;

  while (true) {
    f.setUTCDate(f.getUTCDate() + 1);
    if (f.getTime() > fin.getTime()) break;
    /// Solo el domingo no cuenta.
    if (f.getUTCDay() !== 0) dias.push(new Date(f));
    if (dias.length >= tope) {
      topado = true;
      break;
    }
  }
  return { dias, topado };
}

/** 29/09/2026, como lo escribe ella. */
function fecha(d: Date): string {
  return `${d.getUTCDate()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export type AsesorDelReparto = { id: string; nombre: string };

export function RepartoDiario({
  meta,
  queEs,
  asesores,
  cierre,
  alIrALaProyeccion,
  vencidas = 0,
  faltaEnVencidas = 0,
  ahora = new Date(),
}: {
  /// Lo que falta por conseguir. Es la cifra que encabeza su cuadro.
  meta: number;
  /// Cómo se llama eso: «cupos por cubrir», «leads por conseguir».
  queEs: string;
  asesores: AsesorDelReparto[];
  /// Hasta cuándo hay que conseguirlo.
  cierre: Date | null;
  /// LLEVA A DONDE SALEN LAS CIFRAS.
  ///
  /// «Pilas, porque debe estar amarrado a esto» (cliente, 30 sep
  /// 2026, señalando «Proyección Inscripciones»). Y lo está: la meta
  /// y el cierre vienen de ahí, en la misma consulta. Lo que no
  /// estaba era VERSE, y una cifra de la que no se sabe de dónde sale
  /// se discute en cada reunión. Con el enlace, quien dude va y lo
  /// comprueba acción por acción.
  alIrALaProyeccion?: () => void;
  /// LO QUE SE QUEDA FUERA DEL REPARTO, para poder decirlo.
  ///
  /// Sin esto el cuadro dice una cifra y la tabla de Proyección dice
  /// otra mayor, y nadie sabe por qué. No es un descuadre: las
  /// acciones con el cierre vencido no se pueden repartir entre días
  /// que ya pasaron. Pero hay que DECIRLO, o parece un error.
  vencidas?: number;
  faltaEnVencidas?: number;
  ahora?: Date;
}) {
  const r = useMemo(() => {
    if (!cierre || asesores.length === 0 || meta <= 0) return null;
    const { dias, topado } = diasDeTrabajoHasta(cierre, ahora);
    if (dias.length === 0) return null;

    /// Primero entre asesores, y después entre días. Ver el porqué
    /// arriba: redondear en ese orden es lo que deja el total POR
    /// ENCIMA de la meta y no por debajo.
    const porAsesor = Math.ceil(meta / asesores.length);
    const porDia = Math.ceil(porAsesor / dias.length);

    return {
      dias,
      topado,
      porAsesor,
      porDia,
      /// La fecha del cierre se arma AQUÍ, donde ya se sabe que hay
      /// cierre. Afuera, `cierre` sigue siendo `Date | null` y
      /// resolverlo con un `?? hoy` enseñaría la fecha de hoy como si
      /// fuera el plazo: un error que nadie detectaría leyendo.
      hastaCuando: fecha(hoyBogota(cierre)),
      /// Lo que de verdad suma el cuadro, que por los redondeos es
      /// algo más que la meta. Se enseña: si no, parece un error.
      totalFila: porDia * dias.length,
      total: porDia * dias.length * asesores.length,
    };
  }, [meta, asesores.length, cierre, ahora]);

  if (!r) {
    return (
      <p className="text-[0.78125rem] text-texto-suave">
        {!cierre
          ? "No hay fecha de cierre, así que no hay días entre los que repartir."
          : meta <= 0
            ? "No queda nada por cubrir: la meta ya está."
            : asesores.length === 0
              ? "No hay asesores con carga de inscripciones."
              : "El cierre ya pasó."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <h3 className="text-sm font-bold">Reparto diario por asesor</h3>
        {/* DOS LÍNEAS, NO TRES PÁRRAFOS.

            Esto llegó a tener catorce renglones explicando la cuenta,
            por qué unas acciones quedan fuera y qué hacer para que
            entren. «¿Qué es este lenguaje, Claude, de verdad?»
            (cliente, 30 sep 2026). Un cuadro de metas dice las cifras;
            quien quiera la cuenta la hace, y quien quiera el detalle
            pulsa el enlace. */}
        <p className="mt-0.5 text-[0.71875rem] text-texto-suave">
          <strong className="font-semibold text-titulo">{meta}</strong> {queEs}
          {" · "}
          {asesores.length} {asesores.length === 1 ? "asesor" : "asesores"}
          {" · "}
          {r.dias.length} {r.dias.length === 1 ? "día" : "días"} hasta el{" "}
          {r.hastaCuando}
          {vencidas > 0 && (
            <>
              {" · "}
              <span className="text-aviso">
                {vencidas} con el cierre vencido, fuera ({faltaEnVencidas})
              </span>
            </>
          )}
          {alIrALaProyeccion && (
            <>
              {" · "}
              <button
                type="button"
                onClick={alIrALaProyeccion}
                className="text-marca underline underline-offset-2 hover:opacity-80"
              >
                ver en Proyección
              </button>
            </>
          )}
        </p>
      </div>

      <div className="caja-scroll overflow-x-auto rounded-xl border border-borde">
        <table className="tabla-datos w-full">
          <thead>
            <tr className="bg-tabla-cabecera-fondo text-tabla-cabecera-texto">
              <th className="sticky left-0 z-10 bg-tabla-cabecera-fondo text-left">
                Asesor
              </th>
              {r.dias.map((d) => (
                <th key={d.toISOString()} className="text-center whitespace-nowrap">
                  {fecha(d)}
                  <span className="block text-[0.625rem] font-normal opacity-70">
                    {DIA_CORTO[d.getUTCDay()]}
                  </span>
                </th>
              ))}
              <th className="text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {asesores.map((a) => (
              <tr key={a.id}>
                <td className="sticky left-0 z-10 bg-superficie font-medium">
                  {a.nombre}
                </td>
                {r.dias.map((d) => (
                  <td key={d.toISOString()} className="text-center tabular-nums">
                    {r.porDia}
                  </td>
                ))}
                <td className="text-center font-semibold tabular-nums">
                  {r.totalFila}
                </td>
              </tr>
            ))}
            {/* LA FILA DEL TOTAL, como en su cuadro: abajo del todo y a
                la derecha. Es la que dice si el reparto cubre la meta. */}
            <tr className="border-t-2 border-borde">
              <td className="sticky left-0 z-10 bg-superficie font-bold">Total</td>
              {r.dias.map((d) => (
                <td key={d.toISOString()} className="text-center font-semibold tabular-nums">
                  {r.porDia * asesores.length}
                </td>
              ))}
              <td className="text-center font-bold tabular-nums">{r.total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* LA CUENTA, EN SIGNOS Y NO EN PROSA.

          Eran seis renglones explicando el redondeo y por qué el total
          pasa de la meta. «¿Qué es este lenguaje?» (cliente, 30 sep
          2026). Quien quiera comprobarla la lee de un vistazo; el
          porqué del redondeo vive en el comentario de arriba, que es
          donde sirve. */}
      <p className="text-[0.6875rem] text-texto-suave tabular-nums">
        {meta} ÷ {asesores.length} = {r.porAsesor} · {r.porAsesor} ÷{" "}
        {r.dias.length} = {r.porDia} al día · total {r.total}
      </p>
    </div>
  );
}
