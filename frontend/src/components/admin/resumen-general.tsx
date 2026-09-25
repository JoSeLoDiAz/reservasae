"use client";

/** El Resumen General: siete cifras macro, con una barra por acción de formación. */

/**
 * EL BLOQUE 1 DE CONTROL DE INSCRITOS (cliente, 23 sep 2026).
 *
 * Lo pidió con estas palabras: «los gráficos son de lo macro, por
 * acción de formación», y dictó las siete cifras. Aquí están en el
 * orden en que las dictó, que es el orden en que se leen: primero
 * cuánta gente entró, luego si sus datos sirven, luego dónde está.
 *
 * POR QUÉ SIETE TARJETAS Y NO UN GRÁFICO CON SIETE SERIES. Siete
 * series sobre las mismas siete acciones son 49 barras en un dibujo:
 * para saber si AF3 va bien hay que encontrar su color en la leyenda
 * y volver. Una tarjeta por cifra responde de un vistazo a la
 * pregunta que la tarjeta lleva escrita, y las siete juntas caben en
 * dos filas.
 *
 * QUÉ SIGNIFICA CADA UNA, y por qué no todas suman igual, está en
 * `backend/src/crm/resumen-general.ts`, que es donde se cuentan. En
 * corto: «completos + parciales» es un corte de la misma gente, y
 * «en proceso + sin gestión + inscritos + no interesados» es otro.
 * El pie del bloque lo dice, porque es la primera pregunta que hace
 * cualquiera que sume dos columnas.
 */

import { useCallback, useMemo } from "react";

import { crmApi, type FilaResumenGeneral, type Filtros } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { n } from "./graficos";
import { Aviso } from "./marco-admin";
import { Bloque, Esqueleto, Vacio } from "./piezas";

/// Las siete, en el orden que dictó el cliente. `color` es la
/// variable de tema, no un literal: en oscuro las siete cambian
/// solas y ninguna se queda ilegible.
const CIFRAS: Array<{
  clave: keyof Pick<
    FilaResumenGeneral,
    | "leads"
    | "datosCompletos"
    | "datosParciales"
    | "enProceso"
    | "sinGestion"
    | "inscritos"
    | "noInteresados"
  >;
  titulo: string;
  pie: string;
  color: string;
}> = [
  {
    clave: "leads",
    titulo: "Leads que entraron",
    pie: "Todas las personas registradas en esa acción.",
    color: "var(--marca)",
  },
  {
    clave: "datosCompletos",
    titulo: "Datos completos",
    pie: "No les falta ningún dato de los que pide el SENA.",
    color: "var(--exito)",
  },
  {
    clave: "datosParciales",
    titulo: "Datos parciales",
    pie: "Les falta al menos un dato para poder reportarlas.",
    color: "var(--aviso)",
  },
  {
    clave: "enProceso",
    titulo: "En proceso",
    pie: "Alguien del equipo ya las trabajó y siguen abiertas.",
    color: "var(--marca)",
  },
  {
    clave: "sinGestion",
    titulo: "Sin ninguna gestión",
    pie: "Nadie las ha llamado ni les ha dejado una nota.",
    color: "var(--error)",
  },
  {
    clave: "inscritos",
    titulo: "Total inscritos",
    pie: "Ya ocupan un cupo del grupo.",
    color: "var(--exito)",
  },
  {
    clave: "noInteresados",
    titulo: "Total no interesados",
    pie: "Dijeron que no, o no hubo forma de contactarlas.",
    color: "var(--texto-suave)",
  },
];

