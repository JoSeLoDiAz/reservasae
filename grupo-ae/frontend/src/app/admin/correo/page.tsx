"use client";

/** Correo saliente: si sale y a dónde. */

/// Esta pantalla existe para contestar una sola pregunta:
/// «¿los correos que manda el CRM están saliendo?». Antes
/// había que abrir una consola para saberlo, y una alerta que
/// no sale se pierde en silencio -- que es la peor forma de
/// perderse.

import { useCallback, useEffect, useState } from "react";

import { BloqueDeBanda } from "@/components/admin/bloques";
import { Cargando } from "@/components/admin/piezas";
import { Boton, CLASE_CONTROL, useAdmin } from "@/components/admin/marco-admin";
import {
  AvisoDeSeccion,
  CabeceraDePantalla,
  Seccion,
} from "@/components/admin/secciones";
import { ErrorApi } from "@/lib/api";
import { correoApi, type EstadoCorreo } from "@/lib/correo-api";

export default function PaginaCorreo() {
  const { admin } = useAdmin();
  const [estado, setEstado] = useState<EstadoCorreo | null>(null);
  const [para, setPara] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setEstado(await correoApi.estado());
  }, []);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  // el propio correo de quien mira, que es a donde uno se lo
  // manda la primera vez
  useEffect(() => {
    if (!para && admin.correo) setPara(admin.correo);
  }, [admin.correo, para]);

  async function mandar() {
    setError(null);
    setExito(null);
    setOcupado(true);
    try {
      const r = await correoApi.probar(para.trim());
      setExito(
        r.desviado
          ? `Salió para ${r.para.join(", ")}, NO para ${r.pedido}: este ` +
              `entorno desvía todo el correo.`
          : `Salió para ${r.para.join(", ")}. Si no aparece en unos ` +
              `segundos, mire en la carpeta de spam.`,
      );
      await cargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  if (!estado) {
    return error ? (
      <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>
    ) : (
      <Cargando />
    );
  }

  const sale = estado.configurado && estado.acepta;

  return (
    <div className="flex min-h-0 grow flex-col">
      {/* La pantalla SÍ lleva título, como las otras catorce.
          Sin él, esta era la única que arrancaba con una franja
          azul de cabecera de bloque en vez de con un título, y
          por eso no parecía del mismo producto. */}
      <CabeceraDePantalla titulo="Cuenta de correo" />

      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}
      {exito && <AvisoDeSeccion color="var(--exito)">{exito}</AvisoDeSeccion>}

      <Seccion>
        <div className="@container px-6 pt-5 pb-6">
          {/* EL SOBRANTE NO SE DEJA EN BLANCO: SE LE DEDICA LA
              SEGUNDA REGIÓN.

              Eran dos bandas apiladas y las dos topaban en 720:
              a 1920 esta pantalla usaba el 39 % del ancho y el
              60 % de la derecha era papel. Es la respuesta b) de
              la regla de lista —dedicar el sobrante a una
              segunda región útil—, que es la que toca aquí
              porque esto no es una lista con ocho datos
              comparables que abrir en columna.

              Consulta de CONTENEDOR y no de ventana: la barra
              lateral se pliega y la banda gana 180 px sin que la
              ventana cambie de tamaño. Lo que decide si caben
              las dos regiones es el ancho de la banda, que es
              lo que mide el ojo.

              420 px a la derecha porque es lo que mide el
              formulario de prueba: 360 el campo de correo y el
              botón debajo. No se estira: un campo mide lo que
              mide su dato. */}
          <div className="grid gap-x-10 gap-y-6 @[1100px]:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <BloqueDeBanda rotulo="Cómo está">
                <div className="space-y-3">
                  {/* El estado, en el COLOR DE LA LETRA.

                      Era un recuadro relleno de verde o de rojo, con
                      borde y una palomita grande. Es la regla 2 del
                      panel al revés —«sin caja, sin borde, sin fondo,
                      sin punto»— y aquí encima gritaba: esta pantalla
                      se mira una vez al mes para comprobar que todo
                      sigue bien, y lo normal era abrirla y recibir un
                      bloque verde a toda página.

                      El punto de color se queda porque es el mismo que
                      usa el resto del panel para una nota, y porque
                      el color solo no basta: uno de cada doce hombres
                      no distingue el verde del rojo, y el texto dice
                      cuál es sin depender del color.

                      Lo que NO sale es en rojo ni en ámbar: en este
                      panel esos dos colores significan «alguien lleva
                      esperando respuesta» y nada más. Un servidor mal
                      configurado se lee por lo que dice. */}
                  <Nota color={sale ? "var(--exito)" : "var(--texto-suave)"}>
                    <p
                      className={sale ? "text-exito" : "text-titulo"}
                      style={{ fontWeight: sale ? 600 : 700 }}
                    >
                      {sale
                        ? "El correo está saliendo."
                        : estado.configurado
                          ? "Está configurado, pero el servidor no lo acepta."
                          : "No está configurado."}
                    </p>
                    {estado.error && (
                      <p className="mt-0.5 text-texto-suave">{estado.error}</p>
                    )}
                    {!estado.configurado && (
                      <p className="mt-0.5 text-texto-suave">
                        Faltan <code>SMTP_SERVIDOR</code>, <code>SMTP_USUARIO</code> o{" "}
                        <code>SMTP_CLAVE</code> en el servidor.
                      </p>
                    )}
                  </Nota>

                  {estado.desviadoA.length > 0 && (
                    <Nota color="var(--texto-suave)">
                      <p className="text-titulo" style={{ fontWeight: 700 }}>
                        Todo el correo se desvía y no llega a su destinatario.
                      </p>
                      <p className="mt-0.5 text-texto-suave">
                        Salga para quien salga, lo reciben{" "}
                        <strong className="font-normal text-texto">
                          {estado.desviadoA.join(", ")}
                        </strong>
                        . Se quita borrando <code>CORREO_REDIRIGIR_A</code> del servidor.
                      </p>
                    </Nota>
                  )}

                  {estado.esPrueba && estado.desviadoA.length === 0 && (
                    <Nota color="var(--texto-suave)">
                      <p className="text-titulo" style={{ fontWeight: 700 }}>
                        Entorno de pruebas sin desvío: no va a salir ningún correo.
                      </p>
                      <p className="mt-0.5 text-texto-suave">
                        Es a propósito. Con las credenciales de verdad puestas, un correo
                        de prueba le llegaría a una persona real. Se arregla poniendo{" "}
                        <code>CORREO_REDIRIGIR_A</code>.
                      </p>
                    </Nota>
                  )}
                </div>
              </BloqueDeBanda>

              {/* Una raya y no otra caja: separa «cómo está» de
                  «con qué está puesto», que es lo que se viene a
                  mirar después.

                  Y EN COLUMNA. Iban en dos columnas topadas en
                  720: cinco datos en tres renglones con
                  novecientos píxeles de blanco al lado. Son cinco
                  datos cortos del mismo tipo —con qué está puesto
                  el correo— y se leen de un vistazo puestos uno al
                  lado del otro.

                  auto-fit y no un número de columnas: el mismo
                  bloque vive en una banda de 1636 px y en una
                  columna de 700, y lo que decide cuántos caben es
                  el hueco, no la pantalla. 200 px es lo que mide
                  el más largo de los rótulos con su dato debajo. */}
              <dl className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-8 gap-y-4 border-t border-hairline pt-5">
                <Dato titulo="Servidor" valor={estado.servidor} />
                <Dato titulo="Puerto" valor={String(estado.puerto)} />
                <Dato titulo="Cuenta" valor={estado.usuario} />
                <Dato
                  titulo="Sale como"
                  valor={estado.remitente ? `${estado.nombre} <${estado.remitente}>` : null}
                />
                {/* la clave nunca se muestra, ni un pedazo */}
                <Dato titulo="Clave" valor={estado.tieneClave ? "Puesta" : "Sin poner"} />
              </dl>
            </div>

            <BloqueDeBanda
              rotulo="Mandar uno de prueba"
              nota="Para verlo llegar con sus propios ojos."
            >
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mandar();
                }}
              >
                {/* Un campo de correo mide 360 px. Medía 1350 y era
                    el ejemplo más limpio del problema: no sobraba
                    aire, sobraba ancho. */}
                <div className="w-[360px] max-w-full">
                  <label
                    htmlFor="para"
                    className="mb-1.5 block"
                    style={{ fontSize: "0.8125rem" }}
                  >
                    A qué dirección
                  </label>
                  <input
                    id="para"
                    type="email"
                    required
                    className={CLASE_CONTROL}
                    value={para}
                    onChange={(e) => setPara(e.target.value)}
                    placeholder="usted@grupo-ae.com.co"
                  />
                </div>
                <Boton type="submit" disabled={ocupado || !estado.configurado}>
                  {ocupado ? "Mandando…" : "Mandar prueba"}
                </Boton>
              </form>
            </BloqueDeBanda>
          </div>
        </div>
      </Seccion>
    </div>
  );
}

