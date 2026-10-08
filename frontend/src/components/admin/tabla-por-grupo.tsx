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
 * LAS SEDES DE UNA FILA, UNA SOLA VEZ Y CON SU RED.
 *
 * `coberturas` es OPCIONAL en el contrato: un backend sin reiniciar no
 * la manda, y esa ventana es real ---el `docker compose up -d --build`
 * recrea los dos contenedores, pero no a la vez---. Sin la red, un
 * `.length` sobre el ausente lanza DENTRO del render y se lleva el
 * bloque entero, no solo el editor.
 *
 * Va en una funcion y no en tres `?? []` sueltos: son tres sitios que
 * leen lo mismo, y el dia que uno se olvide la red volvemos aqui.
 */
const sedesDe = (f: FilaDeGrupo) => f.coberturas ?? [];

/// Si NINGUNA fila trae el detalle, es el backend viejo y no un grupo
/// sin sedes: hay que decirlo en vez de ensenar metas en cero.
const faltaElDetalle = (filas: FilaDeGrupo[]) =>
  filas.length > 0 && filas.every((f) => f.coberturas === undefined);

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
 * AÑADIR UNA SEDE A UN GRUPO, O AJUSTAR LA QUE YA TIENE.
 *
 * «Debo poder agregar grupos, departamento, la modalidad y distribuir
 * la meta» (Josse, 7 oct 2026), y despues, al probarlo: «en el grupo 1
 * dice que Antioquia ya esta, pero puedo volver a repetir Antioquia,
 * no hay problema [...] lo unico que necesitamos ahi es poner que
 * vamos a anadir en el grupo tal, en tal ubicacion, sin importar si es
 * el mismo departamento, que yo pueda ajustar los cupos» (8 oct 2026).
 *
 * DOS FILAS DE LA MISMA PAREJA NO CABEN, y eso no es una preferencia:
 * `GrupoCobertura` lleva `@@unique([grupoId, ubicacionId, modalidad])`.
 * Y hace bien ---dos celdas iguales dejarian sin respuesta a cual de
 * las dos pertenece una ficha---. Lo que SI es cierto es que
 * rechazarlas no le servia de nada: lo que el quiere es ajustar sus
 * cupos, y para eso ya existia `PATCH coberturas/:id/cupos`.
 *
 * ASI QUE EL FORMULARIO ELIGE LA PUERTA, no el usuario: alta si la
 * ubicacion es nueva en ese grupo, ajuste si ya estaba. Las dos rutas
 * ya existian, estan probadas y toman el mismo `FOR UPDATE` sobre la
 * oferta, asi que no hizo falta ninguna ruta nueva. El 409 del alta
 * SE QUEDA: sigue siendo la respuesta correcta para quien llame a la
 * API directo, y lo que cambia es que el panel ya no lo topa.
 *
 * LO QUE EL GRUPO TIENE SE PRECARGA. Sin eso, elegir Antioquia y
 * teclear 40 pisaria los 25 que tenia sin que nadie los hubiera visto:
 * el ajuste quedaria a ciegas, que es peor que el rechazo.
 *
 * LO QUE NO PUEDE HACER, y hay que decirlo: una ubicacion donde la
 * accion NO tiene oferta no sale en la lista y el servidor la
 * rechazaria. Cali, por ejemplo, solo se dicta en AF3; las virtuales
 * van por los nueve departamentos. Crear esa oferta cambia lo que el
 * SITIO PUBLICO ofrece ---`catalogo.service.ts` y el formulario de
 * preinscripcion leen `ofertas`--- y hoy no entra por ninguna ruta de
 * la API: solo por la siembra. Es otra decision, no un ajuste de cupos.
 *
 * LA MODALIDAD NO SE PIDE: la pone la oferta, y el formulario la
 * ensena en cuanto se elige la sede. Dejarla teclear permitiria crear
 * una celda cuya modalidad no case con su oferta, y esa celda sale en
 * la tabla y NO SE PUEDE ASIGNAR a nadie, sin que nada falle.
 */
