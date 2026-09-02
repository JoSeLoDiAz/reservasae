"use client";

/** Las plantillas de correo: escribirlas una vez. */

/// Lo que cambia de una persona a otra va entre llaves. Esta
/// pantalla tiene que hacer dos cosas bien: enseñar CUÁLES
/// existen —a mano, para poder pegarlas— y no dejar guardar
/// una variable que no existe. Lo segundo es lo que evita que
/// salga «Estimado {{nombreDePila}}» a cuarenta personas.
///
/// Son DOS vistas y no una, y ese fue el arreglo principal.
/// Antes el editor salía encima de la lista y la lista seguía
/// debajo, entera: se editaba una plantilla con las otras
/// cinco a la vista y sin ninguna señal de cuál se estaba
/// tocando. Ahora la lista es una tabla de una fila por
/// plantilla —el cuerpo se ve al desplegarla, no siempre— y
/// editar se lleva la pantalla completa.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IconoBuscar, IconoDerecha, IconoIzquierda } from "@/components/admin/iconos";
import { Aviso, Boton, CLASE_CONTROL, useAdmin } from "@/components/admin/marco-admin";
import { useToast } from "@/components/admin/toast";
import {
  ejemplosDe,
  resolver,
  VistaPreviaCorreo,
} from "@/components/admin/vista-previa-correo";
import { ErrorApi } from "@/lib/api";
import {
  plantillasCorreoApi,
  urlDelCabezote,
  type PlantillaCorreo,
  type VariableCorreo,
} from "@/lib/plantillas-correo-api";

/// TODAS las etapas, agrupadas por momento.
///
/// El primer intento dejó fuera las de salida —perdido,
/// retirado, no aprobó— con el argumento de que a quien se
/// fue no se le escribe. Es al revés: a esa persona es a la
/// que hay que escribirle. «No quedó seleccionado esta vez»,
/// «lo esperamos en la próxima convocatoria», «cuéntenos por
/// qué lo dejó». Sin ellas el sistema solo sabe felicitar.
///
/// Van agrupadas y no en una lista corrida de once porque
/// once casillas seguidas no se leen: se marca la primera que
/// suene y se sigue.
///
/// El tercer elemento es la aclaración, y va DEBAJO del
/// nombre y no pegada a él: «Desertó» y «Abandonó» suenan
/// igual y no lo son, pero con la aclaración en la misma
/// línea la casilla mide tres renglones y el grupo se
/// desarma.
const GRUPOS: Array<{
  titulo: string;
  /// valor · lo que dice la casilla · la aclaración, si la
  /// necesita.
  etapas: Array<[string, string, string?]>;
}> = [
  {
    titulo: "Mientras avanza",
    etapas: [
      ["INTERESADO", "Interesado"],
      ["CONTACTADO", "Contactado"],
      ["DATOS_COMPLETOS", "Con datos completos"],
      ["INSCRITO", "Inscrito"],
      ["EN_FORMACION", "En formación"],
    ],
  },
  {
    /// Una sola casilla, y es correcto: es el único final
    /// bueno que hay. Repartirla en otro grupo para que las
    /// tres columnas midan igual sería mentir sobre el
    /// proceso.
    titulo: "Terminó bien",
    etapas: [["CERTIFICADO", "Certificado"]],
  },
  {
    titulo: "No siguió",
    etapas: [
      ["NO_APROBO", "No aprobó"],
      ["DESERTO", "Desertó", "avisó que se iba"],
      ["ABANDONO", "Abandonó", "dejó de entrar, sin avisar"],
      ["RETIRADO", "Retirado"],
      ["PERDIDO", "Perdido", "no se logró contactar"],
    ],
  },
];

/// Cómo se nombra cada etapa cuando se cuenta en una frase:
/// «solo para quien esté inscrito, en formación». Sale del
/// mismo sitio que las casillas para que no se separen.
const EN_PALABRAS: Record<string, string> = Object.fromEntries(
  GRUPOS.flatMap((g) =>
    g.etapas.map(([valor, texto]) => [valor, texto.toLocaleLowerCase("es-CO")]),
  ),
);

