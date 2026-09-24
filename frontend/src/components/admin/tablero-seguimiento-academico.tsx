"use client";

/** Seguimiento académico: el resumen del aula, sin nombres. */

/**
 * LO QUE PIDIÓ EL CLIENTE EL 23 DE SEPTIEMBRE DE 2026, con sus palabras:
 *
 *   «Filtro: acción de formación, grupos (individual o todo).
 *    Resumen: 1. acción de formación (seleccionable), 2. número de
 *    grupos, 3. total de beneficiarios por grupo matriculados,
 *    4. estados de cada uno de los participantes (general o por grupo).
 *    IMPORTANTE: no mostrar las personas, sino los resúmenes o
 *    cantidades».
 *
 * NO SE PINTA UNA SOLA FILA CON NOMBRE, y eso manda sobre todo lo
 * demás: esta pantalla es para mirar cómo va el proyecto en una
 * reunión, y una lista de quinientas personas con su documento
 * encima de la mesa es un problema de tratamiento de datos que nadie
 * pidió. Quien necesita a la persona entra por «Seguimiento del
 * aula», que es la pantalla de trabajo.
 *
 * SALE DEL MISMO SITIO QUE EL AULA --`crmApi.academico`--, a
 * propósito. Con una consulta propia, las dos pantallas darían cifras
 * parecidas y distintas, que es lo primero que hace desconfiar de un
 * panel. Las personas llegan y se cuentan aquí; no se enseñan.
 *
 * LOS ESTADOS LOS MANDA EL LMS. El asesor no los toca: lo suyo queda
 * en sus notas. Por eso aquí no hay ningún botón que cambie nada.
 */

import { useCallback, useMemo, useState } from "react";

import { crmApi, type Academico, type FilaAcademica } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { Desplegable } from "./desplegable";
import { colorEtapa } from "./etapa";
import { n } from "./graficos";
import { Aviso } from "./marco-admin";
import { Bloque, Encabezado, Esqueleto, Vacio } from "./piezas";

/// «AF1 · GESTIÓN DE LA ATENCIÓN…» llega en un solo texto, y el nombre
/// entero son noventa letras que se comen la primera columna de la
/// tabla. Aquí solo hace falta el código: el nombre ya está arriba, en
/// el desplegable y en la tarjeta de la acción elegida.
const soloElCodigo = (accion: string | null) =>
  accion ? (accion.split("·")[0]?.trim() ?? accion) : null;

/// TODOS es una opción de verdad y no «sin filtro»: el cliente lo dijo
/// así --«grupos (individual o todo)»-- y con el desplegable en blanco
/// nadie sabe si está viendo todo o si se le olvidó elegir.
const TODOS = "";

/// Los seis del aula, en el orden del recorrido: del que no entró al
/// que ya terminó. No por tamaño: el orden es el del proceso, y así la
/// fila se lee como un camino.
const ESTADOS = [
  { clave: "sinIngreso", etiqueta: "Sin ingreso", etapa: "PERDIDO" },
  { clave: "sinEmpezar", etiqueta: "Sin empezar", etapa: "CONTACTADO" },
  { clave: "atrasados", etiqueta: "Atrasado", etapa: "EN_FORMACION" },
  { clave: "alDia", etiqueta: "Al día", etapa: "CERTIFICADO" },
  { clave: "completados", etiqueta: "Listo para certificar", etapa: "INSCRITO" },
  { clave: "certificados", etiqueta: "Certificado", etapa: "CERTIFICADO" },
] as const;

/// Las cuatro salidas. Van aparte porque no son un punto del camino:
/// son cuatro maneras de bajarse de él, y mezclarlas con las de arriba
/// haría que la fila no sumara la gente del aula.
const SALIDAS = [
  { clave: "desertaron", etiqueta: "Desertó", etapa: "DESERTO" },
  { clave: "abandonaron", etiqueta: "Abandonó", etapa: "ABANDONO" },
  { clave: "retirados", etiqueta: "Retirado", etapa: "RETIRADO" },
  { clave: "noAprobaron", etiqueta: "No aprobó", etapa: "NO_APROBO" },
] as const;

