"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FirmaConvoca, PieDeConvoca } from "@/components/firma-convoca";
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
    /// La altura RESTA la franja de pruebas.
    ///
    /// Con `min-h-dvh` a secas la pantalla medía toda la
    /// ventana empezando 2,25rem más abajo, así que al body le
    /// sobraba justo la altura de la franja: un scroll de 36 px
    /// que no lleva a ninguna parte. En producción no se veía
    /// porque allí no hay franja.
    <div
      style={{ minHeight: "calc(100dvh - var(--franja-alto, 0px))" }}
      className="grid lg:grid-cols-2"
    >
      {/* el panel de marca: solo desde lg, o roba la pantalla */}
      <section className="relative hidden flex-col justify-between bg-marca p-10 text-marca-texto lg:flex">
        {/* Convoca ARRIBA y grande, y el cliente debajo.
            Al contrario que en el panel, y a proposito: esta
            es la puerta del PRODUCTO, no la cara publica del
            gremio. Quien entra por aqui trabaja el sistema;
            quien llega al formulario viene por su gremio. */}
        <div className="space-y-7">
          <FirmaConvoca tamano={56} />
          <Marca />
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-bold">
            De los cupos apartados a las personas formadas.
          </h2>
          <p className="mt-4 text-sm leading-relaxed opacity-80">
            Aquí se sigue cada organización que reservó, cada persona inscrita y
            cómo avanza su formación.
          </p>
        </div>

      </section>

      <section className="relative flex items-center justify-center p-6 lg:p-10">
        <div className="absolute top-4 right-4">
          <ConmutadorTema compacto />
        </div>

        <div className="w-full max-w-sm">
          {/* En movil el panel de marca no existe, asi que
              esta es la unica cabecera: Convoca arriba y el
              cliente debajo, igual que en el panel grande. */}
          <div className="mb-8 space-y-5 lg:hidden">
            <FirmaConvoca tamano={44} />
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

          {/* el pie legal: en el lado del formulario, que es el
              unico que se ve en movil */}
          <PieDeConvoca className="mt-6 border-t border-borde pt-4" />
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

  if (logos.length) {
    return (
      // self-start: en una columna flex, si no, la placa
      // se estira a todo el ancho y queda una caja vacia
      /// Mas grandes que antes, pero por DEBAJO de Convoca.
      ///
      /// 48 px contra los 56 del signo: se ven de verdad y
      /// siguen leyendose como la segunda linea. Igualarlos
      /// dejaria dos cosas peleando por el mismo sitio.
      <div className="flex w-fit max-w-full flex-wrap items-center gap-x-6 gap-y-3 self-start rounded-2xl bg-white px-6 py-4 shadow-sm">
        {logos.map((logo) => (
          // <img>: tamano desconocido y ya viene cacheado
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logo.id}
            src={urlLogo(logo)}
            alt={logo.etiqueta}
            className="h-12 w-auto max-w-[10.5rem] object-contain"
          />
        ))}
      </div>
    );
  }

  /// Sin logos NO se pinta nada.
  ///
  /// Antes salía una placa de respaldo con la inicial y el
  /// nombre. El problema es que justo encima ya está la firma
  /// de Convoca, así que en un gremio sin logos cargados la
  /// pantalla decía «Convoca» dos veces seguidas, una debajo
  /// de la otra, con dos tipografías distintas.
  ///
  /// Un hueco es mejor que una repetición: la firma de arriba
  /// ya identifica el producto. En cuanto el gremio cargue sus
  /// logos, la rama de arriba los pinta.
  return null;
}
