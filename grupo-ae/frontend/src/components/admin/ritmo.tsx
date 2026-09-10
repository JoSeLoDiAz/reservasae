"use client";

import Link from "next/link";

import { n, TarjetaCifra } from "@/components/admin/graficos";
import { Tarjeta } from "@/components/admin/marco-admin";
import { bonito } from "@/lib/api";
import type { InformeProyeccion, Proyeccion } from "@/lib/tableros-api";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function fechaLarga(iso: string): string {
  return FECHA.format(new Date(`${iso}T00:00:00Z`));
}

/** Un decimal, y "0,4" en vez de "0.4". */
function ritmo(valor: number): string {
  return valor.toLocaleString("es-CO", { maximumFractionDigits: 1 });
}

/**
 * Qué pasa con esta meta, contra el CRONOGRAMA.
 *
 * El plazo manda sobre el ritmo. «A este ritmo se llena el 22
 * de junio de 2027» es cierto y no sirve de nada: para esa
 * fecha el curso arrancó y cerró hace meses. Cuando hay fecha
 * de cierre, la respuesta es si llega o no llega antes de ella,
 * y cuántos cupos quedarían sin llenar.
 *
 * Sin cronograma se vuelve a lo de antes --el ritmo solo-- y se
 * DICE que falta la fecha. Eso es accionable: alguien la carga
 * y la pantalla empieza a contestar de verdad.
 */
export function textoDeEstado(p: Proyeccion): string {
  // estas dos no dependen del plazo
  if (p.estado === "CUMPLIDA") return "Meta cumplida.";
  if (p.estado === "SIN_META") return "No hay meta registrada.";

  switch (p.cronograma) {
    case "CERRADA":
      return `Inscripción cerrada el ${fechaLarga(p.cierre!)}. Quedaron ${n(
        p.faltan,
      )} cupos sin llenar.`;

    case "ALCANZA":
      return `Alcanza la meta antes del cierre, el ${fechaLarga(p.cierre!)}.`;

    case "NO_ALCANZA":
      return (
        `No alcanza: cierra el ${fechaLarga(p.cierre!)} y al ritmo de hoy ` +
        `quedarían ${n(p.faltaranAlCierre!)} cupos sin llenar.` +
        /// Un ritmo negativo no es «poco»: es que se esta
        /// cancelando. Sin decirlo, el numero de arriba se lee
        /// como lentitud.
        (p.estado === "RETROCEDE" ? " Se está cancelando más de lo que entra." : "")
      );

    case "SIN_CRONOGRAMA":
      return `${soloElRitmo(p)} Falta cargar la fecha de inicio del grupo.`;
  }
}

/// Lo que se puede decir con el ritmo y nada más.
function soloElRitmo(p: Proyeccion): string {
  switch (p.estado) {
    case "SIN_RITMO":
      return "Sin movimiento en la ventana.";
    case "RETROCEDE":
      return "Se está cancelando más de lo que entra.";
    case "MUY_LEJOS":
      return "A este ritmo, más de un año.";
    case "ESTIMADA":
      return `A este ritmo se llena el ${fechaLarga(p.fechaEstimada!)}.`;
    default:
      return "";
  }
}

/**
 * Si esta semana entra más o menos que las dos anteriores.
 *
 * Decía «acelerando» y «frenando», que es vocabulario de carro
 * y no de gestión: Mauricio preguntó qué quería decir frenando,
 * que es la señal de que la palabra no estaba trabajando. Ahora
 * nombra lo que mide --el ritmo-- y hacia dónde va.
 */
export function Tendencia({ p }: { p: Proyeccion }) {
  /// Sin las dos no hay tendencia que comparar, y decir
  /// «estable» seria afirmar algo que no se sabe.
  if (p.ritmo7 === null || p.ritmo14 === null) {
    return <span className="text-texto-suave">—</span>;
  }
  const diferencia = p.ritmo7 - p.ritmo14;
  if (Math.abs(diferencia) < 0.05)
    return <span className="text-texto-suave">Ritmo estable</span>;
  return diferencia > 0 ? (
    <span className="text-exito">▲ Ritmo al alza</span>
  ) : (
    <span className="text-aviso">▼ Ritmo a la baja</span>
  );
}