export function TableroSeguimientoAcademico() {
  const [accionFormacionId, setAccion] = useState(TODOS);
  const [grupoId, setGrupo] = useState(TODOS);

  const filtros = useMemo(
    () => ({
      accionFormacionId: accionFormacionId || undefined,
      grupoId: grupoId || undefined,
    }),
    [accionFormacionId, grupoId],
  );
  const clave = `${accionFormacionId}|${grupoId}`;
  const cargar = useCallback(() => crmApi.academico(filtros), [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const vivos = useDatosVivos<Academico>(cargar, { clave: `tablero-academico:${clave}` });

  /// El catálogo sale de la MISMA respuesta, así que al elegir una
  /// acción el desplegable de grupos se queda solo con los suyos sin
  /// pedir nada más. Y los grupos se recortan a mano por si la
  /// respuesta trae los de todas.
  const acciones = vivos.datos?.acciones ?? [];
  const grupos = (vivos.datos?.grupos ?? []).filter(
    (g) => !accionFormacionId || g.accionFormacionId === accionFormacionId,
  );

  /// NO HACE FALTA SOLTAR EL GRUPO A MANO: el desplegable de la acción
  /// ya lo hace al cambiar (`alElegir`). Estuvo aquí como red de
  /// seguridad, primero suelto en el render y después en un efecto, y
  /// las dos formas son un cambio de estado durante el pintado: React
  /// lo canta en la consola y el linter lo rechaza. Una red que no
  /// atrapa nada y ensucia la consola no es una red.

  const accion = acciones.find((a) => a.id === accionFormacionId) ?? null;

  return (
    <div className="space-y-4">
      <Encabezado compacto titulo="Seguimiento académico" />

      {/* LOS DOS FILTROS, en su tarjeta y con el mismo alto que en las
          demás pantallas. */}
      <div className="rounded-xl border border-borde bg-superficie px-7 py-3">
        <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Filtros
          {vivos.datos && (
            <span className="ml-2.5 font-normal tracking-normal text-marca normal-case">
              <strong className="font-semibold tabular-nums">
                {n(vivos.datos.resumen.total)}
              </strong>{" "}
              {vivos.datos.resumen.total === 1 ? "persona matriculada" : "personas matriculadas"}
            </span>
          )}
        </p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}
        >
          <Desplegable
            alto={34}
            marcador="Acción de formación"
            etiquetaAria="Acción de formación"
            valor={accionFormacionId}
            opciones={[
              { valor: TODOS, etiqueta: "Todas las acciones" },
              ...acciones.map((a) => ({
                valor: a.id,
                etiqueta: `${a.codigo} · ${a.nombre}`,
              })),
            ]}
            alElegir={(v) => {
              setAccion(v);
              setGrupo(TODOS);
            }}
          />
          <Desplegable
            alto={34}
            marcador="Grupos"
            etiquetaAria="Grupo"
            valor={grupoId}
            opciones={[
              { valor: TODOS, etiqueta: "Todos los grupos" },
              ...grupos.map((g) => ({ valor: g.id, etiqueta: `Grupo ${g.numero}` })),
            ]}
            alElegir={setGrupo}
          />
        </div>
      </div>

      {vivos.error && <Aviso tipo="error">{vivos.error}</Aviso>}
      {!vivos.datos && !vivos.error && <Esqueleto />}

      {vivos.datos && (
        <Cuerpo datos={vivos.datos} accion={accion} grupoElegido={grupoId} />
      )}
    </div>
  );
}

function Cuerpo({
  datos,
  accion,
  grupoElegido,
}: {
  datos: Academico;
  accion: { id: string; codigo: string; nombre: string } | null;
  grupoElegido: string;
}) {
  const r = datos.resumen;
  if (r.total === 0) {
    return (
      <Vacio titulo="No hay nadie matriculado en este recorte">
        Pruebe con otra acción de formación, o con todos los grupos.
      </Vacio>
    );
  }

  /// Cuántos grupos entran en lo que se está mirando, y cuánta gente
  /// hay en cada uno. Se cuenta de las filas que ya llegaron --no se
  /// enseñan-- para no pedir una segunda consulta que podría dar otra
  /// cifra que la de arriba.
  const porGrupo = new Map<
    string,
    { llave: string; numero: number; accion: string | null; gente: number }
  >();
  for (const p of datos.personas as FilaAcademica[]) {
    const llave = `${p.accionFormacionId ?? "—"}|${p.grupo ?? "—"}`;
    /// EL CÓDIGO Y NO EL NOMBRE. `p.accion` trae el nombre entero de
    /// la acción --noventa letras-- y con él la primera columna se
    /// comía la tabla. El código identifica igual y cabe.
    const g =
      porGrupo.get(llave) ??
      { llave, numero: p.grupo ?? 0, accion: soloElCodigo(p.accion), gente: 0 };
    g.gente += 1;
    porGrupo.set(llave, g);
  }
  const grupos = [...porGrupo.values()].sort(
    (a, b) => (a.accion ?? "").localeCompare(b.accion ?? "") || a.numero - b.numero,
  );

  const salidas = r.desertaron + r.abandonaron + r.retirados + r.noAprobaron;

  return (
    <>
      {/* 1 y 2 · QUÉ SE ESTÁ MIRANDO Y CUÁNTO PESA */}
      <div className="grid gap-px rounded-xl border border-borde bg-hairline sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          rotulo="Acción de formación"
          valor={accion ? accion.codigo : "Todas"}
          pie={accion ? accion.nombre : `${n(datos.acciones.length)} en el aula`}
        />
        <Cifra
          rotulo="Grupos"
          valor={n(grupoElegido ? 1 : grupos.length)}
          pie={grupoElegido ? "el grupo elegido" : "con gente matriculada"}
        />
        <Cifra
          rotulo="Matriculados"
          valor={n(r.total)}
          pie={
            grupos.length > 0
              ? `${(r.total / grupos.length).toLocaleString("es-CO", { maximumFractionDigits: 1 })} por grupo de media`
              : "sin grupos"
          }
        />
        <Cifra
          rotulo="Siguen en formación"
          valor={n(r.enFormacion)}
          tono="exito"
          pie={salidas > 0 ? `${n(salidas)} salieron del aula` : "nadie ha salido"}
        />
      </div>

      {/* 4 · LOS ESTADOS, que los manda el LMS */}
      <Bloque
        titulo="En qué estado está la gente"
        descripcion="Lo dice el LMS, no el asesor. Los seis se cuentan solo sobre quien sigue dentro del aula."
      >
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ESTADOS.map((e) => (
            <Casilla
              key={e.clave}
              etiqueta={e.etiqueta}
              valor={r[e.clave]}
              color={colorEtapa(e.etapa)}
              sobre={r.enFormacion}
            />
          ))}
        </div>

        <p className="mt-3.5 border-t border-hairline pt-3 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Y quiénes salieron del aula
        </p>
        {/* CUATRO EN CUATRO COLUMNAS, del mismo alto que las seis de
            arriba. Eran cuatro cajas más altas, con frase debajo en
            tres de ellas y sin frase en la cuarta, así que la cifra de
            «No aprobó» quedaba a otra altura que sus vecinas. */}
        {/* EN LA MISMA REJILLA DE SEIS que las de arriba, aunque solo
            sean cuatro: así la casilla mide exactamente lo mismo en las
            dos filas. Con `grid-cols-4` las de abajo salían medio dedo
            más anchas y las dos filas no se leían como una sola cosa. */}
        <div className="mt-2.5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {SALIDAS.map((s) => (
            <Casilla
              key={s.clave}
              etiqueta={s.etiqueta}
              valor={r[s.clave]}
              color={colorEtapa(s.etapa)}
              sobre={r.total}
            />
          ))}
        </div>
      </Bloque>

      {/* 3 · CUÁNTA GENTE POR GRUPO, que es la carga real */}
      <Bloque
        sinRelleno
        titulo="Matriculados por grupo"
        descripcion="Cuánta gente lleva cada grupo. Sin nombres: para la persona está «Seguimiento del aula»."
      >
        <div className="caja-scroll overflow-x-auto">
          <table className="tabla-datos w-full">
            <thead>
              <tr>
                <th className="w-full">Grupo</th>
                <th className="text-right whitespace-nowrap">Matriculados</th>
                <th className="text-right whitespace-nowrap">Parte del total</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                /// LA LLAVE LLEVA EL ID DE LA ACCIÓN, no su código: los
                /// dos gremios tienen su «AF1», así que «AF1|1» sale dos
                /// veces y React se queja de claves repetidas.
                <tr key={g.llave}>
                  <td>
                    <span className="font-mono text-xs text-texto-suave">{g.accion ?? "—"}</span>
                    <span className="ml-2">Grupo {g.numero}</span>
                  </td>
                  <td className="text-right font-medium tabular-nums">{n(g.gente)}</td>
                  <td className="text-right tabular-nums">
                    {Math.round((g.gente / r.total) * 100)} %
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-borde font-semibold">
                <td>Total</td>
                <td className="text-right tabular-nums">{n(r.total)}</td>
                <td className="text-right tabular-nums">100 %</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Bloque>
    </>
  );
}

