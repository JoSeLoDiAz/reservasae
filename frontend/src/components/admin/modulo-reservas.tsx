"use client";

/** Módulo 1 del Resumen: el control de reservas de afiliados. */

/**
 * «El módulo uno es el que va a mostrar el control de reservas de
 * afiliado: cupos reservados, inscritos confirmados, pendientes por
 * inscribir, de cuántas instituciones. Cuánto reservó cada
 * institución… por institución, por acción de formación y por
 * departamento» (cliente, 22 sep 2026). Y después: «y es control de
 * reservas y ya, en el 1».
 *
 * LA MATRIZ SÍ ESTÁ, y el 22 sep no estaba: el cliente la enseñó
 * dos veces de su maqueta y pidió «lo quiero igual como está en el
 * ejemplo, TODO». Se dibuja desde `cruce`, que ya viene en la misma
 * respuesta, así que no cuesta ni una consulta más.
 *
 * LO QUE NO SE TRAJO es el despliegue por PERSONA de cada fila —el
 * nombre, su grupo, su fecha y su estado—: eso es el detalle, y el
 * propio cliente puso ahí la frontera —«esto es un RESUMEN, el
 * detalle queda como está»—. Cada institución enlaza al informe de
 * Reservas, que ya lo tiene hecho.
 *
 * «INSCRITOS CONFIRMADOS» SON LOS QUE ESTÁN DENTRO HOY, no los que
 * pasaron alguna vez (decisión de Josse, 22 sep 2026). Es una cifra
 * DISTINTA de la que abre el informe de Reservas, que cuenta también
 * a quien se retiró porque es la que se le reporta al SENA. Las dos
 * son ciertas y por eso no se llaman igual: aquí «están hoy», allá
 * «ya tienen nombre». El pie lo dice, porque dos cifras parecidas
 * sin explicar se leen como una mal calculada.
 */

import { useCallback, useState } from "react";

import { n } from "./graficos";
import {
  ACENTO,
  BarrasDobles,
  Cifra,
  CifraDelModulo,
  Cifras,
  FraseDelModulo,
  Leyenda,
  Modulo,
  VerDetalle,
  type FilaDoble,
} from "./piezas-modulo";
import { Esqueleto, Vacio } from "./piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import { porcentaje } from "@/lib/trafico-comun";
import { tablerosApi, type InformeReservas } from "@/lib/tableros-api";

/// Se refresca como lo hacía el Resumen de antes: cada medio
/// minuto. Es lo que se mira en reunión mientras entra gente.
const CADA_MEDIO_MINUTO = 30_000;

type Corte = "institucion" | "accion" | "departamento";

const COMO_SE_LLAMA: Record<Corte, string> = {
  institucion: "Por institución",
  accion: "Por acción",
  departamento: "Por departamento",
};

const HECHO = ACENTO[1];
const FALTA = "color-mix(in srgb, var(--marca) 28%, transparent)";

