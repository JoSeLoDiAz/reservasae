"use client";

/// Esta pantalla contesta una sola pregunta: «¿va a funcionar
/// cuando conecte Meta?».
///
/// Y la contesta POR GREMIO. Hay una app de Meta por cada uno
/// —una app, una URL de devolución, un gremio—, así que cada
/// uno tiene su propio secreto y su propio token. El estado de
/// uno no dice absolutamente nada del otro.
///
/// Eso importa más de lo que parece: cada app firma con SU
/// secreto, así que si a un gremio le falta el suyo, Meta le
/// manda los leads y nosotros los rechazamos todos por «firma
/// inválida». Y ese síntoma no se lee como un error de
/// configuración: se lee como «Meta no nos está mandando
/// nada», que es de los más caros de diagnosticar porque no
/// hay nada roto que mirar. Verlos aquí uno al lado del otro
/// es lo que hace que salte a la vista.

import { useCallback, useEffect, useState } from "react";

import { Aviso, Boton, Tarjeta } from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
import {
  metaApi,
  type EstadoMeta,
  type GremioMeta,
  type Resultado,
  type ResultadoAviso,
} from "@/lib/meta-api";

/// Un valor que hay que copiar y pegar en Meta, con su botón.
///
/// Con botón y no «selecciónelo y cópielo»: una URL mal
/// copiada —un espacio al final, media línea— falla con el
/// mismo silencio que todo lo demás en Meta.
function ParaCopiar({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div>
      <p className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
        {etiqueta}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-superficie-alterna px-3 py-2 font-mono text-sm whitespace-nowrap">
          {valor}
        </code>
        <button
          type="button"
          className="shrink-0 rounded border border-borde px-3 py-2 text-sm transition hover:border-marca"
          onClick={() => {
            void navigator.clipboard.writeText(valor).then(() => {
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 1500);
            });
          }}
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

/// El resultado de una prueba: pasó o no, y por qué.
function Veredicto({ r }: { r: Resultado }) {
  return (
    <Aviso tipo={r.pasa ? "exito" : "error"}>
      <p className="font-medium">{r.pasa ? "Funciona" : "No funciona todavía"}</p>
      <p className="mt-1">{r.porque}</p>
      {r.devolvio !== undefined && (
        <p className="mt-2 font-mono text-sm">
          Devolvió: <span className="break-all">{r.devolvio || "(nada)"}</span>
        </p>
      )}
    </Aviso>
  );
}

function PanelDeGremio({
  g,
  puedeSimular,
  campo,
  alRecargar,
}: {
  g: GremioMeta;
  puedeSimular: boolean;
  campo: string;
  alRecargar: () => Promise<void>;
}) {
  const [verificacion, setVerificacion] = useState<Resultado | null>(null);
  const [aviso, setAviso] = useState<ResultadoAviso | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function correr(cual: string, accion: () => Promise<void>) {
    setError(null);
    setOcupado(cual);
    try {
      await accion();
      await alRecargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Tarjeta
      titulo={g.nombre}
      /// La insignia dice el estado sin abrir nada, y en el
      /// color de la casa: en la letra, sin caja.
      insignia={
        <span className={g.listo ? "text-exito" : "text-aviso"}>
          {g.listo ? "Listo" : `Faltan ${g.faltan.length}`}
        </span>
      }
    >
      <div className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {g.faltan.length > 0 && (
          <div>
            <p className="text-texto-suave">
              Mientras falte cualquiera de estas, este gremio no recibe leads.
              Las dos son <strong>suyas</strong>: cada app de Meta tiene su
              propio secreto y su propio token.
            </p>
            <ul className="mt-3 space-y-2">
              {g.faltan.map((f) => (
                <li
                  key={f}
                  className="rounded border-l-2 border-error bg-error-suave px-3 py-2 text-sm"
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {g.sinTabla && (
          <Aviso tipo="error">
            La tabla de leads no existe todavía. Falta aplicar la migración
            «20260828090000_mesa_de_entrada_de_leads». Los avisos de Meta
            llegarían bien, pero no habría dónde guardarlos.
          </Aviso>
        )}

        <div className="space-y-4 border-t border-borde pt-4">
          <ParaCopiar
            etiqueta="URL de devolución de llamada"
            valor={g.urlDeDevolucion}
          />
          <ParaCopiar etiqueta="Campo al que suscribirse" valor={campo} />
          <p className="text-sm text-texto-suave">
            El <strong>token de verificación</strong>{" "}
            {g.tokenPuesto ? "ya está puesto" : "todavía no está puesto"} y el{" "}
            <strong>secreto de la app</strong>{" "}
            {g.secretoPuesto ? "también" : "tampoco"}. Ninguno de los dos se
            muestra aquí a propósito: una credencial en pantalla es una
            credencial en una captura.
          </p>
        </div>

        {!g.sinTabla && (
          <div className="flex flex-wrap gap-6 border-t border-borde pt-4 text-sm">
            <span>
              Leads recibidos:{" "}
              <strong className="tabular-nums">{g.leads.total}</strong>
            </span>
            <span>
              Sin completar:{" "}
              <strong className="tabular-nums">{g.leads.pendientes}</strong>
            </span>
          </div>
        )}

        <div className="border-t border-borde pt-4">
          <p className="text-texto-suave">
            El <strong>apretón de manos</strong> es lo que enciende el webhook.
            Meta llama una vez y espera que le devolvamos su palabra clave tal
            cual; si falla no avisa, simplemente no llegan leads. Esta prueba
            hace esa misma llamada contra nosotros mismos y no escribe nada.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Boton
              disabled={ocupado !== null}
              onClick={() =>
                correr("verificacion", async () => {
                  setVerificacion(await metaApi.probarVerificacion(g.slug));
                })
              }
            >
              {ocupado === "verificacion" ? "Probando…" : "Probar el apretón"}
            </Boton>

            {puedeSimular && (
              <>
                <Boton
                  disabled={ocupado !== null}
                  onClick={() =>
                    correr("aviso", async () => {
                      setAviso(await metaApi.probarAviso(g.slug, 3));
                    })
                  }
                >
                  {ocupado === "aviso" ? "Mandando…" : "Mandar tres leads de mentira"}
                </Boton>
                <button
                  type="button"
                  disabled={ocupado !== null}
                  className="underline disabled:opacity-50"
                  onClick={() =>
                    correr("limpiar", async () => {
                      const { borrados } = await metaApi.limpiar();
                      setAviso(null);
                      setError(
                        borrados === 0
                          ? "No había leads de prueba que borrar."
                          : `Se borraron ${borrados} leads de prueba.`,
                      );
                    })
                  }
                >
                  Borrar los de prueba
                </button>
              </>
            )}
          </div>

          {puedeSimular && (
            <p className="mt-2 text-sm text-texto-suave">
              «Tres de golpe» es la prueba que de verdad importa: Meta agrupa
              varios avisos en un mismo envío, y quedarse con el primero es un
              fallo que nadie nota hasta que faltan leads. Se firman con el
              secreto <strong>de este gremio</strong>.
            </p>
          )}

          {verificacion && (
            <div className="mt-4">
              <Veredicto r={verificacion} />
            </div>
          )}

          {aviso && (
            <div className="mt-4 space-y-3">
              <Veredicto r={aviso} />
              {aviso.filas && aviso.filas.length > 0 && (
                <div className="overflow-x-auto rounded border border-borde">
                  <table className="w-full text-sm">
                    <thead className="bg-superficie-alterna text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Lead</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 font-medium">Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aviso.filas.map((f) => (
                        <tr key={f.externoId} className="border-t border-borde">
                          <td className="px-3 py-2 font-mono">{f.externoId}</td>
                          <td className="px-3 py-2">{f.estado}</td>
                          <td className="px-3 py-2">{f.origen}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

export default function PaginaMeta() {
  const [estado, setEstado] = useState<EstadoMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setEstado(await metaApi.estado());
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!estado && !error) return <p className="text-texto-suave">Cargando…</p>;

  return (
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Webhook de Meta</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Por aquí entran los leads que se pagan en Facebook e Instagram. Hay{" "}
          <strong>una app de Meta por gremio</strong>, así que cada uno tiene su
          propia URL, su propio secreto y su propio token: lo que esté bien en
          uno no dice nada del otro.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {estado && (
        <>
          {estado.listo && (
            <Aviso tipo="exito">
              Los {estado.gremios.length} gremios están configurados.
            </Aviso>
          )}

          {/* Uno debajo del otro y a lo ancho, no en dos
              columnas: cada uno lleva sus botones de prueba y
              sus resultados, y en media pantalla el veredicto
              queda ilegible. */}
          {estado.gremios.map((g) => (
            <PanelDeGremio
              key={g.slug}
              g={g}
              campo={estado.campo}
              puedeSimular={estado.puedeSimular}
              alRecargar={cargar}
            />
          ))}

          <Tarjeta titulo="Lo que esto NO prueba">
            <ul className="list-disc space-y-2 pl-5 text-texto-suave">
              <li>
                <strong>Que Meta llegue al dominio.</strong> Depende del DNS y
                del certificado, no del código, y solo se sabe el día que se
                conecta.
              </li>
              <li>
                <strong>Que lleguen los datos de la persona.</strong> Meta{" "}
                <em>no</em> los manda: manda un identificador. Para saber cómo
                se llama hay que volver a pedírselo a Meta con un token de la
                página. Por eso el lead se guarda igual, sin nombre, y se
                completa después: un lead pagado que se pierde porque nos
                faltaba una credencial es plata tirada.
              </li>
            </ul>
          </Tarjeta>
        </>
      )}
    </div>
  );
}