/// Una cifra de la tira de arriba. Todas del mismo alto, con el rótulo
/// arriba y el pie abajo, aunque el pie esté vacío.
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
    <div className="bg-superficie px-4 py-3">
      <p className="text-[0.625rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
        {rotulo}
      </p>
      <p
        className={`mt-1 truncate text-[1.375rem] leading-none font-semibold tabular-nums ${
          tono === "exito" ? "text-exito" : "text-titulo"
        }`}
        title={valor}
      >
        {valor}
      </p>
      <p className="mt-1.5 truncate text-[0.6875rem] text-texto-suave" title={pie}>
        {pie}
      </p>
    </div>
  );
}

/// Una casilla de estado: el punto de su color, el rótulo, la cifra y
/// qué parte del total es. Las diez miden lo mismo.
function Casilla({
  etiqueta,
  valor,
  color,
  sobre,
}: {
  etiqueta: string;
  valor: number;
  color: string;
  sobre: number;
}) {
  return (
    <div
      style={{ ["--etapa" as string]: color }}
      className="rounded-lg border border-borde bg-superficie px-3 py-2"
    >
      <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
        <span className="punto-etapa" aria-hidden />
        <span className="truncate text-texto-suave">{etiqueta}</span>
      </span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span className="text-lg leading-none font-bold tabular-nums">{n(valor)}</span>
        <span className="text-[0.6875rem] text-texto-suave tabular-nums">
          {sobre > 0 ? `${Math.round((valor / sobre) * 100)} %` : "—"}
        </span>
      </span>
    </div>
  );
}
