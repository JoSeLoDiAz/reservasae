"use client";

/// Esta pantalla contesta una sola pregunta: «¿va a funcionar
/// cuando conecte Meta?».
///
/// Existe porque conectar Meta depende de cosas que no
/// dependen de nosotros —una app aprobada, una página con
/// permisos, un dominio público— y todas pueden tardar
/// semanas. Sin esta pantalla habría que esperar a tenerlas
/// para descubrir si lo nuestro estaba bien.
///
/// Va en tres pasos, en el orden en que se rompen las cosas:
/// primero lo que falta, luego el apretón de manos —que es lo
/// que ENCIENDE el webhook—, y por último un lead de mentira
/// que entra por la misma puerta que entrará el de verdad.

import { useCallback, useEffect, useState } from "react";

import { Aviso, Boton, Tarjeta } from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
import {
  metaApi,
  type EstadoMeta,
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
      <p className="text-sm font-medium">{etiqueta}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-superficie-alterna px-3 py-2 font-mono text-sm whitespace-nowrap">
          {valor}
        </code>
        <button
          type="button"
          className="shrink-0 rounded-md border border-borde px-3 py-2 text-sm hover:border-marca"
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

export default function PaginaMeta() {
  const [estado, setEstado] = useState<EstadoMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificacion, setVerificacion] = useState<Resultado | null>(null);
  const [aviso, setAviso] = useState<ResultadoAviso | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

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

  async function correr(cual: string, accion: () => Promise<void>) {
    setError(null);
    setOcupado(cual);
    try {
      await accion();
      await cargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(null);
    }
  }

  if (!estado && !error) return <p className="text-texto-suave">Cargando…</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Webhook de Meta</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Por aquí entran los leads que se pagan en Facebook e Instagram. Esta
          pantalla deja comprobar que funciona <strong>antes</strong> de tener
          Meta conectado: lo que depende de nosotros se prueba entero desde
          aquí, y es donde están los errores que podemos cometer.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {estado && (
        <>
          <Tarjeta
            titulo="1 · Qué falta"
            descripcion="Las tres cosas que hay que poner en el .env del servidor."
          >
            {estado.listo ? (
              <Aviso tipo="exito">
                <p className="font-medium">No falta nada.</p>
                <p className="mt-1">
                  Los leads de Meta entrarían a{" "}
                  <strong>{estado.convenio?.nombre}</strong>.
                </p>
              </Aviso>
            ) : (
              <div className="space-y-3">
                <p className="text-texto-suave">
                  Mientras falte cualquiera de estas, el webhook no queda
                  encendido a medias: queda apagado.
                </p>
                <ul className="space-y-2">
                  {estado.faltan.map((f) => (
                    <li
                      key={f}
                      className="rounded-md border border-error bg-error-suave px-3 py-2 text-sm"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!estado.sinTabla && (
              <div className="mt-4 flex flex-wrap gap-6 border-t border-borde pt-4 text-sm">
                <span>
                  Leads de Meta recibidos:{" "}
                  <strong className="tabular-nums">{estado.leads.total}</strong>
                </span>
                <span>
                  Sin completar:{" "}
                  <strong className="tabular-nums">
                    {estado.leads.pendientes}
                  </strong>
                </span>
              </div>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="2 · Lo que hay que pegar en Meta"
            descripcion="En la app de Meta, en Webhooks de la página."
          >
            <div className="space-y-4">
              <ParaCopiar
                etiqueta="URL de devolución de llamada"
                valor={estado.paraMeta.urlDeDevolucion}
              />
              <ParaCopiar
                etiqueta="Campo al que suscribirse"
                valor={estado.paraMeta.campo}
              />
              <div>
                <p className="text-sm font-medium">Token de verificación</p>
                <p className="mt-1 text-sm text-texto-suave">
                  {estado.paraMeta.tokenPuesto ? (
                    <>
                      Es el valor de <code>META_VERIFY_TOKEN</code> del{" "}
                      <code>.env</code>. No se muestra aquí a propósito: una
                      credencial en pantalla es una credencial en una captura.
                    </>
                  ) : (
                    <>
                      Todavía no hay ninguno. Póngalo en{" "}
                      <code>META_VERIFY_TOKEN</code>: se lo inventa usted, y va
                      escrito igual en el <code>.env</code> y en Meta.
                    </>
                  )}
                </p>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta
            titulo="3 · El apretón de manos"
            descripcion="Es lo que ENCIENDE el webhook. Si esto falla, Meta no avisa: simplemente no llegan leads."
          >
            <p className="text-texto-suave">
              Antes de mandar nada, Meta llama una vez y espera que le
              devolvamos su palabra clave tal cual. Esta prueba hace
              exactamente esa llamada contra nosotros mismos. No escribe nada,
              así que se puede correr también en el servidor de verdad.
            </p>
            <div className="mt-4">
              <Boton
                disabled={ocupado !== null}
                onClick={() =>
                  correr("verificacion", async () => {
                    setVerificacion(await metaApi.probarVerificacion());
                  })
                }
              >
                {ocupado === "verificacion" ? "Probando…" : "Probar"}
              </Boton>
            </div>
            {verificacion && (
              <div className="mt-4">
                <Veredicto r={verificacion} />
              </div>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="4 · Un lead de mentira"
            descripcion="Entra por la misma puerta, firmado igual, y se guarda igual."
          >
            {!estado.puedeSimular ? (
              <Aviso tipo="error">
                Inventar leads solo se puede en el entorno de pruebas. En el
                servidor de verdad llenaría Gestión de leads de gente que no
                existe.
              </Aviso>
            ) : (
              <>
                <p className="text-texto-suave">
                  Se arma el mismo cuerpo que manda Meta, se firma con el mismo
                  secreto y se manda a la misma ruta. Lo que se comprueba es
                  todo lo nuestro: que la firma cuadre, que el cuerpo llegue
                  entero y que los avisos se guarden. Los leads que salen de
                  aquí se llaman <code>PRUEBA-…</code> para que se vean a un
                  metro.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Boton
                    disabled={ocupado !== null}
                    onClick={() =>
                      correr("aviso", async () => {
                        setAviso(await metaApi.probarAviso(1));
                      })
                    }
                  >
                    {ocupado === "aviso" ? "Mandando…" : "Mandar uno"}
                  </Boton>
                  <Boton
                    disabled={ocupado !== null}
                    onClick={() =>
                      correr("lote", async () => {
                        setAviso(await metaApi.probarAviso(3));
                      })
                    }
                  >
                    {ocupado === "lote" ? "Mandando…" : "Mandar tres de golpe"}
                  </Boton>
                  <button
                    type="button"
                    disabled={ocupado !== null}
                    className="underline disabled:opacity-50"
                    onClick={() =>
                      correr("limpiar", async () => {
                        const { borrados } = await metaApi.limpiar();
                        setAviso(null);
                        setVerificacion(null);
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
                </div>
                <p className="mt-2 text-sm text-texto-suave">
                  «Tres de golpe» es la prueba que de verdad importa: Meta
                  agrupa varios avisos en un mismo envío, y quedarse con el
                  primero es un fallo que nadie nota hasta que faltan leads.
                </p>

                {aviso && (
                  <div className="mt-4 space-y-3">
                    <Veredicto r={aviso} />
                    {aviso.filas && aviso.filas.length > 0 && (
                      <div className="overflow-x-auto rounded-md border border-borde">
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
                              <tr
                                key={f.externoId}
                                className="border-t border-borde"
                              >
                                <td className="px-3 py-2 font-mono">
                                  {f.externoId}
                                </td>
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
              </>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="Lo que esto NO prueba"
            descripcion="Para que nadie lo dé por conectado antes de tiempo."
          >
            <ul className="list-disc space-y-2 pl-5 text-texto-suave">
              <li>
                <strong>Que Meta llegue al dominio.</strong> Eso solo se sabe el
                día que se conecta de verdad, y depende del DNS y del
                certificado, no del código.
              </li>
              <li>
                <strong>Que lleguen los datos de la persona.</strong> Meta{" "}
                <em>no</em> los manda: manda un identificador y ya. Para saber
                cómo se llama hay que volver a pedírselo a Meta con un token de
                la página. Por eso el lead se guarda igual, sin nombre, y se
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