/// Una nota dentro de un bloque: punto de color y texto.
///
/// Es el mismo idioma que `AvisoDeSeccion`, que era lo que
/// había aquí, pero esa es una BANDA --lleva su propio `px-6`
/// y su raya de abajo-- y metida dentro de un bloque quedaba
/// sangrada dos veces y con una raya suelta en medio.
function Nota({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span
        aria-hidden
        className="h-[6px] w-[6px] shrink-0 -translate-y-px rounded-full"
        style={{ background: color }}
      />
      <div
        className="min-w-0 max-w-[68ch] flex-1"
        style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}
      >
        {children}
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string | null }) {
  return (
    <div>
      {/* El rótulo va en `dt` y no en un `div` con la clase: en
          una lista de definiciones el par dt/dd es lo que hace
          que un lector de pantalla los lea juntos. */}
      <dt
        className="font-bold uppercase text-texto-suave"
        style={{ fontSize: "0.625rem", letterSpacing: "0.11em", lineHeight: 1.2 }}
      >
        {titulo}
      </dt>
      <dd
        className="mt-1 [overflow-wrap:anywhere] tabular-nums"
        style={{ fontSize: "0.8125rem" }}
      >
        {valor ?? <span className="text-texto-suave">—</span>}
      </dd>
    </div>
  );
}
