"use client";

import { useState } from "react";

import { Bloque } from "@/components/admin/piezas";
import { FormularioCambioClave } from "@/components/admin/cambio-clave";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  useAdmin,
} from "@/components/admin/marco-admin";
import { FirmaConvoca, useEstado } from "@/components/firma-convoca";
import { adminApi, comoSePresenta } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

export default function PaginaPerfil() {
  const { admin, refrescar } = useAdmin();

  const [datos, setDatos] = useState({
    nombre: admin.nombre,
    cargo: admin.cargo ?? "",
    celular: admin.celular ?? "",
    organizacion: admin.organizacion ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  function cambiar(campo: keyof typeof datos, valor: string) {
    setDatos((p) => ({ ...p, [campo]: valor }));
    setGuardado(false);
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await adminApi.actualizarPerfil(datos);
      await refrescar();
      setGuardado(true);
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4 pb-6">
      <header>
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Mi perfil</h1>
        <p className="mt-1 text-texto-suave">
          {admin.correo} · {comoSePresenta(admin)}
        </p>
      </header>

      <Bloque titulo="Mis datos">
        {/* `space-y-5` y no 4: entre el pie de un campo y el
            rótulo del siguiente había menos aire que entre el
            rótulo y su propia caja, así que cada etiqueta se
            leía pegada al campo de ARRIBA en vez de al suyo. */}
        <form onSubmit={guardar} className="space-y-5">
          <Campo etiqueta="Nombre completo">
            <input
              required
              value={datos.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>

          {/* Sin `gap`, «Cargo» y «Celular» se tocaban: las dos
              cajas quedaban pegadas por el costado. */}
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Campo etiqueta="Cargo">
              <input
                value={datos.cargo}
                onChange={(e) => cambiar("cargo", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>
            <Campo etiqueta="Celular">
              <input
                value={datos.celular}
                onChange={(e) => cambiar("celular", e.target.value)}
                inputMode="tel"
                className={CLASE_CONTROL}
              />
            </Campo>
          </div>

          <Campo etiqueta="Organización">
            <input
              value={datos.organizacion}
              onChange={(e) => cambiar("organizacion", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>

          {error && <Aviso tipo="error">{error}</Aviso>}
          {guardado && !error && <Aviso tipo="exito">Datos guardados.</Aviso>}

          {/* Separado por la raya: es el final del formulario y
              nacía contra la caja de «Organización». */}
          <div className="border-t border-hairline pt-5">
            <Boton type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Boton>
          </div>
        </form>
      </Bloque>

      <Bloque
        titulo="Cambiar mi contraseña"
        descripcion="El correo no se puede cambiar desde aquí: es el identificador de la cuenta."
      >
        <FormularioCambioClave alTerminar={refrescar} />
      </Bloque>

      <SobreConvoca />
    </div>
  );
}

/**
 * Qué es esto y qué versión está corriendo.
 *
 * Va en el perfil porque es donde uno mira cuando quiere
 * saber «¿dónde estoy y con qué?»: al reportar un problema,
 * el dato que siempre falta es la versión, y hasta ahora la
 * única forma de saberla era abrir /api/estado a mano.
 */
function SobreConvoca() {
  const estado = useEstado();
  const ano = estado ? new Date(estado.hora).getFullYear() : null;
  const enPruebas = (estado?.version ?? "").includes("prueba");

  return (
    <Bloque titulo="Sobre Convoca CRM">
      <div className="space-y-5">
        <FirmaConvoca tamano={40} />

        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Dato titulo="Versión" valor={estado?.version ?? "…"} mono />
          <Dato
            titulo="Entorno"
            valor={
              !estado
                ? "…"
                : enPruebas
                  ? "Pruebas · los datos son inventados"
                  : "Producción · datos reales"
            }
          />
          <Dato titulo="Gestionado por" valor="Grupo AE" />
          <Dato
            titulo="Derechos"
            valor={ano ? `© ${ano}, todos los derechos reservados` : "…"}
          />
        </dl>

        <p className="text-sm text-texto-suave">
          La versión sale del propio servidor, no de una constante escrita a
          mano: es la que de verdad está corriendo. Si va a reportar algo, es el
          dato que conviene copiar.
        </p>
      </div>
    </Bloque>
  );
}

/** Una etiqueta con su valor. */
function Dato({
  titulo,
  valor,
  mono,
}: {
  titulo: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
        {titulo}
      </dt>
      <dd className={`mt-0.5 ${mono ? "font-mono text-[0.95rem]" : ""}`}>
        {valor}
      </dd>
    </div>
  );
}
