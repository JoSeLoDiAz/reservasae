"use client";

import { useCallback, useState } from "react";

import { estiloEtapa } from "@/components/admin/etapa";
import {
  Anillo,
  BarraAvance,
  BarrasPorDia,
  ListaBarras,
  Medidor,
  n,
  TarjetaCifra,
} from "@/components/admin/graficos";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, Tarjeta, useAdmin } from "@/components/admin/marco-admin";
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

/** Flecha y porcentaje contra el periodo anterior. */
function Variacion({
  valor,
  contra,
  mejorSiBaja = false,
}: {
  valor: number | null;
  contra: string | null;
  mejorSiBaja?: boolean;
}) {
  // sin con que comparar, no se pinta
  if (valor === null || contra === null) return null;

  const puntos = Math.round(valor * 100);
  if (puntos === 0) {
    return <p className="mt-1.5 text-xs text-texto-suave">igual que {contra}</p>;
  }

  const sube = puntos > 0;
  const bueno = sube !== mejorSiBaja;

  return (
    <p
      className={`mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs font-medium ${
        bueno ? "text-exito" : "text-error"
      }`}
    >
      <span aria-hidden>{sube ? "▲" : "▼"}</span>
      <span className="tabular-nums">
        {sube ? "+" : "−"}
        {Math.abs(puntos)} %
      </span>
      <span className="font-normal text-texto-suave">vs {contra}</span>
    </p>
  );
}

/** La misma tarjeta de cifra, con su variación. */
function TarjetaComparada({
  titulo,
  valor,
  sufijo,
  detalle,
  variacion,
  contra,
  mejorSiBaja,
}: {
  titulo: string;
  valor: number | string;
  sufijo?: string;
  detalle?: string;
  variacion: number | null;
  contra: string | null;
  mejorSiBaja?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
      <p className="text-sm text-texto-suave">{titulo}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-titulo">
        {typeof valor === "number" ? n(valor) : valor}
        {sufijo && <span className="ml-1 text-xl font-normal text-texto-suave">{sufijo}</span>}
      </p>
      {detalle && <p className="mt-1 text-xs text-texto-suave">{detalle}</p>}
      <Variacion valor={variacion} contra={contra} mejorSiBaja={mejorSiBaja} />
    </div>
  );
}

export default function PaginaControl() {
  const { admin } = useAdmin();
  const [rango, setRango] = useState<Rango>("TODO");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const vivos = useDatosVivos<Control>(
    useCallback(
      () => crmApi.control(rango, desde || undefined, hasta || undefined),
      [rango, desde, hasta],
    ),
    { clave: `${rango}|${desde}|${hasta}` },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de inscritos</h1>
          <p className="mt-1 text-texto-suave">
            Cuántos hay y cómo se reparten. Los porcentajes de los cortes van siempre
            sobre quienes llegaron a inscrito en el periodo, para que se comparen entre
            sí; la cobertura y la conversión por asesor son la excepción y no llevan
            periodo.
          </p>
        </div>
        <IndicadorActualizacion
          actualizadoEn={vivos.actualizadoEn}
          refrescando={vivos.refrescando}
          desactualizado={vivos.desactualizado}
          alRefrescar={vivos.refrescar}
        />
      </header>

      <div>
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

        <p className="mt-2 text-xs text-texto-suave">
          El periodo recorta por la fecha en que la persona quedó{" "}
          <strong className="font-medium">inscrita</strong>: quien todavía no lo está se
          queda fuera de casi todos los cortes. El embudo es la excepción y va por la
          fecha en que <strong className="font-medium">llegó el lead</strong>, porque sus
          primeros peldaños no tienen matrícula. Los cupos confirmados, la cobertura, los
          que llegaron por su cuenta y la conversión por asesor no se recortan nunca.
          {rango === "PERSONALIZADO" && (!desde || !hasta) && (
            <span className="text-aviso"> Faltan las dos fechas, así que se muestra todo.</span>
          )}
        </p>
      </div>

      {vivos.error ? (
        <Aviso tipo="error">{vivos.error}</Aviso>
      ) : !vivos.datos ? (
        <Esqueleto conCifras />
      ) : (
        <Cuerpo d={vivos.datos} adminId={admin.id} />
      )}
    </div>
  );
}

