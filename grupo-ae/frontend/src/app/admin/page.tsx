"use client";

/** La portada: qué hay que hacer hoy y cómo va el mes. */

/// Aquí vivía el resumen de ocupación de Convoca: cupos
/// comprometidos con el SENA, cobertura territorial en un mapa y
/// reservas de aliados. Nada de eso existe en un CRM de ventas, así
/// que la pantalla se rehizo entera en vez de traducirle los
/// rótulos.
///
/// **Cinco bloques y en este orden**, que no es decorativo:
///
///  1. Lo que exige una acción HOY —quién está esperando respuesta—.
///  2. El dinero: lo abierto y lo esperado.
///  3. Cómo va el mes cerrado.
///  4. Dónde está atascado el embudo.
///  5. Qué campaña trae negocio, y qué se está enfriando.
///
/// El orden es de urgencia, no de importancia. Lo de arriba se mira
/// ahora; lo de abajo, una vez al día.

import { useCallback, useEffect, useState } from "react";

import { Aviso } from "@/components/admin/marco-admin";
import { Bloque, Cargando, Pildora } from "@/components/admin/piezas";
import { ErrorApi } from "@/lib/api";
import {
  enPesos,
  haceCuanto,
  oportunidadesApi,
  type ResumenDeVentas,
} from "@/lib/oportunidades-api";

