"use client";

/** Cuántos negocios entró un formulario, y por qué campaña. */

/// LA FRASE QUE ESTA PIEZA TIENE QUE DEJAR DICHA:
/// «este formulario es esta puerta, y por ella han entrado N
/// negocios que valen X».
///
/// Sale del resumen del embudo (`porCampana`), que agrupa las
/// oportunidades por la cadena `campana` y por nada más. Qué
/// campañas son de este formulario lo decide la convención de
/// `lib/enlace-de-campana.ts`; aquí solo se suma.

import { anuncioDe, esDeLaPuerta } from "@/lib/enlace-de-campana";
import { enPesos, type ResumenDeVentas } from "@/lib/oportunidades-api";

type Fila = ResumenDeVentas["porCampana"][number];

/** Lo que entró por esa puerta, sumado y en detalle. */
export function loQueEntroPor(
  slug: string,
  resumen: ResumenDeVentas | null,
): { filas: Fila[]; cuantas: number; abierto: number; ganado: number } {
  const filas = (resumen?.porCampana ?? []).filter((f) =>
    esDeLaPuerta(slug, f.campana),
  );
  return {
    filas,
    cuantas: filas.reduce((s, f) => s + f.cuantas, 0),
    abierto: filas.reduce((s, f) => s + f.abierto, 0),
    ganado: filas.reduce((s, f) => s + f.ganado, 0),
  };
}

/**
 * Lo que trajo una campaña de correo, por su nombre.
 *
 * La marca que se reparte es `puerta/anuncio` y el anuncio se
 * sugiere de los nombres de las campañas de mailing: por eso una
 * campaña se reconoce como la cola de la etiqueta. Es la misma
 * convención de `enlace-de-campana.ts` leída del otro lado —un
 * formulario publicado ES una campaña, y la cuenta tiene que
 * poder verse desde las dos pantallas.
 */
export function loQueTrajoLaCampana(
  nombre: string,
  resumen: ResumenDeVentas | null,
): { cuantas: number; abierto: number; ganado: number } {
  const limpio = nombre.trim();
  const filas = (resumen?.porCampana ?? []).filter(
    (f) => f.campana === limpio || f.campana.endsWith(`/${limpio}`),
  );
  return {
    cuantas: filas.reduce((s, f) => s + f.cuantas, 0),
    abierto: filas.reduce((s, f) => s + f.abierto, 0),
    ganado: filas.reduce((s, f) => s + f.ganado, 0),
  };
}

/// LO VACÍO SE ESCRIBE «—», SIEMPRE.
///
/// Ni «Sin valor», ni «$ 0», ni «0 negocios». Una raya en gris
/// dice «aquí no hay nada» sin gastar el peso tipográfico que le
/// toca a la plata que sí hay.
const NADA = "—";

/**
 * Una cantidad de pesos, con el contrato del panel.
 *
 * El signo a 0,85 em y en `--texto-suave`; los dígitos heredan
 * el tamaño y el color de quien la pinta, que es quien decide
 * si esta cifra es la portada (34) o la de una fila (20).
 * Tabular siempre, sin decimales nunca.
 */
export function Plata({ valor }: { valor: number | null | undefined }) {
  if (valor === null || valor === undefined || valor <= 0) {
    return <span className="text-texto-suave">{NADA}</span>;
  }
  /// `enPesos` devuelve «$ 46.500.000»: se parte el signo para
  /// poder apagarlo sin reescribir el formato de la moneda.
  const digitos = enPesos(valor).replace(/^[^\d]*/, "");
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-texto-suave" style={{ fontSize: "0.85em" }}>
        $
      </span>
      <span style={{ marginLeft: "0.2em" }}>{digitos}</span>
    </span>
  );
}

/**
 * Lo que ha traído una puerta, para el canto derecho de su fila.
 *
 * El dinero es lo más grande de la fila —20/700— y la cuenta de
 * negocios baja a micro debajo. Es el orden que pidió el dueño:
 * primero cuánto vale, después cuántos son.
 */
