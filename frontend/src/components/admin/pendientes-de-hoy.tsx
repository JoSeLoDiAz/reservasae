"use client";

import Link from "next/link";
import { useContext } from "react";

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
import { ContextoRecorteDeControl, enlaceAlInforme } from "./panel-reservas";
import { Bloque } from "./piezas";
import { ETIQUETA_ORIGEN, type Control, type Filtros, type Origen } from "@/lib/crm-api";

type Tono = "bueno" | "normal" | "aviso";

/**
 * El recorte de Control, metido en la dirección de la lista.
 *
 * Las cifras se cuentan CON los filtros de la pantalla --`control.ts`
 * los mete dentro de `suyos`, y `sinAsignar` y `sinContactar` salen de
 * ahí--, así que el enlace tiene que llevarlos o la lista sale más
 * larga que la cifra que se pulsó. Es el mismo defecto que este bloque
 * arregló el 21 sep para la lista entera, colándose por los filtros.
 *
 * NO PISA LO QUE EL ENLACE YA TRAE, y no es un detalle: «Repartir
 * personas» va con `asesor=NINGUNO`, y dejar que el filtro de asesor
 * lo sustituyera daría la lista de ESE asesor, o sea justo la gente
 * que ya tiene quien la llame.
 *
 * `convenioId` se queda fuera porque no puede viajar: `filtros-en-la-url.ts`
 * lo aparta a propósito --«ese sale del gremio de la sesión, y aceptarlo
 * por la URL sería dejar que se pida el gremio ajeno»--. Cuando está
 * puesto se dice arriba, en vez de callarlo.
 */
function conElRecorte(base: string, cortes: Filtros | null): string {
  const [ruta, cola] = base.split("?");
  const p = new URLSearchParams(cola);
  const poner = (llave: string, valor: string | null | undefined) => {
    if (valor && !p.has(llave)) p.set(llave, valor);
  };
  poner("curso", cortes?.accionFormacionId);
  poner("grupo", cortes?.grupoId);
  poner("asesor", cortes?.asesorId);
  poner(
    "departamento",
    cortes?.departamentoSepId != null ? String(cortes.departamentoSepId) : null,
  );
  return `${ruta}?${p.toString()}`;
}

/// Los tramos de espera que manda el backend. 8 y 15 días son
/// «frío»: una semana sin la primera llamada.
const DIAS_FRIOS = [8, 15];

/**
 * Los cupos apartados salieron de aquí (20 sep 2026).
 *
 * «Por qué mezclas peras con manzanas: si hablas de reservas,
 * háblalo más abajo, o que no cuente en el filtro, porque no son
 * registros, son prospectos o gente esperada». Tenía razón: las
 * otras tres filas son LEADS --personas que ya existen y a las que
 * hay que llamar-- y los cupos son un compromiso de una empresa sin
 * nombres todavía. Viven en `ReservasSinNombre`, en su bloque.
 */