function AnadirSede({
  grupos,
  alCrear,
}: {
  /**
   * LOS GRUPOS DE ESTA ACCION, CON LO QUE SUMAN HOY.
   *
   * El total va porque es lo que hace posible «distribuir los 65»:
   * sin el, repartir entre tres ubicaciones es sacar la calculadora
   * contra la tabla de arriba. NO es un tope ---no existe tal cosa en
   * la base: los 65 son la suma de las coberturas, y el foro de AF7
   * se subio a proposito por encima de la suya---, asi que se dice y
   * no se impone.
   */
  grupos: Array<{ grupoId: string; numero: number; base: number; tope: number }>;
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
   * QUE FALLO AL PEDIR LAS SEDES, APARTE DEL NULO.
   *
   * `sedes === null` significaba DOS cosas ---no ha elegido grupo y
   * la peticion fallo--- y el rotulo afirmaba la primera: con el
   * grupo ya elegido al lado, el desplegable seguia deshabilitado
   * diciendo «Elija el grupo primero». El toast avisa una vez y se
   * va; despues queda un cartel que dice algo falso. Y la salida no
   * era obvia: volver a elegir el MISMO grupo no dispara `onChange`.
   *
   * Pasa con cualquier 403, 404 o 429 ---el limitador de 60/min por
   * manejador que esta casa ya documenta como «No se pudo completar
   * la operacion»---.
   */
  const [falloSedes, setFalloSedes] = useState<string | null>(null);

  /**
   * LAS SEDES SE PIDEN AL ELEGIR EL GRUPO, no al abrir el formulario.
   *
   * Dependen del grupo ---son las ubicaciones donde su accion tiene
   * oferta, y dice cuales y con cuantos cupos las tiene ese grupo---,
   * asi que pedirlas antes seria pedir las de ninguno.
   */
  async function elegirGrupo(id: string) {
    setGrupoId(id);
    setUbicacionId("");
    setBase("");
    setTope("");
    setSedes(null);
    setFalloSedes(null);
    if (!id) return;
    try {
      setSedes(await cronogramaApi.sedesPosibles(id));
    } catch (e) {
      const m = (e as ErrorApi).message ?? "No se pudieron leer las sedes.";
      setFalloSedes(m);
      toast.error(m);
    }
  }

  /// Elegir una que ya esta trae SUS cupos; una nueva deja los campos
  /// vacios. Precargar es lo que impide pisar a ciegas lo que tenia.
  function elegirUbicacion(id: string) {
    setUbicacionId(id);
    const s = sedes?.find((x) => x.ubicacionId === id) ?? null;
    setBase(s?.puesta ? String(s.puesta.cuposBase) : "");
    setTope(s?.puesta ? String(s.puesta.cuposMaximos) : "");
  }

  const sede = sedes?.find((s) => s.ubicacionId === ubicacionId) ?? null;
  const grupo = grupos.find((g) => g.grupoId === grupoId) ?? null;
  const ajusta = sede?.puesta ?? null;
  /**
   * POR QUE TODAVIA NO SE PUEDE GUARDAR, EN PALABRAS.
   *
   * El servidor rechaza un tope por debajo de lo comprometido ---«el
   * sobrecupo suma, no resta»--- y hacia bien, pero el formulario
   * dejaba pulsar y la unica respuesta era un 400 con un toast que se
   * va. Y es el primer movimiento natural al repartir: bajar el tope
   * de una sede y olvidarse del comprometido. Lo topé probándolo.
   *
   * NO ES UNA SEGUNDA VERDAD: la del navegador es comodidad y la del
   * servidor es la que manda ---sigue ahi, con el mismo mensaje---.
   * Es la regla que esta casa ya usa en la preinscripcion: el boton
   * apagado dice que falta.
   *
   * Lo que NO se adelanta es «ya tiene N personas dentro»: ese dato
   * no lo tiene el formulario, y el servidor lo contesta nombrando
   * el numero. Inventarlo aqui seria adivinar.
   */
  const falta =
    grupoId === ""
      ? "Elija el grupo."
      : ubicacionId === ""
        ? "Elija la ubicación."
        : base.trim() === "" || tope.trim() === ""
          ? "Falta el comprometido o el tope."
          : Number(tope) < Number(base)
            ? "El tope no puede quedar por debajo de lo comprometido: el sobrecupo suma, no resta."
            : null;

  /**
   * LO QUE EL GRUPO SUMARIA CON LO QUE HAY TECLEADO.
   *
   * En un alta se suma; en un ajuste se sustituye lo que esa sede
   * tenia. Sin esa resta, ajustar Antioquia de 25 a 40 diria que el
   * grupo sube 40 cuando sube 15.
   */
  const quedaria =
    grupo && tope.trim() !== "" && Number.isFinite(Number(tope))
      ? grupo.tope - (ajusta?.cuposMaximos ?? 0) + Number(tope)
      : null;

  async function guardar() {
    setGuardando(true);
    try {
      if (ajusta) {
        await cronogramaApi.actualizarCupos(ajusta.coberturaId, {
          cuposBase: Number(base),
          cuposMaximos: Number(tope),
        });
        toast.exito("Cupos ajustados.");
      } else {
        await cronogramaApi.crearCobertura(grupoId, {
          ubicacionId,
          cuposBase: Number(base),
          cuposMaximos: Number(tope),
        });
        toast.exito("Sede añadida.");
      }
      setUbicacionId("");
      setBase("");
      setTope("");
      setSedes(await cronogramaApi.sedesPosibles(grupoId));
      alCrear();
    } catch (e) {
      toast.error((e as ErrorApi).message ?? "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-end gap-3">
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
            onChange={(e) => elegirUbicacion(e.target.value)}
            disabled={sedes === null}
            className={`${CLASE_CONTROL} w-[16rem]`}
          >
            <option value="">
              {/* TRES ESTADOS Y NO DOS: sin grupo, fallo y listo. El
                  rotulo de antes afirmaba el primero en los tres. */}
              {falloSedes !== null
                ? "No se pudieron leer"
                : sedes === null
                  ? "Elija el grupo primero"
                  : "Elegir…"}
            </option>
            {(sedes ?? []).map((s) => (
              /* LAS QUE YA ESTÁN SE MARCAN Y SE PUEDEN ELEGIR.
                 Estuvieron bloqueadas un día, y Josse lo corrigió:
                 «puedo volver a repetir Antioquia, no hay problema».
                 Elegirla no crea una segunda ---la llave única lo
                 prohíbe--- sino que ajusta la que hay, con sus cupos
                 ya precargados. Esconderlas sería peor todavía: quien
                 busca Medellín y no la encuentra no sabría si es que
                 no se dicta allí o si es que ya está puesta. */
              <option key={s.ubicacionId} value={s.ubicacionId}>
                {s.nombre}
                {s.puesta
                  ? ` · ya tiene ${s.puesta.cuposBase}/${s.puesta.cuposMaximos}`
                  : ""}
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
            aria-label="Cupos comprometidos en esta sede"
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
            aria-label="Tope de cupos en esta sede"
          />
        </label>

        {/* EL RÓTULO DICE CUÁL DE LAS DOS COSAS VA A PASAR. Con
            «Añadir» siempre, ajustar una sede que ya estaba se leería
            como un alta y nadie sabría que está pisando un número. */}
        <button
          onClick={guardar}
          disabled={falta !== null || guardando}
          className="sin-aro rounded-lg bg-marca px-3 py-1.5 text-[0.78125rem] font-semibold text-blanco transition disabled:opacity-40"
        >
          {guardando
            ? ajusta
              ? "Ajustando…"
              : "Añadiendo…"
            : ajusta
              ? "Ajustar"
              : "Añadir"}
        </button>
        {/* VOLVER A INTENTARLO, que es la salida que no habia:
            elegir otra vez el MISMO grupo no dispara `onChange`, asi
            que sin este boton habia que pasar por «Elegir…» y
            volver. */}
        {falloSedes !== null && grupoId !== "" && (
          <button
            type="button"
            onClick={() => elegirGrupo(grupoId)}
            className="pb-2 text-[0.78125rem] font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
          >
            Volver a intentarlo
          </button>
        )}
      </div>

      {/* LA RAZON SE LEE, y solo cuando ya hay algo tecleado: con el
          formulario recien abierto, «Elija el grupo» seria un regano
          por no haber hecho nada todavia. */}
      {falta !== null && grupoId !== "" && ubicacionId !== "" && (
        <p className="mt-3 text-xs text-aviso">{falta}</p>
      )}

      {falloSedes !== null && (
        <p className="mt-3 text-xs text-error">{falloSedes}</p>
      )}

      {/* LO QUE SUMA EL GRUPO, que es lo que pidió para poder
          «distribuir los 65 entre Cali, Magdalena y Huila».

          DICE, NO IMPIDE: en la base no existe un tope del grupo ---los
          65 son la suma de sus coberturas--- y el foro de AF7 se subió
          a propósito por encima de la suya. Poner aquí un límite sería
          inventar una regla que nadie pidió. */}
      {grupo && (
        <p className="mt-3 text-xs text-texto-suave">
          El grupo {grupo.numero} lleva{" "}
          <strong className="font-semibold tabular-nums text-texto">
            {n(grupo.base)}
          </strong>{" "}
          comprometidos y{" "}
          <strong className="font-semibold tabular-nums text-texto">
            {n(grupo.tope)}
          </strong>{" "}
          de tope, repartidos entre sus ubicaciones.
          {quedaria !== null && quedaria !== grupo.tope && (
            <>
              {" "}
              Con lo que está escrito quedaría en{" "}
              <strong className="font-semibold tabular-nums text-texto">
                {n(quedaria)}
              </strong>
              .
            </>
          )}
        </p>
      )}

      {/* UNA UBICACIÓN SIN OFERTA NO SALE, Y HAY QUE DECIR POR QUÉ:
          si no, buscar Cali en una virtual y no encontrarla se lee
          como un fallo. Crear esa oferta cambia lo que el sitio
          público ofrece allí, así que no entra por aquí. */}
      {sedes !== null && (
        <p className="mt-1 text-xs text-texto-suave">
          Solo salen las ubicaciones donde esta acción de formación ya se dicta.
        </p>
      )}
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

  /// LOS CUPOS LOS EDITA QUIEN CONFIGURA LA FORMACION, igual que en
  /// Cronograma: es la misma ruta y el mismo permiso. Quien no puede,
  /// ve las cifras y ningun control ---un boton que da 403 es peor que
  /// no tenerlo---.
  const { admin } = useAdmin();
  const puedeEditar = alcanza(admin.permisos?.configuracion, "ESCRIBIR");
  const [anadiendo, setAnadiendo] = useState(false);
  /// Que fila tiene abierto el editor de su meta, por su llave.
  const [editando, setEditando] = useState<string | null>(null);
  const toast = useToast();

  /**
   * EL REFRESCO SE PARA MIENTRAS HAY UN EDITOR ABIERTO, y esto no es
   * una optimizacion: es un defecto que una revision adversarial
   * encontro el 8 oct 2026, y era mio.
   *
   * `CuposDeLaSede` guarda sus dos campos en estado al montarse y no
   * vuelve a sincronizarlos. En su casa de siempre ---la vista del
   * cronograma--- eso era inofensivo, porque alli NO hay datos vivos.
   * Esta tabla si los tiene, cada 30 s, y su `cambio` se compara
   * contra el prop NUEVO: si otra persona tocaba esa misma cobertura,
   * al refrescar el boton «Guardar» SE ENCENDIA SOLO y, pulsado,
   * mandaba los valores viejos ---pisando lo del otro y bajando con
   * ello el tope de la oferta---.
   *
   * Es la MISMA foto que el desglose del asesor tenia y que se
   * arreglo el 7 oct; reaparecio por el otro lado de la misma entrega
   * al mudar el componente a una pantalla que si se refresca. Van
   * cuatro veces en este proyecto que un arreglo trae su defecto.
   *
   * La cura es la regla que esta casa ya tiene escrita: los datos
   * vivos «NO se aplican en las pantallas de edicion: pisarian lo que
   * se escribe». `activo: false` NO tira los datos ---solo se salta el
   * efecto---, y al cerrar el editor vuelve a pedir, asi que lo que se
   * ve despues es la verdad.
   */
  const vivos = useDatosVivos<FilaDeGrupo[]>(cargar, {
    clave: `resumen-por-grupo:${accionFormacionId}:${clave}`,
    activo: listo && editando === null && !anadiendo,
  });

  /// `refrescar` NO va memoizada: la devuelve `useDatosVivos` nueva
  /// en cada render, asi que un useCallback con ella en las
  /// dependencias se rehace igual y solo anade ruido.
  const alGuardar = async () => {
    vivos.refrescar();
  };

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
   * LOS GRUPOS, SIN REPETIR Y CON LO QUE SUMAN, PARA EL DESPLEGABLE.
   *
   * `filas` trae UNA FILA POR (grupo, departamento), así que el grupo
   * 1 con dos departamentos sale dos veces y el desplegable ofrecería
   * «Grupo 1» dos veces, las dos lo mismo. La llave es el grupoId.
   *
   * Y DE PASO SE SUMA LO QUE LLEVA CADA GRUPO, que es lo que hace
   * posible «distribuir los 65 entre Cali, Magdalena y Huila» (Josse,
   * 8 oct 2026) sin sacar la calculadora contra la tabla. Sale de las
   * coberturas de sus filas ---el dato ya viaja--- y NO de una
   * consulta nueva: el grupo cruza varias filas de esta misma tabla.
   */
  const gruposUnicos = [
    ...filas
      .reduce((m, f) => {
        const v = m.get(f.grupoId) ?? {
          grupoId: f.grupoId,
          numero: f.numero,
          base: 0,
          tope: 0,
        };
        for (const c of sedesDe(f)) {
          v.base += c.cuposBase;
          v.tope += c.cuposMaximos;
        }
        m.set(f.grupoId, v);
        return m;
      }, new Map<string, { grupoId: string; numero: number; base: number; tope: number }>())
      .values(),
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
      {/* EL BACKEND VIEJO SE DICE, NO SE DISIMULA.

          Si NINGUNA fila trae el detalle de sus sedes, es que el
          servidor todavia no se ha reiniciado ---la ventana del
          despliegue--- y no que los grupos esten sin sedes. Sin
          decirlo, la meta no se puede editar y el formulario diria
          que cada grupo lleva 0 de tope: una cifra falsa es peor que
          una pantalla que explica lo que le pasa. Es lo mismo que
          hace el desglose del asesor cuando le falta `porAccion`. */}
      {faltaElDetalle(filas) && (
        <p className="px-4 pb-4 text-sm text-texto-suave">
          El servidor no está enviando el detalle de sedes de cada grupo, así que la meta no se
          puede editar todavía. Si acaba de actualizarse, hay que reiniciarlo.
        </p>
      )}
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
                    {puedeEditar && sedesDe(f).length > 0 ? (
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
                        {sedesDe(f).map((c) => (
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
