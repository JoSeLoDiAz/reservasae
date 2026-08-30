"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import {
  Aviso,
  Boton,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { useToast } from "@/components/admin/toast";
import { bonito, ErrorApi } from "@/lib/api";
import {
  ETIQUETA_CAMPO,
  ETIQUETA_CLASIFICACION,
  ETIQUETA_FUENTE,
  ETIQUETA_TAMANO,
  institucionesApi,
  TRABAJADORES_POR_TAMANO,
  type CambioRegistrado,
  type ClasificacionEmpresa,
  type ConsultaRues,
  type FichaInstitucion,
  type FuenteDato,
  type Propuesta,
  type TamanoEmpresa,
} from "@/lib/instituciones-api";

/** Los campos que esta pantalla puede escribir: el EditarInstitucionDto. */
type ClaveEditable =
  | "razonSocial"
  | "nombreComercial"
  | "fechaFundacion"
  | "direccion"
  | "telefono"
  | "correo"
  | "paginaWeb"
  | "ciudadNombre"
  | "departamentoNombre"
  | "tamano"
  | "numeroEmpleados"
  | "clasificacion"
  | "sectorEconomico"
  | "codigoCiiu";

const CLAVES_EDITABLES: ClaveEditable[] = [
  "razonSocial",
  "nombreComercial",
  "fechaFundacion",
  "direccion",
  "telefono",
  "correo",
  "paginaWeb",
  "ciudadNombre",
  "departamentoNombre",
  "tamano",
  "numeroEmpleados",
  "clasificacion",
  "sectorEconomico",
  "codigoCiiu",
];

/// Todo el formulario vive como texto, tal como lo devuelve un input.
/// Asi la comparacion contra lo cargado es una sola: cadena contra cadena,
/// sin null que se confunda con "" ni numeros que cambien de tipo al teclear.
type Borrador = Record<ClaveEditable, string>;

/// La tabla se llama `consultas_rues` de cuando se pensaba
/// consultar el RUES. Lo que consulta hoy es el buscador web,
/// así que eso es lo que tiene que decir en pantalla: quien
/// lea «El RUES respondió» va a creer que el dato viene del
/// registro mercantil, y no viene de ahí.
const ETIQUETA_ESTADO_CONSULTA: Record<ConsultaRues["estado"], string> = {
  PENDIENTE: "En cola",
  EN_CURSO: "Consultando",
  LISTA: "El buscador respondió",
  SIN_RESULTADO: "No encontró nada para este NIT",
  FALLIDA: "La consulta falló",
};

const TONO_ESTADO_CONSULTA: Record<ConsultaRues["estado"], string> = {
  PENDIENTE: "bg-superficie-alterna text-texto-suave",
  EN_CURSO: "bg-marca-suave text-marca",
  LISTA: "bg-exito-suave text-exito",
  SIN_RESULTADO: "bg-aviso-suave text-aviso",
  FALLIDA: "bg-error-suave text-error",
};

/// El mismo codigo de color que la bandeja de pendientes: WEB en
/// amarillo porque es lo unico que nadie ha comprobado, RUES en verde
/// porque es fuente oficial, y lo demas neutro. Si aqui significara
/// otra cosa, la persona tendria que reaprender la pantalla.
const ESTILO_FUENTE: Record<FuenteDato, string> = {
  WEB: "border-aviso/40 bg-aviso-suave font-semibold text-aviso",
  RUES: "border-exito/30 bg-exito-suave text-exito",
  CARGA: "border-borde bg-superficie-alterna text-texto-suave",
  HUMANO: "border-borde bg-superficie-alterna text-texto-suave",
};

/// El orden en que se leen los campos, el mismo del formulario y el de
/// la bandeja, para revisar siempre en el mismo sitio.
const ORDEN_CAMPOS = Object.keys(ETIQUETA_CAMPO);

function ordenarCampos(campos: Record<string, unknown>): string[] {
  const posicion = (clave: string) => {
    const i = ORDEN_CAMPOS.indexOf(clave);
    return i === -1 ? ORDEN_CAMPOS.length : i;
  };
  return Object.keys(campos).sort((a, b) => posicion(a) - posicion(b));
}

