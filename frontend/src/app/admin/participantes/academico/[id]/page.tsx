"use client";

/**
 * EL PARTICIPANTE, UNO A UNO, DENTRO DE SEGUIMIENTO DEL AULA.
 *
 * «Te dije que Abrir lead es una visual de Seguimiento del aula,
 * como de resumen del participante, porque ya es el 1 a 1. ¿Por qué
 * me muestras la vista de Control de inscritos?» (cliente, 25 sep
 * 2026).
 *
 * El cajón lateral llevaba a `/admin/participantes/[id]`, que es la
 * ficha de Gestión de leads: otro módulo, otra cabecera, otra miga
 * ---«← Gestión de leads»--- y una pantalla que habla de etapas, de
 * habeas data y del formato SEP. Todo eso es verdad de la PERSONA,
 * pero quien viene del aula viene a mirar OTRA cosa: cómo va en el
 * curso.
 *
 * Esta pantalla es esa otra cosa. Vive en Académica, se lee de
 * arriba abajo como un resumen ---quién es, dónde está, cómo va,
 * qué se ha hecho con ella--- y no deja editar nada del aula: eso lo
 * manda el LMS.
 *
 * LO QUE NO HACE, y a propósito: no duplica la ficha. Los datos de
 * la persona ---su cédula, su empresa, su autorización--- siguen
 * viviendo en un solo sitio, y al final hay un enlace discreto para
 * ir allá. Dos pantallas editando los mismos datos es como acaban
 * diciendo cosas distintas.
 *
 * SE PIDE AL SERVIDOR aunque el cajón ya tuviera la fila: a esta
 * dirección se puede llegar pegando el enlace, y entonces no hay
 * ninguna lista de la que sacarla. La calcula `academico()`, el
 * mismo sitio que la lista, así que el estado de aquí no puede
 * discrepar del de la tabla.
 */

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { CajonDelAula } from "@/components/admin/cajon-del-aula";
import { colorEtapa } from "@/components/admin/etapa";
import { Aviso } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { CifraCompacta } from "@/components/admin/piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import { fechaDeCalendario } from "@/lib/dia-de-calendario";
import {
  type Academico,
  AYUDA_ACADEMICA,
  crmApi,
  type EstadoAcademico,
  ETIQUETA_ACADEMICA,
  type FilaAcademica,
} from "@/lib/crm-api";

const COLOR: Record<EstadoAcademico, string> = {
  SIN_INGRESO: colorEtapa("PERDIDO"),
  SIN_EMPEZAR: colorEtapa("CONTACTADO"),
  ATRASADO: colorEtapa("EN_FORMACION"),
  AL_DIA: colorEtapa("CERTIFICADO"),
  COMPLETADO: colorEtapa("INSCRITO"),
  CERTIFICADO: colorEtapa("CERTIFICADO"),
};