/// Cómo se reparten las variables en el panel de «Insertar
/// dato». Es reparto de PRESENTACIÓN: el catálogo manda, y lo
/// que llegue del servidor y no esté aquí cae en «Otros» en
/// vez de desaparecer.
const GRUPOS_DE_VARIABLE: Array<{ titulo: string; claves: string[] }> = [
  {
    titulo: "La persona",
    claves: [
      "tratamiento",
      "saludo",
      "primerNombre",
      "nombreCompleto",
      "primerApellido",
      "documento",
    ],
  },
  { titulo: "Contacto", claves: ["correo", "celular", "empresa"] },
  {
    titulo: "La formación",
    claves: [
      "accionFormacion",
      "grupo",
      "fechaInicio",
      "ubicacion",
      "modalidad",
      "asesor",
      "gremio",
    ],
  },
];

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Filtro = "todas" | "activas" | "apagadas";

const FILTROS: Array<[Filtro, string]> = [
  ["todas", "Todas"],
  ["activas", "Activas"],
  ["apagadas", "Apagadas"],
];

export default function PaginaPlantillasCorreo() {
  const [plantillas, setPlantillas] = useState<PlantillaCorreo[] | null>(null);
  const [variables, setVariables] = useState<VariableCorreo[]>([]);
  const [error, setError] = useState<string | null>(null);

  /// Null: se está en la lista. Si no, la plantilla que se
  /// edita —o `"nueva"` para una en blanco—.
  const [editando, setEditando] = useState<PlantillaCorreo | "nueva" | null>(
    null,
  );

  const cargar = useCallback(async () => {
    const [lista, vars] = await Promise.all([
      plantillasCorreoApi.listar(),
      plantillasCorreoApi.variables(),
    ]);
    setPlantillas(lista);
    setVariables(vars);
  }, []);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  if (!plantillas) {
    return error ? (
      <Aviso tipo="error">{error}</Aviso>
    ) : (
      <p className="text-texto-suave">Cargando…</p>
    );
  }

  if (editando) {
    return (
      <Editor
        /// La llave remonta el editor al cambiar de plantilla:
        /// sin ella, pasar de una a otra dejaría el borrador
        /// de la anterior escrito encima de la siguiente.
        key={editando === "nueva" ? "nueva" : editando.id}
        origen={editando === "nueva" ? null : editando}
        variables={variables}
        alSalir={() => setEditando(null)}
        alGuardar={async () => {
          await cargar();
          setEditando(null);
        }}
      />
    );
  }

  return (
    <Lista plantillas={plantillas} alEditar={setEditando} alRecargar={cargar} />
  );
}

// ─────────────────────────────── la lista ───────────────────

