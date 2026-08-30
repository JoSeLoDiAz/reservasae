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
  type Concesion,
  type RolAdmin,
  type RolConvenio,
} from "@/lib/admin-api";
import { Pildora } from "@/components/admin/piezas";
import { ErrorApi } from "@/lib/api";

/**
 * RolAdmin ya solo dice una cosa: si administra el
 * sistema o no. El trabajo del día a día lo decide el rol
 * DE CONVENIO, y tener dos listas llamadas «Rol» hacía
 * que una contradijera a la otra.
 */
const ROLES: Array<{ valor: RolAdmin; etiqueta: string; descripcion: string }> = [
  {
    valor: "SUPERADMIN",
    etiqueta: "Sí, administra el sistema",
    descripcion:
      "Crea cuentas, publica formularios, cambia la apariencia y puede borrar datos.",
  },
  {
    valor: "GESTOR",
    etiqueta: "No, solo su trabajo",
    descripcion: "Lo que ve y hace lo deciden los convenios y roles de abajo.",
  },
];

export default function PaginaUsuarios() {
  const { admin } = useAdmin();
  const [usuarios, setUsuarios] = useState<AdminActual[] | null>(null);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claveNueva, setClaveNueva] = useState<{ correo: string; clave: string } | null>(
    null,
  );

  const cargar = useCallback(async () => {
    setUsuarios(await adminApi.usuarios());
    setConvenios(await adminApi.convenios());
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
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Usuarios</h1>
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

                {/* EL ROL PRIMERO, y con su nombre completo.

                    Lo prominente era «Administra el sistema»,
                    que es una casilla de sí o no; el rol —que
                    es lo que de verdad decide qué ve y qué
                    toca esta persona todos los días— salía
                    debajo, en letra chica y abreviado.

                    Sin concesión no ve NADA, y eso hay que
                    verlo de una. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {u.rol === "SUPERADMIN" && (
                    <Pildora tono="aviso">
                      Administra el sistema · ve y toca todo
                    </Pildora>
                  )}
                  {u.concesiones?.length ? (
                    u.concesiones.map((c) => (
                      <Pildora key={c.convenioId} tono="marca">
                        {ROLES_DE_CONVENIO.find((r) => r.valor === c.rol)
                          ?.etiqueta ?? c.rol}{" "}
                        en {c.sigla}
                      </Pildora>
                    ))
                  ) : u.rol === "SUPERADMIN" ? null : (
                    <Pildora tono="error">
                      Sin rol en ningún gremio: no ve ninguna pantalla
                    </Pildora>
                  )}
                </div>
              </div>

              <label className="text-sm">
                <span className="mb-1 block text-xs text-texto-suave">
                  ¿Administra el sistema?
                </span>
                <select
                  value={u.rol === "SUPERADMIN" ? "SUPERADMIN" : "GESTOR"}
                  disabled={u.id === admin.id}
                  onChange={(e) =>
                    conError(async () => {
                      await adminApi.actualizarUsuario(u.id, {
                        rol: e.target.value as RolAdmin,
                      });
                    })
                  }
                  className="rounded-xl border border-borde px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  <option value="SUPERADMIN">Sí</option>
                  <option value="GESTOR">No</option>
                </select>
              </label>

              <div className="flex gap-3 text-sm">
                <button
                  onClick={() => setEditando(editando === u.id ? null : u.id)}
                  className="text-marca underline"
                >
                  {editando === u.id ? "Cerrar" : "Convenios"}
                </button>
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

              {editando === u.id && (
                <div className="w-full">
                  <EditorConcesiones
                    usuario={u}
                    convenios={convenios}
                    alGuardar={async (concesiones) => {
                      await conError(async () => {
                        await adminApi.actualizarUsuario(u.id, { concesiones });
                      });
                      setEditando(null);
                    }}
                  />
                </div>
              )}
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
      <form onSubmit={enviar} className="grid sm:grid-cols-2">
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

        <Campo
          etiqueta="¿Administra el sistema?"
          ayuda={ROLES.find((r) => r.valor === rol)?.descripcion}
        >
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
            {convenios.map((c) => (
              <FilaConvenio
                key={c.id}
                convenio={c}
                valor={porConvenio[c.id] ?? ""}
                alCambiar={(rol) => setPorConvenio((p) => ({ ...p, [c.id]: rol }))}
              />
            ))}
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

/**
 * Marcar convenio y elegir su rol. Lo comparten crear y
 * editar: eran la misma decisión escrita dos veces.
 */
function EditorConcesiones({
  usuario,
  convenios,
  alGuardar,
}: {
  usuario: AdminActual;
  convenios: Convenio[];
  alGuardar: (concesiones: Concesion[]) => Promise<void>;
}) {
  const inicial: Record<string, RolConvenio | ""> = {};
  for (const c of usuario.concesiones ?? []) inicial[c.convenioId] = c.rol;

  const [porConvenio, setPorConvenio] = useState(inicial);
  const [guardando, setGuardando] = useState(false);

  const concesiones = Object.entries(porConvenio)
    .filter(([, r]) => r)
    .map(([convenioId, r]) => ({ convenioId, rol: r as RolConvenio }));

  return (
    <div className="mt-3 rounded-xl border border-borde bg-superficie-alterna p-4">
      <p className="mb-3 text-sm font-medium">
        A qué convenios entra {usuario.nombre.split(" ")[0]}
      </p>

      <div className="space-y-2">
        {convenios.map((c) => (
          <FilaConvenio
            key={c.id}
            convenio={c}
            valor={porConvenio[c.id] ?? ""}
            alCambiar={(rol) => setPorConvenio((p) => ({ ...p, [c.id]: rol }))}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Boton
          type="button"
          disabled={guardando || concesiones.length === 0}
          onClick={async () => {
            setGuardando(true);
            await alGuardar(concesiones);
            setGuardando(false);
          }}
        >
          {guardando ? "Guardando…" : "Guardar convenios"}
        </Boton>
        {concesiones.length === 0 && (
          <span className="text-xs text-error">
            Sin ninguno no vería nada: desactive la cuenta en vez de dejarla así.
          </span>
        )}
      </div>
    </div>
  );
}

function FilaConvenio({
  convenio,
  valor,
  alCambiar,
}: {
  convenio: Convenio;
  valor: RolConvenio | "";
  alCambiar: (rol: RolConvenio | "") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-superficie p-3">
      <label className="flex min-w-40 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={Boolean(valor)}
          onChange={(e) => alCambiar(e.target.checked ? "GESTOR_INSCRIPCION" : "")}
        />
        {convenio.sigla ?? convenio.slug}
      </label>

      {valor && (
        <>
          <select
            value={valor}
            onChange={(e) => alCambiar(e.target.value as RolConvenio)}
            className={`${CLASE_CONTROL} sm:max-w-md`}
            aria-label={`Rol en ${convenio.sigla ?? convenio.slug}`}
          >
            {ROLES_DE_CONVENIO.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
          <p className="w-full text-xs text-texto-suave">
            {ROLES_DE_CONVENIO.find((r) => r.valor === valor)?.descripcion}
          </p>
        </>
      )}
    </div>
  );
}
