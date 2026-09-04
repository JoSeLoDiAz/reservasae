"use client";

import { useCallback, useEffect, useState } from "react";

import { n } from "@/components/admin/graficos";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { ComiteMarketing } from "@/components/admin/comite-marketing";
import { Desplegable } from "@/components/admin/desplegable";
import { PanelProceso } from "@/components/admin/panel-proceso";
import {
  crmApi,
  ETIQUETA_RANGO,
  type Control,
  type Filtros,
  type Rango,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/**
 * Los dos del periodo, marcados.
 *
 * Mandan sobre la pantalla entera —y sobre los otros cinco
 * filtros, que recortan DENTRO del periodo elegido—, y con los
 * siete pintados igual no habia forma de saberlo. Fondo y borde
 * de marca, y el texto en negrita: se leen antes que los demas
 * sin sacarlos de la fila.
 */
const CLASE_PERIODO =
  CLASE_CONTROL.replace("border-campo-borde", "border-marca/45")
    .replace("bg-campo-fondo", "bg-marca-suave")
    .replace("text-texto", "font-semibold text-marca");

/** Los periodos que se ofrecen, en su orden. */
const RANGOS: Rango[] = [
  "HOY",
  "AYER",
  "SEMANA",
  "MES",
  "MES_PASADO",
  "TRIMESTRE",
  "ANO",
  "TODO",
  "PERSONALIZADO",
];


/**
 * Cuántos días abarca un periodo, con el criterio de
 * `ventana.ts`. Null es «no recorta»: TODO, y también un
 * PERSONALIZADO a medias, que el backend trata como TODO.
 *
 * Hace falta aquí porque la respuesta solo trae las fechas
 * del periodo elegido, no las del comparado, y sin las dos
 * duraciones no hay forma de avisar de que no coinciden.
 */
function diasDeRango(rango: Rango, desde: string, hasta: string): number | null {
  const hoy = new Date();
  const [y, m, dia] = [hoy.getFullYear(), hoy.getMonth(), hoy.getDate()];

  switch (rango) {
    case "HOY":
    case "AYER":
      return 1;
    case "SEMANA":
      return 7;
    case "MES":
      return 30;
    case "TRIMESTRE":
      return 90;
    case "MES_PASADO":
      // dia 0: el ultimo del mes pasado
      return new Date(y, m, 0).getDate();
    case "ANO":
      return Math.round((Date.UTC(y, m, dia + 1) - Date.UTC(y - 1, m, dia + 1)) / 86_400_000);
    case "PERSONALIZADO": {
      if (!desde || !hasta) return null;
      const a = Date.parse(`${desde}T00:00:00Z`);
      const b = Date.parse(`${hasta}T00:00:00Z`);
      if (Number.isNaN(a) || Number.isNaN(b) || a > b) return null;
      // el «hasta» va incluido
      return Math.round((b - a) / 86_400_000) + 1;
    }
    default:
      return null;
  }
}

function textoDuracion(dias: number | null): string {
  if (dias === null) return "todo el histórico";
  return `${n(dias)} ${dias === 1 ? "día" : "días"}`;
}

/// Las dos pestañas. Antes eran dos entradas del menú que
/// contaban lo mismo por caminos distintos.
const PESTANAS = [
  { clave: "metas", etiqueta: "Proceso" },
  { clave: "comite", etiqueta: "Comité Marketing" },
] as const;

type Pestana = (typeof PESTANAS)[number]["clave"];

export default function PaginaControl() {
  /// Se recuerda cuál miraba: quien vive en una de las dos no
  /// tiene por qué volver a elegirla en cada visita.
  const [pestana, setPestana] = useState<Pestana>("metas");

  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem("control:pestana");
      if (guardada === "metas" || guardada === "comite") setPestana(guardada);
    } catch {
      // navegador sin almacenamiento: se queda con la de por defecto
    }
  }, []);

  function cambiar(a: Pestana) {
    setPestana(a);
    try {
      window.localStorage.setItem("control:pestana", a);
    } catch {
      // no poder recordarlo no es motivo para no cambiar
    }
  }

  const [rango, setRango] = useState<Rango>("TODO");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  // AUTO: el previo de siempre
  const [contra, setContra] = useState<Rango | "AUTO">("AUTO");
  const [contraDesde, setContraDesde] = useState("");
  const [contraHasta, setContraHasta] = useState("");

  const eligio = contra !== "AUTO";

  /**
   * Los cortes que elige el panel de arriba, para que ESTA
   * mitad de la pantalla corte igual.
   *
   * El periodo lo manda la cabecera y los cortes el panel, pero
   * las dos consultas los llevan: si solo cortase una, el
   * embudo diría «BRITCHAM» y el ritmo seguiría contando los
   * dos gremios en la misma pantalla.
   */
  const [cortes, setCortes] = useState<Filtros>({});

  /// La clave del refresco lleva los cortes: sin ellos, cambiar
  /// de gremio no volvía a pedir nada y se quedaba lo anterior.
  const claveCortes = [
    cortes.convenioId,
    cortes.accionFormacionId,
    cortes.asesorId,
    cortes.departamentoSepId,
  ].join("|");

  const vivos = useDatosVivos<Control>(
    useCallback(
      () =>
        crmApi.control({
          rango,
          desde: desde || undefined,
          hasta: hasta || undefined,
          contra: contra === "AUTO" ? undefined : contra,
          contraDesde: contra === "AUTO" ? undefined : contraDesde || undefined,
          contraHasta: contra === "AUTO" ? undefined : contraHasta || undefined,
          convenioId: cortes.convenioId,
          accionFormacionId: cortes.accionFormacionId,
          asesorId: cortes.asesorId,
          departamentoSepId: cortes.departamentoSepId,
        }),
      [rango, desde, hasta, contra, contraDesde, contraHasta, cortes],
    ),
    {
      clave: `${rango}|${desde}|${hasta}|${contra}|${contraDesde}|${contraHasta}|${claveCortes}`,
    },
  );

  const diasA = diasDeRango(rango, desde, hasta);
  const diasB = eligio ? diasDeRango(contra, contraDesde, contraHasta) : diasA;
  // tambien en automatico: mes pasado
  const duracionDistinta =
    (eligio && diasA !== diasB) ||
    (!eligio &&
      (vivos.datos?.ventana.etiquetaAnterior ?? '').includes('días contra'));

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            Control de Inscritos
          </h1>
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            Todo el proceso de inscripción, de interesado a inscrito — dónde
            avanza y dónde se cae.
          </p>
        </div>
        {/* LA COMPARACIÓN, AL FRENTE DEL TÍTULO.

            Bajó un tiempo a la tarjeta de filtros y no es su
            sitio: los cinco filtros recortan QUÉ se mira --y se
            cambian a menudo--, mientras que el periodo y su
            comparación enmarcan la pantalla ENTERA, incluida la
            pestaña del comité. Enmarcar es cosa de la cabecera.

            El indicador va con ellos, y solo en «Proceso»: en la
            otra pestaña diría una hora que no le corresponde. */}
        {pestana === "metas" && (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-1.5 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-texto-suave">
                Comparación
              </p>
              {/* Anchos de verdad: son dos frases --«Desde el
                  principio», «vs. el mes pasado»--, no dos
                  palabras, y apretados se leen cortados. */}
              <div className="flex flex-wrap items-center gap-2 [&>*]:min-w-[11.5rem]">
                <ControlesDePeriodo
                  rango={rango}
                  alCambiarRango={setRango}
                  desde={desde}
                  alCambiarDesde={setDesde}
                  hasta={hasta}
                  alCambiarHasta={setHasta}
                  contra={contra}
                  alCambiarContra={setContra}
                  contraDesde={contraDesde}
                  alCambiarContraDesde={setContraDesde}
                  contraHasta={contraHasta}
                  alCambiarContraHasta={setContraHasta}
                />
              </div>
            </div>

            <IndicadorActualizacion
              actualizadoEn={vivos.actualizadoEn}
              refrescando={vivos.refrescando}
              desactualizado={vivos.desactualizado}
              alRefrescar={vivos.refrescar}
            />
          </div>
        )}
      </header>

      <div
        role="tablist"
        aria-label="Qué mirar"
        className="flex gap-1 self-start rounded-lg border border-borde bg-superficie p-1"
      >
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            role="tab"
            aria-selected={pestana === p.clave}
            onClick={() => cambiar(p.clave)}
            className={`sin-aro rounded-md px-4 py-1.5 text-[0.78125rem] font-semibold transition ${
              pestana === p.clave
                ? "bg-marca-suave text-marca"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === "comite" && <ComiteMarketing />}

      {pestana === "metas" && (
        <>
      {/* El aviso no cabe arriba con los filtros: es prosa, y solo
          aparece cuando los dos periodos no duran lo mismo. */}
      {duracionDistinta && (
        <p className="rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
          <strong className="font-semibold">Los dos periodos no duran lo mismo:</strong>{" "}
          {ETIQUETA_RANGO[rango].toLowerCase()} abarca {textoDuracion(diasA)} y{" "}
          {ETIQUETA_RANGO[contra as Rango].toLowerCase()} abarca {textoDuracion(diasB)}.
          Comparar volumen entre ventanas de distinta duración no significa nada —la más
          larga gana siempre—; la media de días de lead a inscrito sí se puede leer.
        </p>
      )}

      {/* La pantalla entera. Antes esto era `PanelMetas` plegado
          al pie más un `Cuerpo` de siete tarjetas y cuatro
          bloques anidados, y los dos contaban lo mismo por
          caminos distintos: «en qué punto está cada quien» salía
          dos veces, «de dónde vienen» otras dos y el ritmo, tres.

          El periodo se le pasa como `periodo` y el dato de esa
          consulta como `control`: los filtros mandan sobre toda
          la pantalla y tienen que verse en una sola fila. */}
      <PanelProceso alCambiarFiltros={setCortes} control={vivos.datos} />

      {/* El error del periodo se queda: `PanelProceso` avisa de
          los suyos, pero esta consulta es de la pagina y si se
          cae en silencio el ritmo y el desglose salen vacios sin
          decir por que. */}
      {vivos.error && <Aviso tipo="error">{vivos.error}</Aviso>}
        </>
      )}
    </div>
  );
}

/**
 * Los dos desplegables del periodo, para la cabecera.
 *
 * Vivían en una franja propia debajo de las pestañas, con borde y fondo,
 * ocupando el ancho entero para dos selects. Aquí arriba pesan lo que
 * tienen que pesar: son el filtro de la pantalla, no un bloque más.
 */
/**
 * Los dos selectores de periodo, SUELTOS.
 *
 * Devuelve un fragmento y no un `div`: van dentro de la misma
 * rejilla que los otros cinco filtros, en una sola fila con
 * ellos. Envueltos en su propio contenedor formaban una segunda
 * linea, y separados parecian mandar sobre cosas distintas
 * cuando mandan sobre la misma pantalla.
 */
function ControlesDePeriodo({
  rango,
  alCambiarRango,
  desde,
  alCambiarDesde,
  hasta,
  alCambiarHasta,
  contra,
  alCambiarContra,
  contraDesde,
  alCambiarContraDesde,
  contraHasta,
  alCambiarContraHasta,
}: {
  rango: Rango;
  alCambiarRango: (r: Rango) => void;
  desde: string;
  alCambiarDesde: (v: string) => void;
  hasta: string;
  alCambiarHasta: (v: string) => void;
  contra: Rango | "AUTO";
  alCambiarContra: (r: Rango | "AUTO") => void;
  contraDesde: string;
  alCambiarContraDesde: (v: string) => void;
  contraHasta: string;
  alCambiarContraHasta: (v: string) => void;
}) {
  return (
    <>
      {/* `Desplegable` y no `<select>`: la lista de un select
          la dibuja el sistema operativo, con su cuadro cuadrado
          y su azul, y al lado de los cinco filtros --que sí se
          abren con los colores del panel-- se veía de otra
          aplicación. */}
      <Desplegable
        alto={34}
        etiquetaAria="Periodo"
        valor={rango}
        opciones={RANGOS.map((r) => ({ valor: r, etiqueta: ETIQUETA_RANGO[r] }))}
        alElegir={(v) => alCambiarRango(v as Rango)}
      />

      {rango === "PERSONALIZADO" && (
        <>
          <input
            type="date"
            className={`${CLASE_PERIODO} w-full`}
            value={desde}
            max={hasta || undefined}
            onChange={(e) => alCambiarDesde(e.target.value)}
            aria-label="Desde"
            title="Desde"
          />
          <input
            type="date"
            className={`${CLASE_PERIODO} w-full`}
            value={hasta}
            min={desde || undefined}
            onChange={(e) => alCambiarHasta(e.target.value)}
            aria-label="Hasta"
            title="Hasta"
          />
        </>
      )}

      {/* El «vs.» va en el texto de cada opción y no en un
          rótulo aparte: el grupo ya se llama «Comparación», pero
          la opción tiene que seguir diciendo que lo es cuando se
          lee cerrada. */}
      <Desplegable
        alto={34}
        etiquetaAria="Comparar con"
        valor={contra}
        opciones={[
          { valor: "AUTO", etiqueta: "vs. anterior" },
          ...RANGOS.map((r) => ({
            valor: r,
            etiqueta: `vs. ${ETIQUETA_RANGO[r].toLowerCase()}`,
          })),
        ]}
        alElegir={(v) => alCambiarContra(v as Rango | "AUTO")}
      />

      {contra === "PERSONALIZADO" && (
        <>
          <input
            type="date"
            className={`${CLASE_PERIODO} w-full`}
            value={contraDesde}
            max={contraHasta || undefined}
            onChange={(e) => alCambiarContraDesde(e.target.value)}
            aria-label="Comparar desde"
            title="Comparar desde"
          />
          <input
            type="date"
            className={`${CLASE_PERIODO} w-full`}
            value={contraHasta}
            min={contraDesde || undefined}
            onChange={(e) => alCambiarContraHasta(e.target.value)}
            aria-label="Comparar hasta"
            title="Comparar hasta"
          />
        </>
      )}
    </>
  );
}
