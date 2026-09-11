/** El bloque que vive DENTRO de una banda, y su rótulo. */

/// Ni borde, ni fondo, ni cabecera teñida.
///
/// Lo que había era `Bloque` de `piezas.tsx`: una caja con borde
/// y una franja de `--marca-suave` de cabecera. En una pantalla
/// con cinco de esas franjas ninguna es la importante —el único
/// escalón de jerarquía que quedaba era el color del fondo, y es
/// el mismo color siempre—, y encima tres marcos anidados para
/// dos casillas de verificación.
///
/// Un bloque se separa del siguiente por 24 px de aire y por su
/// rótulo en versalita. Nada más. Quien delimita es la BANDA
/// (`Seccion`), con su regla de 1 px abajo.

import type React from "react";

/**
 * El rótulo en versalita: 10/700, +0.11em, `--texto-suave`.
 *
 * No va en `--marca`: el azul de marca tiene cuatro usos —botón
 * principal, enlace, aro de foco y lo que está seleccionado
 * ahora mismo— y un rótulo no es ninguno de los cuatro. Un
 * rótulo azul cada 24 px reparte el acento hasta que deja de
 * señalar nada.
 */
export function Rotulo({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`font-bold uppercase text-texto-suave ${className}`}
      style={{ fontSize: "0.625rem", letterSpacing: "0.11em", lineHeight: 1.2 }}
    >
      {children}
    </div>
  );
}

/**
 * Un corte dentro de una banda: rótulo, nota y contenido.
 *
 * `nota` es prosa y topa en 68 caracteres: una línea de 1350 px
 * se pierde al volver al renglón siguiente.
 */
export function BloqueDeBanda({
  rotulo,
  nota,
  acciones,
  children,
}: {
  rotulo?: string;
  nota?: React.ReactNode;
  /// A la derecha del rótulo, en la misma línea base.
  acciones?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section>
      {(rotulo || acciones) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          {rotulo && <Rotulo>{rotulo}</Rotulo>}
          {acciones}
        </div>
      )}
      {nota && (
        <p
          className="mt-2 max-w-[68ch] text-texto-suave"
          style={{ fontSize: "0.71875rem", lineHeight: 1.55 }}
        >
          {nota}
        </p>
      )}
      {children && <div className={rotulo || nota ? "mt-3" : undefined}>{children}</div>}
    </section>
  );
}

/**
 * El ancho de un formulario: 720 px y ni uno más.
 *
 * Un campo de correo no mide 1350 px de ancho nunca. El
 * contenido de trabajo —tablas y tablero— sí va a sangre, pero
 * un formulario es prosa con casillas.
 */
export const ANCHO_FORMULARIO = "max-w-[720px]";
