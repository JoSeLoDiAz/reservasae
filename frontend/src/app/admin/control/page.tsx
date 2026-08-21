"use client";

import { useCallback } from "react";

import { estiloEtapa } from "@/components/admin/etapa";
import {
  Anillo,
  BarrasPorDia,
  ListaBarras,
  Medidor,
  n,
  TarjetaCifra,
} from "@/components/admin/graficos";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, Tarjeta } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { crmApi, ETIQUETA_ETAPA, type Control, type Etapa } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/** Las cuatro del embudo más su salida, en orden. */
const EMBUDO: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "DATOS_COMPLETOS",
  "INSCRITO",
  "PERDIDO",
];

const ETIQUETA_ORIGEN: Record<string, string> = {
  EMPRESA: "La empresa lo nominó",
  ASESOR: "Lo capturó un asesor",
  AUTOGESTION: "Se inscribió solo",
  REFERIDO: "Referido",
  REDES: "Redes sociales",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  WHATSAPP: "WhatsApp",
  CORREO: "Correo",
  EVENTO: "Feria o evento",
  OTRO: "Otro",
};

export default function PaginaControl() {
  const vivos = useDatosVivos<Control>(useCallback(() => crmApi.control(), []));

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto conCifras />;

  const d = vivos.datos;
  const cobertura = d.cuposConfirmados > 0 ? d.total / d.cuposConfirmados : 0;

  // el embudo: cuantos quedan en cada peldano
  const enEtapa = new Map(d.embudo.map((e) => [e.etapa, e.total]));
  const escalones = EMBUDO.map((e) => ({ etapa: e, total: enEtapa.get(e) ?? 0 }));
  const entraron = escalones
    .filter((e) => e.etapa !== "PERDIDO")
    .reduce((s, e) => s + e.total, 0);
  const cima = Math.max(1, ...escalones.map((e) => e.total));

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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de inscritos</h1>
          <p className="mt-1 text-texto-suave">
            Cuántos hay y cómo se reparten. Los porcentajes van siempre sobre el total
            de inscritos, para que los cortes se puedan comparar entre sí.
          </p>
        </div>
        <IndicadorActualizacion
          actualizadoEn={vivos.actualizadoEn}
          refrescando={vivos.refrescando}
          desactualizado={vivos.desactualizado}
          alRefrescar={vivos.refrescar}
        />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaCifra titulo="Inscritos" valor={d.total} />
        <TarjetaCifra
          titulo="Cupos confirmados"
          valor={d.cuposConfirmados}
          detalle="el techo de la captura"
        />
        <TarjetaCifra
          titulo="Cobertura"
          valor={Math.round(cobertura * 100)}
          sufijo="%"
          detalle={`${n(d.cuposConfirmados - d.total)} cupos sin nombre detrás`}
          tono={cobertura >= 0.8 ? "exito" : cobertura >= 0.4 ? "normal" : "aviso"}
        />
        <TarjetaCifra
          titulo="De lead a inscrito"
          valor={d.diasHastaInscribir === null ? "—" : Math.round(d.diasHastaInscribir)}
          sufijo={d.diasHastaInscribir === null ? undefined : "días"}
          detalle="promedio"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta
          titulo="El embudo"
          descripcion="Dónde está cada quien. La caída entre peldaños es lo que hay que trabajar."
        >
          <ul className="space-y-3">
            {escalones.map((e, i) => {
              const anterior = i > 0 ? escalones[i - 1].total : null;
              const cae =
                anterior && anterior > 0 && e.etapa !== "PERDIDO"
                  ? Math.round((1 - e.total / anterior) * 100)
                  : null;
              return (
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
                  {cae !== null && cae > 0 && (
                    <p className="mt-0.5 text-[11px] text-texto-suave">
                      cae {cae} % desde el peldaño anterior
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-borde pt-3 text-xs text-texto-suave">
            {n(entraron)} personas vivas en el proceso ·{" "}
            {entraron > 0 ? Math.round((d.total / entraron) * 100) : 0} % ha llegado a
            inscrito
          </p>
        </Tarjeta>

        <Tarjeta
          titulo="Ritmo de inscripción"
          descripcion="Por el día en que quedaron inscritos, últimos 60."
        >
          <BarrasPorDia
            datos={d.serie.map((p) => ({ dia: p.dia, reservas: p.total, cupos: p.total }))}
          />
        </Tarjeta>

        <Tarjeta titulo="Cobertura" descripcion="Inscritos contra cupos confirmados.">
          <div className="flex flex-col items-center gap-4 py-2">
            <Anillo
              porcentaje={Math.round(cobertura * 100)}
              tamano={130}
              etiqueta={`${n(d.total)} de ${n(d.cuposConfirmados)}`}
            />
            {d.porConvenio.length > 0 && (
              <ul className="w-full space-y-2">
                {d.porConvenio.map((c) => (
                  <li key={c.etiqueta}>
                    <Medidor
                      porcentaje={d.total > 0 ? Math.round((c.total / d.total) * 100) : 0}
                      cifra={c.total}
                      detalle="inscritos"
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
          descripcion="Cuántos ha llevado hasta inscrito cada quien."
        >
          <ListaBarras datos={barras(d.porAsesor)} vacio="Nadie tiene asesor asignado." />
        </Tarjeta>

        <Tarjeta
          titulo="De dónde vienen"
          descripcion="El origen del lead. Es lo que dice qué pauta funciona."
        >
          <ListaBarras
            datos={d.porOrigen.map((o) => ({
              etiqueta: ETIQUETA_ORIGEN[o.etiqueta] ?? o.etiqueta,
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
