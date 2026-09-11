"use client";

/** El lead, abierto de lado, sin perder la lista. */

/**
 * Por qué un cajón y no una página.
 *
 * Un asesor revisando su embudo abre ocho negocios seguidos. Con una
 * página, cada uno cuesta salir de la lista, esperar y volver — y al
 * volver se ha perdido el sitio, el filtro y el scroll. Con el cajón,
 * la lista sigue detrás: se mira, se cierra y se sigue por donde
 * iba. Ese es el gesto que hace que el CRM se use.
 *
 * La página completa también existe, en `/admin/oportunidades/[id]`,
 * porque una dirección que se pueda pegar en un WhatsApp hace falta:
 * «mira este negocio» tiene que poder mandarse.
 *
 * Es la pantalla donde un asesor pasa el día, así que la densidad y
 * la jerarquía importan más que en ninguna:
 *
 * - **Lo más grande del cajón es la plata**, a 34 px, y nada más
 *   puede serlo. Antes lo más grande era el título del negocio y el
 *   valor iba a 18, igual que la probabilidad y que la fecha: cuatro
 *   datos del mismo peso y ninguno mandaba.
 * - **El único color caliente es el reloj.** Ni una etapa en ámbar,
 *   ni un aviso de validación en rojo, ni una tarjeta teñida de
 *   rosa. Ver ámbar aquí significa que alguien lleva esperando, y no
 *   significa ninguna otra cosa.
 * - **Los bloques no llevan ni borde ni fondo**: se separan por 24
 *   px de aire y por su rótulo en versalita. Eran cinco rayas
 *   horizontales que partían el cajón en cinco pantallas pegadas.
 * - **Sin sombra.** El cajón flota por su borde de 1 px, que es lo
 *   único que separa en este panel.
 *
 * Cómo se escribe cada dato está en `datos-del-negocio.tsx`, que es
 * el mismo contrato que usa la lista de detrás. De
 * `docs/estilo-del-panel.md`: el color va en la LETRA —ni una
 * píldora, ni un rectángulo de color—, el radio es un token y no una
 * clase, y ni un párrafo que explique lo que ya se ve.
 */

import { useCallback, useEffect, useState } from "react";