export function ModuloReservas() {
  const [corte, setCorte] = useState<Corte>("institucion");

  const vivos = useDatosVivos<InformeReservas>(
    /// Sin filtros: el ámbito lo pone el guard y el gremio viaja en
    /// la cabecera, como en todo el panel.
    useCallback(() => tablerosApi.informeReservas(), []),
    { intervaloMs: CADA_MEDIO_MINUTO },
  );

  const d = vivos.datos;
  const t = d?.totales;

  /// PENDIENTES POR INSCRIBIR contra los que están DENTRO, no contra
  /// `sinNombre`: aquella resta a quien llegó alguna vez, así que un
  /// cupo cuya persona se retiró le saldría cubierto. Acotado a cero
  /// porque una reserva puede tener más gente que cupos.
  const pendientes = t ? Math.max(0, t.cuposConfirmados - t.dentro) : 0;

  const filas: FilaDoble[] = (() => {
    if (!d) return [];
    if (corte === "institucion")
      return d.porOrganizacion.map((o) => ({
        clave: o.empresaId,
        etiqueta: o.razonSocial,
        hecho: o.dentro,
        total: o.cuposConfirmados,
        derecha: (
          <>
            {n(o.dentro)} de {n(o.cuposConfirmados)} ·{" "}
            {porcentaje(o.dentro, o.cuposConfirmados)}
          </>
        ),
      }));
    if (corte === "accion")
      return d.porAccion.map((a) => ({
        /// La llave es el id y NO el código: con los dos gremios hay
        /// dos «AF1», y agrupando por código se funden en una fila.
        clave: a.accionFormacionId,
        etiqueta: `${a.codigo} · ${a.nombre}`,
        hecho: a.dentro,
        total: a.cuposConfirmados,
        derecha: (
          <>
            {n(a.dentro)} de {n(a.cuposConfirmados)} ·{" "}
            {porcentaje(a.dentro, a.cuposConfirmados)}
          </>
        ),
      }));
    /// El corte por ubicación NO trae los inscritos: es DÓNDE SE
    /// DICTA, y el informe solo cuenta ahí reservas y cupos. Se
    /// pinta lo que hay y se dice lo que falta, en vez de inventar
    /// un segundo segmento que no está medido.
    return d.porUbicacion.map((u) => ({
      clave: u.ubicacionId,
      etiqueta: u.nombre,
      hecho: 0,
      total: u.cuposConfirmados,
      derecha: <>{n(u.cuposConfirmados)} cupos</>,
    }));
  })();

  return (
    <Modulo
      numero={1}
      titulo="Control de reservas de afiliados"
      descripcion="Cupos que reservó cada institución y cuántos de esos cupos ya tienen persona inscrita."
    >
      {vivos.error ? (
        <Vacio titulo="No se pudieron traer las reservas">{vivos.error}</Vacio>
      ) : !d || !t ? (
        <Esqueleto conCifras />
      ) : t.reservas === 0 ? (
        <Vacio titulo="Todavía no hay ninguna reserva">
          Aparecen aquí en cuanto una institución aparte sus primeros cupos desde
          el formulario público.
        </Vacio>
      ) : (
        <>
          <FraseDelModulo numero={1}>
            <Cifra>{n(t.organizaciones)}</Cifra>{" "}
            {t.organizaciones === 1 ? "institución reservó" : "instituciones reservaron"}{" "}
            <Cifra>{n(t.cuposConfirmados)}</Cifra> cupos. Hay{" "}
            <Cifra>{n(t.dentro)}</Cifra> inscritos confirmados (
            {porcentaje(t.dentro, t.cuposConfirmados)}) y faltan{" "}
            <Cifra>{n(pendientes)}</Cifra> por confirmar.
          </FraseDelModulo>

          <Cifras>
            <CifraDelModulo
              etiqueta="Cupos reservados"
              valor={n(t.cuposConfirmados)}
              pie={`en ${n(t.reservas)} ${t.reservas === 1 ? "reserva" : "reservas"}`}
            />
            <CifraDelModulo
              etiqueta="Inscritos confirmados"
              valor={n(t.dentro)}
              pie={`${porcentaje(t.dentro, t.cuposConfirmados)} de lo reservado`}
              tono={t.dentro > 0 ? "bueno" : undefined}
            />
            <CifraDelModulo
              etiqueta="Pendientes por inscribir"
              valor={n(pendientes)}
              pie={pendientes > 0 ? "requieren seguimiento" : "sin pendientes"}
              tono={pendientes > 0 ? "aviso" : "bueno"}
            />
            <CifraDelModulo
              etiqueta="Instituciones"
              valor={n(t.organizaciones)}
              pie="con al menos una reserva"
            />
          </Cifras>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Reservado frente a inscrito</h3>
              {/* Tres cortes de la MISMA cifra, así que no viajan en
                  la dirección: no son un filtro de la pantalla. */}
              <div className="no-imprimir inline-flex overflow-hidden rounded-lg border border-borde">
                {(Object.keys(COMO_SE_LLAMA) as Corte[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCorte(c)}
                    aria-pressed={corte === c}
                    className="px-2.5 py-1 text-[0.71875rem] font-semibold transition"
                    style={
                      corte === c
                        ? { background: HECHO, color: "var(--marca-texto)" }
                        : { color: "var(--texto-suave)" }
                    }
                  >
                    {COMO_SE_LLAMA[c]}
                  </button>
                ))}
              </div>
            </div>

            {corte !== "departamento" && (
              <Leyenda
                de={[
                  { nombre: "Inscritos confirmados", color: HECHO },
                  { nombre: "Reservado sin confirmar", color: FALTA },
                ]}
              />
            )}

            <BarrasDobles
              filas={filas}
              colorHecho={corte === "departamento" ? FALTA : HECHO}
              colorFalta={FALTA}
              vacio="No hay reservas con este corte."
              maximoFilas={9}
            />

            {corte === "departamento" && (
              /// SE DICE LO QUE NO SE PUEDE DECIR. Un corte sin su
              /// segundo dato, callado, se lee como que ahí nadie se
              /// inscribió.
              <p className="text-[0.71875rem] text-texto-suave">
                Aquí no van los inscritos: este corte es dónde se dicta el curso,
                no dónde está la institución.
              </p>
            )}
          </div>

          <MatrizDeReservas informe={d} />

          <p className="text-[0.71875rem] text-texto-suave">
            «Inscritos confirmados» son los que están{" "}
            <strong className="font-semibold text-texto">hoy</strong> en el cupo.
            El informe de Reservas cuenta además a quien llegó a inscribirse y
            después se retiró, porque esa es la cifra que entra en el reporte al
            SENA: por eso allá el número puede ser mayor.
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <VerDetalle a="/admin/control?pantalla=reservas">
              Ver el detalle: institución por institución y persona por persona
            </VerDetalle>
            <VerDetalle a="/admin/ocupacion">Ver la ocupación contra la meta</VerDetalle>
          </div>
        </>
      )}
    </Modulo>
  );
}