function Lista({
  plantillas,
  alEditar,
  alRecargar,
}: {
  plantillas: PlantillaCorreo[];
  alEditar: (p: PlantillaCorreo | "nueva") => void;
  alRecargar: () => Promise<void>;
}) {
  const toast = useToast();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierta, setAbierta] = useState<string | null>(null);

  const activas = plantillas.filter((p) => p.activa).length;
  const visibles = plantillas.filter((p) =>
    filtro === "activas" ? p.activa : filtro === "apagadas" ? !p.activa : true,
  );

  async function conmutar(p: PlantillaCorreo) {
    try {
      if (p.activa) {
        await plantillasCorreoApi.apagar(p.id);
        toast.exito("Se apagó la plantilla.");
      } else {
        await plantillasCorreoApi.editar(p.id, { activa: true });
        toast.exito("Se encendió la plantilla.");
      }
      await alRecargar();
    } catch (e) {
      toast.error((e as ErrorApi).message);
    }
  }

  return (
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
            Plantillas de correo
          </h1>
          <p className="mt-1 max-w-3xl text-texto-suave">
            Se escriben una vez y se mandan muchas. Lo que cambia de una persona a
            otra va entre llaves, y se llena solo con los datos de su lead.
          </p>
        </div>
        <Boton onClick={() => alEditar("nueva")}>
          <span className="text-base leading-none">+</span> Nueva plantilla
        </Boton>
      </header>

      <div className="px-7 py-5">
        {plantillas.length === 0 ? (
          /// El vacío no es una fila más: es una invitación, y
          /// por eso lleva el borde punteado. Con el borde
          /// entero se leería como una plantilla sin nombre.
          <div className="rounded-md border border-dashed border-campo-borde bg-superficie px-6 py-16 text-center">
            <p className="font-semibold text-titulo">Todavía no hay ninguna</p>
            <p className="mx-auto mt-1.5 mb-5 max-w-sm text-[13px] text-texto-suave">
              Se escriben una vez y se mandan muchas. Cree la primera para empezar
              a escribir correos desde una ficha o una campaña.
            </p>
            <Boton onClick={() => alEditar("nueva")}>
              <span className="text-base leading-none">+</span> Nueva plantilla
            </Boton>
          </div>
        ) : (
          <>
            <div className="mb-3.5 flex flex-wrap items-center gap-3">
              <div className="flex gap-0.5 rounded-sm border border-borde bg-superficie-alterna p-[3px]">
                {FILTROS.map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setFiltro(valor)}
                    className={`rounded-xs px-2.5 py-1 text-[12px] font-semibold transition ${
                      filtro === valor
                        ? "bg-superficie text-titulo"
                        : "text-texto-suave hover:text-texto"
                    }`}
                  >
                    {texto}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-texto-suave tabular-nums">
                {plantillas.length}{" "}
                {plantillas.length === 1 ? "plantilla" : "plantillas"} · {activas}{" "}
                {activas === 1 ? "activa" : "activas"}
              </span>
            </div>

            {/* La tabla no se aplasta: por debajo de su ancho
                se desplaza dentro de su caja. Cinco columnas
                apretadas en un portátil de trece pulgadas
                cortan el asunto justo donde empieza a
                importar. */}
            <div className="overflow-x-auto rounded-md border border-borde bg-superficie">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[1.7fr_2.2fr_1.5fr_1.3fr_1fr] border-b border-borde bg-superficie-alterna px-4">
                  {["Plantilla", "Asunto", "Puede ir a", "Última edición", ""].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="py-[11px] text-[10.5px] font-bold tracking-[0.05em] uppercase text-texto-suave opacity-80"
                      >
                        {h}
                      </div>
                    ),
                  )}
                </div>

                {visibles.length === 0 && (
                  <p className="px-4 py-8 text-center text-[13px] text-texto-suave">
                    Ninguna plantilla está{" "}
                    {filtro === "activas" ? "activa" : "apagada"}.
                  </p>
                )}

                {visibles.map((p) => (
                  <Fila
                    key={p.id}
                    plantilla={p}
                    abierta={abierta === p.id}
                    alAbrir={() => setAbierta(abierta === p.id ? null : p.id)}
                    alEditar={() => alEditar(p)}
                    alConmutar={() => void conmutar(p)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Fila({
  plantilla: p,
  abierta,
  alAbrir,
  alEditar,
  alConmutar,
}: {
  plantilla: PlantillaCorreo;
  abierta: boolean;
  alAbrir: () => void;
  alEditar: () => void;
  alConmutar: () => void;
}) {
  /// El alcance y el estado comparten renglón porque son la
  /// misma pregunta —«¿esta a quién le sirve?»— y porque
  /// apagada gana: si lo está, da igual de qué gremio sea.
  const linea = !p.activa
    ? "Apagada · no aparece al escribir un correo"
    : p.convenio
      ? `Solo para ${p.convenio.sigla ?? p.convenio.nombre}`
      : "Sirve para todos los gremios";

  const etapas =
    p.etapasPermitidas.length > 0
      ? p.etapasPermitidas.map((e) => EN_PALABRAS[e] ?? e).join(", ")
      : "Cualquier etapa";

  return (
    <div className="border-b border-borde last:border-b-0">
      <div
        onClick={alAbrir}
        className="grid cursor-pointer grid-cols-[1.7fr_2.2fr_1.5fr_1.3fr_1fr] items-center px-4 py-2.5 transition hover:bg-superficie-alterna"
      >
        <div className="flex min-w-0 items-center gap-2.5 pr-3">
          <IconoDerecha
            tamano={14}
            className={`shrink-0 text-texto-suave transition-transform ${
              abierta ? "rotate-90" : ""
            }`}
          />
          <div className="min-w-0">
            <p
              className={`truncate text-[13.5px] font-semibold ${
                p.activa ? "text-titulo" : "text-texto-suave"
              }`}
            >
              {p.nombre}
            </p>
            <p className="truncate text-[11.5px] font-medium text-texto-suave">
              {linea}
            </p>
          </div>
        </div>

        <div className="min-w-0 pr-4 text-[13px] text-texto-suave">
          <span className="block truncate font-mono">{p.asunto}</span>
        </div>

        <div className="min-w-0 pr-4 text-[12px] text-texto-suave opacity-80">
          <span className="block truncate">{etapas}</span>
        </div>

        <div className="min-w-0">
          <p className="text-[12px] text-texto-suave tabular-nums">
            {FECHA.format(new Date(p.actualizadoEn))}
          </p>
          {p.creadoPor && (
            <p className="truncate text-[11px] text-texto-suave opacity-80">
              La escribió {p.creadoPor.nombre}
            </p>
          )}
        </div>

        {/* Los botones no abren la fila: paran el clic antes
            de que suba. Sin esto, «Apagar» apaga y de paso
            despliega el cuerpo. */}
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={alEditar}
            className="rounded-xs border border-campo-borde px-2.5 py-[5px] text-[12px] font-semibold text-marca transition hover:bg-superficie-alterna"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={alConmutar}
            className="rounded-xs border border-campo-borde px-2.5 py-[5px] text-[12px] font-semibold text-texto-suave transition hover:bg-superficie-alterna"
          >
            {p.activa ? "Apagar" : "Encender"}
          </button>
        </div>
      </div>

      {abierta && (
        <div className="bg-superficie-alterna px-4 pt-0.5 pb-[18px] pl-[42px]">
          <p className="mt-3 mb-2 text-[11px] font-semibold tracking-[0.05em] uppercase text-texto-suave opacity-80">
            Asunto
          </p>
          <p className="mb-3.5 font-mono text-[13.5px]">{p.asunto}</p>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.05em] uppercase text-texto-suave opacity-80">
            El mensaje
          </p>
          <p className="max-w-[720px] rounded-sm border border-borde bg-superficie px-4 py-3.5 text-[13px] leading-relaxed whitespace-pre-wrap">
            {p.cuerpo}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── el editor ──────────────────

type Borrador = {
  nombre: string;
  asunto: string;
  cuerpo: string;
  convenioId: string | null;
  etapasPermitidas: string[];
};

function Editor({
  origen,
  variables,
  alSalir,
  alGuardar,
}: {
  origen: PlantillaCorreo | null;
  variables: VariableCorreo[];
  alSalir: () => void;
  alGuardar: () => Promise<void>;
}) {
  const toast = useToast();
  const { gremios } = useAdmin();
  const caja = useRef<HTMLTextAreaElement>(null);

  const [b, setB] = useState<Borrador>(() => ({
    nombre: origen?.nombre ?? "",
    asunto: origen?.asunto ?? "",
    cuerpo: origen?.cuerpo ?? "",
    convenioId: origen?.convenioId ?? null,
    etapasPermitidas: origen?.etapasPermitidas ?? [],
  }));

  /// El cabezote se sube por su propia ruta y necesita el id
  /// de la plantilla, que una nueva todavía no tiene. Se
  /// guarda aquí el archivo escogido y se manda DESPUÉS de
  /// crearla.
  const [cabezote, setCabezote] = useState<File | null>(null);
  const [quitarCabezote, setQuitarCabezote] = useState(false);

  const [etapasAbiertas, setEtapasAbiertas] = useState(false);
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [previaAbierta, setPreviaAbierta] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const ejemplos = useMemo(() => ejemplosDe(variables), [variables]);

  const asuntoR = resolver(b.asunto, ejemplos);
  const cuerpoR = resolver(b.cuerpo, ejemplos);
  const asuntoLleno = asuntoR.trozos.map((t) => t.t).join("");
  const rotas = [...new Set([...asuntoR.rotas, ...cuerpoR.rotas])];
  const puestas = [...new Set([...asuntoR.puestas, ...cuerpoR.puestas])];

  const faltanCampos =
    !b.nombre.trim() || !b.asunto.trim() || !b.cuerpo.trim();
  const textoRotas =
    `Estas variables no existen: ${rotas.map((r) => `{{${r}}}`).join(", ")}. ` +
    "Van a salir tal cual en el correo, así que no se puede guardar así.";

  /// Se bloquea AQUÍ y no solo en el servidor. El servidor ya
  /// lo rechaza, pero rechazarlo después de pulsar deja a
  /// quien escribe con un aviso rojo flotante y sin saber
  /// cuál de las llaves estaba mal escrita.
  const noSePuede = rotas.length > 0 || faltanCampos;

  const urlGuardada =
    origen?.bannerMime && !quitarCabezote ? urlDelCabezote(origen) : null;

  async function guardar() {
    setOcupado(true);
    try {
      let id: string;
      if (origen) {
        await plantillasCorreoApi.editar(origen.id, b);
        id = origen.id;
      } else {
        id = (await plantillasCorreoApi.crear(b)).id;
      }

      if (cabezote) await plantillasCorreoApi.subirCabezote(id, cabezote);
      else if (quitarCabezote) await plantillasCorreoApi.quitarCabezote(id);

      toast.exito(origen ? "Se guardó la plantilla." : "Se creó la plantilla.");
      await alGuardar();
    } catch (e) {
      toast.error((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  /// Pega la variable donde esté el cursor. Escribirlas a
  /// mano es como se cuela un `{{nombrecompleto}}` con la ce
  /// minúscula, que el servidor rechaza y nadie entiende por
  /// qué.
  function pegar(clave: string) {
    const trozo = `{{${clave}}}`;
    setCatalogoAbierto(false);
    setConsulta("");

    const ta = caja.current;
    if (!ta) {
      setB((v) => ({ ...v, cuerpo: v.cuerpo + trozo }));
      return;
    }
    const { selectionStart: a, selectionEnd: z } = ta;
    setB((v) => ({
      ...v,
      cuerpo: v.cuerpo.slice(0, a) + trozo + v.cuerpo.slice(z),
    }));
    // devolver el cursor detrás de lo pegado
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(a + trozo.length, a + trozo.length);
    });
  }

  function conmutarEtapa(valor: string) {
    setB((v) => ({
      ...v,
      etapasPermitidas: v.etapasPermitidas.includes(valor)
        ? v.etapasPermitidas.filter((x) => x !== valor)
        : [...v.etapasPermitidas, valor],
    }));
  }

  const resumenEtapas =
    b.etapasPermitidas.length > 0
      ? `Solo: ${b.etapasPermitidas.map((e) => EN_PALABRAS[e] ?? e).join(", ")}`
      : "Cualquier etapa (sin restricción)";

  return (
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px] flex items-center gap-3">
        <button
          type="button"
          onClick={alSalir}
          className="inline-flex items-center gap-1.5 rounded-sm border border-borde bg-superficie px-3 py-[7px] text-[12.5px] font-semibold text-texto-suave transition hover:text-texto"
        >
          <IconoIzquierda tamano={14} /> Plantillas
        </button>
        <h1 className="text-[1.1875rem] font-bold tracking-[-0.01em] text-titulo">
          {origen ? "Editar la plantilla" : "Nueva plantilla"}
        </h1>
      </header>

      <div className="px-7 py-5">
        {/* ── Datos de la plantilla ── */}
        <div className="mb-5 flex flex-col gap-4 rounded-md border border-borde bg-superficie p-5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-texto-suave">
                Cómo la va a reconocer
              </span>
              <input
                className={CLASE_CONTROL}
                value={b.nombre}
                onChange={(e) => setB({ ...b, nombre: e.target.value })}
                placeholder="Ej. Confirmación de inscripción"
              />
            </label>

            {/* El alcance existía en la base desde el primer
                día y la pantalla no lo tenía: todo lo que se
                creaba aquí salía global, aunque la lista
                dijera «Solo para ADECOPRIA» en las que sí lo
                llevaban. */}
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-texto-suave">
                Alcance
              </span>
              <select
                className={CLASE_CONTROL}
                value={b.convenioId ?? ""}
                onChange={(e) =>
                  setB({ ...b, convenioId: e.target.value || null })
                }
              >
                <option value="">Sirve para todos los gremios</option>
                {gremios.map((g) => (
                  <option key={g.convenioId} value={g.convenioId}>
                    Solo para {g.sigla}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-texto-suave">
              Asunto
            </span>
            <input
              className={CLASE_CONTROL}
              value={b.asunto}
              onChange={(e) => setB({ ...b, asunto: e.target.value })}
              placeholder="Lo que ve la persona en su bandeja"
            />
            {/* Lo que se ve en la lista del celular antes de
                abrirlo. Se mide sobre el asunto YA resuelto:
                «{{primerApellido}}» ocupa quince caracteres
                aquí y cuatro allá. */}
            {asuntoLleno.length > 50 && (
              <span className="mt-1.5 block text-[11.5px] text-aviso">
                En el celular se corta cerca del carácter 50. Este tiene{" "}
                {asuntoLleno.length}.
              </span>
            )}
          </label>

          {/* ── Etapas, plegadas ──
              Once casillas son más altas que los tres campos
              de texto juntos, y son lo que menos se toca.
              Cerradas dicen a quién le sirve; abiertas se
              cambia. */}
          <div className="border-t border-borde pt-4">
            <button
              type="button"
              onClick={() => setEtapasAbiertas(!etapasAbiertas)}
              className="flex w-full items-center gap-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-texto-suave">
                  ¿A quién se le puede mandar?
                </span>
                <span className="mt-0.5 block truncate text-[13px]">
                  {resumenEtapas}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-bold text-marca tabular-nums">
                {b.etapasPermitidas.length > 0
                  ? `${b.etapasPermitidas.length} de ${Object.keys(EN_PALABRAS).length}`
                  : "Sin límite"}
              </span>
              <IconoDerecha
                tamano={14}
                className={`shrink-0 text-texto-suave transition-transform ${
                  etapasAbiertas ? "rotate-90" : ""
                }`}
              />
            </button>

            {etapasAbiertas && (
              <div className="mt-3 border-t border-borde">
                <p className="pt-3 text-[12px] leading-relaxed text-texto-suave">
                  Si no marca ninguna, sirve para cualquiera. Marque solo si esta
                  plantilla dice algo que no es cierto en otra etapa —una
                  «confirmación» no le sirve a quien no quedó, y un «no quedó
                  seleccionado» no le sirve a quien sí.
                </p>
                <div className="mt-2.5 grid gap-6 sm:grid-cols-3">
                  {GRUPOS.map((g) => (
                    <div key={g.titulo}>
                      <p className="mb-2.5 text-[10.5px] font-bold tracking-[0.05em] uppercase text-texto-suave opacity-75">
                        {g.titulo}
                      </p>
                      <div className="flex flex-col gap-3">
                        {g.etapas.map(([valor, texto, nota]) => (
                          <label
                            key={valor}
                            className="flex cursor-pointer items-start gap-2 text-[12px] leading-tight"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={b.etapasPermitidas.includes(valor)}
                              onChange={() => conmutarEtapa(valor)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block">{texto}</span>
                              {nota && (
                                <span className="mt-px block text-[11px] text-texto-suave opacity-80">
                                  {nota}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Cabezote ── */}
          <div className="border-t border-borde pt-4">
            <div className="mb-1.5 flex items-baseline gap-2.5">
              <span className="text-[12px] font-semibold text-texto-suave">
                Cabezote del correo
              </span>
              <span className="ml-auto text-[11px] text-texto-suave opacity-80">
                Va de primeras, arriba del texto
              </span>
            </div>
            <Cabezote
              archivo={cabezote}
              url={urlGuardada}
              alEscoger={(f) => {
                setCabezote(f);
                setQuitarCabezote(false);
              }}
              alQuitar={() => {
                setCabezote(null);
                setQuitarCabezote(true);
              }}
            />
          </div>
        </div>

        {/* ── El mensaje ── */}
        <div className="mb-5">
          <p className="mb-2.5 text-[12px] font-bold tracking-[0.03em] uppercase text-texto-suave opacity-80">
            El mensaje
          </p>
          <div className="rounded-md border border-campo-borde bg-superficie p-3.5">
            {/* La clase va escrita y no compuesta sobre
                `CLASE_CONTROL`: el control de la casa mide
                12.5 px y aquí el texto es 13.5, y dos
                utilidades de tamaño en la misma etiqueta se
                resuelven por el orden de la hoja compilada,
                no por el del atributo. */}
            <textarea
              ref={caja}
              rows={12}
              className="w-full resize-y rounded-lg border border-borde bg-fondo px-3 py-3 text-[13.5px] leading-relaxed text-texto outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25"
              value={b.cuerpo}
              onChange={(e) => setB({ ...b, cuerpo: e.target.value })}
              placeholder="Escriba el correo. Lo que cambia de una persona a otra se pega desde «Insertar dato», aquí abajo."
            />

            {/* Lo que aquí sale lleno puede llegar vacío a
                alguien: el ejemplo tiene todos los datos y un
                lead real no siempre. */}
            {puestas.length > 0 && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-texto-suave">
                Usa {puestas.length} {puestas.length === 1 ? "variable" : "variables"}.
                A quien le falte alguna de esas en su lead, no se le manda: sale
                en la lista de omitidos con el motivo.
              </p>
            )}

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setCatalogoAbierto(!catalogoAbierto)}
                className="inline-flex items-center gap-2 rounded-sm border border-campo-borde bg-superficie px-3 py-2 text-[13px] font-semibold text-marca transition hover:border-marca"
              >
                <span className="text-[15px] leading-none">+</span> Insertar dato
                <IconoDerecha
                  tamano={12}
                  className={`transition-transform ${catalogoAbierto ? "rotate-90" : ""}`}
                />
              </button>
              <span className="ml-2.5 text-[11.5px] text-texto-suave opacity-80">
                Se pega donde esté el cursor.
              </span>

              {catalogoAbierto && (
                <Catalogo
                  variables={variables}
                  consulta={consulta}
                  alBuscar={setConsulta}
                  alPegar={pegar}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Vista previa ── */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setPreviaAbierta(!previaAbierta)}
            className="flex w-full items-center gap-2.5 rounded-md border border-borde bg-superficie px-4 py-3 text-left transition hover:border-campo-borde"
          >
            <span className="text-[12px] font-bold tracking-[0.03em] uppercase text-texto-suave opacity-80">
              Así va a salir
            </span>
            <span className="rounded-xs bg-marca-suave px-2 py-0.5 text-[11px] font-semibold text-marca">
              Con datos de ejemplo
            </span>
            <span className="ml-auto text-[12px] font-semibold text-texto-suave">
              {previaAbierta ? "Ocultar" : "Ver"}
            </span>
            <IconoDerecha
              tamano={12}
              className={`text-texto-suave transition-transform ${
                previaAbierta ? "rotate-90" : ""
              }`}
            />
          </button>

          {previaAbierta && (
            <div className="mt-3">
              <VistaPreviaCorreo
                variante="carta"
                asunto={b.asunto}
                cuerpo={b.cuerpo}
                variables={variables}
                banner={cabezote}
                bannerUrl={urlGuardada}
              />
            </div>
          )}

          {rotas.length > 0 && (
            <p className="mt-2.5 rounded-sm border border-error bg-error-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-error">
              {textoRotas}
            </p>
          )}
        </div>

        {/* ── Guardar ── */}
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={() => void guardar()} disabled={ocupado || noSePuede}>
            {ocupado ? "Guardando…" : "Guardar"}
          </Boton>
          <button
            type="button"
            onClick={alSalir}
            className="rounded-sm border border-campo-borde px-4 py-2 text-[13.5px] font-semibold text-texto-suave transition hover:text-texto"
          >
            Cancelar
          </button>
          {/* El motivo, al lado del botón. Un botón apagado
              sin decir por qué se lee como que la pantalla se
              rompió. */}
          {rotas.length > 0 ? (
            <span className="text-[12px] font-semibold text-error">{textoRotas}</span>
          ) : faltanCampos ? (
            <span className="text-[12px] text-texto-suave">
              Faltan campos: cómo la va a reconocer, asunto y el mensaje.
            </span>
          ) : (
            <span className="text-[12px] font-semibold text-exito">
              Todo listo para guardar.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── piezas del editor ──────────────

/// El catálogo, en su sitio y no flotando. Un desplegable
/// encima del cuerpo tapa justo lo que se está escribiendo, y
/// hay que cerrarlo para comprobar dónde cayó lo pegado.
function Catalogo({
  variables,
  consulta,
  alBuscar,
  alPegar,
}: {
  variables: VariableCorreo[];
  consulta: string;
  alBuscar: (v: string) => void;
  alPegar: (clave: string) => void;
}) {
  const q = consulta.trim().toLocaleLowerCase("es-CO");
  const casa = (v: VariableCorreo) =>
    !q ||
    v.clave.toLocaleLowerCase("es-CO").includes(q) ||
    v.titulo.toLocaleLowerCase("es-CO").includes(q) ||
    v.ejemplo.toLocaleLowerCase("es-CO").includes(q);

  const puestas = new Set(GRUPOS_DE_VARIABLE.flatMap((g) => g.claves));
  const grupos = [
    ...GRUPOS_DE_VARIABLE.map((g) => ({
      titulo: g.titulo,
      items: g.claves.flatMap((c) => {
        const v = variables.find((x) => x.clave === c);
        return v && casa(v) ? [v] : [];
      }),
    })),
    /// Lo que traiga el servidor y no esté repartido arriba.
    /// Sin esto, añadir una variable en el backend la haría
    /// invisible en el panel y nadie sabría por qué.
    {
      titulo: "Otros",
      items: variables.filter((v) => !puestas.has(v.clave) && casa(v)),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mt-2.5 max-h-[300px] overflow-auto rounded-sm border border-borde bg-superficie-alterna">
      <div className="sticky top-0 z-10 border-b border-borde bg-superficie-alterna p-2.5">
        <div className="flex items-center gap-2 rounded-sm border border-borde bg-superficie px-3 py-[7px]">
          <IconoBuscar tamano={14} className="shrink-0 text-texto-suave" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            value={consulta}
            onChange={(e) => alBuscar(e.target.value)}
            placeholder="Buscar dato"
          />
        </div>
      </div>

      <div className="px-1.5 pt-1.5 pb-2">
        {grupos.map((g, i) => (
          <div
            key={g.titulo}
            className={i > 0 ? "mt-1 border-t border-borde pt-1" : undefined}
          >
            <p className="px-2.5 pt-2 pb-1 text-[10px] font-bold tracking-[0.06em] uppercase text-texto-suave opacity-80">
              {g.titulo}
            </p>
            {g.items.map((v) => (
              <button
                key={v.clave}
                type="button"
                onClick={() => alPegar(v.clave)}
                className="flex w-full items-baseline gap-2.5 rounded-xs px-2.5 py-2 text-left transition hover:bg-superficie"
              >
                <span className="shrink-0 font-mono text-[12px] font-bold text-marca">
                  {`{{${v.clave}}}`}
                </span>
                <span className="min-w-0 truncate text-[12px] text-texto-suave">
                  {v.titulo} · <em className="opacity-80">{v.ejemplo}</em>
                </span>
              </button>
            ))}
          </div>
        ))}

        {grupos.length === 0 && (
          <p className="px-2.5 py-3 text-[12.5px] text-texto-suave">
            Ningún dato coincide con «{consulta}».
          </p>
        )}
      </div>
    </div>
  );
}

/// La franja de arriba del correo. Se sube después de guardar
/// —necesita el id de la plantilla—, así que aquí solo se
/// escoge y se enseña.
function Cabezote({
  archivo,
  url,
  alEscoger,
  alQuitar,
}: {
  archivo: File | null;
  url: string | null;
  alEscoger: (f: File) => void;
  alQuitar: () => void;
}) {
  const vistaPrevia = useMemo(
    () => (archivo ? URL.createObjectURL(archivo) : null),
    [archivo],
  );
  const imagen = vistaPrevia ?? url;

  if (imagen) {
    return (
      <div className="relative overflow-hidden rounded-sm border border-borde">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagen} alt="Cabezote del correo" className="block w-full" />
        <div className="absolute top-2 right-2 flex gap-1.5">
          <label className="cursor-pointer rounded-xs border border-campo-borde bg-superficie px-2.5 py-[5px] text-[11.5px] font-semibold">
            Cambiar
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) alEscoger(f);
              }}
            />
          </label>
          <button
            type="button"
            onClick={alQuitar}
            className="rounded-xs border border-campo-borde bg-superficie px-2.5 py-[5px] text-[11.5px] font-semibold text-error"
          >
            Quitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-sm border-[1.5px] border-dashed border-campo-borde bg-superficie px-3 py-2.5">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xs bg-marca-suave text-[19px] leading-none text-marca">
        +
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold">Suba el cabezote</span>
        <span className="block text-[11px] text-texto-suave">
          PNG, JPG o WebP, hasta 2 MB (logo o franja del gremio).
        </span>
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) alEscoger(f);
        }}
      />
    </label>
  );
}