export function ResumenGeneral({ filtros }: { filtros?: Filtros }) {
  /// La clave lleva los filtros: sin ella, cambiar de departamento
  /// dejaba las barras del corte anterior hasta que volviera la
  /// respuesta, que es el «no concuerda» que el cliente ya señaló
  /// una vez en Tráfico.
  const clave = useMemo(() => JSON.stringify(filtros ?? {}), [filtros]);
  const cargar = useCallback(() => crmApi.resumenGeneral(filtros ?? {}), [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const vivos = useDatosVivos<FilaResumenGeneral[]>(cargar, {
    clave: `resumen-general:${clave}`,
  });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;

  const filas = vivos.datos;

  /// EL CÓDIGO, Y LA SIGLA SOLO SI HACE FALTA.
  ///
  /// Los dos gremios numeran sus acciones desde AF1, así que con los
  /// dos a la vista salían dos barras llamadas «AF1» y no había cómo
  /// saber cuál era de cuál. Poner la sigla siempre gastaría media
  /// tarjeta cuando solo se está mirando un gremio, que es lo normal.
  const repetidos = new Set(
    filas.map((f) => f.codigo).filter((c, i, todos) => todos.indexOf(c) !== i),
  );
  const rotulo = (f: FilaResumenGeneral) =>
    repetidos.has(f.codigo) && f.gremio ? `${f.codigo} · ${f.gremio}` : f.codigo;

  return (
    <Bloque
      titulo="Resumen General"
    >
      {filas.length === 0 ? (
        <Vacio titulo="Todavía no hay personas en ninguna acción">
          Aquí aparecen las cifras en cuanto entre el primer lead.
        </Vacio>
      ) : (
          <div
            className="grid gap-3"
            /// `auto-fit` con mínimo de 232 px: cuatro tarjetas en
            /// una pantalla ancha, dos en un portátil y una en el
            /// teléfono, sin un corte fijo que mantener.
            style={{ gridTemplateColumns: "repeat(auto-fit,minmax(232px,1fr))" }}
          >
            {CIFRAS.map((c) => (
              <TarjetaMacro key={c.clave} cifra={c} filas={filas} rotulo={rotulo} />
            ))}
          </div>
      )}
    </Bloque>
  );
}

/// Una tarjeta: su total arriba y una barra corta por acción.
function TarjetaMacro({
  cifra,
  filas,
  rotulo,
}: {
  cifra: (typeof CIFRAS)[number];
  filas: FilaResumenGeneral[];
  rotulo: (f: FilaResumenGeneral) => string;
}) {
  const total = filas.reduce((a, f) => a + f[cifra.clave], 0);
  /// El tope es la acción más alta DE ESTA tarjeta: cada tarjeta se
  /// lee sola, comparando sus propias acciones entre sí. Con un tope
  /// común a las siete, «Sin gestión» saldría con siete rayitas
  /// invisibles al lado de «Leads» y no diría nada.
  const tope = Math.max(...filas.map((f) => f[cifra.clave]), 1);

  return (
    <div className="rounded-lg border border-hairline bg-superficie-alterna/45 px-3.5 py-3">
      <p className="text-[0.6875rem] font-bold tracking-[0.06em] text-texto-suave uppercase">
        {cifra.titulo}
      </p>
      <p className="mt-0.5 text-[1.375rem] leading-none font-semibold tabular-nums text-titulo">
        {n(total)}
      </p>
      <p className="mt-1 text-[0.6875rem] leading-snug text-texto-suave">{cifra.pie}</p>

      <ul className="mt-2.5 space-y-1.5">
        {filas.map((f) => {
          const valor = f[cifra.clave];
          return (
            <li key={f.accionFormacionId}>
              <div className="flex items-baseline justify-between gap-2 text-[0.75rem]">
                {/* El código y no el nombre: siete nombres de curso
                    de cuarenta letras no caben en una tarjeta de 232
                    px, y el nombre entero va en el `title` y en la
                    tabla de abajo. */}
                <span
                  className="truncate font-mono text-texto-suave"
                  title={`${f.codigo} · ${f.nombre}`}
                >
                  {rotulo(f)}
                </span>
                <span className="shrink-0 tabular-nums">{n(valor)}</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-superficie-alterna">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(valor / tope) * 100}%`,
                    background: cifra.color,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
