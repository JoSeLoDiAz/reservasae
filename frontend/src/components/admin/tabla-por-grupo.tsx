"use client";

/** El Bloque 3: la misma tabla, abierta por los grupos de la acción elegida. */

/**
 * «EL MISMO DETALLE PERO POR GRUPOS DE LA AF ELEGIDA» (cliente, 23 sep
 * 2026). Se abre pulsando una fila de «Cupos e inscritos por acción» y
 * se cierra pulsándola otra vez.
 *
 * NACE CERRADA Y SE ABRE DE UNA EN UNA. Siete acciones abiertas a la
 * vez son setenta filas seguidas, que es el chorrero que el cliente ya
 * nos hizo quitar de esta misma pantalla.
 *
 * Los «cupos reservados afiliados» de aquí no son los mismos de la
 * reservados» de la tabla de arriba, y por eso se llama distinto: el
 * pie lo explica y `backend/src/crm/resumen-por-grupo.ts` lo razona.
 */

import { Fragment, useCallback, useState } from "react";

import { alcanza } from "@/lib/admin-api";
import { cronogramaApi, type SedePosible } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { crmApi, type FilaDeGrupo } from "@/lib/crm-api";
import { cumplimiento } from "@/lib/cumplimiento";
import { useDatosVivos } from "@/lib/datos-vivos";

import { CuposDeLaSede } from "./cupos-de-la-sede";
import { Aviso, CLASE_CONTROL, useAdmin } from "./marco-admin";
import { Bloque, Esqueleto, Vacio } from "./piezas";
import { useToast } from "./toast";

/**
 * LA UBICACION DE LA CELDA, no su departamento.
 *
 * La fila agrupa por departamento, pero lo que la celda dice es DONDE
 * SE DICTA: desde la AF3 son CIUDADES ---APARTADO, MEDELLIN, SANTA
 * MARTA, PEREIRA, CALI--- y la columna imprimia ANTIOQUIA, MAGDALENA,
 * RISARALDA. Un rotulo que cuenta algo distinto de lo que mide, y lo
 * vio Josse en produccion el 7 oct 2026: «son ciudades».
 *
 * El dato ya viajaba: `sedes` trae los nombres de las ubicaciones de
 * esa fila, pegados ---dentro de un departamento puede haber varias
 * ciudades y siguen siendo la misma fila---. En las virtuales el
 * nombre de la ubicacion ES el departamento, asi que esta funcion
 * acierta en los dos casos sin preguntar por el tipo.
 *
 * El departamento queda de respaldo para el grupo SIN coberturas, que
 * sale a proposito con los dos vacios.
 */
const dondeSeDicta = (f: { sedes: string; departamento: string }) =>
  f.sedes || f.departamento || "—";

const n = (v: number) => v.toLocaleString("es-CO");

/// Los dos bloques de columnas, los mismos de la tabla de acciones.
/// LAS DOS MITADES DE LA TABLA, y por que llevan clase propia.
///
/// `grupo-entro` y `grupo-inscribio` no pintan texto: pintan la RAYA
/// que separa cada columna (`globals.css`, la cuadricula). El color
/// del rotulo ya decia de que mitad es cada columna, pero en una fila
/// de doce cifras el rotulo queda arriba del todo y a la altura del
/// dato ya no se sabe: «coloreame las separaciones» (cliente, 24 sep
/// 2026).
const ENTRO = "text-center whitespace-nowrap text-marca grupo-entro";
const INSCRIBIO = "text-center whitespace-nowrap text-exito grupo-inscribio";

/// Las mismas dos mitades, en el cuerpo. La clase va en la celda y no
/// en la fila porque la raya es de la COLUMNA.
const CELDA_ENTRO = "text-center tabular-nums grupo-entro";
const CELDA_ENTRO_TOTAL = "text-center font-medium tabular-nums grupo-entro";
const CELDA_INSCRIBIO = "text-center tabular-nums grupo-inscribio";

const tasa = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