import { Boton, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { IconoCerrar } from "@/components/admin/iconos";
import {
  Cliente,
  Codigo,
  Dinero,
  Etapa,
  Fecha,
  Porcentaje,
  Puerta,
  Reloj,
  Rotulo,
  Vacio,
  esperaVencida,
  Persona,
  relojEnTexto,
} from "@/components/admin/datos-del-negocio";
import { ErrorApi } from "@/lib/api";
import {
  oportunidadesApi,
  type EtapaOportunidad,
  type FichaDeOportunidad,
  type MotivoCierre,
} from "@/lib/oportunidades-api";

/// Los mismos rótulos que usa el backend. Una segunda lista de
/// nombres para lo mismo acaba discrepando: si un día se renombra
/// una etapa, esto se cambia en un solo sitio.
const ROTULO_ETAPA: Record<EtapaOportunidad, string> = {
  CAPTADO: "Captado",
  CONTACTADO: "Contactado",
  CALIFICADO: "Calificado",
  PROPUESTA_ENVIADA: "Propuesta enviada",
  EN_NEGOCIACION: "En negociación",
  GANADO: "Ganado",
  PERDIDO: "Perdido",
};

const ETAPAS_POR_EMBUDO: Record<string, EtapaOportunidad[]> = {
  EMPRESA: [
    "CAPTADO",
    "CONTACTADO",
    "CALIFICADO",
    "PROPUESTA_ENVIADA",
    "EN_NEGOCIACION",
    "GANADO",
    "PERDIDO",
  ],
  PERSONA: ["CAPTADO", "CONTACTADO", "CALIFICADO", "GANADO", "PERDIDO"],
};

const MOTIVOS_GANAR: Array<{ valor: MotivoCierre; rotulo: string }> = [
  { valor: "PRECIO_ACEPTADO", rotulo: "Aceptó el precio" },
  { valor: "UNICA_OPCION", rotulo: "Era la única opción" },
  { valor: "RECOMENDACION", rotulo: "Vino recomendado" },
];

const MOTIVOS_PERDER: Array<{ valor: MotivoCierre; rotulo: string }> = [
  { valor: "PRECIO_ALTO", rotulo: "Le pareció caro" },
  { valor: "SIN_PRESUPUESTO", rotulo: "No tenía presupuesto" },
  { valor: "SE_FUE_CON_OTRO", rotulo: "Se fue con otro" },
  { valor: "FUERA_DE_TIEMPO", rotulo: "Fuera de tiempo" },
  { valor: "NO_ERA_QUIEN_DECIDE", rotulo: "No era quien decide" },
  { valor: "NUNCA_RESPONDIO", rotulo: "Nunca respondió" },
  { valor: "NO_LE_INTERESA", rotulo: "No le interesa" },
  { valor: "DATOS_ERRADOS", rotulo: "Los datos estaban malos" },
  { valor: "OTRO", rotulo: "Otro" },
];

/**
 * Un fallo del servidor, sin caja y sin rojo.
 *
 * Era una tarjeta teñida de rosa con borde y radio. El rojo de este
 * panel significa UNA cosa —que alguien lleva esperando respuesta— y
 * un error de validación no es eso: repartirlo entre dos
 * significados es lo que hace que deje de verse.
 *
 * Queda el peso 600, que es el peso del resultado de algo, y el
 * mensaje tal cual lo manda el servidor: dice QUÉ falta —«falta el
 * valor», «diga por qué se cierra»—, que es lo que sirve.
 */
function Falla({ children }: { children: React.ReactNode }) {
  return <p className="estado mb-3">{children}</p>;
}

export function CajonOportunidad({
  id,
  alCerrar,
  alCambiar,
}: {
  id: string | null;
  alCerrar: () => void;
  /// Para que la lista de detrás se entere y se refresque. Sin
  /// esto, se cierra el cajón tras mover una etapa y la fila sigue
  /// diciendo la anterior.
  alCambiar?: () => void;
}) {
  const [ficha, setFicha] = useState<FichaDeOportunidad | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    setError(null);
    try {
      setFicha(await oportunidadesApi.ficha(id));
    } catch (e) {
      setError(
        e instanceof ErrorApi ? e.message : "No pudimos abrir el negocio.",
      );
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    setFicha(null);
    void cargar();
  }, [cargar]);

  /// Escape cierra. Es el gesto que espera cualquiera que abra algo
  /// encima de otra cosa, y no tenerlo obliga a buscar la equis.
  useEffect(() => {
    if (!id) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [id, alCerrar]);

  if (!id) return null;

  const quien =
    ficha?.empresa?.razonSocial ??
    (ficha?.persona
      ? `${ficha.persona.primerNombre} ${ficha.persona.primerApellido}`
      : null);

  return (
    <>
      {/* La lista de detrás se ve, atenuada: el cajón es una capa
          encima de donde uno estaba, no otro sitio. */}
      <div
        className="no-imprimir fixed inset-0 z-40 bg-black/25"
        onClick={alCerrar}
        aria-hidden="true"
      />
      {/* Borde de 1 px y NINGUNA sombra. El cajón es uno de los tres
          objetos del panel que llevan borde completo —el campo, el
          modal y la ficha del tablero son los otros—, y eso ya dice
          que flota. La sombra era lo único que levitaba en todo el
          producto. */}
      <aside
        className="no-imprimir fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-borde bg-superficie"
        role="dialog"
        aria-label="Negocio"
      >
        <header className="relative flex items-end gap-4 border-b border-borde px-4 pt-3 pr-12 pb-3">
          <div className="min-w-0 grow">
            {ficha ? (
              <>
                <div className="flex items-baseline gap-3">
                  <Codigo codigo={ficha.codigo} />
                  {/* El reloj solo si hay algo que mirar. Cuando
                      nadie espera, ese hueco se queda vacío y eso ya
                      es información. */}
                  {esperaVencida(
                    ficha.minutosPrimeraRespuesta,
                    ficha.embudo,
                  ) && (
                    <Reloj
                      minutos={ficha.minutosPrimeraRespuesta}
                      embudo={ficha.embudo}
                    />
                  )}
                </div>
                <h2
                  className="titulo-pantalla mt-1 line-clamp-2"
                  title={ficha.titulo}
                >
                  {ficha.titulo}
                </h2>
                <p className="secundario mt-1">
                  {quien ? <Cliente nombre={quien} /> : <Vacio />}
                </p>
                <div className="mt-2">
                  <Etapa etapa={ficha.etapa} rotulo={ROTULO_ETAPA[ficha.etapa]} />
                </div>
              </>
            ) : (
              <h2 className="titulo-pantalla">
                Negocio
              </h2>
            )}
          </div>

          {/* Lo más grande del cajón, siempre. */}
          {ficha && (
            <div className="shrink-0 text-right">
              <Rotulo>Valor</Rotulo>
              <span className="mt-1 block">
                <Dinero valor={ficha.valor} portada />
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="absolute top-3 right-3 rounded-lg p-1.5 text-texto-suave transition hover:bg-superficie-alterna hover:text-texto"
          >
            <IconoCerrar tamano={18} />
          </button>
        </header>

        <div className="min-h-0 grow overflow-y-auto px-4 py-4">
          {error && <Falla>{error}</Falla>}
          {cargando && !ficha && <Cargando que="Abriendo el negocio…" />}
          {ficha && (
            <div className="flex flex-col gap-6">
              <Cifras ficha={ficha} />
              <MoverEtapa
                ficha={ficha}
                alHecho={() => {
                  void cargar();
                  alCambiar?.();
                }}
              />
              <Contacto ficha={ficha} />
              <Anotar
                ficha={ficha}
                alHecho={() => {
                  void cargar();
                  alCambiar?.();
                }}
              />
              <Historial ficha={ficha} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/// Lo que acompaña a la plata: cuándo cierra, con qué confianza y
/// quién responde. Sin marcos: son tres datos, no tres objetos.
function Cifras({ ficha }: { ficha: FichaDeOportunidad }) {
  return (
    <section className="grid grid-cols-3 gap-x-6">
      <Dato rotulo="Probabilidad">
        {/* Gris significa «esto es un supuesto»: la que sale de la
            forma del embudo va apagada, la que alguien puso mirando
            el negocio va en el color del texto. Así se sabe qué
            número se puede llevar a una reunión. */}
        <Porcentaje
          valor={ficha.probabilidad}
          supuesto={!ficha.probabilidadPropia}
        />
        {/* Iba en ámbar, y el ámbar de este panel dice una sola
            cosa: que alguien lleva esperando. Que una cifra la
            pusiera una persona no es una alarma, es una nota al
            pie — y el gris de la propia cifra ya lo cuenta. */}
        {ficha.probabilidadPropia && (
          <span className="micro mt-0.5 block">puesta a mano</span>
        )}
      </Dato>
      <Dato rotulo="Cierre esperado">
        <Fecha iso={ficha.cierreEsperado} />
      </Dato>
      <Dato rotulo="Dueño">
        <Persona nombre={ficha.asesor?.nombre} />
      </Dato>
    </section>
  );
}

function Dato({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Rotulo>{rotulo}</Rotulo>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * Mover de etapa, que es la acción principal de esta pantalla.
 *
 * El motivo aparece SOLO al elegir ganado o perdido, y no antes: un
 * desplegable de motivos permanente sobre un negocio vivo invita a
 * llenarlo, y un motivo de cierre en algo que no se ha cerrado
 * ensucia el informe del que se supone que aprendemos.
 *
 * Cada botón lleva el punto de color de su etapa, así que la rampa
 * —de gris a azul profundo, y el verde solo en Ganado— se lee aquí
 * igual que en la lista. El elegido se rellena de `--marca`, que es
 * el único sitio del panel donde el azul de marca significa «esto
 * es lo que está seleccionado ahora mismo».
 */
function MoverEtapa({
  ficha,
  alHecho,
}: {
  ficha: FichaDeOportunidad;
  alHecho: () => void;
}) {
  const [a, setA] = useState<EtapaOportunidad | "">("");
  const [motivo, setMotivo] = useState<MotivoCierre | "">("");
  const [nota, setNota] = useState("");
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cierra = a === "GANADO" || a === "PERDIDO";
  const motivos = a === "GANADO" ? MOTIVOS_GANAR : MOTIVOS_PERDER;
  const etapas = (ETAPAS_POR_EMBUDO[ficha.embudo] ?? []).filter(
    (e) => e !== ficha.etapa,
  );

  async function mover(evento: React.FormEvent) {
    evento.preventDefault();
    if (!a) return;
    setYendo(true);
    setError(null);
    try {
      await oportunidadesApi.cambiarEtapa(ficha.id, {
        a,
        motivo: cierra && motivo ? motivo : undefined,
        nota: nota.trim() || undefined,
      });
      setA("");
      setMotivo("");
      setNota("");
      alHecho();
    } catch (e) {
      /// El mensaje del servidor dice QUÉ FALTA —«falta el valor»,
      /// «diga por qué se cierra»—, así que se enseña tal cual. Un
      /// «no se pudo» genérico obligaría a adivinar.
      setError(
        e instanceof ErrorApi ? e.message : "No pudimos moverla de etapa.",
      );
    } finally {
      setYendo(false);
    }
  }

  return (
    <section>
      <Rotulo>Mover de etapa</Rotulo>
      {error && (
        <div className="mt-2">
          <Falla>{error}</Falla>
        </div>
      )}
      <form onSubmit={mover} className="mt-2 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {etapas.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setA(a === e ? "" : e)}
              aria-pressed={a === e}
              className={`rounded-lg border px-3 py-1.5 transition ${
                a === e
                  ? "border-marca bg-marca font-semibold text-marca-texto"
                  : "border-borde hover:bg-superficie-alterna"
              }`}
            >
              {a === e ? (
                ROTULO_ETAPA[e]
              ) : (
                <Etapa etapa={e} rotulo={ROTULO_ETAPA[e]} />
              )}
            </button>
          ))}
        </div>

        {cierra && (
          <label className="block">
            <Rotulo>Por qué se cierra</Rotulo>
            <select
              value={motivo}
              onChange={(ev) => setMotivo(ev.target.value as MotivoCierre)}
              className={`ancho-nombre mt-1 ${CLASE_CONTROL}`}
            >
              <option value="">Elija el motivo…</option>
              {motivos.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}

        {a && (
          <>
            <textarea
              value={nota}
              onChange={(ev) => setNota(ev.target.value)}
              rows={2}
              placeholder="Qué pasó (opcional, salvo al reabrir)"
              className={CLASE_CONTROL}
            />
            <div>
              <Boton type="submit" disabled={yendo}>
                {yendo ? "Moviendo…" : `Pasar a ${ROTULO_ETAPA[a]}`}
              </Boton>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

/// Cómo contactarlo. Con enlaces que marcan y escriben: el asesor
/// está en el CRM para llamar, no para copiar un número a mano.
function Contacto({ ficha }: { ficha: FichaDeOportunidad }) {
  const p = ficha.persona;
  const e = ficha.empresa;
  if (!p && !e) return null;

  const celular = p?.celular ?? null;
  const soloDigitos = celular?.replace(/\D/g, "") ?? "";

  return (
    <section>
      <Rotulo>Contacto</Rotulo>
      {/* Los rótulos de la izquierda en versalita y el dato en el
          cuerpo: antes eran los dos del mismo tamaño y del mismo
          gris, y una lista así no tiene jerarquía, tiene renglones. */}
      <dl className="mt-2 grid gap-1.5">
        {e && (
          <Renglon rotulo="NIT">
            <span className="tabular-nums">{e.nit}</span>
          </Renglon>
        )}
        {p?.correo && (
          <Renglon rotulo="Correo">
            <a href={`mailto:${p.correo}`} className="text-marca underline">
              {p.correo}
            </a>
          </Renglon>
        )}
        {celular && (
          <Renglon rotulo="Celular">
            <span className="flex flex-wrap gap-3">
              <a
                href={`tel:+57${soloDigitos}`}
                className="tabular-nums text-marca underline"
              >
                {celular}
              </a>
              {/* Colombia vende por WhatsApp: el 94 % de la gente lo
                  usa como canal principal. Un enlace directo ahorra
                  el copiar-pegar que nadie hace. */}
              <a
                href={`https://wa.me/57${soloDigitos}`}
                target="_blank"
                rel="noreferrer"
                className="text-marca underline"
              >
                WhatsApp
              </a>
            </span>
          </Renglon>
        )}
        {/* Por dónde entró. Un formulario publicado es una campaña, y
            que la puerta se vea aquí y en la lista igual es lo que
            hace que «de dónde vienen» no parezca un informe aparte. */}
        <Renglon rotulo="Vino por">
          <Puerta campana={ficha.campana} />
        </Renglon>
      </dl>
    </section>
  );
}

function Renglon({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 pt-[3px]">
        <Rotulo>{rotulo}</Rotulo>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/// Una nota suelta, sin agendar nada. Es «hablé con ella en el
/// ascensor y el presupuesto sale en marzo»: no es un compromiso,
/// pero es justo lo que hay que releer antes de volver a llamar.
function Anotar({
  ficha,
  alHecho,
}: {
  ficha: FichaDeOportunidad;
  alHecho: () => void;
}) {
  const [nota, setNota] = useState("");
  const [yendo, setYendo] = useState(false);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (nota.trim().length < 2) return;
    setYendo(true);
    try {
      await oportunidadesApi.anotar(ficha.id, nota.trim());
      setNota("");
      alHecho();
    } finally {
      setYendo(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <Rotulo>Anotar</Rotulo>
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        placeholder="Qué se habló"
        className={`mt-2 ${CLASE_CONTROL}`}
      />
      <div className="mt-2">
        <Boton type="submit" disabled={yendo || nota.trim().length < 2}>
          {yendo ? "Guardando…" : "Guardar nota"}
        </Boton>
      </div>
    </form>
  );
}

/**
 * Todo lo que le pasó, en orden.
 *
 * Es la mitad del valor de la ficha: la etapa dice DÓNDE está el
 * negocio y esto dice POR QUÉ. Cuando se cae, es lo único que
 * permite reconstruir dónde se enfrió.
 */
function Historial({ ficha }: { ficha: FichaDeOportunidad }) {
  if (ficha.movimientos.length === 0) return null;

  return (
    <section>
      <Rotulo>Historial</Rotulo>
      <ol className="mt-2 flex flex-col gap-3">
        {ficha.movimientos.map((m) => {
          const movio = m.de !== null && m.de !== m.a;
          return (
            <li key={m.id} className="flex gap-3">
              <span className="micro w-24 shrink-0 pt-[2px]">
                <Fecha iso={m.creadoEn} />
              </span>
              <span className="min-w-0">
                {movio ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-texto-suave">
                      {m.de ? ROTULO_ETAPA[m.de] : "—"}
                    </span>
                    <span className="text-texto-suave">→</span>
                    <Etapa etapa={m.a} rotulo={ROTULO_ETAPA[m.a]} />
                  </span>
                ) : (
                  <span className="text-texto-suave">Nota</span>
                )}
                {m.nota && <span className="block">{m.nota}</span>}
                <span className="micro block">
                  {m.actorNombre}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/// Cuánto lleva sin que nadie la toque, para la lista. Vive aquí
/// porque el cajón y la lista lo dicen igual: una sola unidad, la
/// mayor, tal como manda el contrato del reloj.
export function quietaDesde(ultimoToqueEn: string, ahora: number): string {
  return relojEnTexto(
    Math.round((ahora - new Date(ultimoToqueEn).getTime()) / 60_000),
  );
}
