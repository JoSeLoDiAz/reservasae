"use client";

/** Todo el paso por el aula, de matriculado a certificado. */

/**
 * TRES bloques, y ese es el punto.
 *
 * La primera versión tenía once, y se veía como once pantallas
 * pegadas: dos donuts que contaban lo mismo que las tarjetas de
 * estado de arriba, tres listas sueltas de «por acción», «por
 * grupo» y «por asesor» —que son la misma pregunta cortada de
 * tres maneras—, y una tabla de desglose que repetía lo que ya
 * dice el acordeón del final.
 *
 * Ahora cada bloque responde UNA pregunta, en el orden en que
 * se hacen:
 *
 *   1. ¿Cómo va el recorrido y dónde se cae la gente?
 *   2. ¿A qué hay que meterle mano esta semana?
 *   3. ¿Dónde se está quedando: qué curso, qué grupo, quién?
 *
 * Los cortes de dentro van con `plano` --sin borde ni franja--
 * a propósito: los que responden a la misma pregunta van en un
 * solo bloque con su rótulo, no en tres cajas con tres bordes.
 *
 * No pide nada nuevo al servidor. Todo sale de `personas[]`.
 */

import { useMemo } from "react";

import { colorEtapa } from "./etapa";
import { EmbudoProceso, type Hito, type NotaDelEmbudo } from "./embudo-proceso";
import {
  ListaBarras,
  n,
  Tasa,
  Termometro,
  type Tono,
  type TramoTermometro,
} from "./graficos";
import { Bloque } from "./piezas";
import { type Academico, type FilaAcademica } from "@/lib/crm-api";

/// Cuánto lleva sin entrar, en tramos.
///
/// Los cortes no son redondos por gusto: a los 3 días todavía
/// es un fin de semana largo, a los 8 ya es una semana entera
/// sin abrir el aula, y de 15 en adelante casi nadie vuelve
/// solo. El tono dice a cuál hay que llamar.
const TRAMOS: Array<{
  etiqueta: string;
  tono: Tono;
  cabe: (dias: number) => boolean;
}> = [
  { etiqueta: "Esta semana", tono: "bueno", cabe: (d) => d <= 2 },
  { etiqueta: "3 a 7 días", tono: "normal", cabe: (d) => d >= 3 && d <= 7 },
  { etiqueta: "8 a 15 días", tono: "aviso", cabe: (d) => d >= 8 && d <= 15 },
  { etiqueta: "Más de 15 días", tono: "malo", cabe: (d) => d > 15 },
];

