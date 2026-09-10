"use client";

/** Lo que estas cifras piden hacer hoy, en orden. */

/**
 * La única lista ACCIONABLE de Control de Inscritos.
 *
 * El resto de la pantalla describe: cuántos entraron, dónde se
 * caen, de dónde vienen. Esto dice qué hacer, con el nombre de a
 * quién llamar. Es lo que separa un tablero que se mira de uno
 * que se usa.
 *
 * Se perdió al rediseñar la pantalla —el encargo de diseño no le
 * dejó sitio y se fue con el cuerpo viejo— y José pidió que
 * volviera. Vuelve como COMPONENTE y no como un trozo dentro de
 * la página: así el siguiente rediseño lo mueve, pero no puede
 * borrarlo sin darse cuenta.
 *
 * Las cuatro salen de cifras que ya están en `control`. No hay
 * consulta nueva: es la misma información dicha como una tarea.
 *
 * El orden no es casual. Primero lo que ya está pagado y sin
 * nombre —un cupo apartado que no se llena es una plaza perdida
 * para el SENA—, luego lo que se enfría, luego lo que nadie está
 * trabajando, y al final la única que no es una queja: por dónde
 * conviene empujar.
 */

import { n } from "./graficos";
import { Bloque } from "./piezas";
import { ETIQUETA_ORIGEN, type Control, type Origen } from "@/lib/crm-api";

type Tono = "bueno" | "normal" | "aviso";

/// Los tramos de espera que manda el backend. 8 y 15 días son
/// «frío»: una semana sin la primera llamada.
const DIAS_FRIOS = [8, 15];

export function PendientesDeHoy({ control }: { control: Control | null }) {
  if (!control) return null;
  const d = control;

  const espera = new Map(d.sinContactar.map((t) => [t.dias, t.total]));
  const esperando = d.sinContactar.reduce((s, t) => s + t.total, 0);
  const frios = DIAS_FRIOS.reduce((s, x) => s + (espera.get(x) ?? 0), 0);

  /// Cupos apartados por una organización que todavía no tienen
  /// una persona detrás.
  const sinNombre = Math.max(0, d.cuposConfirmados - d.inscritosConReserva);
  const cobertura = d.cuposConfirmados > 0 ? d.inscritosConReserva / d.cuposConfirmados : 0;

  /// El canal que mejor convierte, con al menos cinco leads: con
  /// dos leads y un inscrito sale un 50 % que no significa nada.
  const mejorCanal = [...d.conversionPorOrigen]
    .filter((o) => o.leads >= 5)
    .sort((a, b) => b.conversion - a.conversion)[0];

  /// La que más cupos debe, para poder decir a quién llamar.
  const empresaFloja = [...d.topEmpresas].sort(
    (a, b) => b.cupos - b.inscritos - (a.cupos - a.inscritos),
  )[0];

  const pendientes: Array<{
    tono: Tono;
    cifra: number;
    que: string;
    hacer: string;
    accion: string;
  }> = [];

  if (sinNombre > 0)
    pendientes.push({
      tono: cobertura >= 0.8 ? "bueno" : cobertura >= 0.4 ? "normal" : "aviso",
      cifra: sinNombre,
      accion: "Cobrar nombres",
      que: `de los ${n(d.cuposConfirmados)} cupos apartados no tienen todavía un nombre detrás.`,
      hacer: empresaFloja
        ? `La que más debe es ${empresaFloja.razonSocial}, con ${n(
            empresaFloja.cupos - empresaFloja.inscritos,
          )} pendientes. Pídale los nombres.`
        : "Pida los nombres a las organizaciones que apartaron cupos.",
    });

  if (frios > 0)
    pendientes.push({
      tono: "aviso",
      cifra: frios,
      accion: "Llamar",
      que: `de los ${n(esperando)} leads que esperan una primera llamada llevan más de una semana.`,
      hacer: "Llámelos hoy: cuanto más se enfría un lead, menos se inscribe.",
    });

  if (d.sinAsignar > 0)
    pendientes.push({
      tono: "normal",
      cifra: d.sinAsignar,
      accion: "Asignar",
      que: "leads no tienen asesor asignado.",
      hacer: "Repártalos, porque hoy no los está llamando nadie.",
    });

  if (mejorCanal)
    pendientes.push({
      tono: "bueno",
      cifra: Math.round(mejorCanal.conversion * 100),
      accion: "Ver canal",
      que: `% inscribe «${
        ETIQUETA_ORIGEN[mejorCanal.etiqueta as Origen] ?? mejorCanal.etiqueta
      }», el canal que mejor rinde.`,
      hacer: "Es por donde conviene meter esfuerzo antes que por el que más volumen trae.",
    });

  return (
    <Bloque
      titulo="Qué atender primero"
      descripcion="Lo que estas cifras piden hacer hoy, en orden."
    >
      {pendientes.length === 0 ? (
        /* El caso bueno se dice, no se deja en blanco: una
           tarjeta vacía se lee como que no cargó. */
        <p className="text-[0.84375rem] text-texto-suave">
          No hay nada pendiente: los cupos tienen nombre y no queda nadie sin llamar.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {pendientes.map((p) => (
            <li key={p.accion} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span
                className={`w-[3.25rem] shrink-0 text-right text-[1.375rem] leading-none font-bold tabular-nums ${
                  p.tono === "aviso"
                    ? "text-error"
                    : p.tono === "bueno"
                      ? "text-exito"
                      : "text-aviso"
                }`}
              >
                {n(p.cifra)}
              </span>
              <p className="min-w-0 grow text-[0.84375rem] leading-snug">
                <span className="text-titulo">{p.que}</span>{" "}
                <span className="text-texto-suave">{p.hacer}</span>
              </p>
              <span className="shrink-0 text-[0.6875rem] font-semibold tracking-[0.06em] text-marca uppercase">
                {p.accion}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}
