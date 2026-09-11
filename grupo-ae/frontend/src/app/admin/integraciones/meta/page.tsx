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

import {
  Bloque,
  BotonSuave,
  Cargando,
  Encabezado,
} from "@/components/admin/piezas";
import { Rotulo } from "@/components/admin/bloques";
import { Aviso, Boton } from "@/components/admin/marco-admin";
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
      <p className="rotulo-bloque">{etiqueta}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="dato bg-superficie-alterna rounded-plano min-w-0 flex-1 overflow-x-auto px-3 py-[7px] whitespace-nowrap tabular-nums">
          {valor}
        </code>
        <BotonSuave
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(valor).then(() => {
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 1500);
            });
          }}
        >
          {copiado ? "Copiado" : "Copiar"}
        </BotonSuave>
      </div>
    </div>
  );
}

/// El resultado de una prueba: pasó o no, y por qué.
function Veredicto({ r }: { r: Resultado }) {
  return (
    <Aviso tipo={r.pasa ? "exito" : "error"}>
      <p>{r.pasa ? "Funciona" : "No funciona todavía"}</p>
      <p className="dato mt-1">{r.porque}</p>
      {r.devolvio !== undefined && (
        <p className="dato mt-2 tabular-nums">
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
    /// Un corte DENTRO de la banda, no una banda propia: dos
    /// bandas apiladas no se pueden poner una al lado de la
    /// otra, y verlas juntas es justo para lo que existe esta
    /// pantalla.
    <section>
      <div className="prosa">
        <Rotulo>{g.nombre}</Rotulo>
        {/* El estado, DEBAJO del rótulo y a la izquierda.

            Iba a la derecha del título, y con el título en una
            banda a sangre eso lo dejaba a seiscientos píxeles
            del nombre al que se refiere. Un estado va siempre
            alineado a la izquierda y con el mismo ancho de
            columna, que es lo que deja leerlos en vertical
            cuando hay varias líneas de negocio.

            Y lo que falta NO va en ámbar: en este panel el
            color cálido significa que alguien lleva esperando
            respuesta, y una credencial sin poner no espera a
            nadie. */}
        <p className={`estado mb-4 ${g.listo ? "text-exito" : "text-titulo"}`}>
          {g.listo ? "Listo" : `Faltan ${g.faltan.length}`}
        </p>

        {error && (
          <div className="mb-4">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        )}

        {g.faltan.length > 0 && (
          <div>
            <p className="rotulo-bloque">Sin esto no recibe leads</p>
            {/* Eran renglones con borde rojo a la izquierda y
                fondo rosa. `--error` está reservado para el
                tiempo vencido de quien espera respuesta. */}
            <ul className="mt-3">
              {g.faltan.map((f) => (
                <li
                  key={f}
                  className="dato border-hairline border-b py-[var(--pad-fila)] last:border-b-0"
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {g.sinTabla && (
          <div className="mt-4">
            <Aviso tipo="error">
              La tabla de leads no existe todavía. Falta aplicar la migración
              «20260828090000_mesa_de_entrada_de_leads». Los avisos de Meta
              llegarían bien, pero no habría dónde guardarlos.
            </Aviso>
          </div>
        )}

        <div className="border-hairline mt-6 space-y-4 border-t pt-4">
          <ParaCopiar
            etiqueta="URL de devolución de llamada"
            valor={g.urlDeDevolucion}
          />
          <ParaCopiar etiqueta="Campo al que suscribirse" valor={campo} />
          <p className="dato">
            El token de verificación{" "}
            {g.tokenPuesto ? "ya está puesto" : "todavía no está puesto"} y el
            secreto de la app {g.secretoPuesto ? "también" : "tampoco"}. Ninguno
            de los dos se muestra aquí a propósito: una credencial en pantalla es
            una credencial en una captura.
          </p>
        </div>

        {!g.sinTabla && (
          <div className="border-hairline mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t pt-4">
            <div>
              <p className="rotulo-bloque">Leads recibidos</p>
              <p className="cifra-columna mt-1">{g.leads.total}</p>
            </div>
            <div>
              <p className="rotulo-bloque">Sin completar</p>
              <p className="cifra-columna mt-1">{g.leads.pendientes}</p>
            </div>
          </div>
        )}

        {/* Sin el párrafo del apretón de manos y sin el de
            «tres de golpe»: los dos estaban escritos aquí, o sea
            una vez POR LÍNEA DE NEGOCIO, palabra por palabra
            iguales. Dos veces el mismo párrafo en la misma
            pantalla no explica el doble: empuja el doble. Se
            dicen una sola vez en la bajada del bloque, que es
            donde gobiernan a las dos. */}
        <div className="border-hairline mt-6 border-t pt-4">
          <div className="flex flex-wrap items-center gap-3">
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
                <BotonSuave
                  disabled={ocupado !== null}
                  onClick={() =>
                    correr("aviso", async () => {
                      setAviso(await metaApi.probarAviso(g.slug, 3));
                    })
                  }
                >
                  {ocupado === "aviso" ? "Mandando…" : "Mandar tres leads de mentira"}
                </BotonSuave>
                <button
                  type="button"
                  disabled={ocupado !== null}
                  className="dato text-marca underline disabled:text-texto-suave disabled:no-underline"
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

          {verificacion && (
            <div className="mt-4">
              <Veredicto r={verificacion} />
            </div>
          )}

          {aviso && (
            <div className="mt-4">
              <Veredicto r={aviso} />
              {aviso.filas && aviso.filas.length > 0 && (
                <div className="caja-scroll mt-4 overflow-x-auto">
                  <table className="dato w-full border-collapse">
                    <thead>
                      <tr>
                        {["Lead", "Estado", "Origen"].map((c) => (
                          <th
                            key={c}
                            className="rotulo-bloque border-borde border-b px-3 py-2 text-left"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aviso.filas.map((f) => (
                        <tr key={f.externoId} className="border-hairline border-b">
                          <td className="px-3 py-[var(--pad-fila)] tabular-nums">
                            {f.externoId}
                          </td>
                          <td className="px-3 py-[var(--pad-fila)]">{f.estado}</td>
                          <td className="px-3 py-[var(--pad-fila)]">{f.origen}</td>
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
    </section>
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

  if (!estado && !error) return <Cargando />;

  return (
    <div className="flex min-h-0 grow flex-col">
      <Encabezado
        titulo="Webhook de Meta"
        descripcion="Por aquí entran los leads que se pagan en Facebook e Instagram. Hay una app de Meta por línea de negocio, así que cada una tiene su propia URL, su propio secreto y su propio token: lo que esté bien en uno no dice nada del otro."
      />

      {(error || estado?.listo) && (
        <div className="banda">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {estado?.listo && (
            <Aviso tipo="exito">
              Las {estado.gremios.length} líneas de negocio están configuradas.
            </Aviso>
          )}
        </div>
      )}

      {estado && (
        <>
          {/* LAS LÍNEAS DE NEGOCIO, UNA AL LADO DE LA OTRA.

              Iban una debajo de otra y a lo ancho, con el
              argumento de que «en media pantalla el veredicto
              queda ilegible». A 1440 era cierto por poco; a
              1920 no lo es: el texto de cada panel topa en 68
              caracteres --unos 540 px-- y en media banda de
              1920 caben 790.

              Y apiladas se pierde lo único que esta pantalla
              existe para enseñar. Cada app de Meta firma con SU
              secreto, así que si a una línea le falta el suyo
              Meta le manda los leads y nosotros los rechazamos
              todos por «firma inválida», y ese síntoma se lee
              como «Meta no nos manda nada». Verlas juntas es lo
              que hace que salte a la vista, y con la segunda
              empezando a 970 px de alto no se veía ninguna de
              las dos a la vez.

              El ancho de la pista es la MEDIDA DE LECTURA, no
              la mitad de la pantalla. Con dos columnas de 1fr
              cada panel medía 790 px, su texto topaba en 68
              caracteres --540-- y los 250 sobrantes de cada uno
              se juntaban en un canal de 500 px en el centro. Un
              hueco en medio se lee como algo roto; el mismo
              hueco al final se lee como margen.

              Con `auto-fill` y un mínimo de 480, el ancho manda
              cuántas líneas de negocio caben en fila: tres a
              1920, dos a 1440, una en estrecho. Y no hace falta
              consulta de contenedor ni de ventana --la rejilla
              mide su propia caja--, así que sigue siendo
              correcta cuando la barra lateral se pliega. */}
          <Bloque
            titulo="Cada línea de negocio, con su app"
            descripcion="El apretón de manos es lo que enciende el webhook: Meta llama una vez y espera que le devolvamos su palabra clave tal cual; si falla no avisa, simplemente no llegan leads. La prueba hace esa misma llamada contra nosotros mismos y no escribe nada. «Tres de golpe» es la que de verdad importa: Meta agrupa varios avisos en un mismo envío, y quedarse con el primero es un fallo que nadie nota hasta que faltan leads."
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(480px,1fr))] gap-x-12 gap-y-10">
              {estado.gremios.map((g) => (
                <PanelDeGremio
                  key={g.slug}
                  g={g}
                  campo={estado.campo}
                  puedeSimular={estado.puedeSimular}
                  alRecargar={cargar}
                />
              ))}
            </div>
          </Bloque>

          <Bloque titulo="Lo que esto NO prueba">
            <ul className="prosa list-disc space-y-3 pl-5">
              <li className="dato">
                Que Meta llegue al dominio. Depende del DNS y del certificado, no
                del código, y solo se sabe el día que se conecta.
              </li>
              <li className="dato">
                Que lleguen los datos de la persona. Meta no los manda: manda un
                identificador. Para saber cómo se llama hay que volver a
                pedírselo a Meta con un token de la página. Por eso el lead se
                guarda igual, sin nombre, y se completa después: un lead pagado
                que se pierde porque nos faltaba una credencial es plata tirada.
              </li>
            </ul>
          </Bloque>
        </>
      )}
    </div>
  );
}
