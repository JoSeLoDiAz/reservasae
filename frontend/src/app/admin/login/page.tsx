"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConmutadorTema, useMarca } from "@/components/marca-publica";
import { adminApi, urlLogo } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

export default function PaginaAcceso() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setEntrando(true);
    try {
      await adminApi.iniciarSesion(correo, clave);
      // replace: no dejar el acceso en el historial
      router.replace("/admin");
    } catch (e) {
      setError((e as ErrorApi).message);
      setEntrando(false);
    }
  }

  const clase =
    "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3.5 py-2.5 text-texto " +
    "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* el panel de marca: solo desde lg, o roba la pantalla */}
      <section className="relative hidden flex-col justify-between bg-marca p-10 text-marca-texto lg:flex">
        <Marca />

        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-bold">
            De los cupos apartados a las personas formadas.
          </h2>
          <p className="mt-4 text-sm leading-relaxed opacity-80">
            Aquí se sigue cada organización que reservó, cada persona inscrita y
            cómo avanza su formación.
          </p>
        </div>

        <p className="text-xs opacity-60">Convoca · panel de gestión</p>
      </section>

      <section className="relative flex items-center justify-center p-6 lg:p-10">
        <div className="absolute top-4 right-4">
          <ConmutadorTema compacto />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Marca claro />
          </div>

          <h1 className="text-2xl font-bold">Bienvenido</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Entre con el correo con el que le crearon la cuenta.
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Correo</span>
              <input
                required
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className={clase}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Contraseña</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className={clase}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-error/30 bg-error-suave p-3 text-sm text-error"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={entrando}
              className="w-full rounded-xl bg-marca px-5 py-2.5 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
            >
              {entrando ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-8 text-xs text-texto-suave">
            ¿No tiene cuenta? Las crea un administrador del sistema.
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * Los logos que el administrador subió. Van sobre una
 * placa blanca fija —la otra excepción a los tokens, como
 * la franja— porque un logo institucional se diseña para
 * papel: sobre el color de marca o en modo oscuro
 * desaparecería la mitad. Sin logos, la inicial.
 */
function Marca({ claro = false }: { claro?: boolean }) {
  const { marca } = useMarca();
  const logos = marca?.logos ?? [];
  const nombre = marca?.nombreApp ?? "Convoca";

  if (logos.length) {
    return (
      // self-start: en una columna flex, si no, la placa
      // se estira a todo el ancho y queda una caja vacia
      <div className="flex w-fit max-w-full flex-wrap items-center gap-x-5 gap-y-3 self-start rounded-2xl bg-white px-5 py-3.5 shadow-sm">
        {logos.map((logo) => (
          // <img>: tamano desconocido y ya viene cacheado
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logo.id}
            src={urlLogo(logo)}
            alt={logo.etiqueta}
            className="h-10 w-auto max-w-[9rem] object-contain"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl text-base font-bold ${
          claro ? "bg-marca text-marca-texto" : "bg-marca-texto/15"
        }`}
      >
        {nombre[0]?.toUpperCase() ?? "C"}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-bold">{nombre}</span>
        <span className={`text-xs ${claro ? "text-texto-suave" : "opacity-70"}`}>
          panel de gestión
        </span>
      </span>
    </div>
  );
}