export function PanelAcademico({ datos }: { datos: Academico }) {
  const { personas, resumen, criterio } = datos;

  /// Quien se fue no cuenta en el recorrido: su avance quedó
  /// congelado el día que dejó de entrar, y mezclarlo con quien
  /// sigue dentro haría que el aula pareciera más atrasada de
  /// lo que está.
  const dentro = useMemo(() => personas.filter((p) => !p.salio), [personas]);

  const hitos: Hito[] = useMemo(() => {
    const r = resumen;
    return [
      { etapa: "INSCRITO", etiqueta: "Matriculados", total: r.analizadas },
      {
        etapa: "CONTACTADO",
        etiqueta: "Entraron al aula",
        total: r.analizadas - r.sinIngreso,
      },
      {
        etapa: "EN_FORMACION",
        etiqueta: "Con alguna actividad",
        total: r.analizadas - r.sinIngreso - r.sinEmpezar,
      },
      {
        etapa: "DATOS_COMPLETOS",
        etiqueta: "Al día o mejor",
        total: r.alDia + r.completados + r.certificados,
      },
      {
        etapa: "CERTIFICADO",
        etiqueta: "Listos para certificar",
        total: r.completados + r.certificados,
      },
      { etapa: "CERTIFICADO", etiqueta: "Certificados", total: r.certificados },
    ];
  }, [resumen]);

  /// Los que se cayeron, con el porqué. Van como notas del
  /// embudo y no como bloque aparte: no son un paso del camino,
  /// son las cuatro puertas por las que se sale de él.
  const notas: NotaDelEmbudo[] = useMemo(
    () =>
      (
        [
          {
            cifra: resumen.desertaron,
            etiqueta: "Desertaron",
            detalle: "Avisaron que se iban.",
            tono: "aviso",
          },
          {
            cifra: resumen.abandonaron,
            etiqueta: "Abandonaron",
            detalle: "Dejaron de entrar, sin avisar.",
            tono: "error",
          },
          {
            cifra: resumen.retirados,
            etiqueta: "Retirados",
            detalle: "Se les dio de baja del grupo.",
            tono: "neutro",
          },
          {
            cifra: resumen.noAprobaron,
            etiqueta: "No aprobaron",
            detalle: "Terminaron sin alcanzar el mínimo.",
            tono: "error",
          },
        ] as NotaDelEmbudo[]
      ).filter((x) => x.cifra > 0),
    [resumen],
  );

  const porAccion = useMemo(() => avanceMedio(dentro, (p) => p.accion), [dentro]);

  const porGrupo = useMemo(
    () =>
      avanceMedio(dentro, (p) =>
        p.grupo === null ? null : `${etiquetaCorta(p.accion)} · gr. ${p.grupo}`,
      ),
    [dentro],
  );

  const porAsesor = useMemo(
    () => alDia(dentro, (p) => p.asesor?.nombre ?? null),
    [dentro],
  );

  const tramos: TramoTermometro[] = useMemo(() => {
    /// Solo quien YA entró alguna vez: a quien nunca ha entrado
    /// no se le cuentan días sin volver, se le cuenta que no ha
    /// empezado. Ese ya sale arriba, en «Sin ingreso».
    const conAcceso = dentro.filter((p) => p.diasSinEntrar !== null);

    return TRAMOS.map((t) => ({
      etiqueta: t.etiqueta,
      tono: t.tono,
      total: conAcceso.filter((p) => t.cabe(p.diasSinEntrar as number)).length,
    })).filter((t) => t.total > 0);
  }, [dentro]);

  const vencidos = useMemo(() => porFecha(dentro, "vencidos"), [dentro]);
  const arrancan = useMemo(() => porFecha(dentro, "arrancan"), [dentro]);

  const entraron = resumen.analizadas - resumen.sinIngreso;
  const enRiesgo = resumen.sinIngreso + resumen.atrasados;
  const salieron =
    resumen.desertaron +
    resumen.abandonaron +
    resumen.retirados +
    resumen.noAprobaron;

  return (
    <div className="flex flex-col gap-3">
      {/* ── 1 · Cómo va el recorrido ── */}
      <Bloque
        titulo="El paso por el aula, hito a hito"
        descripcion="Cuántos llegan a cada punto y cuántos se caen entre uno y otro. Empieza donde acaba el embudo de inscripción."
      >
        <EmbudoProceso hitos={hitos} notas={notas} />

        {/* Las tres tasas, DENTRO del embudo y no en su propio
            bloque: son la lectura del mismo dibujo, no otra
            cosa que mirar. */}
        <div className="mt-5 grid gap-5 border-t border-hairline pt-4 sm:grid-cols-3">
          <Tasa
            titulo="Entraron al aula"
            parte={entraron}
            total={resumen.analizadas}
            detalle="De los matriculados, cuántos la han abierto al menos una vez."
          />
          <Tasa
            titulo="Van al día o mejor"
            parte={resumen.alDia + resumen.completados + resumen.certificados}
            total={Math.max(entraron, 1)}
            detalle={`Contra el calendario de su grupo, con ${criterio.tolerancia} actividades de tolerancia.`}
          />
          <Tasa
            titulo="Se fueron"
            parte={salieron}
            total={resumen.total}
            tono="malo"
            detalle="Deserción, abandono, retiro y no aprobados, sobre el total."
          />
        </div>
      </Bloque>

      {/* ── 2 · Lo accionable ── */}
      <Bloque
        titulo="Qué hay que atender"
        descripcion="Lo único de esta pantalla que se resuelve con una llamada."
      >
        <Bloque plano titulo="Cuánto llevan sin entrar al aula">
          <Termometro
            tramos={tramos}
            vacio="Nadie con acceso registrado todavía."
          />
          {enRiesgo > 0 && (
            <p className="mt-3 text-[0.78125rem] text-texto-suave">
              Hoy hay <strong className="text-aviso">{n(enRiesgo)}</strong>{" "}
              {enRiesgo === 1 ? "persona" : "personas"} que necesitan una llamada:{" "}
              {n(resumen.sinIngreso)} que nunca han entrado y{" "}
              {n(resumen.atrasados)} que van atrasadas. Se considera parado a los{" "}
              {criterio.diasParado} días sin volver.
            </p>
          )}
        </Bloque>

        {(vencidos.length > 0 || arrancan.length > 0) && (
          <div className="mt-6 grid gap-6 border-t border-hairline pt-5 sm:grid-cols-2">
            <Bloque
              plano
              titulo="Grupos vencidos con gente dentro"
              descripcion="Ya pasó su fecha de fin. O se cierra el grupo, o se le mueve la fecha: mientras siga así, esa gente sale «atrasada» contra un calendario que ya venció."
            >
              <ListaBarras
                datos={vencidos}
                maximoFilas={6}
                vacio="Ninguno vencido. Bien."
              />
            </Bloque>

            <Bloque
              plano
              titulo="Grupos que arrancan"
              descripcion="Empiezan en los próximos 30 días. A esta gente todavía no se le puede exigir ritmo."
            >
              <ListaBarras
                datos={arrancan}
                maximoFilas={6}
                vacio="Ninguno arranca este mes."
              />
            </Bloque>
          </div>
        )}
      </Bloque>

      {/* ── 3 · Dónde se está quedando ── */}
      <Bloque
        titulo="Dónde se está quedando"
        descripcion="La misma pregunta cortada de tres maneras. En las tres, arriba va lo que hay que mirar."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Bloque plano titulo="Por acción de formación" descripcion="Avance medio">
            <ListaBarras
              datos={porAccion}
              sufijo=" %"
              maximoFilas={8}
              vacio="Sin avance registrado."
            />
          </Bloque>

          <Bloque plano titulo="Por grupo" descripcion="Avance medio">
            <ListaBarras
              datos={porGrupo}
              sufijo=" %"
              maximoFilas={8}
              vacio="Sin avance registrado."
            />
          </Bloque>

          <Bloque plano titulo="Por asesor" descripcion="Cuántos de los suyos van al día">
            <ListaBarras
              datos={porAsesor}
              sufijo=" %"
              maximoFilas={8}
              vacio="Nadie con asesor asignado."
            />
          </Bloque>
        </div>
      </Bloque>
    </div>
  );
}

