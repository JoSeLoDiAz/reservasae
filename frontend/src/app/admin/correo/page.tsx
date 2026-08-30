"use client";

/** Correo saliente: si sale y a dónde. */

/// Esta pantalla existe para contestar una sola pregunta:
/// «¿los correos que manda Convoca están saliendo?». Antes
/// había que abrir una consola para saberlo, y una alerta que
/// no sale se pierde en silencio -- que es la peor forma de
/// perderse.

import { useCallback, useEffect, useState } from "react";

import { Aviso, Boton, CLASE_CONTROL, Tarjeta, useAdmin } from "@/components/admin/marco-admin";
import { AvisoDeSeccion } from "@/components/admin/secciones";
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
      <p className="text-texto-suave">Cargando…</p>
    );
  }

  const sale = estado.configurado && estado.acepta;

  return (
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Correo saliente</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Por aquí salen los avisos que manda Convoca. Si esto no está en verde,
          no sale ninguno.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="exito">{exito}</Aviso>}

      <Tarjeta titulo="Cómo está">
        <div className="space-y-4">
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              sale
                ? "border-exito/30 bg-exito-suave text-exito"
                : "border-error/30 bg-error-suave text-error"
            }`}
          >
            <span className="text-lg leading-none">{sale ? "✓" : "✕"}</span>
            <div>
              <p className="font-medium">
                {sale
                  ? "El correo está saliendo."
                  : estado.configurado
                    ? "Está configurado, pero el servidor no lo acepta."
                    : "No está configurado."}
              </p>
              {estado.error && <p className="mt-1 text-sm">{estado.error}</p>}
              {!estado.configurado && (
                <p className="mt-1 text-sm">
                  Faltan <code>SMTP_SERVIDOR</code>, <code>SMTP_USUARIO</code> o{" "}
                  <code>SMTP_CLAVE</code> en el servidor.
                </p>
              )}
            </div>
          </div>

          {estado.desviadoA.length > 0 && (
            <AvisoDeSeccion color="var(--aviso)">
              <p className="font-semibold text-aviso">
                Todo el correo se desvía y no llega a su destinatario.
              </p>
              <p className="mt-1">
                Salga para quien salga, lo reciben{" "}
                <strong>{estado.desviadoA.join(", ")}</strong>. Se quita
                borrando <code>CORREO_REDIRIGIR_A</code> del servidor.
              </p>
            </AvisoDeSeccion>
          )}

          {estado.esPrueba && estado.desviadoA.length === 0 && (
            <AvisoDeSeccion color="var(--error)">
              <p className="font-semibold text-error">
                Entorno de pruebas sin desvío: no va a salir ningún correo.
              </p>
              <p className="mt-1">
                Es a propósito. Con las credenciales de verdad puestas, un
                correo de prueba le llegaría a una persona real. Se arregla
                poniendo <code>CORREO_REDIRIGIR_A</code>.
              </p>
            </AvisoDeSeccion>
          )}

          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
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
      </Tarjeta>

      <Tarjeta
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
      </Tarjeta>
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