export function LoQueTrajoLaPuerta({
  slug,
  resumen,
}: {
  slug: string;
  resumen: ResumenDeVentas | null;
}) {
  /// Mientras no ha llegado el resumen se pinta la raya y no un
  /// cero: un «0 negocios» que después salta a catorce se lee
  /// como que se perdieron catorce.
  const { cuantas, abierto } = resumen
    ? loQueEntroPor(slug, resumen)
    : { cuantas: 0, abierto: 0 };

  return <LoQueTrajo cuantas={cuantas} abierto={abierto} />;
}

/**
 * El canto derecho de una fila: la plata y, debajo, cuántos son.
 *
 * Sin nada que contar es UNA raya en micro, no una raya de 20 px:
 * una raya del tamaño de una cifra se lee como una cifra que no
 * cargó. El hueco vacío ya es información.
 */
export function LoQueTrajo({
  cuantas,
  abierto,
}: {
  cuantas: number;
  abierto: number;
}) {
  if (cuantas === 0) {
    return (
      <div
        className="shrink-0 text-right text-texto-suave"
        style={{ fontSize: "0.65625rem" }}
      >
        {NADA}
      </div>
    );
  }

  return (
    <div className="shrink-0 text-right">
      <div
        className="font-bold leading-none text-titulo"
        style={{ fontSize: "1.25rem", letterSpacing: "-0.02em" }}
      >
        <Plata valor={abierto} />
      </div>
      <div
        className="mt-1.5 leading-none text-texto-suave tabular-nums"
        style={{ fontSize: "0.65625rem" }}
      >
        {cuantas} {cuantas === 1 ? "negocio" : "negocios"}
      </div>
    </div>
  );
}

/**
 * Las tres cifras de una puerta, sin caja y separadas por aire.
 *
 * El dinero abierto va a 34 px: es la cifra de portada de la
 * pantalla, y es la que decide si se sigue pagando el anuncio.
 * La cuenta de negocios y lo ganado la acompañan a 20.
 */
export function CifrasDeLaPuerta({
  cuantas,
  abierto,
  ganado,
}: {
  cuantas: number;
  abierto: number;
  ganado: number;
}) {
  return (
    <div className="flex flex-wrap gap-x-12 gap-y-5">
      <Indicador rotulo="Negocios">
        <span className="tabular-nums">{cuantas > 0 ? cuantas : NADA}</span>
      </Indicador>
      <Indicador rotulo="Abierto" grande>
        <Plata valor={abierto} />
      </Indicador>
      <Indicador rotulo="Ganado" color={ganado > 0 ? "var(--exito)" : undefined}>
        <Plata valor={ganado} />
      </Indicador>
    </div>
  );
}

