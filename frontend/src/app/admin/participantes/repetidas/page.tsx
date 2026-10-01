"use client";

/** «Unir fichas»: la misma persona en dos acciones de formación. */

/**
 * Lo pidió el cliente el 1 oct 2026, al encontrar a una persona dos
 * veces en Gestión de leads ---en AF2 con una asesora y en AF6 con
 * otra, las dos llamándola---:
 *
 *   «La única opción es crear una herramienta de unificación para esos
 *   casos, y dejar el lead de acuerdo a qué AF realmente va a elegir, y
 *   fusionar los datos, pero teniendo la posibilidad de CÓMO
 *   fusionarlos».
 *
 * Y eso es exactamente lo que esta pantalla pregunta, en ese orden:
 * primero A CUÁL VA, y después, campo por campo, DE CUÁL SALE CADA
 * DATO. No hay un botón de «unir y ya»: la decisión es suya.
 *
 * LO QUE NO SE PREGUNTA, porque no se pierde: las notas de gestión de
 * las dos, el historial de etapas y de dónde llegó el lead se mueven
 * enteros a la que queda. Se dice en pantalla para que nadie dude.
 *
 * LO QUE SÍ SE PIERDE SE AVISA ANTES DE PULSAR: el avance del aula de
 * la ficha que se absorbe. Las actividades son de ese curso, y
 * llevarlas a la otra inventaría progreso en uno que no cursó.
 *
 * POR QUÉ ESTA PANTALLA EXISTE Y NO BASTA CON HABERLO BLINDADO: desde
 * el 1 oct 2026 las tres puertas aplican «solo una acción de
 * formación», así que no entran casos nuevos. Pero los que ya estaban
 * no se arreglan solos, y a mano cuesta: hay que mover las notas de
 * una a otra sin perder ninguna.
 */

import { useCallback, useState } from "react";

import { Boton } from "@/components/admin/marco-admin";
import { Desplegable } from "@/components/admin/desplegable";
import { Encabezado, Bloque, Cargando, Vacio } from "@/components/admin/piezas";
import { conPermiso } from "@/components/admin/puerta-de-pantalla";
import { crmApi, type FichaRepetida, type PersonaRepetida } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/**
 * Los campos que se pueden traer de una ficha a la otra.
 *
 * Es la misma lista que `CAMPOS_FUSIONABLES` del servidor, y el
 * servidor IGNORA lo que no esté en la suya: aquí solo se eligen los
 * que una persona puede decidir mirando la pantalla. Los demás
 * ---nivel ocupacional del SEP, campaña de entrada--- los trae el
 * servidor si se piden, pero no se ofrecen porque nadie los compara a
 * ojo.
 */
const ELEGIBLES = [
  { campo: "etapa", titulo: "Etapa" },
  { campo: "asesorId", titulo: "Asesora" },
  { campo: "empresaId", titulo: "Organización" },
  { campo: "cargoEnEmpresa", titulo: "Cargo" },
] as const;

/// Qué enseña cada campo de una ficha, para compararlas de un vistazo.
function valorDe(f: FichaRepetida, campo: string): string {
  if (campo === "etapa") return f.etapa;
  if (campo === "asesorId") return f.asesor ?? "sin asesora";
  if (campo === "empresaId") return f.empresa ?? "sin organización";
  return "—";
}

function Repetidas() {
  /**
   * EL AVISO DE «SE UNIERON» VIVE AQUÍ, NO EN LA TARJETA.
   *
   * Lo estaba en la tarjeta, y al unir la tarjeta DESAPARECE ---ya no
   * hay caso que mostrar---, así que el mensaje se iba con ella: uno
   * pulsaba y no alcanzaba a leer qué se había movido. Lo encontré
   * ejercitando la pantalla, no leyéndola.
   */
  const [hecho, setHecho] = useState<string | null>(null);
  const vivos = useDatosVivos(useCallback(() => crmApi.repetidas(), []), {
    clave: "repetidas",
  });
  const gente = vivos.datos;

  if (!gente) return <Cargando />;

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6 [&>header]:mx-0 [&>header]:mb-0">
      <Encabezado compacto titulo="Unir fichas repetidas" />

      {hecho && (
        <p className="rounded-lg border border-exito/30 bg-exito-suave px-4 py-2.5 text-[0.8125rem] text-exito">
          {hecho}
        </p>
      )}

      {gente.length === 0 ? (
        <Vacio titulo="Nadie está repetido">
          Ninguna persona aparece en más de una acción de formación. Desde el 1 de
          octubre el sistema no deja crear la segunda, así que esta lista debería
          quedarse vacía.
        </Vacio>
      ) : (
        gente.map((p) => (
          <Caso
            key={p.personaId}
            persona={p}
            alUnir={(mensaje) => {
              setHecho(mensaje);
              vivos.refrescar();
            }}
          />
        ))
      )}
    </div>
  );
}

