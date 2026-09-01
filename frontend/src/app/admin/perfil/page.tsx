"use client";

import { useState } from "react";

import { FormularioCambioClave } from "@/components/admin/cambio-clave";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import { FirmaConvoca, useEstado } from "@/components/firma-convoca";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

const ROLES: Record<string, string> = {
  SUPERADMIN: "Superadministrador",
  GESTOR: "Gestor",
  CONSULTA: "Consulta",
};

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
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Mi perfil</h1>
        <p className="mt-1 text-texto-suave">
          {admin.correo} · {ROLES[admin.rol] ?? admin.rol}
        </p>
      </header>

      <Tarjeta titulo="Mis datos">
        <form onSubmit={guardar} className="space-y-4">
          <Campo etiqueta="Nombre completo">
            <input
              required
              value={datos.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>

          <div className="grid sm:grid-cols-2">
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

          <Boton type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Boton>
        </form>
      </Tarjeta>

      <Tarjeta
        titulo="Cambiar mi contraseña"
        descripcion="El correo no se puede cambiar desde aquí: es el identificador de la cuenta."
      >
        <FormularioCambioClave alTerminar={refrescar} />
      </Tarjeta>

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
    <Tarjeta titulo="Sobre Convoca CRM">
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
    </Tarjeta>
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