/**
 * LA LLAVE DE UNA FILA, UNA SOLA VEZ.
 *
 * Desde que un grupo puede dar dos filas ---una por departamento--- el
 * id del grupo solo ya no identifica la fila, y React con llaves
 * repetidas reordena mal y reusa celdas de otra fila sin avisar.
 *
 * La usan la `key` y el estado del editor abierto. Escritas dos veces,
 * el dia que cambie una se pulsaria una fila y se abriria la de al
 * lado ---o ninguna---.
 */
const llaveDeFila = (f: { grupoId: string; departamento: string }) =>
  `${f.grupoId}·${f.departamento}`;

/**
 * LAS COLUMNAS, DECLARADAS, Y NO ESCRITAS A MANO EN EL `<thead>`.
 *
 * No es orden ni es estilo: es que la fila que se abre debajo lleva un
 * `colSpan`, y un numero fijo ahi es el defecto de agosto que este
 * proyecto ya tiene escrito ---la fila desplegable de reservas llevaba
 * uno y «con columnas que se quitan y se ponen ese numero se descuadra
 * solo», asi que el detalle acabo en un cajon lateral---. Declaradas,
 * el `colSpan` es `COLUMNAS.length` y no hay nada que recordar.
 *
 * Son las mismas que la tabla de acciones, y sin «Sede» (cliente, 23
 * sep 2026): la ubicacion ya dice donde.
 */
const COLUMNAS: Array<{ titulo: string; clase?: string }> = [
  { titulo: "Grupo" },
  /// UBICACION y no «Departamento»: desde la AF3 son CIUDADES, y la
  /// hibrida trae departamento Y ciudad. Un solo rotulo que vale para
  /// los tres (Josse, 7 oct 2026).
  { titulo: "Ubicación", clase: "w-full" },
  { titulo: "Modalidad", clase: "text-center whitespace-nowrap" },
  { titulo: "Meta", clase: "text-center whitespace-nowrap" },
  { titulo: "Cupos reservados afiliados", clase: ENTRO },
  { titulo: "Cupos reservados de pauta", clase: ENTRO },
  { titulo: "Total leads de pauta", clase: ENTRO },
  { titulo: "Inscritos reservas de afiliado", clase: INSCRIBIO },
  { titulo: "Inscritos de pauta", clase: INSCRIBIO },
  { titulo: "Total inscritos", clase: INSCRIBIO },
  { titulo: "Conversión", clase: "text-center whitespace-nowrap" },
  { titulo: "Cupos disponibles", clase: "text-center whitespace-nowrap" },
  { titulo: "Estado", clase: "text-center whitespace-nowrap" },
];


/// Como se lee, no como está escrita en la base.
const MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  MIXTA: "Mixta",
};

/**
 * ANADIR UNA SEDE A UN GRUPO QUE YA EXISTE.
 *
 * «Debo poder agregar grupos, departamento, la modalidad y distribuir
 * la meta» (Josse, 7 oct 2026), y despues, mirando la pantalla: «no se
 * ve la opcion de agregar grupos».
 *
 * LO QUE EL PIDE NO ES UN GRUPO NUEVO, Y ESO HAY QUE DECIRLO. Lo que
 * describe ---«grupo 1 Bogota y grupo 1 Antioquia»--- son DOS FILAS DE
 * LA TABLA, no dos grupos: la clave `(accionFormacionId, numero)`
 * prohibe dos grupos con el mismo numero en una accion. Es UN grupo
 * con DOS coberturas, y la fila que falta crear es la cobertura. Por
 * eso el formulario pide el grupo y la sede, no un numero de grupo.
 *
 * LA MODALIDAD NO SE PIDE: la pone la oferta, y el formulario la
 * ENSENA en cuanto se elige la sede. Dejarla teclear permitiria crear
 * una celda cuya modalidad no case con su oferta, y esa celda sale en
 * la tabla y NO SE PUEDE ASIGNAR a nadie, sin que nada falle.
 */