export default function Portada() {
  const [datos, setDatos] = useState<ResumenDeVentas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await oportunidadesApi.resumen());
    } catch (e) {
      setError(
        e instanceof ErrorApi
          ? e.message
          : "No pudimos traer el resumen. Vuelva a intentarlo.",
      );
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (error) {
    return (
      <div className="px-4 pt-4 pb-6">
        <Aviso tipo="error">{error}</Aviso>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="px-4 pt-4 pb-6">
        <Cargando que="Trayendo el resumen…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-6">
      <Reloj reloj={datos.reloj} />
      <Dinero datos={datos} />
      <Embudo porEtapa={datos.porEtapa} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Campanas filas={datos.porCampana} />
        <Frias frias={datos.frias} cuantas={datos.cuantasFrias} />
      </div>
    </div>
  );
}

/**
 * Arriba del dinero, siempre.
 *
 * Contestar dentro de los primeros cinco minutos multiplica por 21 la
 * probabilidad de calificar frente a esperar media hora, y el
 * promedio del mercado son 42 horas. Es la única cifra de esta
 * pantalla que se puede arreglar en el minuto siguiente a leerla.
 */
function Reloj({ reloj }: { reloj: ResumenDeVentas["reloj"] }) {
  const hayUrgentes = reloj.pasadosDeCinco > 0;

  if (reloj.esperando === 0) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-exito/40 bg-exito-suave px-4 py-3">
        <span className="font-semibold text-exito">Nadie esperando.</span>
        <span className="text-sm opacity-75">
          Todo lo que entró tiene una primera respuesta.
        </span>
        {reloj.medianaRespuesta !== null && (
          <span className="ml-auto text-sm opacity-75">
            Mediana de respuesta:{" "}
            <strong className="tabular-nums">
              {haceCuanto(reloj.medianaRespuesta).replace("hace ", "")}
            </strong>
          </span>
        )}
      </div>
    );
  }

  return (
    <section
      className={`rounded-lg border px-4 py-4 ${
        hayUrgentes ? "border-error/40 bg-error-suave" : "border-borde"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span
            className={`text-3xl font-bold tabular-nums ${hayUrgentes ? "text-error" : ""}`}
          >
            {reloj.esperando}
          </span>
          <span className="text-sm">
            <strong className="block">sin primera respuesta</strong>
            <span className="opacity-70">
              {hayUrgentes
                ? `${reloj.pasadosDeCinco} pasan de cinco minutos`
                : "todavía dentro de los cinco minutos"}
            </span>
          </span>
        </div>
        {reloj.medianaRespuesta !== null && (
          <span className="text-sm opacity-75">
            Mediana de respuesta:{" "}
            <strong className="tabular-nums">
              {haceCuanto(reloj.medianaRespuesta).replace("hace ", "")}
            </strong>
          </span>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-1.5 border-t border-current/10 pt-3">
        {reloj.lista.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
          >
            <span className="min-w-0">
              <span className="font-mono text-xs opacity-50">{e.codigo}</span>{" "}
              {e.titulo}
              {e.campana && (
                <span className="ml-2 text-xs opacity-55">· {e.campana}</span>
              )}
            </span>
            <span
              className={`shrink-0 tabular-nums ${e.minutosEsperando >= 5 ? "font-medium text-error" : "opacity-70"}`}
            >
              {haceCuanto(e.minutosEsperando)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/// Las dos cifras del embudo y las dos del mes, en una franja.
/// Cuatro números sin cuatro marcos: la separación la hacen los
/// espacios, no los bordes.
function Dinero({ datos }: { datos: ResumenDeVentas }) {
  const { pronostico, mes } = datos;
  return (
    <section className="grid gap-x-10 gap-y-5 border-y border-borde py-5 sm:grid-cols-2 lg:grid-cols-4">
      <Cifra
        rotulo="Sobre la mesa"
        valor={enPesos(pronostico.total)}
        pie={`${pronostico.cuantas} negocios abiertos`}
      />
      <Cifra
        rotulo="Esperado"
        valor={enPesos(pronostico.ponderado)}
        pie="con probabilidades estimadas"
      />
      <Cifra
        rotulo="Ganado este mes"
        valor={enPesos(mes.ganado)}
        pie={mes.ganadas === 1 ? "1 negocio" : `${mes.ganadas} negocios`}
        tono="exito"
      />
      <Cifra
        rotulo="Efectividad del mes"
        valor={mes.tasa === null ? "—" : `${mes.tasa} %`}
        pie={
          mes.tasa === null
            ? "todavía no se cierra nada este mes"
            : `${mes.ganadas} ganados de ${mes.ganadas + mes.perdidas} cerrados`
        }
      />
    </section>
  );
}

function Cifra({
  rotulo,
  valor,
  pie,
  tono,
}: {
  rotulo: string;
  valor: string;
  pie: string;
  tono?: "exito";
}) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wide opacity-55">
        {rotulo}
      </span>
      <span
        className={`block text-2xl font-semibold leading-tight tabular-nums ${tono === "exito" ? "text-exito" : ""}`}
      >
        {valor}
      </span>
      <span className="block text-xs opacity-60">{pie}</span>
    </div>
  );
}

/**
 * Dónde está atascado el embudo.
 *
 * Barras y no un donut: esto es un ranking de etapas por dinero, y
 * lo que se pregunta mirándolo es «¿cuál pesa más?», no «¿qué
 * porción del todo es cada una?». La forma del dato manda sobre la
 * uniformidad.
 */
function Embudo({ porEtapa }: { porEtapa: ResumenDeVentas["porEtapa"] }) {
  const mayor = Math.max(1, ...porEtapa.map((e) => e.total));

  return (
    <Bloque
      titulo="Dónde está el dinero"
      descripcion="Lo abierto, por etapa. Los dos embudos sumados."
    >
      <ul className="flex flex-col gap-3">
        {porEtapa.map((e) => (
          <li key={e.etapa} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                {e.rotulo}{" "}
                <span className="opacity-55">
                  ({e.cuantas === 1 ? "1" : e.cuantas})
                </span>
              </span>
              <span className="tabular-nums">
                {e.total > 0 ? enPesos(e.total) : "—"}
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-current/10"
              role="presentation"
            >
              <div
                className="h-full rounded-full bg-marca"
                style={{ width: `${Math.round((e.total / mayor) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

/**
 * Qué campaña trae negocio.
 *
 * Es la pregunta que justifica el gasto en pauta, y la que casi
 * ningún CRM contesta bien: para contestarla hay que saber de qué
 * anuncio vino cada ficha, y eso solo se sabe si el lead entra solo,
 * con su origen puesto. Aquí entra así.
 */
function Campanas({ filas }: { filas: ResumenDeVentas["porCampana"] }) {
  return (
    <Bloque
      titulo="De dónde vienen"
      descripcion="Por campaña: cuántos trae y cuánto dinero mueve."
    >
      {filas.length === 0 ? (
        <p className="text-sm opacity-60">Todavía no hay leads con campaña.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide opacity-55">
                <th className="pb-2 pr-3 font-medium">Campaña</th>
                <th className="pb-2 pr-3 text-right font-medium">Leads</th>
                <th className="pb-2 pr-3 text-right font-medium">Abierto</th>
                <th className="pb-2 text-right font-medium">Ganado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.campana} className="border-b border-borde/50">
                  <td className="py-2 pr-3">{f.campana}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{f.cuantas}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {f.abierto > 0 ? enPesos(f.abierto) : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {f.ganado > 0 ? (
                      <span className="text-exito">{enPesos(f.ganado)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bloque>
  );
}

/// Una oportunidad sin próximo paso es una oportunidad abandonada, y
/// el sistema tiene que poder decirlo antes de que se muera sola.
function Frias({
  frias,
  cuantas,
}: {
  frias: ResumenDeVentas["frias"];
  cuantas: number;
}) {
  return (
    <Bloque
      titulo="Se están enfriando"
      descripcion="Abiertas que llevan más de una semana sin que nadie las toque."
    >
      {frias.length === 0 ? (
        <p className="text-sm opacity-60">
          Ninguna. Todo lo abierto se ha movido esta semana.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {frias.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borde/50 pb-2 text-sm last:border-0 last:pb-0"
            >
              <span className="min-w-0">
                {f.titulo}
                <span className="block text-xs opacity-55">
                  {f.asesor?.nombre ?? "Sin dueño"} · {enPesos(f.valor)}
                </span>
              </span>
              <Pildora tono="aviso">{f.dias} días</Pildora>
            </li>
          ))}
          {cuantas > frias.length && (
            <li className="text-xs opacity-55">
              y {cuantas - frias.length} más.
            </li>
          )}
        </ul>
      )}
    </Bloque>
  );
}