// ─────────────────────────── cálculos ───────────────────────

/// «AF8 · Gestión de la atención» -> «AF8». En una columna de
/// un tercio de ancho, el nombre entero del curso deja fuera lo
/// que identifica la fila, que es el grupo.
function etiquetaCorta(accion: string | null): string {
  if (!accion) return "Sin acción";
  return accion.split(" · ")[0];
}

/// El avance medio por grupo de filas, redondeado.
function avanceMedio(
  filas: FilaAcademica[],
  clave: (f: FilaAcademica) => string | null,
): Array<{ clave: string; etiqueta: string; valor: number; detalle: string }> {
  const cubos = new Map<string, number[]>();
  for (const f of filas) {
    const k = clave(f);
    if (k === null) continue;
    const lista = cubos.get(k) ?? [];
    lista.push(f.porcentaje);
    cubos.set(k, lista);
  }

  return [...cubos.entries()]
    .map(([etiqueta, valores]) => ({
      clave: etiqueta,
      etiqueta,
      valor: Math.round(valores.reduce((a, b) => a + b, 0) / valores.length),
      detalle: `${n(valores.length)} ${valores.length === 1 ? "persona" : "personas"}`,
    }))
    .sort((a, b) => a.valor - b.valor);
}

/// Qué porcentaje de cada grupo va al día o mejor.
function alDia(
  filas: FilaAcademica[],
  clave: (f: FilaAcademica) => string | null,
): Array<{ clave: string; etiqueta: string; valor: number; detalle: string }> {
  const cubos = new Map<string, { total: number; bien: number }>();
  for (const f of filas) {
    const k = clave(f) ?? "Sin asesor";
    const c = cubos.get(k) ?? { total: 0, bien: 0 };
    c.total += 1;
    if (f.estado === "AL_DIA" || f.estado === "COMPLETADO" || f.estado === "CERTIFICADO") {
      c.bien += 1;
    }
    cubos.set(k, c);
  }

  return [...cubos.entries()]
    .map(([etiqueta, c]) => ({
      clave: etiqueta,
      etiqueta,
      valor: Math.round((c.bien / c.total) * 100),
      detalle: `${n(c.bien)} de ${n(c.total)}`,
    }))
    .sort((a, b) => a.valor - b.valor);
}

/**
 * Grupos por su calendario: los vencidos y los que arrancan.
 *
 * Cuenta PERSONAS y no grupos, porque es lo que dice el tamaño
 * del problema: un grupo vencido con una persona dentro se
 * resuelve con una llamada, y uno con veinte es otra cosa.
 */
function porFecha(
  filas: FilaAcademica[],
  cual: "vencidos" | "arrancan",
): Array<{ clave: string; etiqueta: string; valor: number; detalle: string }> {
  const ahora = Date.now();
  const EN_30_DIAS = 30 * 86_400_000;

  const cubos = new Map<string, { total: number; fecha: number }>();

  for (const f of filas) {
    if (f.grupo === null) continue;

    const inicio = f.fechaInicio ? new Date(f.fechaInicio).getTime() : null;
    const fin = f.fechaFin ? new Date(f.fechaFin).getTime() : null;

    if (cual === "vencidos") {
      // ya terminó el calendario y esta persona no ha acabado
      if (fin === null || fin >= ahora) continue;
      if (f.estado === "CERTIFICADO" || f.estado === "COMPLETADO") continue;
    } else {
      if (inicio === null || inicio <= ahora) continue;
      if (inicio - ahora > EN_30_DIAS) continue;
    }

    const k = `${etiquetaCorta(f.accion)} · gr. ${f.grupo}`;
    const c = cubos.get(k) ?? {
      total: 0,
      fecha: (cual === "vencidos" ? fin : inicio) ?? 0,
    };
    c.total += 1;
    cubos.set(k, c);
  }

  return [...cubos.entries()]
    .map(([etiqueta, c]) => ({
      clave: etiqueta,
      etiqueta,
      valor: c.total,
      detalle:
        (cual === "vencidos" ? "terminó el " : "arranca el ") +
        new Date(c.fecha).toLocaleDateString("es-CO", {
          day: "numeric",
          month: "short",
        }),
    }))
    .sort((a, b) => b.valor - a.valor);
}