function Caso({
  persona,
  alUnir,
}: {
  persona: PersonaRepetida;
  alUnir: (mensaje: string) => void;
}) {
  /// La que se queda nace siendo la MÁS ANTIGUA y con más gestión: es
  /// la que más cuesta rehacer si se elige mal. Se puede cambiar.
  const [conservarId, setConservarId] = useState(
    [...persona.fichas].sort((a, b) => b.notas - a.notas)[0]?.id ?? "",
  );
  const [deDonde, setDeDonde] = useState<Record<string, string>>({});
  const [uniendo, setUniendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conservar = persona.fichas.find((f) => f.id === conservarId);
  const otras = persona.fichas.filter((f) => f.id !== conservarId);

  /// Lo que se pierde si se pulsa: el avance de las que se absorben.
  const avancesQueSePierden = otras.reduce((t, f) => t + f.avances, 0);
  const notasQueSeMueven = otras.reduce((t, f) => t + f.notas, 0);

  async function unir(absorberId: string) {
    setUniendo(true);
    setError(null);
    try {
      const r = await crmApi.unirFichas(conservarId, absorberId, deDonde);
      alUnir(
        `${persona.nombre}: queda en ${r.seQueda ?? "su acción"} y se absorbió ` +
          `${r.seAbsorbio ?? "la otra"}. Se movieron ${r.notas} notas y ` +
          `${r.movimientos} movimientos de etapa.` +
          (r.avancesQueSePierden > 0
            ? ` Se perdieron ${r.avancesQueSePierden} avances del aula.`
            : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo unir.");
    } finally {
      setUniendo(false);
    }
  }

  return (
    <Bloque
      titulo={persona.nombre}
      descripcion={`Documento ${persona.documento}${persona.correo ? ` · ${persona.correo}` : ""} · ${persona.fichas.length} fichas`}
    >
      <div className="space-y-4">
        {/* PRIMERO: A CUÁL VA DE VERDAD. Es la decisión que manda, y
            por eso va arriba y sola: las demás solo tienen sentido
            después de esta. */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[0.8125rem] font-medium text-titulo">
            Se queda en:
          </span>
          <div className="min-w-[18rem]">
            <Desplegable
              alto={38}
              etiquetaAria="A qué acción de formación va"
              valor={conservarId}
              opciones={persona.fichas.map((f) => ({
                valor: f.id,
                etiqueta: `${f.codigo ?? "sin código"} · ${f.etapa}`,
                detalle: `${f.asesor ?? "sin asesora"} · ${f.notas} notas`,
              }))}
              alElegir={setConservarId}
            />
          </div>
        </div>

        {/* DESPUÉS: DE CUÁL SALE CADA DATO. Solo los campos en los que
            las dos fichas DIFIEREN: ofrecer una casilla para elegir
            entre dos valores iguales es pedirle a alguien que decida
            algo que no es una decisión. */}
        {conservar && otras.length === 1 && (
          <div className="rounded-xl border border-borde">
            <div className="grid grid-cols-[8rem_1fr_1fr] gap-3 border-b border-borde bg-superficie-alterna px-4 py-2 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-texto-suave">
              <span>Dato</span>
              <span>{conservar.codigo ?? "la que se queda"}</span>
              <span>{otras[0].codigo ?? "la que se absorbe"}</span>
            </div>
            {ELEGIBLES.filter(
              (c) => valorDe(conservar, c.campo) !== valorDe(otras[0], c.campo),
            ).map((c) => {
              const traida = deDonde[c.campo] === otras[0].id;
              return (
                <div
                  key={c.campo}
                  className="grid grid-cols-[8rem_1fr_1fr] items-center gap-3 border-t border-hairline px-4 py-2 text-[0.8125rem] first:border-t-0"
                >
                  <span className="text-texto-suave">{c.titulo}</span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`${persona.personaId}-${c.campo}`}
                      checked={!traida}
                      onChange={() =>
                        setDeDonde((d) => {
                          const n = { ...d };
                          delete n[c.campo];
                          return n;
                        })
                      }
                      className="h-4 w-4 accent-marca"
                    />
                    {valorDe(conservar, c.campo)}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`${persona.personaId}-${c.campo}`}
                      checked={traida}
                      onChange={() =>
                        setDeDonde((d) => ({ ...d, [c.campo]: otras[0].id }))
                      }
                      className="h-4 w-4 accent-marca"
                    />
                    {valorDe(otras[0], c.campo)}
                  </label>
                </div>
              );
            })}
            {ELEGIBLES.every(
              (c) => valorDe(conservar, c.campo) === valorDe(otras[0], c.campo),
            ) && (
              <p className="px-4 py-3 text-[0.8125rem] text-texto-suave">
                Las dos fichas dicen lo mismo en todo: no hay nada que elegir.
              </p>
            )}
          </div>
        )}

        {/* QUÉ VA A PASAR, ANTES DE PULSAR. Lo que se mueve y lo que se
            pierde, con su número: una herramienta que destruye algo
            tiene que decirlo antes, no después. */}
        <p className="text-[0.8125rem] text-texto-suave">
          Se moverán <strong className="text-titulo">{notasQueSeMueven}</strong>{" "}
          notas de gestión, con su historial y su origen.
          {avancesQueSePierden > 0 && (
            <>
              {" "}
              Se perderán{" "}
              <strong className="text-aviso">{avancesQueSePierden}</strong>{" "}
              avances del aula de la acción que se abandona: las actividades son
              de ese curso.
            </>
          )}
        </p>

        {error && <p className="text-[0.8125rem] text-error">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {otras.map((f) => (
            <Boton
              key={f.id}
              onClick={() => void unir(f.id)}
              disabled={uniendo || !conservarId}
            >
              {uniendo
                ? "Uniendo…"
                : `Absorber ${f.codigo ?? "la otra"} en ${conservar?.codigo ?? "la elegida"}`}
            </Boton>
          ))}
        </div>

        {/* CON TRES O MÁS se une de a dos, y se dice: el cliente tiene
            un caso con tres acciones. Unir las tres de una vez
            escondería dos decisiones distintas detrás de un botón. */}
        {otras.length > 1 && (
          <p className="text-[0.71875rem] text-texto-suave">
            Hay más de dos fichas: se unen de a una, y después vuelve a
            aparecer con las que queden.
          </p>
        )}
      </div>
    </Bloque>
  );
}

/// Mismo candado que el servidor ---administrador---, porque unir QUITA
/// una participación. Esconder el botón no impide la llamada: la
/// cerradura de verdad está en el controlador.
export default conPermiso("inscripciones", "ESCRIBIR", Repetidas);
