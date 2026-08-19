"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import {
  adminApi,
  ROLES_DE_CONVENIO,
  type AdminActual,
  type RolAdmin,
  type RolConvenio,
} from "@/lib/admin-api";
import { Pildora } from "@/components/admin/piezas";
import { ErrorApi } from "@/lib/api";

const ROLES: Array<{ valor: RolAdmin; etiqueta: string; descripcion: string }> = [
  {
    valor: "SUPERADMIN",
    etiqueta: "Superadministrador",
    descripcion: "Todo, incluido crear y desactivar usuarios.",
  },
  {
    valor: "GESTOR",
    etiqueta: "Gestor",
    descripcion: "Publica formación y cambia la apariencia. No toca usuarios.",
  },
  { valor: "CONSULTA", etiqueta: "Consulta", descripcion: "Solo mira." },
];

export default function PaginaUsuarios() {
  const { admin } = useAdmin();
  const [usuarios, setUsuarios] = useState<AdminActual[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claveNueva, setClaveNueva] = useState<{ correo: string; clave: string } | null>(
    null,
  );

  const cargar = useCallback(async () => {
    setUsuarios(await adminApi.usuarios());
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function conError(accion: () => Promise<void>) {
    setError(null);
    try {
      await accion();
      await cargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-texto-suave">
          Quién puede entrar al panel y qué puede hacer.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {claveNueva && (
        <Aviso tipo="exito">
          <p className="font-medium">Contraseña temporal para {claveNueva.correo}</p>
          <p className="mt-2 font-mono text-lg tracking-wide">{claveNueva.clave}</p>
          <p className="mt-2">
            Cópiela ahora y entréguela por un canal seguro:{" "}
            <strong>no se vuelve a mostrar</strong>. Al entrar tendrá que cambiarla.
          </p>
          <button onClick={() => setClaveNueva(null)} className="mt-3 underline">
            Ya la copié
          </button>
        </Aviso>
      )}

      <FormularioNuevoUsuario
        alCrear={(correo, clave) => {
          setClaveNueva({ correo, clave });
          void cargar();
        }}
        alFallar={setError}
      />

      <Tarjeta titulo="Cuentas">
        {!usuarios && <p className="text-texto-suave">Cargando…</p>}

        <ul className="divide-y divide-borde">
          {usuarios?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
              <div className="min-w-48 grow">
                <p className="font-medium">
                  {u.nombre}
                  {u.id === admin.id && (
                    <span className="ml-2 text-xs text-texto-suave">(usted)</span>
                  )}
                </p>
                <p className="text-sm text-texto-suave">{u.correo}</p>
                {u.debeCambiarClave && (
                  <p className="mt-1 text-xs text-aviso">
                    Aún no ha cambiado su contraseña temporal
                  </p>
                )}

                {/* sin concesion no ve nada, y eso hay que verlo */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {u.concesiones?.length ? (
                    u.concesiones.map((c) => (
                      <Pildora key={c.convenioId} tono="marca">
                        {c.sigla} ·{" "}
                        {ROLES_DE_CONVENIO.find((r) => r.valor === c.rol)?.etiqueta ??
                          c.rol}
                      </Pildora>
                    ))
                  ) : (
                    <Pildora tono="error">
                      Sin convenios: no ve ninguna pantalla
                    </Pildora>
                  )}
                </div>
              </div>

              <select
                value={u.rol}
                disabled={u.id === admin.id}
                onChange={(e) =>
                  conError(async () => {
                    await adminApi.actualizarUsuario(u.id, {
                      rol: e.target.value as RolAdmin,
                    });
                  })
                }
                className="rounded-lg border border-borde px-2 py-1.5 text-sm disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.etiqueta}
                  </option>
                ))}
              </select>

              <div className="flex gap-3 text-sm">
                <button
                  onClick={() =>
                    conError(async () => {
                      const { claveTemporal } = await adminApi.reiniciarClave(u.id);
                      setClaveNueva({ correo: u.correo, clave: claveTemporal });
                    })
                  }
                  disabled={u.id === admin.id}
                  className="text-marca underline disabled:opacity-40"
                >
                  Nueva contraseña
                </button>
                <button
                  onClick={() =>
                    conError(async () => {
                      await adminApi.actualizarUsuario(u.id, { activo: !u.activo });
                    })
                  }
                  disabled={u.id === admin.id}
                  className={`underline disabled:opacity-40 ${
                    u.activo ? "text-error" : "text-exito"
                  }`}
                >
                  {u.activo ? "Desactivar" : "Reactivar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}

type Convenio = { id: string; slug: string; sigla: string | null };

function FormularioNuevoUsuario({
  alCrear,
  alFallar,
}: {
  alCrear: (correo: string, clave: string) => void;
  alFallar: (mensaje: string) => void;
}) {
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolAdmin>("GESTOR");
  const [creando, setCreando] = useState(false);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  // por convenio, el rol elegido. Sin entrada, no entra
  const [porConvenio, setPorConvenio] = useState<Record<string, RolConvenio | "">>({});

  useEffect(() => {
    void adminApi.convenios().then(setConvenios);
  }, []);

  const concesiones = Object.entries(porConvenio)
    .filter(([, r]) => r)
    .map(([convenioId, r]) => ({ convenioId, rol: r as RolConvenio }));

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!concesiones.length) {
      alFallar("Marque al menos un convenio: sin ninguno, la cuenta no vería nada.");
      return;
    }
    setCreando(true);
    try {
      const { claveTemporal } = await adminApi.crearUsuario(
        correo,
        nombre,
        rol,
        concesiones,
      );
      alCrear(correo, claveTemporal);
      setCorreo("");
      setNombre("");
      setRol("GESTOR");
      setPorConvenio({});
    } catch (e) {
      alFallar((e as ErrorApi).message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Crear usuario"
      descripcion="Se genera una contraseña temporal que se muestra una sola vez. Quien entre con ella tendrá que cambiarla."
    >
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Correo">
          <input
            required
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className={CLASE_CONTROL}
          />
        </Campo>

        <Campo etiqueta="Nombre completo">
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={CLASE_CONTROL}
          />
        </Campo>

        <Campo etiqueta="Rol" ayuda={ROLES.find((r) => r.valor === rol)?.descripcion}>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as RolAdmin)}
            className={CLASE_CONTROL}
          >
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium">A qué convenios entra</p>
          <p className="mb-3 text-xs text-texto-suave">
            Sin marcar ninguno, la cuenta entra al panel y no ve una sola
            pantalla. El rol se elige por convenio: se puede llevar un área en
            uno y otra en el otro.
          </p>

          <div className="space-y-2">
            {convenios.map((c) => {
              const elegido = porConvenio[c.id] ?? "";
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-borde p-3"
                >
                  <label className="flex min-w-40 items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(elegido)}
                      onChange={(e) =>
                        setPorConvenio((p) => ({
                          ...p,
                          [c.id]: e.target.checked ? "GESTOR_INSCRIPCION" : "",
                        }))
                      }
                    />
                    {c.sigla ?? c.slug}
                  </label>

                  {elegido && (
                    <select
                      value={elegido}
                      onChange={(e) =>
                        setPorConvenio((p) => ({
                          ...p,
                          [c.id]: e.target.value as RolConvenio,
                        }))
                      }
                      className={`${CLASE_CONTROL} sm:max-w-md`}
                      aria-label={`Rol en ${c.sigla ?? c.slug}`}
                    >
                      {ROLES_DE_CONVENIO.map((r) => (
                        <option key={r.valor} value={r.valor}>
                          {r.etiqueta}
                        </option>
                      ))}
                    </select>
                  )}

                  {elegido && (
                    <p className="w-full text-xs text-texto-suave">
                      {ROLES_DE_CONVENIO.find((r) => r.valor === elegido)?.descripcion}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-end">
          <Boton type="submit" disabled={creando}>
            {creando ? "Creando…" : "Crear usuario"}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