/// Una fecha que no se puede leer se devuelve tal como llego: un
/// "Invalid Date" en mitad de la frase no le dice nada a quien revisa.
function fechaLarga(s: string): string {
  const fecha = new Date(s);
  if (Number.isNaN(fecha.getTime())) return s;
  return fecha.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function desdeFicha(f: FichaInstitucion): Borrador {
  return {
    razonSocial: f.razonSocial ?? "",
    nombreComercial: f.nombreComercial ?? "",
    /// El input date solo admite aaaa-mm-dd y el backend puede
    /// devolver la fecha con la hora pegada detras.
    fechaFundacion: (f.fechaFundacion ?? "").slice(0, 10),
    direccion: f.direccion ?? "",
    telefono: f.telefono ?? "",
    correo: f.correo ?? "",
    paginaWeb: f.paginaWeb ?? "",
    ciudadNombre: f.ciudadNombre ?? "",
    departamentoNombre: f.departamentoNombre ?? "",
    tamano: f.tamano ?? "",
    numeroEmpleados: f.numeroEmpleados === null ? "" : String(f.numeroEmpleados),
    clasificacion: f.clasificacion ?? "",
    sectorEconomico: f.sectorEconomico ?? "",
    codigoCiiu: f.codigoCiiu ?? "",
  };
}

/**
 * Lo que se manda en el PATCH: solo las claves que el usuario cambio.
 */
function soloLoQueCambio(borrador: Borrador, cargado: Borrador) {
  const datos: Record<string, unknown> = {};

  for (const clave of CLAVES_EDITABLES) {
    const nuevo = borrador[clave].trim();
    if (nuevo === cargado[clave].trim()) continue;

    /// Un campo que se vacia es un borrado explicito: va como null,
    /// no como "". Una cadena vacia guardada se lee luego como un
    /// dato que alguien escribio, y no lo es.
    if (clave === "numeroEmpleados") {
      datos[clave] = nuevo === "" ? null : Number(nuevo);
      continue;
    }
    datos[clave] = nuevo === "" ? null : nuevo;
  }

  return datos;
}

/// La ley 590 dice cuantos trabajadores tiene cada tamano. Cuando no
/// cuadra hay que decirlo, pero sin bloquear: si el RUES declara otra
/// cosa, la contradiccion es el hallazgo, no un error de quien teclea.
function desajusteDeTamano(tamano: string, empleados: string): string | null {
  if (!tamano || empleados.trim() === "") return null;

  const cantidad = Number(empleados);
  if (!Number.isFinite(cantidad)) return null;

  const rango = TRABAJADORES_POR_TAMANO[tamano as TamanoEmpresa];
  if (!rango) return null;

  const [minimo, maximo] = rango;
  if (cantidad >= minimo && cantidad <= maximo) return null;

  const esperado =
    maximo === Number.MAX_SAFE_INTEGER
      ? `${minimo} trabajadores o más`
      : `entre ${minimo} y ${maximo} trabajadores`;

  return (
    `${ETIQUETA_TAMANO[tamano as TamanoEmpresa]} corresponde a ${esperado}, ` +
    `y aquí figuran ${cantidad}.`
  );
}

/** El valor que hoy tiene la ficha en un campo cualquiera. */
function valorActual(f: FichaInstitucion, clave: string): unknown {
  return (f as unknown as Record<string, unknown>)[clave];
}

const estaVacio = (valor: unknown) =>
  valor === null || valor === undefined || valor === "";

/** Un valor cualquiera, listo para leerse en pantalla. */
function enTexto(clave: string, valor: unknown): string {
  if (estaVacio(valor)) return "—";
  if (clave === "tamano") {
    return ETIQUETA_TAMANO[valor as TamanoEmpresa] ?? String(valor);
  }
  if (clave === "clasificacion") {
    return ETIQUETA_CLASIFICACION[valor as ClasificacionEmpresa] ?? String(valor);
  }
  if (clave === "fechaFundacion") return String(valor).slice(0, 10);
  /// Una propuesta trae lo que trae: si un campo llega como objeto,
  /// vale mas ensenarlo crudo que un "[object Object]".
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/// Lo que trae un buscador nace SIN marcar, igual que en la bandeja de
/// pendientes: si llegara marcado, un clic distraido en Aplicar lo
/// pasaria a la ficha sin que nadie lo haya comprobado, que es justo lo
/// que la regla prohibe. De las demas fuentes viene marcado solo lo que
/// llena un hueco: pisar un dato que ya existe es una decision de quien
/// revisa, no algo que deba pasar por descuido.
function marcasIniciales(f: FichaInstitucion) {
  const marcas: Record<string, Record<string, boolean>> = {};

  for (const propuesta of f.propuestas) {
    const porCampo: Record<string, boolean> = {};
    for (const clave of Object.keys(propuesta.campos)) {
      porCampo[clave] =
        propuesta.fuente !== "WEB" && estaVacio(valorActual(f, clave));
    }
    marcas[propuesta.id] = porCampo;
  }

  return marcas;
}

export default function PaginaInstitucion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [ficha, setFicha] = useState<FichaInstitucion | null>(null);
  const [cargado, setCargado] = useState<Borrador | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [marcas, setMarcas] = useState<Record<string, Record<string, boolean>>>({});
  /// `error` es solo para cuando la ficha NI SIQUIERA carga:
  /// ahí no hay pantalla donde poner un aviso flotante. Todo
  /// lo demás va por `toast`.
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /**
   * Los avisos van flotando, no arriba de la página.
   *
   * Antes el mensaje se pintaba en la cabecera. Esta ficha es
   * larga: al aceptar una propuesta —que es un botón que está
   * casi al final— el «Se aplicaron 12 datos» salía a dos
   * pantallas de distancia, arriba, donde nadie lo veía. Uno
   * le daba, no pasaba nada visible, y parecía que no había
   * servido. Sí servía.
   */
  const toast = useToast();

  const cargar = useCallback(async () => {
    const datos = await institucionesApi.ver(id);
    const inicial = desdeFicha(datos);
    setFicha(datos);
    setCargado(inicial);
    setBorrador(inicial);
    setMarcas(marcasIniciales(datos));
  }, [id]);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  async function conError(accion: () => Promise<string>) {
    setOcupado(true);
    try {
      const mensaje = await accion();
      await cargar();
      toast.exito(mensaje);
    } catch (e) {
      toast.error((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  if (!ficha || !borrador || !cargado) {
    return error ? (
      <Aviso tipo="error">{error}</Aviso>
    ) : (
      <p className="text-texto-suave">Cargando…</p>
    );
  }

  const fuentes = ficha.fuentePorCampo ?? {};
  const cambios = soloLoQueCambio(borrador, cargado);
  const hayCambios = Object.keys(cambios).length > 0;
  const desajuste = desajusteDeTamano(borrador.tamano, borrador.numeroEmpleados);
  const verificada = ficha.verificadaEn !== null;
  const sinRazonSocial = borrador.razonSocial.trim() === "";

  /// Ya hay una pedida y sin responder: pedir otra no la
  /// apura, solo suma trabajo -- y cobro -- por lo mismo.
  const consultando = ficha.consultas.some(
    (c) => c.estado === "PENDIENTE" || c.estado === "EN_CURSO",
  );

  const escribir = (clave: ClaveEditable) => (valor: string) =>
    setBorrador({ ...borrador, [clave]: valor });

  /// Un campo tocado y sin guardar ya no es lo que trajo la fuente:
  /// seguir mostrando el sello de origen encima seria mentir sobre
  /// quien escribio eso que hay en la casilla.
  const tocado = (clave: ClaveEditable) => clave in cambios;

  /// Guardar es lo que aprueba la ficha: el backend la aprueba solo si no
  /// le queda ningun dato por llenar, y devuelve `falta` y `verificadaEn`
  /// ya recalculados. Cuando no queda aprobada hay que decir el motivo
  /// exacto — le faltan datos, y cuales —, porque el unico motivo posible
  /// es ese y no un permiso de quien guarda.
  const guardar = async () => {
    setOcupado(true);
    try {
      const guardada = await institucionesApi.editar(ficha.id, cambios);
      await cargar();

      if (guardada.verificadaEn !== null) {
        toast.exito("La empresa quedó guardada y aprobada.");
      } else if (guardada.falta.length > 0) {
        const pendientes = guardada.falta
          .map((clave) => ETIQUETA_CAMPO[clave] ?? clave)
          .join(", ");
        /// Aviso, no error: los cambios SÍ se guardaron. Lo
        /// que no pasó es la aprobación, y por eso se dice
        /// exactamente qué falta.
        toast.aviso(
          `Se guardaron los cambios, pero la empresa no queda aprobada porque le ` +
            `faltan datos: ${pendientes}.`,
        );
      } else {
        toast.exito("Se guardaron los cambios.");
      }
    } catch (e) {
      toast.error((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div>
      <div>
        <Link href="/admin/instituciones" className="text-sm text-marca hover:underline">
          ← Volver a instituciones
        </Link>
      </div>

      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
            {bonito(ficha.razonSocial)}
          </h1>
          <p className="mt-1 font-mono text-sm text-texto-suave">
            NIT {ficha.nit}-{ficha.digitoVerificacion}
          </p>
          {ficha.nombreComercial && (
            <p className="mt-1 text-sm text-texto-suave">
              Nombre comercial: {bonito(ficha.nombreComercial)}
            </p>
          )}
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm ${
            verificada ? "bg-exito-suave text-exito" : "bg-aviso-suave text-aviso"
          }`}
        >
          {ficha.verificadaEn
            ? `Actualizada por ${ficha.verificadaPor?.nombre ?? "el equipo"} · ${fechaLarga(
                ficha.verificadaEn,
              )}`
            : "Sin actualizar"}
        </span>
      </header>

      {/* los avisos de las acciones salen flotando: esta ficha
          es demasiado larga para ponerlos aquí arriba */}

      {/* el digito lo calcula el backend; si el declarado no coincide,
          alguien copio mal el NIT y eso viaja a todos los reportes */}
      {ficha.digitoDeclarado !== null &&
        ficha.digitoDeclarado !== ficha.digitoVerificacion && (
          <Aviso tipo="error">
            El NIT llegó con dígito de verificación {ficha.digitoDeclarado} y al{" "}
            {ficha.nit} le corresponde {ficha.digitoVerificacion}. Uno de los dos
            números está mal escrito.
          </Aviso>
        )}

      {/* sin datos que falten no hay nada pendiente que enumerar */}
      {ficha.falta.length > 0 && (
        <Tarjeta
          titulo={`Datos pendientes para su aprobación (${ficha.falta.length} ${
            ficha.falta.length === 1 ? "dato" : "datos"
          }):`}
        >
          <ul className="space-y-1 text-sm text-texto">
            {ficha.falta.map((clave) => (
              <li key={clave}>{ETIQUETA_CAMPO[clave] ?? clave}</li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {ficha.sinConfirmar.length > 0 && (
        <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
          <p className="font-medium">
            {ficha.sinConfirmar.length === 1
              ? "Un dato lo trajo un buscador y nadie lo ha confirmado"
              : `${ficha.sinConfirmar.length} datos los trajo un buscador y nadie los ha confirmado`}
          </p>
          <p className="mt-1">
            {ficha.sinConfirmar.map((clave) => ETIQUETA_CAMPO[clave] ?? clave).join(", ")}
            . Son sugerencias: no salen al SENA mientras la ficha siga sin verificar.
          </p>
        </div>
      )}

      <Tarjeta
        titulo="Datos de la empresa"
        descripcion="Recuerde validar los campos que considere pertinente para guardar la empresa correctamente."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
          className="space-y-5"
        >
          <div className="grid sm:grid-cols-2">
            <CampoConFuente
              clave="razonSocial"
              fuente={fuentes.razonSocial}
              cambiado={tocado("razonSocial")}
            >
              <input
                className={CLASE_CONTROL}
                value={borrador.razonSocial}
                onChange={(e) => escribir("razonSocial")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="nombreComercial"
              fuente={fuentes.nombreComercial}
              cambiado={tocado("nombreComercial")}
            >
              <input
                className={CLASE_CONTROL}
                value={borrador.nombreComercial}
                onChange={(e) => escribir("nombreComercial")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="fechaFundacion"
              fuente={fuentes.fechaFundacion}
              cambiado={tocado("fechaFundacion")}
            >
              <input
                type="date"
                className={CLASE_CONTROL}
                value={borrador.fechaFundacion}
                onChange={(e) => escribir("fechaFundacion")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="direccion"
              fuente={fuentes.direccion}
              cambiado={tocado("direccion")}
            >
              <input
                className={CLASE_CONTROL}
                value={borrador.direccion}
                onChange={(e) => escribir("direccion")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="telefono"
              fuente={fuentes.telefono}
              cambiado={tocado("telefono")}
            >
              <input
                inputMode="tel"
                className={CLASE_CONTROL}
                value={borrador.telefono}
                onChange={(e) => escribir("telefono")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="correo"
              fuente={fuentes.correo}
              cambiado={tocado("correo")}
            >
              <input
                type="email"
                className={CLASE_CONTROL}
                value={borrador.correo}
                onChange={(e) => escribir("correo")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="paginaWeb"
              fuente={fuentes.paginaWeb}
              cambiado={tocado("paginaWeb")}
            >
              <input
                className={CLASE_CONTROL}
                placeholder="https://"
                value={borrador.paginaWeb}
                onChange={(e) => escribir("paginaWeb")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="ciudadNombre"
              fuente={fuentes.ciudadNombre}
              cambiado={tocado("ciudadNombre")}
            >
              <input
                className={CLASE_CONTROL}
                value={borrador.ciudadNombre}
                onChange={(e) => escribir("ciudadNombre")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="departamentoNombre"
              fuente={fuentes.departamentoNombre}
              cambiado={tocado("departamentoNombre")}
            >
              <input
                className={CLASE_CONTROL}
                value={borrador.departamentoNombre}
                onChange={(e) => escribir("departamentoNombre")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="sectorEconomico"
              fuente={fuentes.sectorEconomico}
              cambiado={tocado("sectorEconomico")}
            >
              <input
                className={CLASE_CONTROL}
                value={borrador.sectorEconomico}
                onChange={(e) => escribir("sectorEconomico")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="codigoCiiu"
              fuente={fuentes.codigoCiiu}
              cambiado={tocado("codigoCiiu")}
              ayuda="La actividad económica como la clasifica la DIAN."
            >
              <input
                className={CLASE_CONTROL}
                value={borrador.codigoCiiu}
                onChange={(e) => escribir("codigoCiiu")(e.target.value)}
              />
            </CampoConFuente>

            <CampoConFuente
              clave="clasificacion"
              fuente={fuentes.clasificacion}
              cambiado={tocado("clasificacion")}
            >
              <select
                className={CLASE_CONTROL}
                value={borrador.clasificacion}
                onChange={(e) => escribir("clasificacion")(e.target.value)}
              >
                <option value="">Sin definir</option>
                {Object.entries(ETIQUETA_CLASIFICACION).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </CampoConFuente>

            <CampoConFuente
              clave="tamano"
              fuente={fuentes.tamano}
              cambiado={tocado("tamano")}
            >
              <select
                className={CLASE_CONTROL}
                value={borrador.tamano}
                onChange={(e) => escribir("tamano")(e.target.value)}
              >
                <option value="">Sin definir</option>
                {Object.entries(ETIQUETA_TAMANO).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </CampoConFuente>

            <CampoConFuente
              clave="numeroEmpleados"
              fuente={fuentes.numeroEmpleados}
              cambiado={tocado("numeroEmpleados")}
            >
              <input
                type="number"
                min={0}
                className={CLASE_CONTROL}
                value={borrador.numeroEmpleados}
                onChange={(e) => escribir("numeroEmpleados")(e.target.value)}
              />
            </CampoConFuente>
          </div>

          {desajuste && (
            <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
              <p className="font-medium">El tamaño y el número de empleados no cuadran</p>
              <p className="mt-1">
                {desajuste} Se puede guardar de todos modos: si el dato viene del
                RUES, prevalece sobre la tabla de la ley y la diferencia es un
                hallazgo, no un error de digitación.
              </p>
            </div>
          )}

          {sinRazonSocial && (
            <p className="text-sm text-error">
              La razón social no puede quedar vacía: es el nombre con el que la
              institución aparece en todo lo demás.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-borde pt-4">
            <Boton type="submit" disabled={!hayCambios || sinRazonSocial || ocupado}>
              {hayCambios
                ? `Guardar ${Object.keys(cambios).length} ${
                    Object.keys(cambios).length === 1 ? "cambio" : "cambios"
                  }`
                : "Guardar"}
            </Boton>

            {hayCambios && (
              <button
                type="button"
                onClick={() => setBorrador(cargado)}
                className="text-sm underline"
              >
                Descartar los cambios
              </button>
            )}

            {/* type="button": dentro de un formulario, un boton sin
                tipo guarda la ficha ademas de lo suyo */}
            <button
              type="button"
              disabled={ocupado || consultando}
              onClick={() =>
                void conError(async () => {
                  const r = await institucionesApi.validarWeb(ficha.id);
                  return r.ultima?.estado === "EN_CURSO"
                    ? "Ya había una consulta en curso para este NIT."
                    : "Se pidió la consulta. Cuando responda, lo que traiga sale " +
                        "aquí abajo como propuesta, para que usted decida qué entra.";
                })
              }
              className="ml-auto rounded-xl border border-marca px-4 py-2 text-sm font-medium text-marca transition hover:bg-marca-suave disabled:opacity-50"
            >
              {consultando ? "Consultando…" : "Buscar los datos en la web"}
            </button>
          </div>

          {/* lo que trae el buscador NO entra en la ficha: entra
              como propuesta, y una persona la acepta campo por
              campo. Decirlo aqui evita que alguien espere ver los
              datos cambiados solos */}
          <p className="text-sm text-texto-suave">
            La búsqueda en la web no cambia nada de esta ficha: deja una
            propuesta con lo que encontró, y usted decide campo por campo qué
            entra y qué no.
          </p>
        </form>
      </Tarjeta>

      {ficha.propuestas.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              {ficha.propuestas.length === 1
                ? "Hay una propuesta sin revisar"
                : `Hay ${ficha.propuestas.length} propuestas sin revisar`}
            </h2>
            <p className="mt-1 text-sm text-texto-suave">
              Un buscador, el RUES o una persona propuso datos para esta institución.
              Marque lo que sirva y descarte el resto.
            </p>
          </div>

          {/* descartar es aplicar nada: el backend cierra la propuesta
              igual. Sin esa salida, una propuesta que no sirve se queda
              en la ficha para siempre, porque el boton de aplicar esta
              apagado mientras no haya ningun campo marcado */}
          {ficha.propuestas.map((propuesta) => (
            <TarjetaPropuesta
              key={propuesta.id}
              propuesta={propuesta}
              ficha={ficha}
              marcadas={marcas[propuesta.id] ?? {}}
              ocupado={ocupado}
              alMarcar={(clave, valor) =>
                setMarcas({
                  ...marcas,
                  [propuesta.id]: { ...(marcas[propuesta.id] ?? {}), [clave]: valor },
                })
              }
              alAplicar={(campos) =>
                conError(async () => {
                  const r = await institucionesApi.aplicarPropuesta(
                    propuesta.id,
                    campos,
                  );
                  const aplicados =
                    r.aplicados === 1
                      ? "Se aplicó 1 dato"
                      : `Se aplicaron ${r.aplicados} datos`;
                  const resto =
                    r.descartados === 0
                      ? ""
                      : r.descartados === 1
                        ? " El otro se descartó."
                        : ` Los otros ${r.descartados} se descartaron.`;
                  return `${aplicados} a la ficha.${resto}`;
                })
              }
              alDescartar={() =>
                conError(async () => {
                  await institucionesApi.aplicarPropuesta(propuesta.id, []);
                  return "Propuesta descartada. No se cambió ningún dato de la ficha.";
                })
              }
            />
          ))}
        </section>
      )}

      {ficha.empresas.length > 0 && (
        <Tarjeta
          titulo="Empresas enlazadas"
          descripcion="Lo que esta institución ha inscrito con este NIT."
        >
          <ul className="divide-y divide-borde">
            {ficha.empresas.map((empresa) => (
              <li
                key={empresa.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 truncate">{bonito(empresa.razonSocial)}</span>
                <span className="shrink-0 text-sm text-texto-suave tabular-nums">
                  {empresa._count.participantes}{" "}
                  {empresa._count.participantes === 1
                    ? "participante"
                    : "participantes"}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {ficha.consultas.length > 0 && (
        <Tarjeta
          titulo="Consultas al buscador web"
          descripcion="Lo último que se buscó en la web por este NIT."
        >
          <ul className="space-y-3">
            {ficha.consultas.slice(0, 5).map((consulta) => (
              <li
                key={consulta.id}
                className="rounded-xl border border-borde p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-3 py-1 ${
                      TONO_ESTADO_CONSULTA[consulta.estado]
                    }`}
                  >
                    {ETIQUETA_ESTADO_CONSULTA[consulta.estado]}
                  </span>
                  <span className="text-texto-suave">
                    Pedida el {fechaLarga(consulta.creadoEn)}
                    {consulta.resueltaEn &&
                      ` · respondió el ${fechaLarga(consulta.resueltaEn)}`}
                  </span>
                </div>
                {consulta.ultimoError && (
                  <p className="mt-2 rounded-xl bg-error-suave p-3 text-error">
                    {consulta.ultimoError}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <ControlDeCambios historial={ficha.historial} />
    </div>
  );
}

/**
 * Quién cambió qué, y desde qué valor.
 *
 * Con el valor anterior, no solo el nombre del campo: sin eso
 * no se puede responder «esto lo puso el RUES o lo corrigió
 * alguien», que es justo lo que hay que poder responder.
 */
function ControlDeCambios({ historial }: { historial: CambioRegistrado[] }) {
  return (
    <Tarjeta
      titulo="Control de cambios"
      descripcion="Cada guardado queda registrado con su autor y su fecha."
    >
      {historial.length === 0 ? (
        <p className="text-sm text-texto-suave">
          Todavía no se ha guardado ningún cambio en esta empresa.
        </p>
      ) : (
        <ol className="space-y-3">
          {historial.map((cambio) => (
            <li key={cambio.id} className="rounded-xl border border-borde p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-medium">{cambio.actorNombre}</span>
                <span className="text-texto-suave">{fechaLarga(cambio.creadoEn)}</span>
              </div>

              {cambio.resumen ? (
                <ul className="mt-2 space-y-1">
                  {cambio.resumen.split(" · ").map((linea, i) => {
                    const corte = linea.indexOf(":");
                    const campo = corte > 0 ? linea.slice(0, corte) : linea;
                    const valores = corte > 0 ? linea.slice(corte + 1).trim() : "";
                    return (
                      <li key={i} className="text-texto-suave">
                        <span className="font-medium text-texto">
                          {ETIQUETA_CAMPO[campo] ?? campo}
                        </span>
                        {valores && <>: {valores}</>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                cambio.camposTocados.length > 0 && (
                  <p className="mt-2 text-texto-suave">
                    {cambio.camposTocados
                      .map((c) => ETIQUETA_CAMPO[c] ?? c)
                      .join(", ")}
                  </p>
                )
              )}
            </li>
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}

/// `Campo` del kit recibe la etiqueta como texto plano y aqui la
/// etiqueta tiene que llevar el sello de procedencia al lado. Es la
/// misma caja, con sitio para el sello.
function CampoConFuente({
  clave,
  fuente,
  cambiado,
  ayuda,
  children,
}: {
  clave: ClaveEditable;
  fuente?: FuenteDato;
  cambiado?: boolean;
  ayuda?: string;
  children: React.ReactNode;
}) {
  /// La franja amarilla al costado no repite lo que dice el sello: lo
  /// adelanta. En una rejilla de catorce campos el sello hay que
  /// leerlo uno por uno, y lo sugerido tiene que verse antes de eso,
  /// que es lo unico que no puede reportarse al SENA.
  const sugerido = fuente === "WEB" && !cambiado;

  return (
    <label
      className={`block border-l-2 pl-3 ${
        sugerido ? "border-aviso" : "border-transparent"
      }`}
    >
      <span className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium">
        {ETIQUETA_CAMPO[clave] ?? clave}
        {cambiado ? <SelloSinGuardar /> : <SelloFuente fuente={fuente} />}
      </span>
      {children}
      {ayuda && <span className="mt-1.5 block text-xs text-texto-suave">{ayuda}</span>}
    </label>
  );
}

/// Mientras el campo esta escrito y sin guardar, el sello de origen
/// mentiria: ese texto ya no lo puso la fuente que dice el sello.
function SelloSinGuardar() {
  return (
    <span
      title="Lo escribió usted y todavía no se ha guardado."
      className="inline-flex items-center gap-1.5 text-[0.71875rem] font-semibold text-marca"
    >
      Sin guardar
    </span>
  );
}

/**
 * De donde salio el dato. El del buscador se pinta aparte porque es el
 * unico que no puede llegar al SENA sin que una persona lo confirme.
 */
function SelloFuente({ fuente }: { fuente?: FuenteDato }) {
  /// Sin entrada en fuentePorCampo no hay nada que contar: un sello
  /// vacio en cada campo solo seria ruido.
  if (!fuente) return null;

  const esWeb = fuente === "WEB";

  return (
    <span
      title={
        esWeb
          ? "Lo sacó un buscador de una página pública. Es una sugerencia: no llega al SENA hasta que alguien la compruebe."
          : `Procedencia: ${ETIQUETA_FUENTE[fuente]}.`
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${ESTILO_FUENTE[fuente]}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full bg-current ${esWeb ? "" : "opacity-50"}`}
      />
      {esWeb ? "Sugerido, sin verificar" : ETIQUETA_FUENTE[fuente]}
    </span>
  );
}

function TarjetaPropuesta({
  propuesta,
  ficha,
  marcadas,
  ocupado,
  alMarcar,
  alAplicar,
  alDescartar,
}: {
  propuesta: Propuesta;
  ficha: FichaInstitucion;
  marcadas: Record<string, boolean>;
  ocupado: boolean;
  alMarcar: (clave: string, valor: boolean) => void;
  alAplicar: (campos: string[]) => void;
  alDescartar: () => void;
}) {
  const claves = ordenarCampos(propuesta.campos);
  const elegidas = claves.filter((clave) => marcadas[clave]);
  const esWeb = propuesta.fuente === "WEB";

  return (
    <section
      className={`rounded-2xl border bg-superficie p-6 ${
        esWeb ? "border-aviso/40" : "border-borde"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">
            {esWeb ? "Lo encontró un buscador web" : ETIQUETA_FUENTE[propuesta.fuente]}
          </h3>
          <p className="mt-1 text-sm text-texto-suave">
            Llegó el {fechaLarga(propuesta.creadoEn)}
          </p>
        </div>
        <SelloFuente fuente={propuesta.fuente} />
      </div>

      {esWeb && (
        <p className="mt-4 rounded-xl border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
          Nada de esto está verificado, y por eso llega sin marcar. Compruébelo antes de
          marcarlo: lo que aplique quedará en la ficha como sugerido y seguirá sin poder
          reportarse.
        </p>
      )}

      <ul className="mt-5 divide-y divide-borde">
        {claves.map((clave) => {
          const ahora = valorActual(ficha, clave);
          const propone = propuesta.campos[clave];
          const llenaUnHueco = estaVacio(ahora);

          return (
            <li key={clave} className="py-3 first:pt-0">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={marcadas[clave] ?? false}
                  disabled={ocupado}
                  onChange={(e) => alMarcar(clave, e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-marca"
                />
                <span className="min-w-0 grow">
                  <span className="block text-sm font-medium">
                    {ETIQUETA_CAMPO[clave] ?? clave}
                  </span>
                  <span className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                    <span className="min-w-0">
                      <span className="text-texto-suave">Ahora: </span>
                      <span className="break-words">{enTexto(clave, ahora)}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="text-texto-suave">Propone: </span>
                      <span className="break-words font-medium">
                        {enTexto(clave, propone)}
                      </span>
                    </span>
                  </span>
                  {!llenaUnHueco && (
                    <span className="mt-1 block text-xs text-texto-suave">
                      Aplicarlo reemplaza el dato que ya hay.
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-borde pt-4">
        <Boton
          disabled={elegidas.length === 0 || ocupado}
          onClick={() => alAplicar(elegidas)}
        >
          Aplicar lo marcado ({elegidas.length} de {claves.length})
        </Boton>

        <button
          type="button"
          disabled={ocupado}
          onClick={alDescartar}
          className="inline-flex items-center justify-center rounded-xl border border-borde px-5 py-2.5 text-sm font-medium text-error transition hover:bg-error-suave disabled:opacity-50"
        >
          Descartar la propuesta
        </button>

        <p className="text-sm text-texto-suave">
          Lo que no marque se descarta junto con la propuesta.
        </p>
      </div>
    </section>
  );
}