/**
 * La matriz institución × acción de formación.
 *
 * Es lo que el cliente enseñó dos veces de su maqueta, y lo que de
 * verdad usa: cada celda dice confirmados / reservados, así que se
 * ve de un vistazo qué institución debe nombres y en qué curso.
 *
 * SE DIBUJA DESDE `cruce`, que ya viene en la misma respuesta. No
 * hay consulta nueva: el informe lo calcula para su propia pantalla
 * y aquí se reordena.
 *
 * LA CELDA TIÑE CON LA MARCA, no con una escala de colores. Un
 * degradado por volumen se lee como un mapa de calor —«más oscuro
 * es peor»— y aquí más cupos no es ni mejor ni peor: es más grande.
 * Lo que sí distingue es el par de números.
 *
 * EL DESPLIEGUE POR PERSONA NO ESTÁ AQUÍ, y es la frontera que puso
 * el cliente: «esto es un resumen, el detalle queda como está». La
 * lista de cada inscrito, con su grupo y su estado, vive en el
 * informe de Reservas, y el nombre de cada institución lleva allí.
 */
function MatrizDeReservas({ informe }: { informe: InformeReservas }) {
  /// Las columnas son las acciones QUE ALGUIEN RESERVÓ, en el orden
  /// del catálogo. Con las quince, doce columnas saldrían vacías y
  /// la tabla se iría de ancho sin decir nada.
  const acciones = informe.porAccion
    .filter((a) => a.reservas > 0)
    .map((a) => ({ id: a.accionFormacionId, codigo: a.codigo, nombre: a.nombre }));

  if (acciones.length === 0 || informe.porOrganizacion.length === 0) return null;

  /// `accionFormacionId` y NO el código: con los dos gremios hay dos
  /// «AF1» distintos, y agrupando por código se funden en una.
  const celda = new Map<string, { dentro: number; cupos: number }>();
  for (const c of informe.cruce) {
    celda.set(`${c.empresaId}|${c.accionFormacionId}`, {
      dentro: c.dentro,
      cupos: c.cuposConfirmados,
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <h3 className="text-sm font-bold">Detalle de reservas e inscritos</h3>
        <p className="mt-0.5 text-[0.71875rem] text-texto-suave">
          Cada celda muestra inscritos / reservados. Toque una institución para
          ver a cada persona, su grupo y su estado.
        </p>
      </div>

      <div className="caja-scroll overflow-x-auto rounded-xl border border-borde">
        <table className="w-full text-[0.78125rem]">
          <thead>
            <tr className="bg-tabla-cabecera-fondo text-tabla-cabecera-texto">
              <th className="sticky left-0 z-10 bg-tabla-cabecera-fondo px-3 py-2 text-left font-semibold">
                Institución
              </th>
              {acciones.map((a) => (
                <th
                  key={a.id}
                  title={a.nombre}
                  className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                >
                  {a.codigo}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {informe.porOrganizacion.map((o) => (
              <tr key={o.empresaId} className="border-t border-hairline">
                <td className="sticky left-0 z-10 bg-superficie px-3 py-1.5">
                  <VerDetalle
                    a={`/admin/control?pantalla=reservas&empresaId=${encodeURIComponent(o.empresaId)}`}
                  >
                    {o.razonSocial}
                  </VerDetalle>
                </td>
                {acciones.map((a) => {
                  const c = celda.get(`${o.empresaId}|${a.id}`);
                  return (
                    <td key={a.id} className="px-2 py-1.5 text-center tabular-nums">
                      {!c ? (
                        <span className="text-texto-suave">–</span>
                      ) : (
                        <span
                          className="inline-block rounded-md px-1.5 py-0.5"
                          style={{
                            background: "color-mix(in srgb, var(--marca) 12%, transparent)",
                          }}
                        >
                          <strong className="font-bold">{n(c.dentro)}</strong>
                          <span className="text-texto-suave">/{n(c.cupos)}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-center tabular-nums">
                  <strong className="font-bold">{n(o.dentro)}</strong>
                  <span className="text-texto-suave">/{n(o.cuposConfirmados)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* QUÉ ES CADA CÓDIGO. La cabecera dice «AF1» porque el nombre
          completo no cabe en una columna, y una tabla de códigos sin
          su leyenda obliga a adivinar. */}
      <dl className="flex flex-col gap-0.5 text-[0.71875rem] text-texto-suave">
        {acciones.map((a) => (
          <div key={a.id} className="flex gap-2">
            <dt className="font-bold text-texto">{a.codigo}</dt>
            <dd className="min-w-0 truncate">{a.nombre}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
