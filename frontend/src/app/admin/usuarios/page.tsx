"use client";

import { useCallback, useEffect, useState } from "react";

import { Desplegable } from "@/components/admin/desplegable";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  useAdmin,
} from "@/components/admin/marco-admin";
import {
  adminApi,
  AREAS,
  ETIQUETA_AREA,
  PERMISOS_POR_ROL,
  ROLES_DE_CONVENIO,
  type AdminActual,
  type Concesion,
  type Nivel,
  type RolAdmin,
  type RolConvenio,
} from "@/lib/admin-api";
import { Bloque, Pildora } from "@/components/admin/piezas";
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

/**
 * QUÉ VE CADA ROL, en una tabla y no en una frase.
 *
 * Antes cada rol traía una línea de descripción --«Todo lo del
 * gestor, y descarga los reportes al SENA»-- y con eso había
 * que adivinar si esa persona iba a poder abrir Reportes o
 * tocar la Configuración. Conceder a ciegas y enterarse después
 * es justo lo que no se quiere en la pantalla de permisos.
 *
 * Se lee como un comparativo: una fila por área del panel y una
 * columna por rol, con la marca en cada cruce. De un vistazo se
 * ve quién escribe, quién solo mira y quién no entra.
 *
 * NO se puede tocar: es la tabla que aplica el servidor. Lo que
 * se elige es el ROL, abajo, y esto dice qué trae cada uno.
 */
function MatrizDePermisos() {
  return (
    <Bloque
      titulo="Qué ve y qué toca cada rol"
      descripcion="El rol se elige por convenio. Esta tabla dice lo que trae cada uno; la aplica el servidor y no se puede editar aquí."
    >
      <div className="caja-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-borde bg-superficie px-3 py-2.5 text-left text-[0.6875rem] font-bold tracking-[0.05em] uppercase text-texto-suave">
                Área del panel
              </th>
              {ROLES_DE_CONVENIO.map((r) => (
                <th
                  key={r.valor}
                  title={r.descripcion}
                  className="border-b border-borde px-2 py-2.5 text-center align-bottom text-[0.71875rem] leading-tight font-semibold text-titulo"
                >
                  {r.etiqueta}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {AREAS.map((area, i) => (
              <tr key={area} className={i % 2 ? "bg-superficie-alterna/40" : undefined}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 border-b border-hairline px-3 py-2 text-left text-[0.8125rem] font-medium text-titulo ${
                    i % 2 ? "bg-superficie-alterna" : "bg-superficie"
                  }`}
                >
                  {ETIQUETA_AREA[area]}
                </th>

                {ROLES_DE_CONVENIO.map((r) => (
                  <td
                    key={r.valor}
                    className="border-b border-hairline px-2 py-2 text-center"
                  >
                    <Marca nivel={PERMISOS_POR_ROL[r.valor][area]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[0.75rem] text-texto-suave">
        <strong className="font-semibold text-texto">Edita</strong> puede crear
        y cambiar. <strong className="font-semibold text-texto">Ve</strong> solo
        consulta. Un guion es que esa área no le aparece en el menú.
      </p>
    </Bloque>
  );
}

/**
 * La marca de un cruce.
 *
 * Lleva PALABRA además de color e icono: «Edita» y «Ve» son dos
 * verdes que bajo deuteranopia quedan a menos de cinco de
 * distancia, y esta tabla es justo donde confundirlos concede
 * de más.
 */
function Marca({ nivel }: { nivel: Nivel }) {
  if (nivel === "NADA") {
    return (
      <span className="text-texto-suave" title="No entra">
        <span aria-hidden>—</span>
        <span className="sr-only">No entra</span>
      </span>
    );
  }

  const escribe = nivel === "ESCRIBIR";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[0.71875rem] font-semibold ${
        escribe ? "text-exito" : "text-texto-suave"
      }`}
    >
      <svg
        viewBox="0 0 14 14"
        className="size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 7.5l3.2 3.2L12 3.8" />
      </svg>
      {escribe ? "Edita" : "Ve"}
    </span>
  );
}

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
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4 pb-6">
      <header>
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

      <MatrizDePermisos />

      <Bloque titulo="Cuentas">
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

              {/* `div` y no `label`: el desplegable de la casa
                  es un `button`, y una etiqueta que envuelve un
                  botón no le pone nombre a nada --el clic en el
                  texto no lo activa--. El nombre se lo da
                  `etiquetaAria`. */}
              <div className="text-sm">
                <span className="mb-1 block text-xs text-texto-suave">
                  ¿Administra el sistema?
                </span>
                {/* El desplegable de la casa. El nativo lo pinta
                    el sistema operativo: se ve distinto en cada
                    navegador y en tema oscuro abre una lista
                    blanca. */}
                <Desplegable
                  valor={u.rol === "SUPERADMIN" ? "SUPERADMIN" : "GESTOR"}
                  desactivado={u.id === admin.id}
                  etiquetaAria={`¿${u.nombre} administra el sistema?`}
                  alElegir={(v) =>
                    conError(async () => {
                      await adminApi.actualizarUsuario(u.id, {
                        rol: v as RolAdmin,
                      });
                    })
                  }
                  opciones={[
                    { valor: "SUPERADMIN", etiqueta: "Sí" },
                    { valor: "GESTOR", etiqueta: "No" },
                  ]}
                />
              </div>

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
      </Bloque>
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
    <Bloque
      titulo="Crear usuario"
      descripcion="Se genera una contraseña temporal que se muestra una sola vez. Quien entre con ella tendrá que cambiarla."
    >
      {/* La rejilla iba SIN `gap`: los campos se tocaban, la
          ayuda de un campo quedaba pegada al rótulo del
          siguiente y el botón nacía contra la caja de convenios.
          Con aire, cada decisión se lee como una. */}
      <form onSubmit={enviar} className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
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
          {/* Con la descripción de cada rol como segunda línea:
              antes solo se leía la del rol YA elegido, debajo
              del campo. Elegir a ciegas y enterarse después de
              qué se acaba de conceder no es lo que uno quiere
              en la pantalla de permisos. */}
          <Desplegable
            valor={rol}
            alElegir={(v) => setRol(v as RolAdmin)}
            opciones={ROLES.map((r) => ({
              valor: r.valor,
              etiqueta: r.etiqueta,
              detalle: r.descripcion,
            }))}
          />
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

        {/* A lo ancho y separado por la raya: es el final del
            formulario, no una celda más de la rejilla. Metido en
            media columna nacía pegado a la caja de convenios. */}
        <div className="border-t border-hairline pt-5 sm:col-span-2">
          <Boton type="submit" disabled={creando}>
            {creando ? "Creando…" : "Crear usuario"}
          </Boton>
        </div>
      </form>
    </Bloque>
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
          <div className="min-w-56 flex-1 sm:max-w-md">
            <Desplegable
              valor={valor}
              alElegir={(v) => alCambiar(v as RolConvenio)}
              etiquetaAria={`Rol en ${convenio.sigla ?? convenio.slug}`}
              opciones={ROLES_DE_CONVENIO.map((r) => ({
                valor: r.valor,
                etiqueta: r.etiqueta,
                detalle: r.descripcion,
              }))}
            />
          </div>
          <p className="w-full text-xs text-texto-suave">
            {ROLES_DE_CONVENIO.find((r) => r.valor === valor)?.descripcion}
          </p>
        </>
      )}
    </div>
  );
}