export function PendientesDeHoy({ control }: { control: Control | null }) {
  /// ANTES del retorno temprano: un hook detrás de un `return` es
  /// condicional, y React se queja con «Rendered fewer hooks than
  /// expected» en cuanto `control` llega.
  const cortes = useContext(ContextoRecorteDeControl);
  if (!control) return null;
  const d = control;

  const espera = new Map(d.sinContactar.map((t) => [t.dias, t.total]));
  const esperando = d.sinContactar.reduce((s, t) => s + t.total, 0);
  const frios = DIAS_FRIOS.reduce((s, x) => s + (espera.get(x) ?? 0), 0);

  /// El canal que mejor convierte, con al menos cinco leads: con
  /// dos leads y un inscrito sale un 50 % que no significa nada.
  const mejorCanal = [...d.conversionPorOrigen]
    .filter((o) => o.leads >= 5)
    .sort((a, b) => b.conversion - a.conversion)[0];

  const pendientes: Array<{
    tono: Tono;
    cifra: number;
    que: string;
    hacer: string;
    accion: string;
    /// A DÓNDE LLEVA. Era un `<span>` suelto: «¿qué significa
    /// Cobrar nombres, y no tiene hipervínculo ni nada?» (cliente,
    /// 20 sep 2026). Un rótulo que parece botón y no hace nada es
    /// peor que no ponerlo.
    a: string;
    /// Lo que va pegado a la cifra, DENTRO de su columna.
    ///
    /// El canal que mejor rinde es la única fila cuya cifra no son
    /// personas sino un porcentaje, y el «%» se escribía al principio
    /// de la frase de al lado: se leía «39» a 22 px, del mismo tamaño
    /// que el 18 y el 83 --que sí son personas-- y un «% inscribe…»
    /// suelto en otra columna (medido en la captura del cliente, 21
    /// sep 2026). El signo va con su número.
    unidad?: string;
  }> = [];

  /// EL ENLACE LLEVA EL FILTRO PUESTO.
  ///
  /// «¿Estas dos deberían filtrar automático lo que indica, no?»
  /// (cliente, 21 sep 2026). Y sí: los tres llevaban a la lista
  /// entera, así que la cifra decía «18» y al llegar había 131
  /// filas y ningún camino de vuelta a esas 18. Una cifra que
  /// pide hacer algo tiene que llevar a exactamente esa gente.
  ///
  /// Los filtros son los MISMOS que cuentan la cifra: «sigue en
  /// INTERESADO» y «entró hace más de ocho días» son las dos
  /// condiciones de `sinContactar` en `control.ts`, y `espera=8`
  /// es su tramo. Si un día se cambia el tramo allí, hay que
  /// cambiarlo aquí: son la misma pregunta hecha dos veces.
  if (frios > 0)
    pendientes.push({
      tono: "aviso",
      cifra: frios,
      accion: "Ver esas personas",
      a: conElRecorte("/admin/participantes?etapa=INTERESADO&espera=8", cortes),
      que: `de las ${n(esperando)} personas que esperan una primera llamada llevan más de una semana.`,
      hacer: "Llámelos hoy: cuanto más tarda la primera llamada, menos gente se inscribe.",
    });

  if (d.sinAsignar > 0)
    pendientes.push({
      tono: "normal",
      cifra: d.sinAsignar,
      accion: "Repartir personas",
      /// «NINGUNO» es la palabra con la que el servidor entiende
      /// «sin asesor»: un `asesor=` vacío se lee como «no filtres
      /// por asesor», que es justo lo contrario.
      ///
      /// Y `cola=por-trabajar` porque esta cifra NO cuenta a los
      /// inscritos ni a los perdidos sin asesor: un inscrito no
      /// hay que repartirlo. Sin ese trozo la lista salía más
      /// larga que la cifra que se pulsó.
      a: conElRecorte("/admin/participantes?asesor=NINGUNO&cola=por-trabajar", cortes),
      que: "personas no tienen asesor asignado.",
      hacer: "Repártalos, porque hoy no los está llamando nadie.",
    });

  if (mejorCanal)
    pendientes.push({
      tono: "bueno",
      cifra: Math.round(mejorCanal.conversion * 100),
      accion: "Ver el tráfico",
      /// DIRECTO A LA MISMA RUTA, Y YA FUNCIONA.
      ///
      /// Durante un tiempo esto daba un rodeo por `/admin/trafico`,
      /// que redirige aquí: Control leía `?pantalla` una sola vez,
      /// al montar, y un enlace a la misma ruta no la vuelve a
      /// montar, así que el parámetro cambiaba en la barra y la
      /// pantalla no. Desde el 21 sep 2026 Control lo lee con
      /// `useSearchParams`, que se entera de cada cambio de la
      /// dirección --lo destapó el «ver reservas no funciona» del
      /// cliente, que era el mismo defecto--. Ya no hace falta el
      /// rodeo, que además costaba una vuelta al servidor y un
      /// parpadeo. `/admin/trafico` se queda para los enlaces
      /// viejos guardados.
      a: "/admin/control?pantalla=trafico",
      unidad: " %",
      /// CON SU BASE. Un «39 %» sin decir de cuántos no se puede
      /// creer ni repetir en una reunión: con 5 personas y 2
      /// inscritas también sale un 40 %. Las dos cifras ya venían en
      /// la respuesta (`inscritos` y `leads`) y no se escribían.
      que: `de quienes llegaron por «${
        ETIQUETA_ORIGEN[mejorCanal.etiqueta as Origen] ?? mejorCanal.etiqueta
      }» se inscribieron (${n(mejorCanal.inscritos)} de ${n(mejorCanal.leads)}): el canal que mejor rinde.`,
      hacer: "Es por donde conviene meter esfuerzo antes que por el que más volumen trae.",
    });

  return (
    <Bloque
      /// ESTIRADO: va en la misma fila que el embudo y las dos cajas
      /// tienen que medir lo mismo de alto. Sin esto la lista se
      /// quedaba con sus tres filas arriba y un hueco debajo.
      estirado
      titulo="Qué atender primero"
      /// DICE SU ALCANCE. «¿Esas 131 a qué hacen referencia, si
      /// abajo me encuentro con otros datos?» (cliente, 20 sep
      /// 2026): arriba se cuenta a quien ENTRÓ en el periodo
      /// elegido, y esto es una lista de pendientes de ahora mismo
      /// --cupos sin nombre, leads sin asesor-- que no depende de
      /// ese periodo. Sin decirlo, parecen la misma cifra mal
      /// calculada.
      /// Y DICE LO QUE EL ENLACE NO SE PUEDE LLEVAR. El gremio de
      /// estos filtros no viaja en la dirección —`filtros-en-la-url.ts`
      /// lo aparta a propósito—, así que al abrir la lista manda el
      /// de la sesión. Por el subdominio de un gremio da igual, que
      /// es donde se trabaja; por la puerta general, no. Callarlo
      /// daría una cifra que parece llevar a esa gente y lleva a otra.
      descripcion={`Pendientes de ahora mismo, en orden. No dependen del periodo elegido arriba.${
        cortes?.convenioId
          ? " El gremio elegido aquí no viaja al abrir la lista: allí manda el de su sesión."
          : ""
      }`}
    >
      {pendientes.length === 0 ? (
        /* El caso bueno se dice, no se deja en blanco: una
           tarjeta vacía se lee como que no cargó. */
        <p className="text-[0.84375rem] text-texto-suave">
          No queda nadie sin llamar ni sin asesor.
        </p>
      ) : (
        /* LAS FILAS SE REPARTEN EL ALTO desde 1.000 px, que es donde
           la lista va al lado del embudo: tres filas pegadas arriba y
           una caja vacía debajo se leen como una lista a la que le
           falta algo. Apilada, en el celular, cada fila mide lo que
           mide su texto. */
        <ul className="divide-y divide-hairline min-[1000px]:grid min-[1000px]:h-full min-[1000px]:auto-rows-fr">
          {pendientes.map((p) => (
            /* EN EL CELULAR, EL BOTÓN BAJA A SU RENGLÓN.
               Cifra, frase y botón en una sola línea dejaban a la frase
               unos 105 px a 390: la fila de los 23 ocupaba trece
               renglones de dos o tres palabras (medido el 21 sep 2026).
               Por debajo de 620 px la fila es una rejilla de dos
               columnas --la cifra y la frase-- y el botón va debajo de
               la frase; desde 620 vuelve a ser una sola línea. */
            <li
              key={p.accion}
              className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0 min-[620px]:flex"
            >
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
                {/* Más pequeño que la cifra: así «39 %» cabe en la
                    misma columna de 52 px que «18» y «83», y el número
                    sigue mandando. */}
                {p.unidad && <span className="text-[0.84375rem]">{p.unidad}</span>}
              </span>
              <p className="min-w-0 grow text-[0.84375rem] leading-snug">
                <span className="text-titulo">{p.que}</span>{" "}
                <span className="text-texto-suave">{p.hacer}</span>
              </p>
              <Link
                href={p.a}
                className="col-start-2 shrink-0 justify-self-start rounded-lg border border-marca/30 px-2.5 py-1 text-[0.75rem] font-semibold text-marca transition hover:bg-marca-suave"
              >
                {p.accion}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}

/**
 * Los cupos que una empresa apartó y todavía no tienen nombre.
 *
 * VA APARTE Y MÁS ABAJO, y no entre los pendientes de leads: un
 * cupo apartado no es una persona en el CRM, es un compromiso de
 * una organización. Contarlo entre los leads mezclaba dos cosas
 * que ni se cuentan igual ni las trabaja la misma persona
 * (cliente, 20 sep 2026).
 *
 * Tampoco depende del periodo de arriba: una reserva de julio
 * sigue debiendo nombres hoy.
 */
export function ReservasSinNombre({ control }: { control: Control | null }) {
  /// El gremio y la acción que tiene puestos «Proceso». Llegan por
  /// contexto porque `panel-proceso.tsx` solo le pasa `control` a
  /// esta pieza, y `control` no dice qué se filtró. Arriba de los
  /// retornos: un gancho no puede ir detrás de un `return`.
  const cortes = useContext(ContextoRecorteDeControl);
  if (!control) return null;
  const d = control;
  if (d.cuposConfirmados === 0) return null;

  /// POR CUPO Y RESERVA POR RESERVA, la cuenta del informe al que
  /// lleva «Ver reservas». Era cupos − personas (539 − 46 = 493), y
  /// el informe suma 496: hay reservas con más personas que cupos, y
  /// esas personas no llenan el cupo de otra organización. La resta
  /// queda solo para un servidor que todavía no manda las cifras.
  const conNombre = d.cuposConNombre ?? Math.min(d.inscritosConReserva, d.cuposConfirmados);
  const sinNombre = d.cuposSinNombre ?? Math.max(0, d.cuposConfirmados - d.inscritosConReserva);
  const cobertura = conNombre / d.cuposConfirmados;
  /// La que más debe sale de las MISMAS reservas (control.ts,
  /// `cuentaDeNombres`). `topEmpresas` solo miraba las diez con más
  /// inscritos y sin el gremio: sin filtro decía «Transportes El
  /// Cóndor, 28» cuando era Distribuidora El Faro, con 39.
  const empresaFloja =
    d.empresaQueMasDebe !== undefined
      ? d.empresaQueMasDebe
      : ([...d.topEmpresas]
          .map((e) => ({ razonSocial: e.razonSocial, sinNombre: e.cupos - e.inscritos }))
          .sort((a, b) => b.sinNombre - a.sinNombre)[0] ?? null);

  /// DE QUÉ GREMIO SON. El 149 de ADECOPRIA y el 539 de los dos
  /// gremios son los dos ciertos; sin decirlo, pasar del uno al otro
  /// se leía como un error de cuenta (cliente, 21 sep 2026).
  const gremios = d.gremios ?? [];
  const deQuien =
    gremios.length === 1
      ? `De ${gremios[0]}`
      : gremios.length === 2
        ? "De los dos gremios"
        : gremios.length > 2
          ? `De los ${n(gremios.length)} gremios`
          : null;

  return (
    <Bloque
      titulo={deQuien ? `Cupos apartados por empresas · ${deQuien}` : "Cupos apartados por empresas"}
      descripcion="Cupos que una organización reservó y todavía no tienen una persona detrás. No son personas del embudo y no dependen del periodo elegido arriba."
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="text-[1.375rem] leading-none font-bold text-titulo tabular-nums">
            {n(d.cuposConfirmados)}
          </p>
          <p className="mt-1 text-[0.78125rem] text-texto-suave">cupos apartados</p>
        </div>
        <div>
          <p className="text-[1.375rem] leading-none font-bold text-exito tabular-nums">
            {n(conNombre)}
          </p>
          <p className="mt-1 text-[0.78125rem] text-texto-suave">
            ya tienen nombre · {Math.round(cobertura * 100)} %
          </p>
        </div>
        <div>
          <p
            className={`text-[1.375rem] leading-none font-bold tabular-nums ${
              sinNombre > 0 ? "text-error" : "text-texto-suave"
            }`}
          >
            {n(sinNombre)}
          </p>
          <p className="mt-1 text-[0.78125rem] text-texto-suave">siguen sin nombre</p>
        </div>

        {sinNombre > 0 && (
          <p className="min-w-[260px] grow text-[0.84375rem] text-texto-suave">
            {empresaFloja
              ? `La que más debe es ${empresaFloja.razonSocial}, con ${n(
                  empresaFloja.sinNombre,
                )} pendientes.`
              : "Pida los nombres a las organizaciones que apartaron cupos."}
          </p>
        )}

        {/* AL INFORME, Y CON EL RECORTE PUESTO.

            Llevaba a `/admin/reservas`, la lista de trabajo: una
            tabla sin título donde al llegar parecía que no había
            pasado nada --«ver reservas no funciona» (cliente, 21 sep
            2026)--. Ahora abre el informe «Reservas» de Control, que
            empieza por estas mismas tres cifras.

            Con el gremio y la acción de este bloque: sus 149 cupos
            son los de ADECOPRIA cuando está filtrado, y un enlace sin
            recorte abría con los 539 de los dos gremios.

            Es la MISMA ruta en la que ya se está, y funciona porque
            Control lee `?pantalla` con `useSearchParams`, que se
            entera del cambio sin volver a montar la página (ver
            control/page.tsx). */}
        <Link
          href={enlaceAlInforme(cortes)}
          className="shrink-0 rounded-lg border border-marca/30 px-2.5 py-1 text-[0.75rem] font-semibold text-marca transition hover:bg-marca-suave"
        >
          Ver reservas
        </Link>
      </div>
    </Bloque>
  );
}
