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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Mi perfil</h1>
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

          <div className="grid gap-4 sm:grid-cols-2">
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
    </div>
  );
}
