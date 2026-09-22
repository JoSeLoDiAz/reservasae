"use client";

/** Módulo 1 del Resumen: el control de reservas de afiliados. */

/**
 * «El módulo uno es el que va a mostrar el control de reservas de
 * afiliado: cupos reservados, inscritos confirmados, pendientes por
 * inscribir, de cuántas instituciones. Cuánto reservó cada
 * institución… por institución, por acción de formación y por
 * departamento» (cliente, 22 sep 2026).
 *
 * SUSTITUYE al veredicto de ocupación y a los diez bloques que había
 * —«bajan todos, sin excepción»—, que no se borraron: viven en
 * `/admin/ocupacion`, y el pie de este módulo lleva allí.
 *
 * LA MATRIZ NO ESTÁ AQUÍ, Y ES DELIBERADO. El cruce institución ×
 * acción con su despliegue por persona ya existe entero en el
 * informe de Reservas, y el propio cliente puso la frontera: «esto
 * es un RESUMEN, el detalle va a quedar aparte, el detalle queda
 * como está». Copiarlo serían dos pantallas contando lo mismo con
 * dos reglas.
 *
 * «INSCRITOS CONFIRMADOS» SON LOS QUE ESTÁN DENTRO HOY, no los que
 * pasaron alguna vez (decisión de Josse, 22 sep 2026). Es una cifra
 * DISTINTA de la que abre el informe de Reservas, que cuenta también
 * a quien se retiró porque es la que se le reporta al SENA. Las dos
 * son ciertas y por eso no se llaman igual: aquí «están hoy», allá
 * «ya tienen nombre». El pie lo dice, porque dos cifras parecidas
 * sin explicar se leen como una mal calculada.
 */

import Link from "next/link";
import { useCallback, useState } from "react";

import { ListaBarras, n } from "./graficos";
import { Bloque, Esqueleto, TarjetaCifra, Vacio } from "./piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import { porcentaje } from "@/lib/trafico-comun";
import { tablerosApi, type InformeReservas } from "@/lib/tableros-api";

/// El corte se refresca como el resto del módulo 1 lo hacía: cada
/// medio minuto. Es lo que se mira en una reunión mientras entra
/// gente.
const CADA_MEDIO_MINUTO = 30_000;

type Corte = "institucion" | "accion" | "departamento";

const COMO_SE_LLAMA: Record<Corte, string> = {
  institucion: "Por institución",
  accion: "Por acción de formación",
  departamento: "Por departamento",
};

