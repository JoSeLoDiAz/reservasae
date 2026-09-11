/** Las dos piezas de MARCO del embudo: la banda y su apoyo. */

/// AQUÍ VIVÍAN TAMBIÉN LAS PIEZAS DE DATO, Y ERAN LAS SEGUNDAS.
///
/// El panel llegó a tener dos juegos completos: `Plata` y
/// `Dinero`, `EtapaDeVenta` y `Etapa`, `NombreDeEmpresa` y
/// `Cliente`, dos `Reloj`, dos `Puerta`, dos `Codigo`, dos
/// `Porcentaje` y dos `Fecha`. Cada uno correcto por su lado y
/// usado por pantallas distintas —el Resumen y el tablero por
/// unos, la lista y el cajón por los otros—, que es exactamente
/// la avería que las piezas compartidas existen para evitar: dos
/// implementaciones del mismo contrato empiezan iguales y no
/// terminan iguales, y el día que dejan de serlo la plata del
/// Resumen se escribe distinto que la de la lista.
///
/// El contrato entero está en `datos-del-negocio.tsx` y es uno
/// solo. Aquí queda lo que de verdad es de este archivo: cómo se
/// enmarca una franja del embudo.

import type { ReactNode } from "react";

/* ───────────────────────────────────────────────────────────────
   La banda: el único contenedor del panel.

   No es una tarjeta sobre un fondo: es una franja a sangre que
   cruza la pantalla y a la que separa de la siguiente una regla de
   1 px. Por eso el relleno lo pone ella (24 px) y no el
   contenedor: puesto fuera, las reglas se quedarían cortas y
   flotando en mitad del ancho.
   ─────────────────────────────────────────────────────────────── */
export function Banda({
  children,
  sinRegla,
  crece,
  className = "",
}: {
  children: ReactNode;
  /** La última de la pantalla: debajo no empieza nada. */
  sinRegla?: boolean;
  /** Que se coma el alto que sobre. Para el tablero. */
  crece?: boolean;
  className?: string;
}) {
  return (
    <section
      className={
        "bg-superficie px-6 py-4 " +
        (sinRegla ? "" : "border-b border-borde ") +
        (crece ? "flex min-h-0 grow flex-col " : "") +
        className
      }
    >
      {children}
    </section>
  );
}

/** El texto de apoyo de un rótulo. Nunca compite con el dato. */
export function Apoyo({ children }: { children: ReactNode }) {
  return <p className="secundario prosa mt-1">{children}</p>;
}
