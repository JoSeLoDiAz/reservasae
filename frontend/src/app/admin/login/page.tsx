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
  const [verClave, setVerClave] = useState(false);
  /// Si el Bloq Mayus esta puesto. `null` mientras no se ha
  /// tocado el campo: no se avisa de algo que no se sabe.
  const [mayusculas, setMayusculas] = useState(false);

  /// `getModifierState` es lo unico que lo dice, y solo dentro
  /// de un evento de teclado: no se puede consultar al cargar.
  /// Por eso el aviso aparece al escribir y no antes.
  const mirarMayusculas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setMayusculas(e.getModifierState("CapsLock"));
  };
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
          <FirmaConvoca tamano={56} animado />
          <Marca />
        </div>

        <div className="login-entra max-w-md" style={{ "--retraso": "980ms" } as React.CSSProperties}>
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
            <FirmaConvoca tamano={44} animado />
            <Marca claro />
          </div>

          {/* El lado derecho entra escalonado, DETRAS de la
              firma: el saludo, los campos y el boton.

              Empieza a los 700 ms, que es cuando la firma ya ha
              dicho lo suyo. Antes se leerian como dos cosas
              pasando a la vez. */}
          <div
            className="login-entra"
            style={{ "--retraso": "700ms" } as React.CSSProperties}
          >
            <h1 className="text-2xl font-bold">Bienvenido</h1>
            <p className="mt-1 text-sm text-texto-suave">
              Entre con el correo con el que le crearon la cuenta.
            </p>
          </div>

          <form
            onSubmit={enviar}
            className="login-entra mt-8 space-y-4"
            style={{ "--retraso": "840ms" } as React.CSSProperties}
          >
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
              <div className="relative">
                <input
                  required
                  type={verClave ? "text" : "password"}
                  autoComplete="current-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  /// Se mira al PULSAR y al SOLTAR. Solo con `keyup` no se
                  /// entera hasta la segunda letra; solo con `keydown`, la
                  /// propia tecla Bloq Mayus no se refleja hasta la
                  /// siguiente.
                  onKeyDown={mirarMayusculas}
                  onKeyUp={mirarMayusculas}
                  className={clase + " pr-11"}
                />
                {/* El ojito, y no es comodidad.

                    Una contraseña que no se puede leer se teclea a
                    ciegas, y en un teclado ajeno o con el movil en la
                    mano eso es la mitad de los «correo o contraseña
                    incorrectos».

                    `tabIndex={-1}`: el tabulador va del campo al boton
                    de entrar, que es lo que espera quien escribe. */}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? "Ocultar la contraseña" : "Ver la contraseña"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-texto-suave transition hover:text-texto"
                >
                  <Ojo abierto={verClave} />
                </button>
              </div>

              {/* Bloq Mayus, que es la otra mitad del problema.

                  Con la contraseña en puntos no hay forma de verlo, y el
                  mensaje que sale despues dice «incorrectos» sin decir
                  por que. Se avisa MIENTRAS escribe, no al fallar. */}
              {mayusculas && (
                <p className="mt-1.5 text-xs text-aviso" role="status">
                  Tiene el Bloq Mayus activado.
                </p>
              )}
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
              className="w-full rounded-xl bg-marca px-5 py-2.5 font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
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
    /// EL ALTO DEPENDE DE CUANTOS SON.
    ///
    /// Con uno solo puede lucirse; con tres tienen que caber en
    /// el ancho del panel sin espicharse. Fijarlo en un numero
    /// deja el caso de uno pequeño o el de tres desbordado, y
    /// aqui pasaba lo primero: a 48 px la bajada del logo de
    /// ADECOPRIA no se leia.
    ///
    /// Es la misma regla que ya usa la barra del panel, donde el
    /// ancho maximo tambien sale de la cuenta.
    const alto =
      logos.length >= 3
        ? 'h-[5.5rem] max-w-[11rem]'
        : logos.length === 2
          ? 'h-[6.5rem] max-w-[14rem]'
          : 'h-[7.5rem] max-w-[19rem]';

    return (
      // self-start: en una columna flex, si no, la placa
      // se estira a todo el ancho y queda una caja vacia
      /// Y SIGUE POR DEBAJO DE CONVOCA EN JERARQUIA, aunque
      /// ahora sea mas alto que el signo. Quien manda es la
      /// POSICION: el signo va arriba con su nombre y su linea;
      /// este, debajo y en su placa.
      <div className="login-placa flex w-fit max-w-full flex-wrap items-center gap-x-7 gap-y-4 self-start rounded-2xl bg-white px-7 py-5">
        {logos.map((logo) => (
          // <img>: tamano desconocido y ya viene cacheado
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logo.id}
            src={urlLogo(logo)}
            alt={logo.etiqueta}
            className={`w-auto object-contain ${alto}`}
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

/**
 * El ojo, dibujado y no importado.
 *
 * Mismo criterio que `iconos.tsx`: traerse un paquete de mil
 * iconos por uno engorda el bundle y añade algo que mantener.
 * Toma el color del texto, así que sirve en las dos paletas.
 */
function Ojo({ abierto }: { abierto: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {/* Tachado cuando la contraseña está A LA VISTA: el icono
          dice lo que pasa AHORA, no lo que hace el botón. Al
          revés, quien lo mira cree que está oculta. */}
      {abierto && <path d="m4 4 16 16" />}
    </svg>
  );
}