function instante(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaginaDelParticipante() {
  const { id } = useParams<{ id: string }>();

  const cargar = useCallback(() => crmApi.academicoDeUno(id), [id]);
  const vivos = useDatosVivos<Academico>(cargar, { clave: id });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto conCifras />;

  const fila = vivos.datos.personas[0];
  if (!fila) {
    return (
      <div className="px-4 pt-3">
        <Aviso tipo="error">
          Esta persona no está en el aula. Solo aparece aquí quien esté en
          formación en una acción virtual.{" "}
          <Link href="/admin/participantes/academico" className="underline">
            Volver a Seguimiento del aula
          </Link>
        </Aviso>
      </div>
    );
  }

  return <Resumen fila={fila} criterio={vivos.datos.criterio} />;
}

function Resumen({
  fila,
  criterio,
}: {
  fila: FilaAcademica;
  criterio: Academico["criterio"];
}) {
  /// EL CAJÓN SE REUTILIZA PARA ESCRIBIR NOTAS.
  ///
  /// Escribir una nota ya está resuelto ahí ---el canal, el
  /// resultado, la lista de lo anterior--- y copiarlo aquí sería la
  /// segunda copia del mismo formulario. Se abre desde el botón.
  const [enElCajon, setEnElCajon] = useState<FilaAcademica | null>(null);

  const hechas = fila.actividades.filter((a) => a.completada).length;

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      {/* LA MIGA DICE DE DÓNDE VIENE, y dice «Seguimiento del aula»
          y no «Gestión de leads»: es la diferencia que el cliente
          señaló. */}
      <Link
        href="/admin/participantes/academico"
        className="text-[0.78125rem] text-texto-suave no-underline hover:text-texto"
      >
        ← Seguimiento del aula
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            {fila.nombre}
          </h1>
          <p className="mt-0.5 text-[0.8125rem] text-texto-suave">
            <span className="font-mono">{fila.documento}</span>
            {fila.correo && <> · {fila.correo}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            style={{ ["--etapa"]: COLOR[fila.estado] } as React.CSSProperties}
            className="pildora-etapa"
            title={AYUDA_ACADEMICA[fila.estado]}
          >
            {ETIQUETA_ACADEMICA[fila.estado]}
          </span>
          <button
            type="button"
            onClick={() => setEnElCajon(fila)}
            className="inline-flex h-[34px] items-center rounded-lg bg-marca px-3.5 text-[0.78125rem] font-semibold text-marca-texto transition hover:bg-marca-fuerte sin-aro"
          >
            Registrar seguimiento
          </button>
        </div>
      </header>

      {/* ── 1 · Las cifras, arriba y al alto de la casa ── */}
      <div className="flex flex-wrap gap-2">
        <CifraCompacta
          etiqueta="Avance"
          valor={`${fila.porcentaje} %`}
          detalle={`${hechas} de ${fila.actividades.length}`}
          color={fila.porcentaje >= 80 ? "var(--exito)" : undefined}
        />
        <CifraCompacta
          etiqueta="Último ingreso al aula"
          valor={fila.ultimoAcceso ? instante(fila.ultimoAcceso) : "Nunca"}
          pie={
            fila.diasSinEntrar === null
              ? "No ha entrado ni una vez"
              : `Hace ${fila.diasSinEntrar} ${fila.diasSinEntrar === 1 ? "día" : "días"}`
          }
        />
        <CifraCompacta
          etiqueta="Días sin gestión"
          valor={String(fila.diasSinGestion)}
          detalle={fila.notas === 1 ? "1 nota" : `${fila.notas} notas`}
          color={fila.diasSinGestion >= 7 ? "var(--peligro)" : undefined}
          pie={
            fila.notas === 0
              ? "Nunca se le ha escrito: se cuenta desde que entró"
              : `Última: ${instante(fila.ultimaNota)}`
          }
        />
        <CifraCompacta
          etiqueta="Antigüedad del lead"
          valor={`${fila.diasDeAntiguedad} ${fila.diasDeAntiguedad === 1 ? "día" : "días"}`}
        />
      </div>

      {/* ── 2 · Dónde está ── */}
      <section className="rounded-xl border border-borde bg-superficie px-4 py-3.5">
        <h2 className="text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Dónde está
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Campo titulo="Acción de formación" valor={fila.accion} />
          <Campo
            titulo="Grupo"
            valor={fila.grupo === null ? null : `Grupo ${fila.grupo}`}
          />
          <Campo titulo="Departamento" valor={fila.departamento} />
          <Campo titulo="Asesor" valor={fila.asesor?.nombre ?? null} />
          <Campo
            titulo="Fechas del curso"
            valor={
              fila.fechaInicio
                ? `${fechaDeCalendario(fila.fechaInicio, { day: "2-digit", month: "short" })}${
                    fila.fechaFin
                      ? ` → ${fechaDeCalendario(fila.fechaFin, { day: "2-digit", month: "short", year: "2-digit" })}`
                      : ""
                  }`
                : null
            }
          />
          <Campo titulo="Horario" valor={fila.horario} />
          <Campo
            titulo="Nota final"
            valor={fila.notaFinal === null ? null : String(fila.notaFinal)}
          />
        </dl>
      </section>

      {/* ── 3 · Cómo va, actividad por actividad ── */}
      <section className="rounded-xl border border-borde bg-superficie px-4 py-3.5">
        <h2 className="text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Cómo va en el aula
        </h2>
        {/* DICE DE DÓNDE SALE Y POR QUÉ NO SE TOCA. Sin esta línea,
            quien ve una actividad sin marcar y no encuentra cómo
            marcarla piensa que la pantalla está rota. */}
        <p className="mt-1 text-[0.75rem] leading-snug text-texto-suave">
          Lo manda el aula y es la fuente de la verdad: aquí no se edita. Si algo
          no cuadra, se corrige allá y llega solo.
        </p>

        {fila.actividades.length === 0 ? (
          <p className="mt-3 text-sm text-texto-suave">
            Su acción de formación no tiene actividades cargadas todavía.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1.5">
            {fila.actividades.map((a) => (
              <li
                key={a.orden}
                className="flex items-center gap-3 rounded-lg border border-borde px-3 py-2"
              >
                <span
                  aria-hidden
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold ${
                    a.completada
                      ? "bg-exito text-[var(--superficie)]"
                      : "border border-borde text-texto-suave"
                  }`}
                >
                  {a.completada ? "✓" : a.orden}
                </span>
                <span className="min-w-0 grow truncate text-sm font-medium">
                  {a.titulo}
                </span>
                <span
                  className={`shrink-0 text-[0.78125rem] ${
                    a.completada ? "text-exito" : "text-texto-suave"
                  }`}
                >
                  {a.completada ? "Completada" : "Pendiente"}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* EL RITMO, en una frase y no en dos números sueltos. */}
        {fila.esperadas !== null && (
          <p className="mt-3 text-[0.8125rem] text-texto-suave">
            A estas alturas del curso tocarían{" "}
            <strong className="font-semibold text-texto tabular-nums">
              {fila.esperadas}
            </strong>
            :{" "}
            {fila.desfase !== null && fila.desfase < 0
              ? `va ${-fila.desfase} por debajo.`
              : "va al día."}{" "}
            Se certifica con el {Math.round(criterio.minimoParaCertificar * 100)} %
            de lo obligatorio.
          </p>
        )}
      </section>

      {/* LA FICHA DE LA PERSONA, al pie y sobria ---la misma pieza que
          usa el cajón de Gestión de leads---. Aquí vive lo del AULA;
          sus datos, su empresa y su autorización siguen viviendo en un
          solo sitio, y ese sitio es aquel. */}
      <div>
        <a
          href={`/admin/participantes/${fila.id}`}
          className="text-sm text-marca underline"
        >
          Ver sus datos personales y de empresa
        </a>
      </div>

      {enElCajon && (
        <CajonDelAula fila={enElCajon} alCerrar={() => setEnElCajon(null)} />
      )}
    </div>
  );
}

/** Un rótulo y su valor. La raya cuando no hay dato, nunca vacío. */
function Campo({ titulo, valor }: { titulo: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs tracking-wide text-texto-suave uppercase">
        {titulo}
      </dt>
      <dd className="mt-0.5 truncate" title={valor ?? undefined}>
        {valor ?? <span className="text-texto-suave">—</span>}
      </dd>
    </div>
  );
}
