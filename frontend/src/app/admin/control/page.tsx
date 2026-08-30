"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { estiloEtapa } from "@/components/admin/etapa";
import {
  BarraAvance,
  BarrasApiladas,
  Donut,
  DosSeriesPorDia,
  ListaBarras,
  n,
  SERIE,
  TarjetaCifra,
  Tasa,
  Termometro,
  type Tono,
} from "@/components/admin/graficos";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, useAdmin } from "@/components/admin/marco-admin";
import { PanelMetas } from "@/components/admin/panel-metas";
import { TableroPorAccion } from "@/components/admin/tablero-por-accion";
import {
  Bloque, Esqueleto } from "@/components/admin/piezas";
import {
  crmApi,
  ETIQUETA_ETAPA,
  ETIQUETA_ORIGEN,
  ETIQUETA_RANGO,
  type Control,
  type Etapa,
  type Origen,
  type Rango,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/** Las cuatro del embudo más su salida, en orden. */
const EMBUDO: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "DATOS_COMPLETOS",
  "INSCRITO",
  "PERDIDO",
];

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

/** Los cuatro tramos de espera que manda el backend. */
const TRAMOS_ESPERA: Array<{ dias: number; etiqueta: string; tono: Tono }> = [
  { dias: 0, etiqueta: "0 a 2 días", tono: "bueno" },
  { dias: 3, etiqueta: "3 a 7 días", tono: "normal" },
  { dias: 8, etiqueta: "8 a 14 días", tono: "aviso" },
  { dias: 15, etiqueta: "15 días o más", tono: "malo" },
];

function porcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 100)} %`;
}

function fechaCorta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
  { clave: "metas", etiqueta: "Metas y avance" },
  { clave: "analisis", etiqueta: "Análisis a fondo" },
] as const;

type Pestana = (typeof PESTANAS)[number]["clave"];

export default function PaginaControl() {
  const { admin } = useAdmin();
  /// Se recuerda cuál miraba: quien vive en una de las dos no
  /// tiene por qué volver a elegirla en cada visita.
  const [pestana, setPestana] = useState<Pestana>("metas");

  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem("control:pestana");
      if (guardada === "metas" || guardada === "analisis") setPestana(guardada);
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
        }),
      [rango, desde, hasta, contra, contraDesde, contraHasta],
    ),
    { clave: `${rango}|${desde}|${hasta}|${contra}|${contraDesde}|${contraHasta}` },
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
            Cómo va la inscripción contra la meta, y de dónde viene cada lead.
          </p>
        </div>
        {/* solo en Análisis: es de esos datos, y en la otra
            pestaña diría una hora que no le corresponde */}
        {pestana === "analisis" && (
          <IndicadorActualizacion
            actualizadoEn={vivos.actualizadoEn}
            refrescando={vivos.refrescando}
            desactualizado={vivos.desactualizado}
            alRefrescar={vivos.refrescar}
          />
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

      {pestana === "metas" && <PanelMetas />}

      {pestana === "analisis" && (
        <>
      <div className="rounded-lg border border-borde bg-superficie px-7 py-5">
        <div className="grid lg:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium">Periodo</p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className={`${CLASE_CONTROL} max-w-[14rem]`}
                value={rango}
                onChange={(e) => setRango(e.target.value as Rango)}
                aria-label="Periodo"
              >
                {RANGOS.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_RANGO[r]}
                  </option>
                ))}
              </select>

              {rango === "PERSONALIZADO" && (
                <>
                  <input
                    type="date"
                    className={`${CLASE_CONTROL} max-w-[11rem]`}
                    value={desde}
                    max={hasta || undefined}
                    onChange={(e) => setDesde(e.target.value)}
                    aria-label="Desde"
                  />
                  <span className="text-sm text-texto-suave">y</span>
                  <input
                    type="date"
                    className={`${CLASE_CONTROL} max-w-[11rem]`}
                    value={hasta}
                    min={desde || undefined}
                    onChange={(e) => setHasta(e.target.value)}
                    aria-label="Hasta"
                  />
                </>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Comparar con</p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className={`${CLASE_CONTROL} max-w-[14rem]`}
                value={contra}
                onChange={(e) => setContra(e.target.value as Rango | "AUTO")}
                aria-label="Comparar con"
              >
                <option value="AUTO">El periodo anterior</option>
                {RANGOS.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_RANGO[r]}
                  </option>
                ))}
              </select>

              {contra === "PERSONALIZADO" && (
                <>
                  <input
                    type="date"
                    className={`${CLASE_CONTROL} max-w-[11rem]`}
                    value={contraDesde}
                    max={contraHasta || undefined}
                    onChange={(e) => setContraDesde(e.target.value)}
                    aria-label="Comparar desde"
                  />
                  <span className="text-sm text-texto-suave">y</span>
                  <input
                    type="date"
                    className={`${CLASE_CONTROL} max-w-[11rem]`}
                    value={contraHasta}
                    min={contraDesde || undefined}
                    onChange={(e) => setContraHasta(e.target.value)}
                    aria-label="Comparar hasta"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {duracionDistinta && (
          <p className="mt-4 rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
            <strong className="font-semibold">Los dos periodos no duran lo mismo:</strong>{" "}
            {ETIQUETA_RANGO[rango].toLowerCase()} abarca {textoDuracion(diasA)} y{" "}
            {ETIQUETA_RANGO[contra as Rango].toLowerCase()} abarca {textoDuracion(diasB)}.
            Comparar volumen entre ventanas de distinta duración no significa nada —la más
            larga gana siempre—; la media de días de lead a inscrito sí se puede leer.
          </p>
        )}

        <p className="mt-3 text-xs text-texto-suave">
          El periodo acota los inscritos, el ritmo y las series por día. Todo lo demás muestra la situación de hoy.</p>
      </div>

      {vivos.error ? (
        <Aviso tipo="error">{vivos.error}</Aviso>
      ) : !vivos.datos ? (
        <Esqueleto conCifras />
      ) : (
        <Cuerpo d={vivos.datos} adminId={admin.id} eligio={eligio} />
      )}
        </>
      )}
    </div>
  );
}

/** Las cifras y las gráficas del periodo elegido. */
function Cuerpo({ d, adminId, eligio }: { d: Control; adminId: string; eligio: boolean }) {
  const hayVentana = d.ventana.desde !== null && d.ventana.hasta !== null;
  const corte =
    d.ventana.desde && d.ventana.hasta
      ? `${fechaCorta(d.ventana.desde)} – ${fechaCorta(d.ventana.hasta)}`
      : "desde el principio";
  // sin ventana, 60 dias de serie
  const alcanceSerie = hayVentana ? "en el periodo" : "en los últimos 60 días";

  /**
   * El rótulo de las variaciones nombra los DOS periodos
   * cuando la comparación se eligió a mano: «el periodo
   * anterior» ahí sería mentira, porque el segundo puede ser
   * cualquiera y durar otra cosa.
   */
  const contra = !d.anterior
    ? null
    : eligio
      ? `${d.ventana.etiquetaAnterior} · periodo ${d.ventana.etiqueta.toLowerCase()}`
      : d.ventana.etiquetaAnterior;

  // los tramos vacios, en cero
  const espera = new Map(d.sinContactar.map((t) => [t.dias, t.total]));
  const tramos = TRAMOS_ESPERA.map((t) => ({
    etiqueta: t.etiqueta,
    total: espera.get(t.dias) ?? 0,
    tono: t.tono,
  }));
  const esperando = tramos.reduce((s, t) => s + t.total, 0);
  const frios = (espera.get(8) ?? 0) + (espera.get(15) ?? 0);

  // cuantos quedan en cada peldano
  const enEtapa = new Map(d.embudo.map((e) => [e.etapa, e.total]));
  const escalones = EMBUDO.map((e) => ({ etapa: e, total: enEtapa.get(e) ?? 0 }));
  const cima = Math.max(1, ...escalones.map((e) => e.total));
  const enPeldanos = escalones.reduce((s, e) => s + e.total, 0);
  const yaInscritos = enEtapa.get("INSCRITO") ?? 0;

  // los inscritos, sin periodo
  const inscritosSiempre = d.inscritosConReserva + d.inscritosPorSuCuenta;
  const leadsDelPeriodo = d.leadsPorDia.reduce((s, p) => s + p.total, 0);

  // de toda lead a inscrito
  const leads = d.conversionPorOrigen.reduce((s, o) => s + o.leads, 0);
  const convertidas = d.conversionPorOrigen.reduce((s, o) => s + o.inscritos, 0);
  const cobertura = d.cuposConfirmados > 0 ? d.inscritosConReserva / d.cuposConfirmados : 0;

  // por conversion, sin dueno abajo
  const asesores = [...d.porAsesor].sort((a, b) => {
    const sinA = a.asesorId === null;
    const sinB = b.asesorId === null;
    if (sinA !== sinB) return sinA ? 1 : -1;
    return b.conversion - a.conversion;
  });
  const mio = d.porAsesor.find((a) => a.asesorId === adminId) ?? null;
  const leadsRepartidos = d.porAsesor.reduce((s, a) => s + a.asignados, 0);

  const conOrigen = d.porOrigen.reduce((s, o) => s + o.total, 0);
  const conModalidad = d.porModalidad.reduce((s, m) => s + m.total, 0);

  // lo que hay que hacer, sacado de las mismas cifras
  const sinNombre = Math.max(0, d.cuposConfirmados - d.inscritosConReserva);
  const mejorCanal = [...d.conversionPorOrigen]
    .filter((o) => o.leads >= 5)
    .sort((a, b) => b.conversion - a.conversion)[0];
  const empresaFloja = [...d.topEmpresas].sort(
    (a, b) => b.cupos - b.inscritos - (a.cupos - a.inscritos),
  )[0];

  const prioridades: Array<{ tono: Tono; que: string; hacer: string }> = [];
  if (sinNombre > 0)
    prioridades.push({
      tono: cobertura >= 0.8 ? "bueno" : cobertura >= 0.4 ? "normal" : "aviso",
      que: `${n(sinNombre)} de los ${n(d.cuposConfirmados)} cupos apartados no tienen todavía un nombre detrás.`,
      hacer: empresaFloja
        ? `La que más debe es ${empresaFloja.razonSocial}, con ${n(empresaFloja.cupos - empresaFloja.inscritos)} pendientes. Pídale los nombres.`
        : "Pida los nombres a las organizaciones que apartaron cupos.",
    });
  if (frios > 0)
    prioridades.push({
      tono: "aviso",
      que: `${n(frios)} de los ${n(esperando)} leads que esperan una primera llamada llevan más de una semana.`,
      hacer: "Llámelos hoy: cuanto más se enfría un lead, menos se inscribe.",
    });
  if (d.sinAsignar > 0)
    prioridades.push({
      tono: "normal",
      que: `${n(d.sinAsignar)} leads no tienen asesor asignado.`,
      hacer: "Repártalos, porque hoy no los está llamando nadie.",
    });
  if (mejorCanal)
    prioridades.push({
      tono: "bueno",
      que: `El canal que mejor rinde es «${ETIQUETA_ORIGEN[mejorCanal.etiqueta as Origen] ?? mejorCanal.etiqueta}»: inscribe a ${porcentaje(mejorCanal.conversion)} de los que trae.`,
      hacer: "Es por donde conviene meter esfuerzo antes que por el que más volumen trae.",
    });

  return (
    <div className="flex flex-col gap-3">
      {/* las cifras de cabecera */}
      <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaCifra
          titulo="Llegaron a inscrito"
          valor={d.total}
          detalle={`${corte} · se matricularon en el corte, aunque hoy ya cursen`}
          chispa={d.serie.length > 1 ? d.serie.map((p) => p.total) : undefined}
          delta={{ valor: d.variacion.total, contra }}
        />
        <TarjetaCifra
          titulo="Leads que llegaron"
          valor={leadsDelPeriodo}
          detalle={`leads nuevos ${alcanceSerie}, en cualquier etapa`}
          chispa={d.leadsPorDia.length > 1 ? d.leadsPorDia.map((p) => p.total) : undefined}
        />
        <TarjetaCifra
          titulo="Cupos confirmados"
          valor={d.cuposConfirmados}
          detalle="el techo de la captura · sale de reservas, así que no lleva periodo"
        />
        <TarjetaCifra
          titulo="De lead a inscrito"
          valor={d.diasHastaInscribir === null ? "—" : Math.round(d.diasHastaInscribir)}
          sufijo={d.diasHastaInscribir === null ? undefined : "días"}
          detalle="promedio de los inscritos del periodo"
          delta={{ valor: d.variacion.diasHastaInscribir, contra, invertido: true }}
        />
      </section>

      {/* lo que hay que hacer, antes que cómo se calcula */}
      {prioridades.length > 0 && (
        <Bloque
          titulo="Qué atender primero"
          descripcion="Lo que estas cifras piden hacer hoy, en orden."
        >
          <ul className="space-y-2.5">
            {prioridades.map((p) => (
              <li key={p.que} className="flex gap-2.5">
                <span
                  className={`mt-[6px] size-2 shrink-0 rounded-full ${
                    p.tono === "aviso"
                      ? "bg-error"
                      : p.tono === "bueno"
                        ? "bg-exito"
                        : "bg-aviso"
                  }`}
                />
                <p className="text-[0.8125rem] leading-snug">
                  <span className="font-medium text-titulo">{p.que}</span>{" "}
                  <span className="text-texto-suave">{p.hacer}</span>
                </p>
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      {/* la cola de trabajo: un solo bloque, no dos */}
      <Bloque
        titulo="Cola de trabajo"
        descripcion="Leads que todavía esperan gestión: los que no tienen asesor asignado y los que, teniéndolo, aún no han recibido una primera llamada. No depende del periodo seleccionado."
        acciones={
          <Link
            href="/admin/participantes"
            className="text-[0.78125rem] font-medium text-marca"
          >
            Ir al tablero de inscripciones
          </Link>
        }
      >
        {/* una cifra no necesita un bloque entero */}
        <div className="mb-4 flex flex-wrap items-stretch gap-2.5">
          <div className="rounded-lg border border-borde bg-superficie px-3.5 py-2">
            <div className="text-[0.6875rem] leading-none text-texto-suave">
              Sin asesor asignado
            </div>
            <div
              className={`mt-1 text-[1.0625rem] leading-none font-bold tabular-nums ${
                d.sinAsignar > 0 ? "text-aviso" : "text-exito"
              }`}
            >
              {n(d.sinAsignar)}
            </div>
            <div className="mt-1 text-[0.6875rem] leading-none text-texto-suave">
              {d.sinAsignar > 0 ? "repartir es el primer paso" : "todos tienen responsable"}
            </div>
          </div>
          <div className="rounded-lg border border-borde bg-superficie px-3.5 py-2">
            <div className="text-[0.6875rem] leading-none text-texto-suave">
              Esperando primera llamada
            </div>
            <div className="mt-1 text-[1.0625rem] leading-none font-bold text-titulo tabular-nums">
              {n(esperando)}
            </div>
            <div className="mt-1 text-[0.6875rem] leading-none text-texto-suave">
              {esperando > 0
                ? `${n(frios)} llevan más de una semana · ${porcentaje(frios / esperando)}`
                : "nadie pendiente de contacto"}
            </div>
          </div>
        </div>
        <Termometro tramos={tramos} vacio="No hay nadie esperando a que lo llamen." />
      </Bloque>

      <TableroPorAccion />


      {/* las tasas */}
      <Bloque
        titulo="Cómo va contra lo comprometido"
        descripcion="La situación de hoy, no la del periodo."
      >
        <div className="grid sm:grid-cols-3">
          <Tasa
            titulo="Cobertura de los cupos"
            parte={d.inscritosConReserva}
            total={d.cuposConfirmados}
            tono={
              d.cuposConfirmados === 0
                ? "normal"
                : cobertura >= 0.8
                  ? "bueno"
                  : cobertura >= 0.4
                    ? "normal"
                    : "aviso"
            }
            detalle={
              d.cuposConfirmados > d.inscritosConReserva
                ? `${n(d.cuposConfirmados - d.inscritosConReserva)} cupos sin nombre detrás`
                : "los cupos están cubiertos"
            }
          />
          <Tasa
            titulo="Conversión global"
            parte={convertidas}
            total={leads}
            detalle="leads que llegaron a inscrito"
          />
          <Tasa
            titulo="Sin cupo de una empresa"
            parte={d.inscritosPorSuCuenta}
            total={inscritosSiempre}
            detalle="el resto ocupa un cupo que apartó una organización"
          />
        </div>

      </Bloque>

      {/* el embudo y el ritmo */}
      <section className="grid lg:grid-cols-3">
        <Bloque
          estirado
          titulo="En qué punto está cada quien"
          descripcion="Dónde está hoy cada persona que llegó en el periodo. Cada una cuenta en un solo peldaño."
        >
          <ul className="space-y-3">
            {escalones.map((e) => (
              <li key={e.etapa} style={estiloEtapa(e.etapa)}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="punto-etapa" aria-hidden />
                    {ETIQUETA_ETAPA[e.etapa]}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {n(e.total)}
                    <span className="ml-2 text-xs font-normal text-texto-suave">
                      {enPeldanos > 0 ? porcentaje(e.total / enPeldanos) : "0 %"}
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-superficie-alterna">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(e.total / cima) * 100}%`,
                      background: "var(--etapa)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-borde pt-3 text-xs text-texto-suave">
            {n(enPeldanos)} leads llegaron en el corte y siguen en estos cinco peldaños ·{" "}
            <strong className="font-medium tabular-nums">
              {enPeldanos > 0 ? porcentaje(yaInscritos / enPeldanos) : "0 %"}
            </strong>{" "}
            está hoy en «Inscrito». Quien ya pasó al aula no aparece aquí: estos cinco
            peldaños no son todo el recorrido.
          </p>
        </Bloque>

        <div className="lg:col-span-2">
          <Bloque
          estirado
            titulo="Ritmo: llegada contra inscripción"
            descripcion={`Los leads por el día en que llegaron y los inscritos por el día en que lo fueron, ${alcanceSerie}. Es la gráfica que separa las dos preguntas: si entran leads y no salen inscripciones, el problema está en el seguimiento y no en la pauta.`}
          >
            <DosSeriesPorDia
              a={{ nombre: "Leads que llegaron", datos: d.leadsPorDia, color: SERIE.uno }}
              b={{ nombre: "Llegaron a inscrito", datos: d.serie, color: SERIE.dos }}
              vacio="Todavía no hay movimiento que mostrar."
            />
          </Bloque>
        </div>
      </section>

      {/* el origen: volumen y calidad */}
      <section className="grid lg:grid-cols-2">
        <Bloque
          titulo="Qué canal trae más"
          descripcion="Por dónde entraron los inscritos del periodo."
        >
          <Donut
            datos={d.porOrigen.map((o) => ({
              etiqueta: ETIQUETA_ORIGEN[o.etiqueta as Origen] ?? o.etiqueta,
              valor: o.total,
            }))}
            centro={n(conOrigen)}
            detalleCentro="inscritos"
            vacio="Todavía no hay inscritos en el periodo."
          />
        </Bloque>

        <Bloque
          titulo="Qué canal inscribe más"
          descripcion="De cada canal, cuántos acaba inscribiendo. Traer mucho no es traer bueno."
        >
          <BarrasApiladas
            filas={d.conversionPorOrigen.map((o) => ({
              etiqueta: ETIQUETA_ORIGEN[o.etiqueta as Origen] ?? o.etiqueta,
              valores: [o.inscritos, Math.max(o.leads - o.inscritos, 0)],
              detalle: `${porcentaje(o.conversion)} convierte`,
            }))}
            series={[
              { nombre: "Llegaron a inscrito", color: SERIE.uno },
              { nombre: "Todavía no", color: SERIE.dos },
            ]}
            vacio="Todavía no hay leads."
          />
        </Bloque>
      </section>

      {/* los asesores */}
      <Bloque
        titulo="Por asesor"
        descripcion="Cuántos inscribe cada asesor de los leads que ha llevado. Ordenado por eso, no por la actividad de un día."
      >
        {mio && (
          <p className="mb-4 rounded-xl bg-marca-suave px-3 py-2 text-sm">
            <strong className="font-semibold">Tuyos:</strong>{" "}
            <span className="tabular-nums">{n(mio.asignados)}</span> de{" "}
            <span className="tabular-nums">{n(leadsRepartidos)}</span> leads ·{" "}
            <span className="tabular-nums">{n(mio.total)}</span> de{" "}
            <span className="tabular-nums">{n(d.total)}</span> inscritos del periodo · tu
            conversión histórica es del{" "}
            <strong className="tabular-nums">{porcentaje(mio.conversion)}</strong>.
          </p>
        )}

        {asesores.length === 0 ? (
          <p className="py-6 text-center text-sm text-texto-suave">
            Nadie tiene asesor asignado.
          </p>
        ) : (
          <div className="caja-scroll overflow-x-auto">
            <table className="tabla-datos text-sm">
              <thead>
                <tr>
                  <th>Asesor</th>
                  <th>Leads</th>
                  <th>Inscritos siempre</th>
                  <th>Conversión</th>
                  <th>En el periodo</th>
                </tr>
              </thead>
              <tbody>
                {asesores.map((a) => {
                  const suyo = a.asesorId !== null && a.asesorId === adminId;
                  return (
                    <tr
                      key={a.asesorId ?? "sin-asignar"}
                      // gana al sombreado de fila alterna
                      style={suyo ? { background: "var(--marca-suave)" } : undefined}
                    >
                      <td className="max-w-[16rem] truncate" title={a.etiqueta}>
                        {a.etiqueta}
                        {suyo && <span className="text-texto-suave"> · tú</span>}
                      </td>
                      <td className="tabular-nums">{n(a.asignados)}</td>
                      <td className="tabular-nums">{n(a.inscritosSiempre)}</td>
                      <td className="min-w-[9rem]">
                        <span className="font-semibold tabular-nums">
                          {porcentaje(a.conversion)}
                        </span>
                        <span className="mt-1 block">
                          <BarraAvance valor={a.inscritosSiempre} maximo={a.asignados} compacta />
                        </span>
                      </td>
                      <td className="tabular-nums">{n(a.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Bloque>

      {/* quien debe nombres */}
      <section className="grid lg:grid-cols-2">
        <Bloque
          titulo="Las organizaciones con más nombres"
          descripcion="Cuántos nombres ha entregado cada organización de los cupos que apartó. Lo que falta es a quién llamar."
        >
          {d.topEmpresas.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-suave">
              Todavía no hay inscritos con una reserva detrás.
            </p>
          ) : (
            <ul className="space-y-3">
              {d.topEmpresas.map((e) => (
                <li key={e.nit}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate" title={e.razonSocial}>
                      {e.razonSocial}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-texto-suave">
                      NIT {e.nit}
                    </span>
                  </div>
                  <div className="mt-1">
                    <BarraAvance valor={e.inscritos} maximo={e.cupos} compacta />
                  </div>
                  <p className="mt-1 text-xs text-texto-suave">
                    <span className="tabular-nums">{n(e.inscritos)}</span> nombres de{" "}
                    <span className="tabular-nums">{n(e.cupos)}</span> cupos ·{" "}
                    {e.cupos > e.inscritos
                      ? `le faltan ${n(e.cupos - e.inscritos)}`
                      : "sin nombres pendientes"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Bloque>

        <Bloque
          titulo="Por acción de formación"
          descripcion="Distribución de los inscritos del periodo entre las acciones de formación. No incluye a quienes aún no tienen acción asignada."
        >
          <ListaBarras
            datos={d.porAccion.map((a) => ({
              etiqueta: a.etiqueta,
              valor: a.total,
              detalle: d.total > 0 ? porcentaje(a.total / d.total) : undefined,
            }))}
            vacio="Todavía no hay inscritos en el periodo."
            maximoFilas={12}
          />
        </Bloque>
      </section>

      {/* los repartos */}
      <section className="grid lg:grid-cols-3">
        <Bloque
          titulo="Por ubicación"
          descripcion="Ciudad o departamento donde se dicta la formación que eligieron los inscritos del periodo."
        >
          <ListaBarras
            datos={d.porUbicacion.map((u) => ({
              etiqueta: u.etiqueta,
              valor: u.total,
              detalle: `${u.tipo === "CIUDAD" ? "ciudad" : "departamento"} · ${
                d.total > 0 ? porcentaje(u.total / d.total) : "0 %"
              }`,
            }))}
            vacio="Todavía no hay inscritos con oferta."
            maximoFilas={12}
          />
        </Bloque>

        <Bloque titulo="Por grupo" descripcion="Distribución por grupo, tal como se reporta al SENA.">
          <ListaBarras
            datos={d.porGrupo.map((g) => ({
              clave: g.clave,
              etiqueta: g.etiqueta,
              valor: g.total,
              detalle: g.inicio
                ? `arranca el ${new Date(`${g.inicio}T12:00:00`).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                  })}`
                : "sin fecha de inicio",
            }))}
            vacio="Nadie tiene grupo asignado todavía."
            maximoFilas={12}
          />
        </Bloque>

        <div className="space-y-6">
          <Bloque
            titulo="Por convenio"
            descripcion="Inscritos del periodo en cada uno de los convenios a los que tiene acceso."
          >
            <Donut
              datos={d.porConvenio.map((c) => ({ etiqueta: c.etiqueta, valor: c.total }))}
              tamano={120}
              centro={n(d.total)}
              detalleCentro="inscritos"
              vacio="Todavía no hay inscritos en el periodo."
            />
          </Bloque>

          <Bloque
            titulo="Por modalidad"
            descripcion="Modalidad de la oferta asignada: presencial, virtual o híbrida. No incluye a quienes aún no tienen oferta."
          >
            <Donut
              datos={d.porModalidad.map((m) => ({
                etiqueta: m.etiqueta.charAt(0) + m.etiqueta.slice(1).toLowerCase(),
                valor: m.total,
              }))}
              tamano={120}
              centro={n(conModalidad)}
              detalleCentro="con oferta"
              vacio="Todavía no hay inscritos con oferta."
            />
          </Bloque>
        </div>
      </section>
    </div>
  );
}
