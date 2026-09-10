"use client";

/** El embudo: en qué anda cada negocio y cuánto suma. */

/// Dos cifras arriba y nunca una sola. «Sobre la mesa» es el
/// tamaño del embudo y «esperado» es lo que un adulto cuenta con
/// cobrar; enseñar solo la primera es como los CRMs cuentan
/// historias bonitas, y enseñar solo la segunda esconde cuánto
/// trabajo hay encima.
///
/// Y una advertencia que no se quita hasta que sea mentira: las
/// probabilidades son un supuesto mientras no haya cierres propios
/// con los que recalcularlas.

import { useCallback, useEffect, useState } from "react";

import { Bloque, Cargando, Pildora, Vacio } from "@/components/admin/piezas";
import { Aviso, Tarjeta } from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
import {
  enPesos,
  haceCuanto,
  oportunidadesApi,
  type ColumnaDelEmbudo,
  type OportunidadEnTablero,
  type SinRespuesta,
  type Tablero,
  type TipoEmbudo,
} from "@/lib/oportunidades-api";

const EMBUDOS: Array<{ valor: TipoEmbudo; rotulo: string; abajo: string }> = [
  { valor: "EMPRESA", rotulo: "Empresas", abajo: "Semanas o meses" },
  { valor: "PERSONA", rotulo: "Personas", abajo: "Días" },
];