export function ModuloReservas() {
  const [corte, setCorte] = useState<Corte>("institucion");

  const vivos = useDatosVivos<InformeReservas>(
    /// Sin filtros: el ámbito lo pone el guard y el gremio viaja en
    /// la cabecera, como en todo el panel.
    useCallback(() => tablerosApi.informeReservas(), []),
    { intervaloMs: CADA_MEDIO_MINUTO },
  );

  if (vivos.error)
    return (
      <Bloque
        titulo="1 · Control de reservas de afiliados"
        descripcion="Cuántos cupos reservó cada institución y cuántos de ellos ya tienen persona inscrita."
        partible
      >
        <Vacio titulo="No se pudieron traer las reservas">{vivos.error}</Vacio>
      </Bloque>
    );

  const d = vivos.datos;
  const t = d?.totales;

  /// PENDIENTES POR INSCRIBIR contra los que están DENTRO, no contra
  /// `sinNombre`: aquella resta a quien llegó alguna vez, así que un
  /// cupo cuya persona se retiró le saldría cubierto. Acotado a cero
  /// porque una reserva puede tener más gente que cupos.
  const pendientes = t ? Math.max(0, t.cuposConfirmados - t.dentro) : 0;

  const filas = (() => {
    if (!d) return [];
    if (corte === "institucion")
      return d.porOrganizacion.map((o) => ({
        clave: o.empresaId,
        etiqueta: o.razonSocial,
        cupos: o.cuposConfirmados,
        dentro: o.dentro,
      }));
    if (corte === "accion")
      return d.porAccion.map((a) => ({
        /// La llave es el id y NO el código: con los dos gremios hay
        /// dos «AF1», y agrupando por código se funden en una fila.
        clave: a.accionFormacionId,
        etiqueta: `${a.codigo} · ${a.nombre}`,
        cupos: a.cuposConfirmados,
        dentro: a.dentro,
      }));
    /// El corte por ubicación NO trae los inscritos: es DÓNDE SE
    /// DICTA, y el informe solo cuenta ahí reservas y cupos. Se
    /// pinta lo que hay y se dice lo que falta, en vez de inventar
    /// un segundo segmento que no está medido.
    return d.porUbicacion.map((u) => ({
      clave: u.ubicacionId,
      etiqueta: u.nombre,
      cupos: u.cuposConfirmados,
      dentro: null as number | null,
    }));
  })();

  return (
    <Bloque
      titulo="1 · Control de reservas de afiliados"
      descripcion="Cuántos cupos reservó cada institución y cuántos de ellos ya tienen persona inscrita."
      partible
    >
      {!d || !t ? (
        <Esqueleto conCifras />
      ) : t.reservas === 0 ? (
        <Vacio titulo="Todavía no hay ninguna reserva">
          Aparecen aquí en cuanto una institución aparte sus primeros cupos
          desde el formulario público.
        </Vacio>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="imprimible-cifras grid gap-px overflow-hidden rounded-lg border border-borde bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            <TarjetaCifra
              compacta
              etiqueta="Cupos reservados"
              valor={n(t.cuposConfirmados)}
              pie={`en ${n(t.reservas)} ${t.reservas === 1 ? "reserva" : "reservas"}`}
            />
            <TarjetaCifra
              compacta
              etiqueta="Inscritos confirmados"
              valor={n(t.dentro)}
              pie={
                t.cuposConfirmados > 0
                  ? `${porcentaje(t.dentro, t.cuposConfirmados)} de lo reservado`
                  : undefined
              }
              tono={t.dentro > 0 ? "exito" : "neutro"}
            />
            <TarjetaCifra
              compacta
              etiqueta="Pendientes por inscribir"
              valor={n(pendientes)}
              pie={pendientes > 0 ? "hay que cobrarles los nombres" : "sin pendientes"}
              tono={pendientes > 0 ? "aviso" : "exito"}
            />
            <TarjetaCifra
              compacta
              etiqueta="Instituciones"
              valor={n(t.organizaciones)}
              pie="con al menos una reserva"
              tono="neutro"
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Reservado frente a inscrito</h3>
              {/* Tres cortes, y el que está puesto se dice. No es un
                  filtro de la pantalla: es la misma cifra mirada de
                  tres maneras, así que no viaja en la dirección. */}
              <div className="flex flex-wrap gap-1">
                {(Object.keys(COMO_SE_LLAMA) as Corte[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCorte(c)}
                    aria-pressed={corte === c}
                    className={`rounded-lg px-2.5 py-1 text-[0.71875rem] font-semibold transition ${
                      corte === c
                        ? "bg-current/15 text-texto"
                        : "text-texto-suave hover:bg-current/10"
                    }`}
                  >
                    {COMO_SE_LLAMA[c]}
                  </button>
                ))}
              </div>
            </div>

            <ListaBarras
              datos={filas.map((f) => ({
                clave: f.clave,
                etiqueta: f.etiqueta,
                valor: f.cupos,
                detalle:
                  f.dentro === null
                    ? undefined
                    : `${n(f.dentro)} inscrito${f.dentro === 1 ? "" : "s"}`,
              }))}
              sufijo=" cupos"
              sufijoUno=" cupo"
              vacio="No hay reservas con este corte."
              maximoFilas={8}
            />

            {corte === "departamento" && (
              /// SE DICE LO QUE NO SE PUEDE DECIR. Un corte sin su
              /// segundo dato, callado, se lee como que ahí nadie se
              /// inscribió.
              <p className="mt-1.5 text-[0.71875rem] text-texto-suave">
                Aquí no van los inscritos: este corte es dónde se dicta el
                curso, no dónde está la institución.
              </p>
            )}
          </div>

          <p className="text-[0.71875rem] text-texto-suave">
            «Inscritos confirmados» son los que están <strong className="font-semibold text-texto">hoy</strong> en
            el cupo. El informe de Reservas cuenta además a quien llegó a
            inscribirse y después se retiró, porque esa es la cifra que entra en
            el reporte al SENA: por eso allá el número puede ser mayor.
          </p>

          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.78125rem]">
            <Link
              href="/admin/control?pantalla=reservas"
              className="font-semibold text-marca underline underline-offset-2"
            >
              Ver el informe de Reservas, institución por institución
            </Link>
            <Link
              href="/admin/ocupacion"
              className="font-semibold text-marca underline underline-offset-2"
            >
              Ver la ocupación contra la meta
            </Link>
          </p>
        </div>
      )}
    </Bloque>
  );
}
