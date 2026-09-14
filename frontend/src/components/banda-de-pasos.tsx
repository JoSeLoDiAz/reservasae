/** Donde va la persona dentro del tramite publico. */

/// Los tres pasos, escritos UNA vez.
///
/// Estaban copiados a mano en la preinscripcion y en
/// `completar-ficha`. El cliente pidio el 14 sep 2026 que la
/// banda avanzara, y con dos copias se arregla una y la otra
/// se queda diciendo otra cosa.
const PASOS = [
  { n: 1, texto: "Reserva de cupo" },
  { n: 2, texto: "Datos de preinscripción" },
  { n: 3, texto: "Preinscripción confirmada" },
] as const;

/** En que paso va, de 1 a 3. */
export function BandaDePasos({ paso }: { paso: 1 | 2 | 3 }) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie px-5 py-4">
      <div className="flex flex-wrap items-center gap-y-2">
        {PASOS.map((x, i) => (
          <div key={x.n} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                x.n < paso
                  ? "bg-exito text-white"
                  : x.n === paso
                    ? "bg-marca text-marca-texto"
                    : "border border-borde text-texto-suave"
              }`}
            >
              {/* solo lleva palomita lo que quedo atras */}
              {x.n < paso ? "✓" : x.n}
            </span>
            <span
              className={`whitespace-nowrap text-sm ${
                x.n === paso ? "font-semibold text-marca" : "text-texto-suave"
              }`}
            >
              {x.texto}
            </span>
            {i < PASOS.length - 1 && (
              <span className="mx-2 hidden h-px flex-1 bg-borde sm:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