export default function PaginaEmbudo() {
  const [embudo, setEmbudo] = useState<TipoEmbudo>("EMPRESA");
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [esperando, setEsperando] = useState<SinRespuesta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (cual: TipoEmbudo) => {
    setCargando(true);
    setError(null);
    try {
      const [t, s] = await Promise.all([
        oportunidadesApi.tablero(cual),
        oportunidadesApi.sinRespuesta(),
      ]);
      setTablero(t);
      setEsperando(s);
    } catch (e) {
      setError(
        e instanceof ErrorApi
          ? e.message
          : "No pudimos traer el embudo. Vuelva a intentarlo.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(embudo);
  }, [cargar, embudo]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {EMBUDOS.map((e) => (
            <button
              key={e.valor}
              type="button"
              onClick={() => setEmbudo(e.valor)}
              aria-pressed={embudo === e.valor}
              className={`rounded-lg border px-3.5 py-2 text-left transition ${
                embudo === e.valor
                  ? "border-marca bg-marca/10"
                  : "border-borde hover:bg-current/5"
              }`}
            >
              <span className="block text-sm font-semibold">{e.rotulo}</span>
              <span className="block text-xs opacity-60">{e.abajo}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <RelojDeRespuesta esperando={esperando} />

      {cargando && !tablero ? (
        <Cargando que="Armando el embudo…" />
      ) : tablero ? (
        <>
          <Pronostico tablero={tablero} />
          <Columnas tablero={tablero} />
        </>
      ) : null}
    </div>
  );
}

/**
 * Lo único del tablero que exige una acción HOY.
 *
 * Va arriba de todo y antes que el dinero a propósito. El resto de
 * la pantalla se mira una vez al día; esto se mira ahora, porque
 * cada minuto que una fila pasa aquí vale menos que el anterior:
 * contestar dentro de los primeros cinco minutos multiplica por
 * veintiuno la probabilidad de calificar frente a media hora.
 *
 * Cuando está vacío se dice que está vacío, y se celebra. Un
 * indicador que solo aparece cuando hay problema enseña a la gente
 * a no mirar esa zona de la pantalla.
 */
function RelojDeRespuesta({ esperando }: { esperando: SinRespuesta[] }) {
  const urgentes = esperando.filter((e) => e.minutosEsperando >= 5);

  if (esperando.length === 0) {
    return (
      <div className="rounded-lg border border-borde px-4 py-3 text-sm">
        <span className="font-semibold">Nadie esperando.</span>{" "}
        <span className="opacity-70">
          Todo lo que entró ya tiene una primera respuesta.
        </span>
      </div>
    );
  }

  return (
    <Bloque
      titulo={`${esperando.length} sin primera respuesta`}
      descripcion={
        urgentes.length > 0
          ? `${urgentes.length} llevan más de cinco minutos. Ahí es donde se pierde la venta.`
          : "Todavía dentro de los cinco minutos."
      }
    >
      <ul className="flex flex-col gap-2">
        {esperando.slice(0, 8).map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borde/60 pb-2 last:border-0 last:pb-0"
          >
            <span className="min-w-0">
              <span className="font-mono text-xs opacity-60">{e.codigo}</span>{" "}
              <span className="text-sm">{e.titulo}</span>
              {e.campana && (
                <span className="ml-2 text-xs opacity-60">· {e.campana}</span>
              )}
            </span>
            <Pildora tono={e.minutosEsperando >= 5 ? "error" : "aviso"}>
              {haceCuanto(e.minutosEsperando)}
            </Pildora>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function Pronostico({ tablero }: { tablero: Tablero }) {
  const { pronostico } = tablero;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Tarjeta
        titulo="Sobre la mesa"
        descripcion={`${pronostico.cuantas} oportunidades abiertas`}
      >
        <span className="block text-2xl font-semibold tabular-nums">
          {enPesos(pronostico.total)}
        </span>
      </Tarjeta>
      <Tarjeta
        titulo="Esperado"
        descripcion="Valor por probabilidad de cada etapa"
      >
        <span className="block text-2xl font-semibold tabular-nums">
          {enPesos(pronostico.ponderado)}
        </span>
      </Tarjeta>
      <Tarjeta titulo="Las probabilidades">
        <span className="block text-sm leading-snug">
          {pronostico.probabilidadesEstimadas ? (
            <>
              Son <strong>estimadas</strong>: salen de la forma del embudo, no
              de nuestro histórico. Se recalculan con los primeros cierres
              propios.
            </>
          ) : (
            <>Calculadas con cierres propios.</>
          )}
        </span>
      </Tarjeta>
    </div>
  );
}

function Columnas({ tablero }: { tablero: Tablero }) {
  const conAlgo = tablero.columnas.some((c) => c.cuantas > 0);

  if (!conAlgo) {
    return (
      <Vacio titulo="Todavía no hay oportunidades">
        Cuando entre un lead y alguien lo tome, aparecerá aquí en «Captado».
      </Vacio>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {tablero.columnas.map((c) => (
          <Columna key={c.etapa} columna={c} />
        ))}
      </div>
    </div>
  );
}

function Columna({ columna }: { columna: ColumnaDelEmbudo }) {
  const esCierre = columna.etapa === "GANADO" || columna.etapa === "PERDIDO";

  return (
    <section className="flex w-[17rem] shrink-0 flex-col gap-2">
      <header className="rounded-lg border border-borde px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{columna.rotulo}</h3>
          <span className="text-xs opacity-60 tabular-nums">
            {esCierre ? "" : `${columna.probabilidad} %`}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs opacity-60">
            {columna.cuantas === 1 ? "1 negocio" : `${columna.cuantas} negocios`}
          </span>
          <span className="text-xs font-medium tabular-nums">
            {enPesos(columna.total)}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {columna.oportunidades.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borde px-3 py-4 text-center text-xs opacity-50">
            Vacía
          </p>
        ) : (
          columna.oportunidades.map((o) => <Ficha key={o.id} o={o} />)
        )}
      </div>
    </section>
  );
}

function Ficha({ o }: { o: OportunidadEnTablero }) {
  /// Los días quieta se calculan aquí y no en el servidor porque
  /// dependen de cuándo se MIRA la pantalla, no de cuándo se pidió
  /// el dato. Con el tablero abierto media hora, un cálculo del
  /// servidor se queda viejo sin avisar.
  const diasQuieta = Math.floor(
    (Date.now() - new Date(o.ultimoToqueEn).getTime()) / 86_400_000,
  );

  return (
    <article className="flex flex-col gap-1.5 rounded-lg border border-borde px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.7rem] opacity-50">{o.codigo}</span>
        {diasQuieta >= 7 && <Pildora tono="aviso">{diasQuieta} d quieta</Pildora>}
      </div>

      <p className="text-sm font-medium leading-snug">{o.titulo}</p>

      {o.deQuien && <p className="text-xs opacity-70">{o.deQuien}</p>}

      <div className="flex items-baseline justify-between gap-2 pt-0.5">
        <span className="text-sm font-semibold tabular-nums">
          {enPesos(o.valor)}
        </span>
        <span className="text-xs opacity-60">
          {o.asesor?.nombre ?? "Sin dueño"}
        </span>
      </div>

      {o.campana && (
        <span className="text-[0.7rem] opacity-55">Campaña: {o.campana}</span>
      )}
    </article>
  );
}