/** Las cifras y las gráficas del periodo elegido. */
function Cuerpo({ d, adminId }: { d: Control; adminId: string }) {
  // solo los que ocupan cupo reservado
  const cobertura =
    d.cuposConfirmados > 0 ? d.inscritosConReserva / d.cuposConfirmados : 0;
  // puede no quedar hueco: hay más inscritos
  const sinNombre = d.cuposConfirmados - d.inscritosConReserva;
  const hayVentana = d.ventana.desde !== null && d.ventana.hasta !== null;
  const corte =
    d.ventana.desde && d.ventana.hasta
      ? `${fechaCorta(d.ventana.desde)} – ${fechaCorta(d.ventana.hasta)}`
      : "desde el principio";
  // solo si el backend trajo anterior
  const contra = d.anterior ? d.ventana.etiquetaAnterior : null;

  // el embudo: cuantos quedan en cada peldano
  const enEtapa = new Map(d.embudo.map((e) => [e.etapa, e.total]));
  const escalones = EMBUDO.map((e) => ({ etapa: e, total: enEtapa.get(e) ?? 0 }));
  const cima = Math.max(1, ...escalones.map((e) => e.total));
  // se suma solo lo que se pinta
  const llegados = escalones.reduce((s, e) => s + e.total, 0);
  const yaInscritos = enEtapa.get("INSCRITO") ?? 0;

  // por conversion; sin dueno, al final
  const asesores = [...d.porAsesor].sort((a, b) => {
    const sinA = a.asesorId === null;
    const sinB = b.asesorId === null;
    if (sinA !== sinB) return sinA ? 1 : -1;
    return b.conversion - a.conversion;
  });
  const mio = d.porAsesor.find((a) => a.asesorId === adminId) ?? null;

  const barras = (
    xs: Array<{ etiqueta: string; total: number }>,
    detalle?: (x: { etiqueta: string; total: number }) => string,
  ) =>
    xs.map((x) => ({
      etiqueta: x.etiqueta,
      valor: x.total,
      detalle: detalle
        ? detalle(x)
        : d.total > 0
          ? `${Math.round((x.total / d.total) * 100)} %`
          : undefined,
    }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaComparada
          titulo="Llegaron a inscrito"
          valor={d.total}
          detalle={`${corte} · se matricularon en el corte, aunque hoy ya cursen`}
          variacion={d.variacion.total}
          contra={contra}
        />
        <TarjetaCifra
          titulo="Cupos confirmados"
          valor={d.cuposConfirmados}
          detalle="el techo de la captura, sin periodo"
        />
        <TarjetaCifra
          titulo="Cobertura"
          valor={Math.round(cobertura * 100)}
          sufijo="%"
          detalle={`${
            sinNombre > 0 ? `${n(sinNombre)} cupos sin nombre detrás` : "los cupos están cubiertos"
          } · no cambia con el periodo`}
          tono={cobertura >= 0.8 ? "exito" : cobertura >= 0.4 ? "normal" : "aviso"}
        />
        <TarjetaComparada
          titulo="De lead a inscrito"
          valor={d.diasHastaInscribir === null ? "—" : Math.round(d.diasHastaInscribir)}
          sufijo={d.diasHastaInscribir === null ? undefined : "días"}
          detalle="promedio"
          variacion={d.variacion.diasHastaInscribir}
          contra={contra}
          mejorSiBaja
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta
          titulo="El embudo"
          descripcion={
            <>
              Una foto de dónde está cada quien <strong className="font-medium">hoy</strong>:
              cada persona cuenta en un solo peldaño, así que no es un acumulado y los
              peldaños no se restan entre sí. Ojo: este recorte va por la fecha en que{" "}
              <strong className="font-medium">llegó el lead</strong>, no por la de
              inscripción como el resto de la pantalla.
            </>
          }
        >
          <ul className="space-y-3">
            {escalones.map((e) => (
              <li key={e.etapa} style={estiloEtapa(e.etapa)}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="punto-etapa" aria-hidden />
                    {ETIQUETA_ETAPA[e.etapa]}
                  </span>
                  <span className="font-semibold tabular-nums">{n(e.total)}</span>
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
            {n(llegados)} leads llegaron en el corte y siguen en estos cinco peldaños ·{" "}
            {llegados > 0 ? Math.round((yaInscritos / llegados) * 100) : 0} % está hoy en
            «Inscrito»
          </p>
        </Tarjeta>

        <Tarjeta
          titulo="Ritmo de inscripción"
          descripcion={
            hayVentana
              ? "Por el día en que quedaron inscritos, dentro del periodo."
              : "Por el día en que quedaron inscritos, últimos 60."
          }
        >
          <BarrasPorDia
            datos={d.serie.map((p) => ({ dia: p.dia, cupos: p.total }))}
            unidad="inscritos"
            vacio="Todavía no hay inscritos que mostrar."
          />
        </Tarjeta>

        <Tarjeta
          titulo="Cobertura"
          descripcion="Quienes llegaron a inscrito ocupando un cupo reservado, contra los cupos confirmados. Ninguna de las dos cifras lleva periodo, así que el anillo no se mueve al cambiar el corte."
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <Anillo
              porcentaje={Math.round(cobertura * 100)}
              tamano={130}
              etiqueta={`${n(d.inscritosConReserva)} de ${n(d.cuposConfirmados)}`}
            />

            <p className="w-full rounded-xl bg-superficie-alterna px-3 py-2 text-xs text-texto-suave">
              <strong className="text-base font-semibold tabular-nums text-titulo">
                {n(d.inscritosPorSuCuenta)}
              </strong>{" "}
              llegaron por su cuenta —redes, feria o referido— y{" "}
              <strong className="font-medium">no ocupan un cupo reservado</strong>, así
              que quedan fuera del anillo. Sumarlos daría una cobertura falsa: los cupos
              salen de reservas y estos no tienen ninguna detrás.
            </p>

            {d.porConvenio.length > 0 && (
              <ul className="w-full space-y-2">
                {d.porConvenio.map((c) => (
                  <li key={c.etiqueta}>
                    <Medidor
                      porcentaje={d.total > 0 ? Math.round((c.total / d.total) * 100) : 0}
                      cifra={c.total}
                      detalle="llegaron a inscrito en el periodo"
                      etiqueta={c.etiqueta}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Tarjeta>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta
          titulo="Por acción de formación"
          descripcion="Cuántos inscritos lleva cada curso."
        >
          <ListaBarras datos={barras(d.porAccion)} vacio="Todavía no hay inscritos." />
        </Tarjeta>

        <Tarjeta
          titulo="Por ubicación"
          descripcion="Dónde se dicta lo que eligieron: ciudad o departamento."
        >
          <ListaBarras
            datos={d.porUbicacion.map((u) => ({
              etiqueta: u.etiqueta,
              valor: u.total,
              detalle: `${u.tipo === "CIUDAD" ? "ciudad" : "departamento"} · ${
                d.total > 0 ? Math.round((u.total / d.total) * 100) : 0
              } %`,
            }))}
            vacio="Todavía no hay inscritos."
          />
        </Tarjeta>

        <Tarjeta
          titulo="Por grupo"
          descripcion="El reparto real: es lo que se le reporta al SENA."
        >
          <ListaBarras
            datos={d.porGrupo.map((g) => ({
              etiqueta: g.etiqueta,
              valor: g.total,
              detalle: g.inicio
                ? `arranca el ${new Date(g.inicio + "T12:00:00").toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                  })}`
                : "sin fecha de inicio",
            }))}
            vacio="Nadie tiene grupo asignado todavía."
            maximoFilas={14}
          />
        </Tarjeta>

        <Tarjeta
          titulo="Por asesor"
          descripcion="La tabla se ordena por conversión, y la conversión es HISTÓRICA: todos los que llegó a inscribir sobre todas sus fichas, sin periodo. Así se lee quién convierte mejor —quien lleva 200 y convierte el 5 % lo hace peor que quien lleva 20 y convierte el 40 %— y no a quién le entró una inscripción esta mañana. Los del periodo elegido van aparte, debajo de cada barra."
        >
          {mio && (
            <p className="mb-4 rounded-xl bg-marca-suave px-3 py-2 text-sm">
              Tuyos en el periodo: <strong className="tabular-nums">{n(mio.total)}</strong>{" "}
              de <span className="tabular-nums">{n(d.total)}</span> inscritos, el{" "}
              <strong className="tabular-nums">
                {porcentaje(d.total > 0 ? mio.total / d.total : 0)}
              </strong>
              . Tu conversión histórica es del{" "}
              <strong className="tabular-nums">{porcentaje(mio.conversion)}</strong>:{" "}
              <span className="tabular-nums">{n(mio.inscritosSiempre)}</span> inscritos de{" "}
              <span className="tabular-nums">{n(mio.asignados)}</span> fichas.
            </p>
          )}

          {asesores.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-suave">
              Nadie tiene asesor asignado.
            </p>
          ) : (
            <ul className="space-y-3">
              {asesores.map((a) => {
                const suyo = a.asesorId !== null && a.asesorId === adminId;
                return (
                  <li
                    key={a.asesorId ?? "sin-asignar"}
                    className={suyo ? "-mx-2 rounded-xl bg-marca-suave px-2 py-1.5" : undefined}
                  >
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate" title={a.etiqueta}>
                        {a.etiqueta}
                        {suyo && <span className="text-texto-suave"> · tú</span>}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {porcentaje(a.conversion)}
                        <span className="ml-1.5 text-xs font-normal text-texto-suave">
                          convierte
                        </span>
                      </span>
                    </div>
                    <div className="mt-1">
                      {/* la barra: conversión histórica */}
                      <BarraAvance
                        valor={a.inscritosSiempre}
                        maximo={a.asignados}
                        compacta
                      />
                    </div>
                    <p className="mt-1 text-xs text-texto-suave">
                      <span className="tabular-nums">{n(a.inscritosSiempre)}</span>{" "}
                      inscritos de <span className="tabular-nums">{n(a.asignados)}</span>{" "}
                      fichas, sin periodo ·{" "}
                      <span className="tabular-nums">{n(a.total)}</span> en el periodo
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="De dónde vienen"
          descripcion="El origen del lead. Es lo que dice qué pauta funciona."
        >
          <ListaBarras
            datos={d.porOrigen.map((o) => ({
              etiqueta: ETIQUETA_ORIGEN[o.etiqueta as Origen] ?? o.etiqueta,
              valor: o.total,
              detalle: d.total > 0 ? `${Math.round((o.total / d.total) * 100)} %` : undefined,
            }))}
            vacio="Todavía no hay inscritos."
          />
        </Tarjeta>

        <Tarjeta titulo="Por modalidad" descripcion="Presencial, virtual o híbrida.">
          <ListaBarras
            datos={d.porModalidad.map((m) => ({
              etiqueta: m.etiqueta.charAt(0) + m.etiqueta.slice(1).toLowerCase(),
              valor: m.total,
              detalle: d.total > 0 ? `${Math.round((m.total / d.total) * 100)} %` : undefined,
            }))}
            vacio="Todavía no hay inscritos."
          />
        </Tarjeta>
      </div>
    </div>
  );
}
