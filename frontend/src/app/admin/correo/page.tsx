"use client";

/** Correo saliente: si sale y a dónde. */

/// Esta pantalla existe para contestar una sola pregunta:
/// «¿los correos que manda Convoca están saliendo?». Antes
/// había que abrir una consola para saberlo, y una alerta que
/// no sale se pierde en silencio -- que es la peor forma de
/// perderse.

import { useCallback, useEffect, useState } from "react";

import { Bloque, Cargando } from "@/components/admin/piezas";
import { Aviso, Boton, CLASE_CONTROL, useAdmin } from "@/components/admin/marco-admin";
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
      <Aviso tipo="error">{error}</Aviso>
    ) : (
      <Cargando />
    );
  }

  const sale = estado.configurado && estado.acepta;

  return (
    /// Sin cabecera propia, como el resto del panel. La miga
    /// de arriba ya dice «Campaña Mailing / Cuenta de correo».
    /// Lo que decía la bajada --si esto no está en verde no
    /// sale ningún aviso-- lo dice el propio semáforo de la
    /// primera tarjeta, que es donde se mira.
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4 pb-6">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="exito">{exito}</Aviso>}

      <Bloque titulo="Cómo está">
        <div className="space-y-4">
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
              rojo y verde solos no bastan: uno de cada doce
              hombres no los distingue, y el texto dice cuál es
              sin depender del color. */}
          <Nota color={sale ? "var(--exito)" : "var(--error)"}>
            <p className={`font-semibold ${sale ? "text-exito" : "text-error"}`}>
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
            <Nota color="var(--aviso)">
              <p className="font-semibold text-aviso">
                Todo el correo se desvía y no llega a su destinatario.
              </p>
              <p className="mt-0.5 text-texto-suave">
                Salga para quien salga, lo reciben{" "}
                <strong className="text-texto">
                  {estado.desviadoA.join(", ")}
                </strong>
                . Se quita borrando <code>CORREO_REDIRIGIR_A</code> del
                servidor.
              </p>
            </Nota>
          )}

          {estado.esPrueba && estado.desviadoA.length === 0 && (
            <Nota color="var(--error)">
              <p className="font-semibold text-error">
                Entorno de pruebas sin desvío: no va a salir ningún correo.
              </p>
              <p className="mt-0.5 text-texto-suave">
                Es a propósito. Con las credenciales de verdad puestas, un
                correo de prueba le llegaría a una persona real. Se arregla
                poniendo <code>CORREO_REDIRIGIR_A</code>.
              </p>
            </Nota>
          )}

          {/* Una raya y no otra caja: separa «cómo está» de
              «con qué está puesto», que es lo que se viene a
              mirar después. */}
          <dl className="grid gap-x-8 gap-y-3 border-t border-hairline pt-4 text-sm sm:grid-cols-2">
            <Dato titulo="Servidor" valor={estado.servidor} mono />
            <Dato titulo="Puerto" valor={String(estado.puerto)} mono />
            <Dato titulo="Cuenta" valor={estado.usuario} mono />
            <Dato
              titulo="Sale como"
              valor={estado.remitente ? `${estado.nombre} <${estado.remitente}>` : null}
            />
            {/* la clave nunca se muestra, ni un pedazo */}
            <Dato titulo="Clave" valor={estado.tieneClave ? "Puesta" : "Sin poner"} />
          </dl>
        </div>
      </Bloque>

      <Bloque
        titulo="Mandar uno de prueba"
        descripcion="Para verlo llegar con sus propios ojos."
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void mandar();
          }}
        >
          <div className="min-w-[18rem] flex-1">
            <label htmlFor="para" className="mb-1.5 block text-sm font-medium">
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
      </Bloque>
    </div>
  );
}

/// Una nota dentro de un bloque: punto de color y texto.
///
/// Es el mismo idioma que `AvisoDeSeccion`, que era lo que
/// había aquí, pero esa es una BANDA --lleva su propio `px-7`
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
        className="h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full"
        style={{ background: color }}
      />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Dato({
  titulo,
  valor,
  mono,
}: {
  titulo: string;
  valor: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-texto-suave">{titulo}</dt>
      <dd className={`mt-0.5 ${mono ? "font-mono text-[13px]" : ""}`}>
        {valor ?? <span className="text-texto-suave">—</span>}
      </dd>
    </div>
  );
}
