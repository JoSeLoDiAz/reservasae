"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

import { Desplegable } from "@/components/admin/desplegable";
import { IconoDerecha } from "@/components/admin/iconos";
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
  type Nivel,
  type RolAdmin,
  type RolConvenio,
} from "@/lib/admin-api";
import { Bloque, Encabezado } from "@/components/admin/piezas";
import { Rotulo } from "@/components/admin/bloques";
import {
  Celda,
  ListaEnColumnas,
  Seccion,
  SOLO_ANCHA,
  type ColumnaDeLista,
} from "@/components/admin/secciones";
import { enMomento } from "@/lib/en-fecha";
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
    descripcion: "Lo que ve y hace lo deciden las líneas de negocio y roles de abajo.",
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
 *
 * NACE CERRADA, y esa es la corrección de ancho de esta
 * pantalla en su eje vertical. Es una tabla de CONSULTA --se
 * mira para resolver una duda concreta, no para decidir nada
 * aquí-- y abierta ocupa 380 px encima de la lista de cuentas.
 * Con ella y el formulario de creación abiertos a la vez, a
 * 1920x1080 no se veía UNA SOLA cuenta sin desplazar, en la
 * pantalla que existe para mirar las cuentas.
 */
function MatrizDePermisos() {
  return (
    <Bloque
      plegable
      titulo="Qué ve y qué toca cada rol"
      descripcion="El rol se elige por línea de negocio. Esta tabla dice lo que trae cada uno; la aplica el servidor y no se puede editar aquí."
    >
      {/* La tabla va a sangre y se desplaza en horizontal: es
          contenido de trabajo, no prosa. */}
      <div className="caja-scroll overflow-x-auto">
        <table className="dato w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              {/* Cabecera de tabla: rótulo en versalita sobre
                  blanco con una regla de 1 px debajo. Sin la
                  franja gris teñida, que era la única del panel
                  y por eso esta pantalla no se parecía a las
                  otras catorce. */}
              <th className="rotulo-bloque border-borde bg-superficie sticky left-0 z-10 border-b px-3 py-2 text-left">
                Área del panel
              </th>
              {ROLES_DE_CONVENIO.map((r) => (
                <th
                  key={r.valor}
                  title={r.descripcion}
                  className="rotulo-bloque border-borde border-b px-2 py-2 text-center align-bottom"
                >
                  {r.etiqueta}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {AREAS.map((area, i) => (
              <tr
                key={area}
                className={i % 2 ? "bg-tabla-fila-alterna" : undefined}
              >
                <th
                  scope="row"
                  className={`dato border-hairline sticky left-0 z-10 border-b px-3 py-[var(--pad-fila)] text-left ${
                    i % 2 ? "bg-tabla-fila-alterna" : "bg-superficie"
                  }`}
                >
                  {ETIQUETA_AREA[area]}
                </th>

                {ROLES_DE_CONVENIO.map((r) => (
                  <td
                    key={r.valor}
                    className="border-hairline border-b px-2 py-[var(--pad-fila)] text-center"
                  >
                    <Marca nivel={PERMISOS_POR_ROL[r.valor][area]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* «Edita» y «Ve» se distinguen por color, no por peso:
          el 600 está reservado para el estado. */}
      <p className="secundario prosa mt-3">
        <span className="text-exito">Edita</span> puede crear y cambiar.{" "}
        <span className="text-texto">Ve</span> solo consulta. Un guion es que esa
        área no le aparece en el menú.
      </p>
    </Bloque>
  );
}

/**
 * La marca de un cruce.
 *
 * Lleva PALABRA además de color: «Edita» y «Ve» son dos verdes
 * que bajo deuteranopia quedan a menos de cinco de distancia, y
 * esta tabla es justo donde confundirlos concede de más.
 *
 * Sin el visto de trazo que iba delante. Un icono existe solo
 * si es el único contenido de un botón, y aquí la palabra ya
 * está: eran ciento veinte vistos repartidos por la tabla
 * diciendo lo mismo que la palabra de al lado.
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
    <span className={`estado ${escribe ? "text-exito" : "text-texto-suave"}`}>
      {escribe ? "Edita" : "Ve"}
    </span>
  );
}

export default function PaginaUsuarios() {
  const { admin } = useAdmin();
  const [usuarios, setUsuarios] = useState<AdminActual[] | null>(null);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
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
    /// Las dos plantillas de columnas se declaran AQUÍ, en la
    /// raíz de la pantalla, y bajan por herencia hasta la
    /// cabecera y cada fila de la lista. Van en variables
    /// porque el número de columnas depende de cuántas líneas
    /// de negocio haya, que es un dato del producto y no de la
    /// maqueta: no se puede escribir en una clase fija.
    <div className="flex min-h-0 grow flex-col" style={medidas(convenios.length)}>
      {/* El botón relleno existe UNA VEZ por pantalla y vive en
          la cabecera. El formulario de creación ocupaba 460 px
          permanentes encima de la lista para una acción que en
          una empresa de diez personas se hace tres veces al
          año. */}
      <Encabezado
        titulo="Usuarios"
        descripcion="Quién puede entrar al panel y qué puede hacer."
      >
        {!creando && <Boton onClick={() => setCreando(true)}>Nuevo usuario</Boton>}
      </Encabezado>

      {(error || claveNueva) && (
        <div className="banda">
          {error && <Aviso tipo="error">{error}</Aviso>}

          {claveNueva && (
            <div className={error ? "mt-4" : undefined}>
              <p className="rotulo-bloque">
                Contraseña temporal para {claveNueva.correo}
              </p>
              <p className="cifra-columna mt-2">{claveNueva.clave}</p>
              <p className="secundario prosa mt-2">
                Cópiela ahora y entréguela por un canal seguro: no se vuelve a
                mostrar. Al entrar tendrá que cambiarla.
              </p>
              <button
                onClick={() => setClaveNueva(null)}
                className="dato text-marca mt-3 underline"
              >
                Ya la copié
              </button>
            </div>
          )}
        </div>
      )}

      {creando && (
        <FormularioNuevoUsuario
          alCerrar={() => setCreando(false)}
          alCrear={(correo, clave) => {
            setClaveNueva({ correo, clave });
            setCreando(false);
            void cargar();
          }}
          alFallar={setError}
        />
      )}

      <MatrizDePermisos />

      {/* LA LISTA, EN COLUMNAS.

          Cada cuenta ocupaba el ancho entero y apilaba sus
          datos en el 55 % izquierdo --nombre, correo, aviso de
          clave temporal y la ristra de roles, uno debajo de
          otro--, con el desplegable a 1360 px y las acciones al
          canto. Así se lee UN RENGLÓN A LA VEZ, y esta pantalla
          existe para la pregunta contraria: ¿quién administra?,
          ¿quién lleva la línea de personas?, ¿quién no ha
          entrado nunca? Todas se contestan bajando la vista por
          una columna, y ninguna se podía contestar.

          Y el rótulo «¿ADMINISTRA EL SISTEMA?» iba escrito una
          vez POR FILA: ocho veces la misma cabecera de columna,
          que es lo que es. */}
      <Seccion>
        <div className="px-6 pt-4 pb-3">
          <Rotulo>Cuentas</Rotulo>
        </div>
      </Seccion>

      {!usuarios ? (
        <Seccion>
          <p className="secundario px-6 py-4">Cargando…</p>
        </Seccion>
      ) : (
        /// La pieza compartida, la misma que usan Campañas y
        /// Plantillas. Lo que esta pantalla pone de suyo son los
        /// ANCHOS y los rótulos; el armazón --la banda a sangre,
        /// la consulta de contenedor, el suelo y la cabecera--
        /// vive en `secciones.tsx`, y así las tres listas del
        /// panel reparten igual. Una que necesitara una clase
        /// suelta para verse bien delataría que la pieza está
        /// mal.
        <ListaEnColumnas
          rejilla={REJILLA}
          anchoMinimo={anchoMinimo(convenios.length)}
          columnas={cabeceras(convenios)}
        >
          {usuarios.map((u) => (
            <FilaUsuario
              key={u.id}
              usuario={u}
              convenios={convenios}
              esUsted={u.id === admin.id}
              abierta={abierta === u.id}
              alAbrir={() => setAbierta(abierta === u.id ? null : u.id)}
              alActuar={conError}
              alReiniciarClave={(correo, clave) => setClaveNueva({ correo, clave })}
            />
          ))}
        </ListaEnColumnas>
      )}
    </div>
  );
}

type Convenio = { id: string; slug: string; sigla: string | null };

/* ── la maqueta de la lista ──────────────────────────────── */

/**
 * DOS JUEGOS DE COLUMNAS, y el ancho decide cuál.
 *
 * Es la misma regla que la lista de campañas y con los mismos
 * anchos, a propósito: dos listas del mismo panel que reparten
 * distinto se leen como dos productos.
 *
 * Siete columnas llenan los 1204 px de banda que hay a 1440 y
 * dejan 480 sueltos a 1920. Repartir esos 480 entre las siete
 * daría una columna de rol de 400 px para un rótulo de 130: eso
 * no es una columna, es el hueco de antes con un rótulo encima.
 *
 * Por eso el sobrante se gasta ABRIENDO COLUMNA. A partir de
 * 1600 px de banda entran «correo» y «desde», que son dos datos
 * que sí se comparan entre filas y que a 1440 no caben.
 *
 * Es consulta de CONTENEDOR y no de ventana: la barra lateral
 * se pliega y la banda gana 180 px sin que la ventana cambie de
 * tamaño. Lo que decide es el ancho que tiene la lista, que es
 * lo que el ojo mide.
 */
/// Las dos plantillas viven en variables y no en la clase:
/// Campañas y Plantillas pueden escribir sus `grid-cols-[...]`
/// literales porque su número de columnas es fijo, y el de esta
/// depende de cuántas líneas de negocio tenga la empresa.
///
/// `SOLO_ANCHA` --lo que solo sale con la banda ancha-- se
/// importa de la pieza compartida: en estrecho no se encoge,
/// DESAPARECE, y por eso la rejilla estrecha tiene siete pistas
/// y no nueve con dos vacías.
const REJILLA =
  "grid grid-cols-[var(--cols)] @[1600px]:grid-cols-[var(--cols-ancha)]";

/**
 * Por qué cada ancho es el que es.
 *
 * - Persona `minmax(150px, 280px)`: un nombre con primer
 *   apellido son unos 22 caracteres. Topa en 280 porque a
 *   partir de ahí solo le quita ancho a los roles.
 * - Correo 360: es el `ancho-correo` de la casa, el mismo que
 *   mide la caja donde se escribe. Es el mismo dato, así que es
 *   la misma medida; y es fija porque un correo no crece.
 * - Estado 112: cabe «Desactivada». Fija a propósito: la rampa
 *   de color solo se lee en vertical si el rótulo arranca
 *   siempre en la misma x.
 * - Administra 120: «Sí» o una raya. Es la columna que contesta
 *   la pregunta más cara de esta pantalla y por eso tiene la
 *   suya, en vez de ir escondida en la ristra de roles. Mide
 *   120 y no 96 --que es lo que mide su dato-- porque es la
 *   única del panel cuyo RÓTULO es más ancho que su dato: en
 *   versalita «ADMINISTRA» son 88 px, y a 96 se cortaba.
 * - Una columna POR LÍNEA DE NEGOCIO, `minmax(176px, 1fr)`, y
 *   son las que ABSORBEN el sobrante. Van juntas y crecen a la
 *   vez, así que no abren canal en medio de la fila; y el
 *   sobrante se lo lleva el eje que parte esta empresa en dos,
 *   que es lo que hay que mirar aquí. El mínimo es 176 y no 130
 *   porque el panel deja subir el texto al 150 %, y a ese
 *   tamaño «Líder de configuración» mide 188.
 * - Desde 112 y Última entrada 120, tabular y a la derecha.
 *   Van CONTIGUAS y son el par: una cuenta creada en marzo que
 *   nunca ha entrado es una licencia que nadie usa, y una que
 *   no entra desde hace ocho meses es una puerta abierta que ya
 *   no vigila nadie. Ninguna de las dos se ve mirando una fila;
 *   las dos se ven bajando por la columna.
 * - Acciones 120: una palabra y la flecha. Lo que no cabe ahí
 *   no es una acción de fila.
 */
const ANCHO_LINEA = 176;
const FIJAS_ESTRECHA = 280 + 112 + 120 + 120 + 120 + 24;

/// Las dos plantillas de columnas, para N líneas de negocio. Se
/// calculan porque el número de líneas es del producto, no de
/// la maqueta: si mañana hay una tercera, entra su columna y el
/// sobrante se reparte solo.
function medidas(cuantasLineas: number): CSSProperties {
  const lineas = Array(Math.max(cuantasLineas, 1))
    .fill(`minmax(${ANCHO_LINEA}px,1fr)`)
    .join(" ");

  return {
    "--cols": `minmax(150px,280px) 112px 120px ${lineas} 120px 120px`,
    "--cols-ancha": `minmax(150px,280px) 360px 112px 120px ${lineas} 112px 120px 120px`,
  } as CSSProperties;
}

/// El suelo: por debajo se desplaza LA BANDA, nunca la página.
function anchoMinimo(cuantasLineas: number): number {
  return FIJAS_ESTRECHA + ANCHO_LINEA * Math.max(cuantasLineas, 1);
}

/// Los rótulos. El de cada línea de negocio es su sigla: es
/// como se llaman entre ellos y es lo que dice el desplegable
/// de arriba.
function cabeceras(convenios: Convenio[]): ColumnaDeLista[] {
  return [
    { texto: "Persona" },
    { texto: "Correo", soloAncha: true },
    {
      texto: "Estado",
      ayuda:
        "Una cuenta no se borra: se desactiva y la fila se queda. «Sin estrenar» es que todavía no ha cambiado la contraseña temporal.",
    },
    {
      texto: "Administra",
      alineado: "text-center",
      ayuda:
        "Quien administra el sistema ve y toca TODO, sin importar sus líneas de negocio: crea cuentas, publica formularios y puede borrar datos.",
    },
    ...convenios.map((c) => ({ texto: c.sigla ?? c.slug })),
    {
      texto: "Desde",
      alineado: "text-right",
      soloAncha: true,
      ayuda: "Cuándo se creó la cuenta.",
    },
    {
      /// «Última entrada» mide 118 px en versalita y su columna
      /// 120: envolvía, y una cabecera de dos renglones sube el
      /// paso de la lista entera. Se acorta el rótulo, que es
      /// lo barato; ensancharla se lo quitaba a los roles, que
      /// es el dato que sí crece.
      texto: "Última vez",
      alineado: "text-right",
      ayuda:
        "La última vez que entró al panel. Una raya es que nunca ha entrado: leída contra «Desde», esta columna es la lista de cuentas que se crearon y nadie usó.",
    },
    { texto: "" },
  ];
}

/// El estado de una cuenta, en la LETRA y en peso 600.
///
/// Es una rampa y no un arcoíris: desactivada se APAGA --como
/// «Perdido» en el embudo, que tampoco grita en rojo--, sin
/// estrenar va en el color del texto y activa es el único
/// verde. Ninguno de los tres es cálido: el ámbar y el rojo de
/// este panel son el reloj de quien lleva esperando respuesta,
/// y una cuenta no espera a nadie.
///
/// Que la cuenta esté desactivada NO SE VEÍA. El único indicio
/// era que el botón del canto dijera «Reactivar» en vez de
/// «Desactivar», o sea que había que leer la acción para
/// enterarse del estado.
function EstadoDeCuenta({ usuario: u }: { usuario: AdminActual }) {
  if (!u.activo) {
    return <span className="estado text-texto-suave">Desactivada</span>;
  }
  if (u.debeCambiarClave) {
    return (
      <span className="estado text-texto" title="Aún no ha cambiado su contraseña temporal">
        Sin estrenar
      </span>
    );
  }
  return <span className="estado text-exito">Activa</span>;
}

/// Un dato que no está: siempre una raya en `--texto-suave`.
function Vacio() {
  return <span className="text-texto-suave">—</span>;
}

/// Un par rótulo/valor de la ficha, en renglones de una línea.
/// Sin caja, sin fondo: los separa la regla de 1 px que
/// significa «aquí sigue lo mismo».
function Ficha({ titulo, valor }: { titulo: string; valor?: string | null }) {
  return (
    <div className="border-hairline flex items-baseline justify-between gap-4 border-b py-[var(--pad-fila)] last:border-b-0">
      <dt className="secundario shrink-0">{titulo}</dt>
      <dd className="dato min-w-0 truncate text-right" title={valor ?? undefined}>
        {valor ? valor : <Vacio />}
      </dd>
    </div>
  );
}

/**
 * Una cuenta: una fila de 33 px.
 *
 * La FILA ENTERA abre el detalle. La columna del canto lleva
 * solo lo que CAMBIA el estado --desactivar y reactivar--, que
 * es la distinción que la deja en 120 px: mirar es la fila,
 * actuar es el canto.
 *
 * Lo demás bajó al detalle, y no por falta de sitio:
 *
 * - «¿Administra el sistema?» era un DESPLEGABLE por fila, con
 *   su rótulo repetido ocho veces. Un desplegable mide 34 px y
 *   la fila mide 33: con él dentro no hay lista densa posible.
 *   Y conceder el sistema entero desde un desplegable de una
 *   lista, sin ver antes qué unidades tiene esa persona, es la
 *   forma más fácil de conceder de más. Ahora la columna lo
 *   DICE y el detalle lo cambia, junto a las unidades de
 *   negocio, que es la otra mitad de la misma decisión.
 * - «Nueva contraseña» invalida la que la persona esté usando y
 *   no se deshace. Una acción irreversible no cabe en 120 px y
 *   no se mete a la fuerza: abre la fila y pregunta abajo.
 */
function FilaUsuario({
  usuario: u,
  convenios,
  esUsted,
  abierta,
  alAbrir,
  alActuar,
  alReiniciarClave,
}: {
  usuario: AdminActual;
  convenios: Convenio[];
  esUsted: boolean;
  abierta: boolean;
  alAbrir: () => void;
  alActuar: (accion: () => Promise<void>) => Promise<void>;
  alReiniciarClave: (correo: string, clave: string) => void;
}) {
  const porConvenio = new Map(
    (u.concesiones ?? []).map((c) => [c.convenioId, c.rol]),
  );

  /// Lo que solo se lee al detenerse en UNA cuenta no gasta una
  /// columna: va al `title` del nombre.
  const ficha =
    `${u.correo}` +
    (u.cargo ? ` · ${u.cargo}` : "") +
    ` · cuenta creada el ${enMomento(u.creadoEn)}` +
    (u.ultimoAcceso ? ` · última entrada ${enMomento(u.ultimoAcceso)}` : " · no ha entrado nunca");

  const sinNada = u.rol !== "SUPERADMIN" && porConvenio.size === 0;

  return (
    <>
      <div
        onClick={alAbrir}
        className={`dato ${REJILLA} cursor-pointer items-center border-b border-hairline transition hover:bg-tabla-fila-resaltada ${
          abierta ? "bg-tabla-fila-resaltada" : ""
        }`}
      >
        <Celda primera className="text-titulo" titulo={`${u.nombre} — ${ficha}`}>
          {u.nombre}
          {esUsted && <span className="text-texto-suave"> (usted)</span>}
        </Celda>

        <Celda className={SOLO_ANCHA} titulo={u.correo}>
          {u.correo}
        </Celda>

        <Celda>
          <EstadoDeCuenta usuario={u} />
        </Celda>

        {/* «Sí» y nada más. Quien no administra el sistema no
            necesita una palabra que lo diga: la raya es el
            dato, y en una columna de ocho filas los dos «Sí»
            saltan solos. */}
        <Celda className="text-center">
          {u.rol === "SUPERADMIN" ? (
            <span className="estado text-titulo">Sí</span>
          ) : (
            <Vacio />
          )}
        </Celda>

        {/* UNA COLUMNA POR LÍNEA DE NEGOCIO, y no la ristra de
            antes.

            «Líder de configuración en GRUPO AE · Líder de
            configuración en GRUPO AE · Personas» era un renglón
            de texto corrido en el que la línea de negocio iba
            escrita dentro del dato. Así no se puede contestar
            «¿quién lleva personas?», que es media pantalla.

            Con una columna por línea, el nombre de la línea se
            escribe UNA VEZ, en su cabecera, y debajo queda la
            columna de roles que sí se compara. Un hueco es que
            esa persona no entra a esa línea, y el hueco también
            es el dato. */}
        {convenios.map((c) => {
          const rol = porConvenio.get(c.id);
          const etiqueta = rol
            ? (ROLES_DE_CONVENIO.find((r) => r.valor === rol)?.etiqueta ?? rol)
            : null;
          return (
            <Celda key={c.id} titulo={etiqueta ?? undefined}>
              {etiqueta ? etiqueta : <Vacio />}
            </Celda>
          );
        })}

        <Celda className={`${SOLO_ANCHA} text-right tabular-nums`}>
          {enMomento(u.creadoEn)}
        </Celda>

        {/* Sin entrar nunca es una raya, y la raya es el dato:
            en una columna de fechas los huecos son las cuentas
            que se crearon y nadie usó. */}
        <Celda className="text-right tabular-nums">
          {u.ultimoAcceso ? enMomento(u.ultimoAcceso) : <Vacio />}
        </Celda>

        <Celda ultima className="flex items-center justify-end gap-3 text-right">
          <span onClick={(e) => e.stopPropagation()} className="flex items-center">
            {!esUsted && (
              <button
                type="button"
                className={u.activo ? "text-texto-suave" : "text-marca"}
                onClick={() =>
                  alActuar(async () => {
                    await adminApi.actualizarUsuario(u.id, { activo: !u.activo });
                  })
                }
              >
                {u.activo ? "Desactivar" : "Reactivar"}
              </button>
            )}
          </span>
          <IconoDerecha
            tamano={12}
            className={`shrink-0 text-texto-suave transition-transform ${
              abierta ? "rotate-90" : ""
            }`}
          />
        </Celda>
      </div>

      {/* EL DETALLE OCUPA LA FILA ENTERA, y reparte a su vez EN
          HORIZONTAL: los permisos, la ficha de la persona y lo
          de la contraseña van uno al lado del otro. Apilados,
          un bloque de 720 px deja mil en blanco a la derecha,
          que es el defecto de la fila vieja a menor escala.

          Los tres se alinean contra la izquierda y no se
          estiran: un formulario topa en 720 y no crece hasta el
          canto por tener sitio. */}
      {abierta && (
        <div className="border-b border-borde bg-superficie-alterna px-6 py-5">
          <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
            <div className="min-w-[320px] flex-[0_1_720px]">
              <PermisosDe
                usuario={u}
                convenios={convenios}
                esUsted={esUsted}
                alActuar={alActuar}
                alCerrar={alAbrir}
              />

              {sinNada && (
                <p className="dato mt-5">
                  <span className="estado text-titulo">
                    Sin rol en ninguna línea de negocio:
                  </span>{" "}
                  esta cuenta entra al panel y no ve una sola pantalla.
                </p>
              )}
            </div>

            {/* QUIÉN ES. Son datos que el servidor ya mandaba en
                cada carga de la lista y que no miraba nadie: se
                pagaba la consulta y se tiraba el resultado.
                Aquí ganan dos cosas -- dicen a quién se le está
                dando acceso, que es lo que uno quiere saber
                antes de concederlo, y devuelven el correo por
                debajo de 1600 px, donde su columna no cabe. */}
            <div className="min-w-[240px] flex-[0_1_300px]">
              <Rotulo>Quién es</Rotulo>
              <dl className="mt-2">
                <Ficha titulo="Correo" valor={u.correo} />
                <Ficha titulo="Cargo" valor={u.cargo} />
                <Ficha titulo="Celular" valor={u.celular} />
                <Ficha titulo="Cuenta creada" valor={enMomento(u.creadoEn)} />
                <Ficha
                  titulo="Última entrada"
                  valor={u.ultimoAcceso ? enMomento(u.ultimoAcceso) : null}
                />
              </dl>
            </div>

            <div className="min-w-[280px] flex-[0_1_340px]">
              <Rotulo>La contraseña</Rotulo>
              <p className="dato mt-2">
                {u.debeCambiarClave
                  ? "Todavía usa la contraseña temporal que se le entregó."
                  : "Ya tiene una contraseña suya."}
              </p>
              <p className="secundario mt-2">
                Generar una nueva invalida la que esté usando ahora mismo y no se
                puede deshacer: quien la tenga quedará fuera hasta que le
                entreguen la nueva.
              </p>
              {!esUsted && (
                <button
                  type="button"
                  className="dato text-marca mt-3 underline"
                  onClick={() =>
                    alActuar(async () => {
                      const { claveTemporal } = await adminApi.reiniciarClave(u.id);
                      alReiniciarClave(u.correo, claveTemporal);
                    })
                  }
                >
                  Sí, generar una contraseña temporal
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Las dos decisiones de permiso, juntas.
 *
 * Estaban separadas --el desplegable de «¿administra?» en la
 * fila, las líneas de negocio detrás de un botón-- y son la
 * misma pregunta: qué puede hacer esta persona. Una cuenta que
 * administra el sistema ve y toca todo aunque no tenga ninguna
 * unidad marcada, así que decidir lo segundo sin ver lo primero
 * es decidir a ciegas.
 */
function PermisosDe({
  usuario: u,
  convenios,
  esUsted,
  alActuar,
  alCerrar,
}: {
  usuario: AdminActual;
  convenios: Convenio[];
  esUsted: boolean;
  alActuar: (accion: () => Promise<void>) => Promise<void>;
  alCerrar: () => void;
}) {
  const inicial: Record<string, RolConvenio | ""> = {};
  for (const c of u.concesiones ?? []) inicial[c.convenioId] = c.rol;

  const [porConvenio, setPorConvenio] = useState(inicial);
  const [guardando, setGuardando] = useState(false);

  const concesiones = Object.entries(porConvenio)
    .filter(([, r]) => r)
    .map(([convenioId, r]) => ({ convenioId, rol: r as RolConvenio }));

  return (
    <div className="formulario">
      <Rotulo>Qué puede hacer {u.nombre.split(" ")[0]}</Rotulo>

      <div className="mt-3 max-w-[320px]">
        <Campo etiqueta="¿Administra el sistema?">
          <Desplegable
            valor={u.rol === "SUPERADMIN" ? "SUPERADMIN" : "GESTOR"}
            desactivado={esUsted}
            etiquetaAria={`¿${u.nombre} administra el sistema?`}
            alElegir={(v) =>
              alActuar(async () => {
                await adminApi.actualizarUsuario(u.id, { rol: v as RolAdmin });
              })
            }
            opciones={ROLES.map((r) => ({
              valor: r.valor,
              etiqueta: r.etiqueta,
              detalle: r.descripcion,
            }))}
          />
        </Campo>
      </div>

      <p className="rotulo-bloque mt-6">A qué líneas de negocio entra</p>

      <div className="mt-2">
        {convenios.map((c) => (
          <FilaConvenio
            key={c.id}
            convenio={c}
            valor={porConvenio[c.id] ?? ""}
            alCambiar={(rol) => setPorConvenio((p) => ({ ...p, [c.id]: rol }))}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Boton
          type="button"
          disabled={guardando || concesiones.length === 0}
          onClick={async () => {
            setGuardando(true);
            await alActuar(async () => {
              await adminApi.actualizarUsuario(u.id, { concesiones });
            });
            setGuardando(false);
            alCerrar();
          }}
        >
          {guardando ? "Guardando…" : "Guardar líneas de negocio"}
        </Boton>
        {concesiones.length === 0 && (
          <span className="secundario">
            Sin ninguna no vería nada: desactive la cuenta en vez de dejarla así.
          </span>
        )}
      </div>
    </div>
  );
}

function FormularioNuevoUsuario({
  alCrear,
  alCerrar,
  alFallar,
}: {
  alCrear: (correo: string, clave: string) => void;
  alCerrar: () => void;
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
      alFallar("Marque al menos una línea de negocio: sin ninguna, la cuenta no vería nada.");
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
      {/* El formulario topa en 720 px y cada campo mide lo que
          mide su dato: correo 360, nombre 320. Iban al ancho de
          la pantalla, o sea 760 px de caja para escribir un
          correo. */}
      <form onSubmit={enviar} className="formulario">
        <div className="formulario-doble">
          <Campo etiqueta="Correo">
            <input
              required
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={CLASE_CONTROL + " ancho-correo"}
            />
          </Campo>

          <Campo etiqueta="Nombre completo">
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={CLASE_CONTROL + " ancho-nombre"}
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

          <div className="a-lo-ancho">
            <p className="rotulo-bloque">A qué líneas de negocio entra</p>
            <p className="secundario prosa mt-1">
              Sin marcar ninguno, la cuenta entra al panel y no ve una sola
              pantalla. El rol se elige por línea de negocio: se puede llevar un área en
              uno y otra en el otro.
            </p>

            <div className="mt-3">
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
        </div>

        {/* Separado por la raya: es el final del formulario, no
            una celda más de la rejilla. */}
        <div className="border-hairline mt-6 flex flex-wrap items-center gap-4 border-t pt-4">
          <Boton type="submit" disabled={creando}>
            {creando ? "Creando…" : "Crear usuario"}
          </Boton>
          <button
            type="button"
            onClick={alCerrar}
            className="dato text-marca underline"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Bloque>
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
    /// Un renglón de lista, no una tarjeta con borde: «aquí
    /// sigue lo mismo» se dice con una regla de 1 px.
    <div className="border-hairline flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-2 last:border-b-0">
      <label className="dato flex min-w-40 items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(valor)}
          onChange={(e) => alCambiar(e.target.checked ? "GESTOR_INSCRIPCION" : "")}
          className="accent-[var(--marca)] size-4 shrink-0"
        />
        {convenio.sigla ?? convenio.slug}
      </label>

      {valor && (
        <>
          <div className="min-w-56 flex-1">
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
          <p className="secundario prosa w-full">
            {ROLES_DE_CONVENIO.find((r) => r.valor === valor)?.descripcion}
          </p>
        </>
      )}
    </div>
  );
}
