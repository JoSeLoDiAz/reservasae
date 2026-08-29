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
import { Aviso, CLASE_CONTROL, Tarjeta, useAdmin } from "@/components/admin/marco-admin";
import { PanelMetas } from "@/components/admin/panel-metas";
import { Esqueleto } from "@/components/admin/piezas";
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Control de Inscritos</h1>
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
        className="flex gap-1 border-b border-borde"
      >
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            role="tab"
            aria-selected={pestana === p.clave}
            onClick={() => cambiar(p.clave)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              pestana === p.clave
                ? "border-marca text-marca"
                : "border-transparent text-texto-suave hover:text-texto"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === "metas" && <PanelMetas />}

      {pestana === "analisis" && (
        <>
      <div className="rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
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
          Aquí se cruzan <strong className="font-medium">dos fechas distintas</strong>. Los
          inscritos, sus cortes y su ritmo van por la fecha en que la persona{" "}
          <strong className="font-medium">llegó a ser inscrita</strong>. El embudo y la
          llegada de leads van por la fecha en que{" "}
          <strong className="font-medium">llegó el lead</strong>, porque los peldaños de
          arriba no tienen matrícula y sin eso desaparecerían enteros. Las colas de trabajo,
          los cupos, la cobertura, la conversión y las organizaciones{" "}
          <strong className="font-medium">no se recortan nunca</strong>: son lo que hay hoy.
          {rango === "PERSONALIZADO" && (!desde || !hasta) && (
            <span className="text-aviso"> Faltan las dos fechas, así que se muestra todo.</span>
          )}
          {contra === "PERSONALIZADO" && (!contraDesde || !contraHasta) && (
            <span className="text-aviso">
              {" "}
              A la comparación le faltan fechas, así que no hay con qué comparar.
            </span>
          )}
        </p>
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

  // de toda ficha a inscrito
  const fichas = d.conversionPorOrigen.reduce((s, o) => s + o.leads, 0);
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
  const fichasRepartidas = d.porAsesor.reduce((s, a) => s + a.asignados, 0);

  const conOrigen = d.porOrigen.reduce((s, o) => s + o.total, 0);
  const conModalidad = d.porModalidad.reduce((s, m) => s + m.total, 0);

  return (
    <div className="space-y-6">
      {/* la cola de trabajo, antes que nada */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Tarjeta
          titulo="Leads sin asesor"
          descripcion="Fichas por trabajar que no son de nadie. No lleva periodo: es una cola, no un hecho fechado."
        >
          <p
            className={`text-5xl font-semibold tabular-nums ${
              d.sinAsignar > 0 ? "text-aviso" : "text-exito"
            }`}
          >
            {n(d.sinAsignar)}
          </p>
          <p className="mt-2 text-xs text-texto-suave">
            {d.sinAsignar > 0
              ? "Nadie las está llamando: repartirlas es el primer trabajo del día."
              : "Todas las fichas por trabajar tienen dueño."}
          </p>
          <Link
            href="/admin/participantes"
            className="mt-4 inline-block text-sm font-medium text-marca"
          >
            Ir al tablero de inscripciones
          </Link>
        </Tarjeta>

        <div className="lg:col-span-2">
          <Tarjeta
            titulo="Cuánto llevan esperando sin que los llamen"
            descripcion="Solo quien sigue en «Interesado», por su fecha de llegada: en cuanto alguien lo llama la ficha pasa a «Contactado» y sale de aquí. Tampoco lleva periodo, porque recortarla la dejaría vacía justo cuando más larga está."
          >
            <Termometro tramos={tramos} vacio="No hay nadie esperando a que lo llamen." />
            <p className="mt-4 border-t border-borde pt-3 text-xs text-texto-suave">
              <strong className="font-medium tabular-nums">{n(esperando)}</strong> personas
              esperando en total
              {esperando > 0 && (
                <>
                  {" · "}
                  <strong className="font-medium tabular-nums">{n(frios)}</strong> llevan más
                  de una semana, el {porcentaje(frios / esperando)} de la cola
                </>
              )}
            </p>
          </Tarjeta>
        </div>
      </section>

      {/* las cifras de cabecera */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          detalle={`fichas nuevas ${alcanceSerie}, en cualquier etapa`}
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

      {/* las tasas */}
      <Tarjeta
        titulo="Las tres tasas"
        descripcion="Ninguna lleva periodo: las tres miden lo que hay hoy contra lo que se comprometió, y recortarlas por «ayer» daría cifras falsas."
      >
        <div className="grid gap-6 sm:grid-cols-3">
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
            total={fichas}
            detalle="fichas que llegaron a inscrito"
          />
          <Tasa
            titulo="Llegaron por su cuenta"
            parte={d.inscritosPorSuCuenta}
            total={inscritosSiempre}
            detalle="el resto entró por un cupo reservado"
          />
        </div>

        <p className="mt-5 border-t border-borde pt-3 text-xs text-texto-suave">
          La cobertura no se mueve al cambiar el periodo, y es a propósito: los cupos salen
          de reservas y no pueden llevar ventana, así que medir contra ellos unos inscritos
          recortados daría «0 % de cobertura» con solo elegir «ayer». Solo cuenta a quien
          ocupa un cupo reservado: los{" "}
          <strong className="font-medium tabular-nums">{n(d.inscritosPorSuCuenta)}</strong>{" "}
          que llegaron por redes, feria o referido no tienen ninguna reserva detrás.
        </p>
      </Tarjeta>

      {/* el embudo y el ritmo */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Tarjeta
          titulo="El embudo"
          descripcion={
            <>
              Una foto de dónde está cada quien <strong className="font-medium">hoy</strong>:
              cada persona cuenta en un solo peldaño, así que no es un acumulado y los
              peldaños no se restan entre sí. Va por la fecha en que{" "}
              <strong className="font-medium">llegó el lead</strong>, no por la de
              inscripción.
            </>
          }
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
        </Tarjeta>

        <div className="lg:col-span-2">
          <Tarjeta
            titulo="Ritmo: llegada contra inscripción"
            descripcion={`Los leads por el día en que llegaron y los inscritos por el día en que lo fueron, ${alcanceSerie}. Es la gráfica que separa las dos preguntas: si entran leads y no salen inscripciones, el problema está en el seguimiento y no en la pauta.`}
          >
            <DosSeriesPorDia
              a={{ nombre: "Leads que llegaron", datos: d.leadsPorDia, color: SERIE.uno }}
              b={{ nombre: "Llegaron a inscrito", datos: d.serie, color: SERIE.dos }}
              vacio="Todavía no hay movimiento que mostrar."
            />
          </Tarjeta>
        </div>
      </section>

      {/* el origen: volumen y calidad */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Tarjeta
          titulo="De dónde vienen: volumen"
          descripcion="Cuántos de los inscritos del periodo entraron por cada puerta. Dice cuál trae más, nunca cuál trae mejor."
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
        </Tarjeta>

        <Tarjeta
          titulo="De dónde vienen: calidad"
          descripcion="Cuánto convierte cada puerta, sobre todas sus fichas y sin periodo. No es lo mismo que el volumen: una pauta puede traer trescientos leads y convertir el 2 %."
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
            vacio="Todavía no hay fichas."
          />
        </Tarjeta>
      </section>

      {/* los asesores */}
      <Tarjeta
        titulo="Por asesor"
        descripcion="Ordenada por conversión, que es HISTÓRICA: todos los que llegó a inscribir sobre todas sus fichas, sin periodo. Así se lee quién convierte mejor —quien lleva 200 y convierte el 5 % lo hace peor que quien lleva 20 y convierte el 40 %— y no a quién le entró una inscripción esta mañana."
      >
        {mio && (
          <p className="mb-4 rounded-xl bg-marca-suave px-3 py-2 text-sm">
            <strong className="font-semibold">Tuyos:</strong>{" "}
            <span className="tabular-nums">{n(mio.asignados)}</span> de{" "}
            <span className="tabular-nums">{n(fichasRepartidas)}</span> fichas ·{" "}
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
                  <th>Fichas</th>
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
      </Tarjeta>

      {/* quien debe nombres */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Tarjeta
          titulo="Las organizaciones con más nombres"
          descripcion="Nombres puestos contra cupos apartados. Ninguna de las dos cifras lleva periodo: los cupos salen de reservas, y medir contra ellos unos inscritos recortados daría deudas inventadas."
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
        </Tarjeta>

        <Tarjeta
          titulo="Por acción de formación"
          descripcion="Qué curso eligieron los inscritos del periodo. Quien todavía no tiene acción asignada no aparece."
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
        </Tarjeta>
      </section>

      {/* los repartos */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Tarjeta
          titulo="Por ubicación"
          descripcion="Dónde se dicta lo que eligieron: ciudad o departamento."
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
        </Tarjeta>

        <Tarjeta titulo="Por grupo" descripcion="El reparto real: es lo que se le reporta al SENA.">
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
        </Tarjeta>

        <div className="space-y-6">
          <Tarjeta
            titulo="Por convenio"
            descripcion="Los inscritos del periodo, entre los convenios que se pueden ver."
          >
            <Donut
              datos={d.porConvenio.map((c) => ({ etiqueta: c.etiqueta, valor: c.total }))}
              tamano={120}
              centro={n(d.total)}
              detalleCentro="inscritos"
              vacio="Todavía no hay inscritos en el periodo."
            />
          </Tarjeta>

          <Tarjeta
            titulo="Por modalidad"
            descripcion="Presencial, virtual o híbrida. Sale de la oferta, así que quien no tiene una asignada no cuenta."
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
          </Tarjeta>
        </div>
      </section>
    </div>
  );
}