function AnadirSede({
  grupos,
  alCrear,
}: {
  /// Los grupos de esta accion, tal como salen de la tabla.
  grupos: Array<{ grupoId: string; numero: number }>;
  alCrear: () => void;
}) {
  const toast = useToast();
  const [grupoId, setGrupoId] = useState("");
  const [sedes, setSedes] = useState<SedePosible[] | null>(null);
  const [ubicacionId, setUbicacionId] = useState("");
  const [base, setBase] = useState("");
  const [tope, setTope] = useState("");
  const [guardando, setGuardando] = useState(false);

  /**
   * LAS SEDES SE PIDEN AL ELEGIR EL GRUPO, no al abrir el formulario.
   *
   * Dependen del grupo ---son las ubicaciones donde su accion tiene
   * oferta, y marca las que ese grupo ya tiene---, asi que pedirlas
   * antes seria pedir las de ninguno.
   */
  async function elegirGrupo(id: string) {
    setGrupoId(id);
    setUbicacionId("");
    setSedes(null);
    if (!id) return;
    try {
      setSedes(await cronogramaApi.sedesPosibles(id));
    } catch (e) {
      toast.error((e as ErrorApi).message ?? "No se pudieron leer las sedes.");
    }
  }

  const sede = sedes?.find((s) => s.ubicacionId === ubicacionId) ?? null;
  const listo =
    grupoId !== "" && ubicacionId !== "" && base.trim() !== "" && tope.trim() !== "";

  async function guardar() {
    setGuardando(true);
    try {
      await cronogramaApi.crearCobertura(grupoId, {
        ubicacionId,
        cuposBase: Number(base),
        cuposMaximos: Number(tope),
      });
      toast.exito("Sede anadida.");
      setUbicacionId("");
      setBase("");
      setTope("");
      setSedes(await cronogramaApi.sedesPosibles(grupoId));
      alCrear();
    } catch (e) {
      toast.error((e as ErrorApi).message ?? "No se pudo anadir.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-hairline p-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Grupo</span>
        <select
          value={grupoId}
          onChange={(e) => elegirGrupo(e.target.value)}
          className={`${CLASE_CONTROL} w-[8rem]`}
        >
          <option value="">Elegir…</option>
          {grupos.map((g) => (
            <option key={g.grupoId} value={g.grupoId}>
              Grupo {g.numero}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Ubicación</span>
        <select
          value={ubicacionId}
          onChange={(e) => setUbicacionId(e.target.value)}
          disabled={sedes === null}
          className={`${CLASE_CONTROL} w-[14rem]`}
        >
          <option value="">{sedes === null ? "Elija el grupo primero" : "Elegir…"}</option>
          {(sedes ?? []).map((s) => (
            /* LAS QUE YA ESTÁN SE MARCAN Y NO SE ESCONDEN: escondida,
               quien busca Medellín y no la encuentra no sabe si es que
               no se dicta allí o si es que ya está puesta, y son dos
               cosas distintas. */
            <option key={s.ubicacionId} value={s.ubicacionId} disabled={s.yaEnElGrupo}>
              {s.nombre}
              {s.yaEnElGrupo ? " · ya la tiene" : ""}
            </option>
          ))}
        </select>
      </label>

      {/* LA MODALIDAD SE LEE, NO SE ELIGE: la pone la oferta de esa
          (acción, ubicación) y el servidor la deriva igual. Un
          desplegable aquí dejaría crear una celda que no se puede
          asignar a nadie. */}
      <p className="min-w-[6rem] pb-2 text-[0.78125rem]">
        <span className="mb-1 block text-xs font-medium text-texto-suave">Modalidad</span>
        {sede ? (MODALIDAD[sede.modalidad] ?? sede.modalidad) : "—"}
      </p>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Comprometido</span>
        <input
          type="number"
          min={0}
          value={base}
          onChange={(e) => setBase(e.target.value)}
          className={`${CLASE_CONTROL} w-[6rem]`}
          aria-label="Cupos comprometidos en la sede nueva"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Tope</span>
        <input
          type="number"
          min={0}
          value={tope}
          onChange={(e) => setTope(e.target.value)}
          className={`${CLASE_CONTROL} w-[6rem]`}
          aria-label="Tope de cupos en la sede nueva"
        />
      </label>

      <button
        onClick={guardar}
        disabled={!listo || guardando}
        className="sin-aro rounded-lg bg-marca px-3 py-1.5 text-[0.78125rem] font-semibold text-blanco transition disabled:opacity-40"
      >
        {guardando ? "Añadiendo…" : "Añadir"}
      </button>
    </div>
  );
}

export function TablaPorGrupo({
  accionFormacionId,
  titulo,
  recorte,
  ventanaResuelta = true,
}: {
  accionFormacionId: string;
  /// El código y el nombre de la acción abierta, para que el bloque
  /// diga de cuál son estos grupos sin tener que mirar arriba.
  titulo: string;
  /**
   * EL MISMO RECORTE QUE LA TABLA DE ARRIBA.
   *
   * «No es confiable los filtros en los tableros» (cliente, 5 oct
   * 2026). Este bloque no obedecía a ninguno ---ni al periodo---, y
   * se abre pulsando una fila de esa tabla, que sí los obedece: los
   * dos, pegados en la misma pantalla, contaban gente distinta para
   * la misma acción.
   */
  recorte?: Record<string, unknown>;
  /**
   * SI LA CABECERA YA RESOLVIO EL PERIODO.
   *
   * Falso = todavia no ha contestado, y entonces este bloque NO
   * pregunta: el servidor, sin ventana, no filtra, y salia el
   * historico completo bajo el rotulo «Hoy» ---el «25» que reporto
   * el cliente el 5 oct 2026---.
   *
   * Y es «ya contesto», no «hay dos fechas»: con el periodo en
   * «Desde el principio» la respuesta es que NO hay ventana, y eso
   * es una respuesta. Mirando las fechas, la pantalla se quedaba en
   * esqueleto para siempre.
   */
  ventanaResuelta?: boolean;
}) {
  const clave = JSON.stringify(recorte ?? {});
  const cargar = useCallback(
    () => crmApi.resumenPorGrupo(accionFormacionId, recorte ?? {}),
    [accionFormacionId, clave], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const listo = ventanaResuelta;
  const vivos = useDatosVivos<FilaDeGrupo[]>(cargar, {
    clave: `resumen-por-grupo:${accionFormacionId}:${clave}`,
    activo: listo,
  });

  /// LOS CUPOS LOS EDITA QUIEN CONFIGURA LA FORMACION, igual que en
  /// Cronograma: es la misma ruta y el mismo permiso. Quien no puede,
  /// ve las cifras y ningun control ---un boton que da 403 es peor que
  /// no tenerlo---.
  const { admin } = useAdmin();
  const puedeEditar = alcanza(admin.permisos?.configuracion, "ESCRIBIR");
  const [anadiendo, setAnadiendo] = useState(false);
  /// Que fila tiene abierto el editor de su meta, por su llave.
  const [editando, setEditando] = useState<string | null>(null);
  /// `refrescar` NO va memoizada: la devuelve `useDatosVivos` nueva
  /// en cada render, asi que un useCallback con ella en las
  /// dependencias se rehace igual y solo anade ruido.
  const alGuardar = async () => {
    vivos.refrescar();
  };
  const toast = useToast();

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;

  const filas = vivos.datos;
  if (filas.length === 0) {
    return (
      <Vacio titulo="Esa acción todavía no tiene grupos">
        Los grupos se crean en Cronograma; aquí aparecen con sus cupos en cuanto existan.
      </Vacio>
    );
  }

  /**
   * LOS GRUPOS, SIN REPETIR, PARA EL DESPLEGABLE.
   *
   * `filas` trae UNA FILA POR (grupo, departamento), asi que el grupo
   * 1 con dos departamentos sale dos veces y el desplegable ofreceria
   * «Grupo 1» dos veces, las dos lo mismo. La llave es el grupoId.
   */
  const gruposUnicos = [
    ...new Map(filas.map((f) => [f.grupoId, { grupoId: f.grupoId, numero: f.numero }])).values(),
  ].sort((a, b) => a.numero - b.numero);

  const t = filas.reduce(
    (a, f) => ({
      meta: a.meta + f.meta,
      nominadosPorEmpresa: a.nominadosPorEmpresa + f.nominadosPorEmpresa,
      campanaDigital: a.campanaDigital + f.campanaDigital,
      totalLeads: a.totalLeads + f.totalLeads,
      inscritosReservas: a.inscritosReservas + f.inscritosReservas,
      inscritosCampana: a.inscritosCampana + f.inscritosCampana,
      totalInscritos: a.totalInscritos + f.totalInscritos,
      cuposDisponibles: a.cuposDisponibles + f.cuposDisponibles,
    }),
    {
      meta: 0,
      nominadosPorEmpresa: 0,
      campanaDigital: 0,
      totalLeads: 0,
      inscritosReservas: 0,
      inscritosCampana: 0,
      totalInscritos: 0,
      cuposDisponibles: 0,
    },
  );

  return (
    <Bloque
      sinRelleno
      titulo={`Grupos de ${titulo}`}
      /* «NO SE VE LA OPCIÓN DE AGREGAR GRUPOS» (Josse, 7 oct 2026), y
         tenía razón: esta tabla era de solo lectura y el vacío mandaba
         a Cronograma, que es otra pantalla y otro menú. El control va
         donde se lee el dato. */
      acciones={
        puedeEditar ? (
          <button
            type="button"
            onClick={() => setAnadiendo((v) => !v)}
            className="no-imprimir shrink-0 text-[0.75rem] font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
          >
            {anadiendo ? "Cerrar" : "Añadir una sede"}
          </button>
        ) : undefined
      }
    >
      {anadiendo && (
        <div className="px-4 pb-4">
          <AnadirSede
            grupos={gruposUnicos}
            alCrear={() => vivos.refrescar()}
          />
        </div>
      )}
      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos tabla-cuadricula w-full">
          <thead>
            <tr>
              {COLUMNAS.map((c) => (
                <th key={c.titulo} className={c.clase}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              /// LA LLAVE LLEVA EL DEPARTAMENTO. Desde que un grupo
              /// puede dar dos filas --una por departamento-- el id
              /// del grupo solo ya no identifica la fila, y React con
              /// llaves repetidas reordena mal y reusa celdas de otra
              /// fila sin avisar de nada.
              <Fragment key={llaveDeFila(f)}>
                <tr>
                  <td className="whitespace-nowrap">Grupo {f.numero}</td>
                  {/* Una raya y no una celda en blanco: en blanco no se
                      sabe si es que falta el dato o si es que nadie lo
                      llenó. */}
                  <td className="min-w-[10rem]">{dondeSeDicta(f)}</td>
                  <td className="whitespace-nowrap">{MODALIDAD[f.modalidad] ?? f.modalidad}</td>
                  {/* LA META, EDITABLE (Josse, 7 oct 2026: «que la meta
                      sea modificable manual»).

                      Es un BOTÓN que abre el editor debajo, y no un
                      campo en la celda: lo que se ve aquí es la SUMA
                      del departamento, y con dos sedes dentro no se
                      puede escribir encima ---habría que decidir cómo
                      se parte, y eso es decidir por quien escribe---.
                      Abajo sale una por sede.

                      Y sin sedes no hay nada que editar: el grupo sin
                      coberturas sale a propósito, con la ubicación y la
                      modalidad vacías. */}
                  <td className="text-center tabular-nums">
                    {puedeEditar && f.coberturas.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEditando((v) => (v === llaveDeFila(f) ? null : llaveDeFila(f)))
                        }
                        className="no-imprimir underline decoration-dotted underline-offset-2 hover:text-marca"
                        aria-label={`Editar la meta del grupo ${f.numero} en ${dondeSeDicta(f)}`}
                      >
                        {n(f.meta)}
                      </button>
                    ) : (
                      n(f.meta)
                    )}
                  </td>
                  <td className={CELDA_ENTRO}>{n(f.nominadosPorEmpresa)}</td>
                  <td className={CELDA_ENTRO}>{n(f.campanaDigital)}</td>
                  <td className={CELDA_ENTRO_TOTAL}>{n(f.totalLeads)}</td>
                  <td className={CELDA_INSCRIBIO}>{n(f.inscritosReservas)}</td>
                  <td className={CELDA_INSCRIBIO}>{n(f.inscritosCampana)}</td>
                  <td className="text-center font-semibold text-exito tabular-nums grupo-inscribio">
                    {n(f.totalInscritos)}
                  </td>
                  <td className="text-center tabular-nums">{tasa(f.conversion)}</td>
                  <td
                    className={
                      "text-center font-medium tabular-nums " +
                      (f.cuposDisponibles < 0 ? "text-error" : "")
                    }
                  >
                    {n(f.cuposDisponibles)}
                  </td>
                  <td>
                    <span
                      className={
                        "text-[0.75rem] font-semibold " +
                        (f.estado === "CERRADO" ? "text-error" : "text-exito")
                      }
                    >
                      {f.estado === "CERRADO" ? "Cerrado" : "Abierto"}
                    </span>
                  </td>
                </tr>

                {/* EL EDITOR, EN SU PROPIA FILA Y CON EL `colSpan`
                    CALCULADO. Un número fijo aquí es el defecto de
                    agosto, que está escrito en CLAUDE.md: la fila
                    desplegable de reservas llevaba uno y «con columnas
                    que se quitan y se ponen ese número se descuadra
                    solo». `COLUMNAS.length` no se puede quedar atrás.

                    UNA POR SEDE, que es lo que contesta «distribuir la
                    meta»: el tope de la oferta lo recalcula el servidor
                    como la suma de las suyas, así que no hay forma de
                    dejar las dos cifras descuadradas. */}
                {editando === llaveDeFila(f) && (
                  <tr>
                    <td colSpan={COLUMNAS.length} className="bg-fondo p-4">
                      <div className="flex flex-col gap-3">
                        {f.coberturas.map((c) => (
                          <CuposDeLaSede
                            key={c.coberturaId}
                            sede={{
                              id: c.coberturaId,
                              nombre: `${c.ubicacion} · ${MODALIDAD[c.modalidad] ?? c.modalidad}`,
                              cupos: c.cuposBase,
                              tope: c.cuposMaximos,
                            }}
                            alGuardar={alGuardar}
                            alFallar={(m) => toast.error(m)}
                          />
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-texto-suave">
                        «Comprometido» es lo pactado en el proyecto y «Tope» lo incluye más el
                        sobrecupo. La meta de la tabla es el tope. El total de la acción en esa
                        ubicación lo recalcula el servidor como la suma de sus sedes.
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}

            <tr className="border-t-2 border-borde font-semibold">
              <td colSpan={3}>Total</td>
              <td className="text-center tabular-nums">{n(t.meta)}</td>
              {/* LAS CLASES DE LAS DOS MITADES, TAMBIÉN AQUÍ. Sin
                  ellas la raya de color se paraba en la última fila
                  de datos y la de totales quedaba suelta, como si no
                  fuera de la misma tabla. */}
              <td className={CELDA_ENTRO}>{n(t.nominadosPorEmpresa)}</td>
              <td className={CELDA_ENTRO}>{n(t.campanaDigital)}</td>
              <td className={CELDA_ENTRO}>{n(t.totalLeads)}</td>
              <td className={CELDA_INSCRIBIO}>{n(t.inscritosReservas)}</td>
              <td className={CELDA_INSCRIBIO}>{n(t.inscritosCampana)}</td>
              <td className="text-center text-exito tabular-nums grupo-inscribio">
                {n(t.totalInscritos)}
              </td>
              <td className="text-center tabular-nums">
                {tasa(cumplimiento(t.totalInscritos, t.meta))}
              </td>
              <td className="text-center tabular-nums">{n(t.cuposDisponibles)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-sm text-texto-suave mt-3 leading-relaxed">
        La meta de cada grupo son sus cupos del cronograma, ya con el 30 % de sobrecupo, y
        la <strong>conversión</strong> es sus inscritos sobre ella. Los «cupos reservados
        afiliados» de aquí <strong>no</strong> son los mismos de la tabla de arriba: una
        reserva se aparta sobre la acción y la ciudad, no sobre un grupo, así que aquí se
        cuentan las personas que la empresa ya entregó con nombre propio. Por eso los
        grupos pueden sumar menos que su acción mientras queden cupos apartados sin
        nombre.
      </p>
    </Bloque>
  );
}