/** El detalle: la cuenta y de qué anuncio vino cada parte. */
export function LoQueHaTraido({
  slug,
  resumen,
  conCifras = true,
}: {
  slug: string;
  resumen: ResumenDeVentas | null;
  /**
   * Si pinta las tres cifras encima de la tabla.
   *
   * En la ficha de un formulario sí: ahí la de 34 px es la cifra
   * de portada de la pantalla. En la lista, NO: la portada ya la
   * lleva la banda de arriba con el total de todas las puertas,
   * y dos cifras de 34 px en la misma pantalla son dos cifras
   * medianas. Lo que esa puerta vale se lee en su propia fila,
   * en 20/700.
   */
  conCifras?: boolean;
}) {
  const { filas, cuantas, abierto, ganado } = loQueEntroPor(slug, resumen);

  return (
    <div>
      {/* Las cifras solo si hay algo que contar. Tres rayas de
          34 px se leen como tres cifras que no cargaron, y esta
          pantalla no tiene por qué anunciar un hueco: lo que hay
          que decir cuando está vacío es CÓMO se llena. */}
      {conCifras && cuantas > 0 && (
        <CifrasDeLaPuerta cuantas={cuantas} abierto={abierto} ganado={ganado} />
      )}

      {cuantas === 0 ? (
        <p
          className="max-w-[68ch] text-texto-suave"
          style={{ fontSize: "0.71875rem", lineHeight: 1.55 }}
        >
          {resumen
            ? "Todavía no hay negocios marcados con esta puerta. Se marcan repartiendo el enlace de abajo con su campaña: esa marca es la que se cuenta aquí."
            : "Contando…"}
        </p>
      ) : (
        /// TRES ANCHOS FIJOS Y EL ANUNCIO ABSORBE.
        ///
        /// Era `w-full` con reparto automático: a 1920, «Evento
        /// Andi» quedaba en la x 260 y su «1» en la 1190, con
        /// novecientos píxeles de blanco en medio. Una cifra a
        /// novecientos píxeles de su rótulo no se lee: se
        /// adivina. Con las tres columnas de cifras fijas, el
        /// número queda pegado al anuncio que lo trajo y las
        /// tres se comparan en vertical, que es para lo que
        /// existe esta tabla —decidir qué anuncio se sigue
        /// pagando—. `$ 999.999.999` a 13 px tabular mide 104;
        /// con relleno, 128.
        /// Y TOPA EN 740, que es lo que miden sus cuatro
        /// columnas: 388 de anuncio —«Meta · Seguridad
        /// industrial» son 190— más las tres de cifras. Sin
        /// tope, en una región de 1090 px el anuncio se llevaba
        /// 740 y su cuenta quedaba a ochocientos píxeles. Es la
        /// misma medida de la franja de cifras que va encima, así
        /// que las dos acaban en la misma x.
        <table
          className={`w-full max-w-[740px] table-fixed ${
            conCifras && cuantas > 0 ? "mt-6" : ""
          }`}
        >
          <colgroup>
            <col />
            <col style={{ width: 96 }} />
            <col style={{ width: 128 }} />
            <col style={{ width: 128 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-borde text-left">
              {[
                ["Anuncio", ""],
                ["Negocios", "text-right"],
                ["Abierto", "text-right"],
                ["Ganado", "text-right"],
              ].map(([texto, alineado]) => (
                <th
                  key={texto}
                  className={`pb-2 font-bold uppercase text-texto-suave ${alineado}`}
                  style={{ fontSize: "0.625rem", letterSpacing: "0.11em" }}
                >
                  {texto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ fontSize: "0.8125rem" }}>
            {filas.map((f) => {
              const anuncio = anuncioDe(slug, f.campana);
              return (
                <tr key={f.campana} className="border-b border-hairline">
                  {/* UN RENGLÓN, SIEMPRE.

                      Sin `truncate`, «Meta · Seguridad industrial»
                      se partía en dos renglones en cuanto la región
                      bajaba de 740 px —a 1440 pasa—, y esa fila
                      medía 51 px contra los 33 de las demás. Dos
                      altos en la misma lista y la lista deja de
                      escanearse: el ojo necesita un paso constante
                      para bajar por una columna sin releer. El
                      texto entero se queda en el `title`. */}
                  <td
                    className="truncate py-[7px] pr-4"
                    title={anuncio ?? "Enlace sin campaña"}
                  >
                    {anuncio ?? (
                      /* El enlace se repartió sin anuncio. No es un
                         fallo: el pie de una firma o un volante no
                         son campañas, y decirlo así lo distingue de
                         una campaña que se llame «(sin nombre)». */
                      <span className="text-texto-suave">Enlace sin campaña</span>
                    )}
                  </td>
                  <td className="py-[7px] pr-4 text-right tabular-nums">
                    {f.cuantas}
                  </td>
                  <td className="py-[7px] pr-4 text-right">
                    <Plata valor={f.abierto} />
                  </td>
                  <td
                    className="py-[7px] text-right"
                    style={f.ganado > 0 ? { color: "var(--exito)" } : undefined}
                  >
                    <Plata valor={f.ganado} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/// Rótulo en versalita arriba y la cifra debajo. Sin caja: la
/// separación la pone el aire, que es lo que deja que la cifra
/// grande se lea como la cifra grande.
function Indicador({
  rotulo,
  children,
  grande,
  color,
}: {
  rotulo: string;
  children: React.ReactNode;
  grande?: boolean;
  color?: string;
}) {
  return (
    <div>
      <div
        className="font-bold uppercase text-texto-suave"
        style={{ fontSize: "0.625rem", letterSpacing: "0.11em" }}
      >
        {rotulo}
      </div>
      <div
        className="mt-2 font-bold leading-none text-titulo"
        style={{
          fontSize: grande ? "2.125rem" : "1.25rem",
          letterSpacing: "-0.03em",
          color,
        }}
      >
        {children}
      </div>
    </div>
  );
}