export function BloqueRitmo({ informe }: { informe: InformeProyeccion }) {
  const t = informe.total;

  return (
    <div className="space-y-4">
      <div className="imprimible-bloque grid gap-px border-t border-b border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaCifra
          titulo={`Ritmo (${informe.dias} días)`}
          valor={ritmo(t.ritmoDiario)}
          sufijo="cupos/día"
          detalle={[
            t.ritmo7 !== null && `7 días: ${ritmo(t.ritmo7)}`,
            t.ritmo14 !== null && `14 días: ${ritmo(t.ritmo14)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          tono={t.ritmoDiario < 0 ? "aviso" : "normal"}
        />
        <TarjetaCifra
          titulo="Faltan para la meta"
          valor={t.faltan}
          sufijo="cupos"
          detalle={`Meta comprometida: ${n(t.meta)}`}
        />
        <TarjetaCifra
          titulo="Fecha estimada"
          valor={t.fechaEstimada ? fechaLarga(t.fechaEstimada) : "—"}
          detalle={textoDeEstado(t)}
        />
        <TarjetaCifra
          titulo="Tendencia"
          valor={
            t.ritmo7 === null || t.ritmo14 === null
              ? "—"
              : t.ritmo7 > t.ritmo14
                ? "Al alza"
                : t.ritmo7 < t.ritmo14
                  ? "A la baja"
                  : "Estable"
          }
          detalle={
            t.ritmo14 === null
              ? "Hacen falta dos semanas de ventana para comparar."
              : "Comparando la última semana con las dos últimas."
          }
        />
      </div>

      {(t.confianza === "BAJA" || t.origen === "APROXIMADO") && (
        <p className="text-sm text-texto-suave">
          {t.confianza === "BAJA" && "Menos de una semana de historia: la estimación es floja. "}
          {t.origen === "APROXIMADO" &&
            "Sin registro de movimientos en la ventana; el ritmo sale de la fecha de alta y no descuenta cancelaciones."}
        </p>
      )}
    </div>
  );
}

/** Tabla de las acciones más lentas. */
export function TablaRitmo({ acciones }: { acciones: InformeProyeccion["acciones"] }) {
  const pendientes = acciones.filter((a) => a.estado !== "CUMPLIDA" && a.meta > 0);
  if (!pendientes.length) return null;

  return (
    <Tarjeta
      titulo="Qué va más lento"
      descripcion="Ordenado por cupos que entran al día. Sin fecha límite: solo dice cuándo se llenaría al ritmo actual."
    >
      <div className="caja-scroll overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-tabla-borde bg-tabla-cabecera-fondo text-tabla-cabecera-texto">
              <th className="px-3 py-2 text-left font-semibold">Acción</th>
              <th className="px-3 py-2 text-right font-semibold">Cupos/día</th>
              <th className="px-3 py-2 text-right font-semibold">Faltan</th>
              <th className="px-3 py-2 text-left font-semibold">A este ritmo</th>
              <th className="px-3 py-2 text-left font-semibold">Tendencia</th>
            </tr>
          </thead>
          <tbody>
            {pendientes.map((a, i) => (
              <tr
                key={a.id}
                className={i % 2 ? "bg-tabla-fila-alterna" : undefined}
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/acciones/${a.id}`}
                    className="font-medium text-marca hover:underline"
                  >
                    {a.codigo}
                  </Link>
                  <span className="ml-2 text-texto-suave">{bonito(a.nombre)}</span>
                  {!a.publicada && (
                    <span className="ml-2 rounded-full bg-superficie-alterna px-2 py-0.5 text-xs text-texto-suave">
                      sin publicar
                    </span>
                  )}
                </td>
                {/* enfasis de color solo en las peores */}
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    a.ritmoDiario <= 0 ? "font-semibold text-aviso" : ""
                  }`}
                >
                  {ritmo(a.ritmoDiario)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{n(a.faltan)}</td>
                <td className="px-3 py-2 text-texto-suave">{textoDeEstado(a)}</td>
                <td className="px-3 py-2">
                  <Tendencia p={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}
