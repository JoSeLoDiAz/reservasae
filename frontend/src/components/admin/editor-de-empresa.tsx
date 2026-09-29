"use client";

import { useEffect, useMemo, useState } from "react";

import { Boton, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { crmApi, type CatalogosSep, type Ficha } from "@/lib/crm-api";
import { digitoVerificacion, partirNitPegado } from "@/lib/nit";

type Empresa = NonNullable<Ficha["empresa"]>;

/// Todo como TEXTO, incluidos los números.
///
/// Un `number | null` dentro de un input obliga a decidir qué
/// es «vacío» en cada tecla, y con `enableImplicitConversion`
/// del backend una cadena vacía en un campo numérico llega
/// como cero. Aquí se guarda lo tecleado tal cual y la
/// conversión se hace UNA vez, al mandar.
function desde(e: Empresa | null) {
  return {
    nit: e?.nit ?? "",
    razonSocial: e?.razonSocial ?? "",
    digitoVerificacion: e?.digitoVerificacion ?? "",
    direccion: e?.direccion ?? "",
    telefono: e?.telefono ?? "",
    departamentoSepId:
      e?.departamentoSepId == null ? "" : String(e.departamentoSepId),
    municipioSepId: e?.municipioSepId == null ? "" : String(e.municipioSepId),
    sectorEconomico: e?.sectorEconomico ?? "",
    numeroTrabajadores:
      e?.numeroTrabajadores == null ? "" : String(e.numeroTrabajadores),
    contactoNombre: e?.contactoNombre ?? "",
    contactoCargo: e?.contactoCargo ?? "",
    contactoCorreo: e?.contactoCorreo ?? "",
  };
}

type Campos = ReturnType<typeof desde>;

/// Las dos puertas se ven IGUAL de importantes a propósito: ninguna
/// es «la avanzada». Son dos cosas distintas que se hacen por
/// razones distintas, y quien llega tiene que poder elegir.
const CLASE_PUERTA =
  "h-[34px] rounded-lg border border-borde bg-superficie px-3.5 text-[0.78125rem] font-semibold text-titulo hover:bg-superficie-alterna";

/**
 * MOVER LA FICHA A UNA ORGANIZACIÓN QUE YA ESTÁ REGISTRADA.
 *
 * El caso que lo pidió (cliente, 29 sep 2026): la ficha colgaba de
 * una empresa con NIT «1-8» —basura tecleada en la preinscripción—
 * cuando la «Secretaría de Educación Departamental del Cauca» ya
 * existía con su NIT bueno. Corregir el NIT no servía: el servidor
 * paraba porque ese NIT ya era de otra, y con razón.
 *
 * SOLO PIDE EL NIT. La organización de destino ya está en el sistema
 * con su razón social y sus datos; dejar teclear también el nombre
 * daría a entender que se puede renombrar de paso, y renombrar
 * alcanza a todas las fichas de esa fila, no solo a esta.
 *
 * NO BORRA LA ORGANIZACIÓN MALA. Se queda donde está, con las otras
 * fichas que tenga: aquí nada se elimina. Si no le queda ninguna,
 * eso lo limpia quien administra «Empresas registradas», que es
 * quien puede ver a quién más afecta.
 */
function Mudanza({
  participanteId,
  empresa,
  alGuardar,
  cerrar,
}: {
  participanteId: string;
  empresa: Empresa;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
  cerrar: () => void;
}) {
  const [nit, setNit] = useState("");
  const [moviendo, setMoviendo] = useState(false);

  /// Cinco dígitos es el mínimo que acepta el servidor. Se mira aquí
  /// también para no mandar un viaje que ya se sabe que vuelve mal.
  const suficiente = nit.replace(/\D/g, "").length >= 5;

  return (
    <div className="mt-4 rounded-xl border border-borde p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.8125rem] font-semibold text-titulo">
            Mover a otra organización
          </p>
          <p className="mt-1 text-[0.78125rem] leading-relaxed text-texto-suave">
            Esto mueve <strong>solo a esta persona</strong>. La organización
            que tiene ahora —{empresa.razonSocial ?? "sin nombre"} (NIT{" "}
            {empresa.nit ?? "sin NIT"})— no se toca ni se borra, y las demás
            personas que cuelguen de ella se quedan donde están.
          </p>
        </div>
        <button
          type="button"
          onClick={cerrar}
          className="shrink-0 rounded-lg border border-error/40 bg-error-suave px-4 py-2 text-sm font-semibold text-error"
        >
          Cancelar
        </button>
      </div>

      <label className="mt-3 block sm:max-w-xs">
        <span className="mb-1 block text-[0.71875rem] text-texto-suave">
          NIT de la organización a la que se mueve
        </span>
        <input
          className={CLASE_CONTROL}
          value={nit}
          onChange={(e) => setNit(e.target.value)}
          inputMode="numeric"
          placeholder="891580016"
        />
        <span className="mt-1 block text-[0.6875rem] leading-snug text-texto-suave">
          Tiene que estar ya registrada. Puede escribirlo con puntos y con el
          dígito de verificación detrás del guion. Si el NIT todavía no existe
          en el sistema, lo que hay que hacer es corregir el de la
          organización actual.
        </span>
      </label>

      <div className="mt-4">
        <Boton
          disabled={!suficiente || moviendo}
          onClick={() => {
            setMoviendo(true);
            void alGuardar(async () => {
              await crmApi.mudarDeOrganizacion(participanteId, nit);
              /// Se cierra SOLO si salió bien: si el servidor rechazó
              /// —el NIT no existe, la ficha vino por reserva— el
              /// panel se queda abierto con lo tecleado y el aviso
              /// arriba, para corregir sin volver a empezar.
              cerrar();
            }, "Persona movida de organización.").finally(() =>
              setMoviendo(false),
            );
          }}
        >
          {moviendo ? "Moviendo…" : "Mover"}
        </Boton>
      </div>
    </div>
  );
}

/**
 * Corregir los datos de la empresa desde la ficha del lead.
 *
 * Antes de esto solo se corregían tres —nombre, cargo y correo
 * del jefe directo— y el resto había que buscarlo en «Empresas
 * registradas», que un gestor de inscripciones no tiene en el
 * menú. El asesor llamaba, conseguía la dirección y no tenía
 * dónde ponerla: se quedaba en un papel.
 *
 * EN LECTURA NO SE VE NADA DE ESTO, y es a propósito. La
 * tarjeta enseña el NIT y la razón social, que es lo que se
 * consulta cien veces al día; los demás campos aparecen al
 * pulsar el botón. Puestos como cajas de formulario siempre,
 * dejaban la tarjeta mucho más alta que «Datos del
 * interesado», que es con la que tiene que emparejar.
 *
 * Se manda SOLO lo que cambió: una clave ausente es «no lo
 * toque» y una en null es «quítalo». El servidor depende de esa
 * diferencia, así que no se rellena el objeto con lo que ya
 * estaba.
 */
export function EditorDeEmpresa({
  participanteId,
  empresa,
  porSuCuenta,
  puedeEscribir,
  alGuardar,
}: {
  participanteId: string;
  /// Null = la ficha no tiene organización: se DA DE ALTA por su NIT
  /// (Josse, 30 sep 2026). Con empresa, se corrigen sus datos.
  empresa: Empresa | null;
  /// Independiente con RUT: no tiene jefe directo a quien
  /// preguntarle, así que los tres del contacto no se piden.
  porSuCuenta: boolean;
  puedeEscribir: boolean;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [mudando, setMudando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [v, setV] = useState<Campos>(() => desde(empresa));

  const original = useMemo(() => desde(empresa), [empresa]);

  /// Sin empresa, esto DA DE ALTA la organización; con empresa, la
  /// corrige. Cambia los rótulos y hace el NIT obligatorio.
  const crear = empresa === null;
  const faltaNit = crear && v.nit.trim() === "";

  /// El NIT de una empresa es de nueve dígitos (Josse, 30 sep 2026).
  ///
  /// AVISA Y NO BLOQUEA, y las dos razones importan: quien trabaja
  /// POR SU CUENTA pone su cédula, que no tiene nueve; y hay 25
  /// organizaciones en producción que ya entraron con otro largo
  /// --«liceo moderno» son ocho dígitos-- que el equipo va a
  /// revisar. Bloqueando, no se les podría corregir ni la dirección
  /// mientras tanto.
  const nitRaro =
    !porSuCuenta && v.nit.trim() !== "" && v.nit.replace(/\D/g, "").length !== 9;

  /// Si la ficha vuelve del servidor —se guardó, o cambió por
  /// otro lado— lo tecleado se reemplaza por lo guardado. Sin
  /// esto la pantalla seguiría enseñando lo de antes y nadie
  /// sabría cuál de los dos está en la base.
  ///
  /// EN EL RENDER y no en un `useEffect`, que es lo que React
  /// recomienda para ajustar estado cuando cambia una prop: el
  /// efecto repinta dos veces y por un instante enseña lo
  /// viejo. `datos-sena.tsx` lo hace con efecto y arrastra el
  /// aviso del linter; aquí no hacía falta repetirlo.
  const [vista, setVista] = useState(empresa);
  if (vista !== empresa) {
    setVista(empresa);
    setV(desde(empresa));
  }

  /// Los catálogos se piden al abrir, no al montar: son 1.126
  /// municipios y esta tarjeta se abre en una de cada veinte
  /// visitas a la ficha.
  useEffect(() => {
    if (!abierto || catalogos) return;
    void crmApi
      .catalogos()
      .then(setCatalogos)
      .catch(() => setCatalogos(null));
  }, [abierto, catalogos]);

  // los municipios del departamento elegido, y nada mas
  const municipios = useMemo(() => {
    if (!catalogos || v.departamentoSepId === "") return [];
    const dep = Number(v.departamentoSepId);
    return catalogos.municipios
      .filter((m) => m[1] === dep)
      .sort((a, b) => a[2].localeCompare(b[2], "es"));
  }, [catalogos, v.departamentoSepId]);

  const hayCambios = JSON.stringify(v) !== JSON.stringify(original);

  /// El NIT y su dígito son DOS campos, y el de arriba nunca se
  /// queda con los dos pegados (Josse, 30 sep 2026).
  ///
  /// Pegar `8001837677` --como queda al copiar de un documento--
  /// guardaba un NIT de diez dígitos, y así nacieron siete
  /// organizaciones duplicadas en producción. Aquí se reparte a la
  /// vista, en vez de corregirlo por detrás: el asesor ve el NIT en
  /// su casilla y el dígito en la suya.
  ///
  /// El dígito sale CALCULADO al tocar el NIT y se puede cambiar:
  /// para cada NIT hay uno solo, pero si el papel de la empresa dice
  /// otro, manda quien tiene el papel delante.
  function ponerNit(escrito: string) {
    setV((antes) => {
      const partido = partirNitPegado(escrito);
      if (partido) {
        return { ...antes, nit: partido.nit, digitoVerificacion: partido.dv };
      }

      const soloDigitos = escrito.replace(/\D/g, "");
      return {
        ...antes,
        nit: soloDigitos,
        digitoVerificacion: digitoVerificacion(soloDigitos),
      };
    });
  }

  function poner(clave: keyof Campos, valor: string) {
    setV((antes) => {
      const nuevo = { ...antes, [clave]: valor };
      /// Cambiar de departamento deja el municipio en el aire:
      /// el que había es de otro departamento y el servidor lo
      /// rechaza. Se limpia aquí para que el desplegable de al
      /// lado no enseñe un municipio imposible.
      if (clave === "departamentoSepId" && valor !== antes.departamentoSepId) {
        nuevo.municipioSepId = "";
      }
      return nuevo;
    });
  }

  /// Lo que cambió, y nada más.
  ///
  /// Un texto que se deja en blanco se OMITE en vez de
  /// mandarse: quien borra un campo casi siempre es que no
  /// consiguió el dato, no que quiera quitar el que había. Los
  /// desplegables sí mandan null, porque ahí elegir «—» es una
  /// respuesta.
  function loQueCambio() {
    const d: Record<string, string | number | null> = {};

    const texto = (clave: keyof Campos) => {
      if (v[clave] === original[clave]) return;
      const limpio = v[clave].trim();
      if (limpio !== "") d[clave] = limpio;
    };

    const numero = (clave: keyof Campos) => {
      if (v[clave] === original[clave]) return;
      d[clave] = v[clave] === "" ? null : Number(v[clave]);
    };

    texto("nit");
    texto("razonSocial");
    texto("digitoVerificacion");
    texto("direccion");
    texto("telefono");
    texto("sectorEconomico");
    numero("departamentoSepId");
    numero("municipioSepId");
    numero("numeroTrabajadores");

    if (!porSuCuenta) {
      texto("contactoNombre");
      texto("contactoCargo");
      texto("contactoCorreo");
    }

    return d;
  }

    if (!puedeEscribir) return null;

  const ROTULO = "mb-1 block text-[0.71875rem] text-texto-suave";
  const rotulo = crear
    ? "Registrar organización"
    : "Actualizar datos de empresa";

  function cerrar() {
    setV(original);
    setAbierto(false);
  }

  const disparador = (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setAbierto(true)} className={CLASE_PUERTA}>
        {rotulo}
      </button>

      {/* LA SEGUNDA PUERTA, Y POR QUÉ ES OTRA (29 sep 2026).

          El cliente llegó con una ficha colgada de una empresa con NIT
          «1-8» cuando la buena ya estaba registrada. Al corregir el
          NIT, el servidor para ---con razón: dos organizaciones no
          pueden compartir NIT--- y mandaba a usar el enlace de
          completado de la persona, que es pedirle a ella que rellene un
          formulario para arreglar un dato mal digitado.

          Ahí no hay nada que corregir: hay que mover a la persona. Son
          dos operaciones distintas y por eso son dos botones; juntarlas
          en uno haría que quien quiere mover a una persona le cambie el
          NIT a toda la organización sin saberlo.

          SOLO SI YA TIENE UNA. Sin organización no hay de dónde mover, y
          el alta de José ya enlaza sola cuando el NIT que teclean
          resulta ser de una que ya existe. */}
      {!crear && (
        <button
          type="button"
          onClick={() => setMudando(true)}
          className={CLASE_PUERTA}
        >
          Mover a otra organización
        </button>
      )}
    </div>
  );

  /// La mudanza, abierta, sustituye a los botones: es un panel suyo y
  /// no un modal, porque pide UN dato y no trece.
  if (mudando && empresa) {
    return (
      <Mudanza
        participanteId={participanteId}
        empresa={empresa}
        alGuardar={alGuardar}
        cerrar={() => setMudando(false)}
      />
    );
  }

  if (!abierto) return disparador;

  return (
    <>
      {disparador}

      {/* UN MODAL APARTE, no desplegado dentro de la ficha (Josse,
          30 sep 2026). Son trece campos: abiertos en la tarjeta
          dejaban esta columna mucho más alta que la de al lado, que
          es con la que tiene que emparejar. */}
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <button
          type="button"
          onClick={() => !guardando && cerrar()}
          aria-label="Cerrar"
          className="absolute inset-0 bg-black/40"
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={rotulo}
          className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-borde bg-superficie shadow-2xl"
        >
          <header className="border-b border-borde p-6">
            <h2 className="text-lg font-semibold">{rotulo}</h2>
            <p className="mt-1 text-[0.78125rem] leading-relaxed text-texto-suave">
              {crear
                ? "Registre la organización del interesado por su NIT. Se comparte con todas las fichas del mismo NIT, y queda registrado quién la puso."
                : "Lo que se corrija aquí es de la empresa, no de este lead: lo verán todas las personas del mismo NIT. Queda registrado quién lo puso."}
            </p>
          </header>

          {/* Los campos scrollean y los botones se quedan. Con trece,
              un modal que scrollea entero esconde el de guardar. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">

      {/* EL NIT AHORA SE EDITA (28 sep 2026).

          Estuvo en solo lectura porque es la llave de la fila, y
          el motivo escrito era bueno: «alguien lo arregla abriendo
          una fila que comparten todas las fichas». Pero la gente
          se preinscribe con el NIT mal —o con un «0»— y ese es
          justo el dato que va al F7: un NIT malo es un reporte
          malo. Así que se corrige, con dos avisos que siguen
          valiendo: es de TODA la empresa, y el servidor rechaza si
          el NIT ya es de otra. */}
      <div className="mt-3 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
        <label className="block">
          <span className={ROTULO}>
            {porSuCuenta ? "Cédula (hace de RUT)" : "NIT"}
          </span>
          <input
            className={CLASE_CONTROL}
            value={v.nit}
            onChange={(e) => ponerNit(e.target.value)}
            inputMode="numeric"
          />
          {nitRaro ? (
            <span className="mt-1 block text-[0.6875rem] leading-snug text-aviso">
              El NIT de una empresa es de nueve dígitos y este tiene{" "}
              {v.nit.replace(/\D/g, "").length}. Revíselo contra el RUT: es el
              número que va al SENA. Se puede guardar igual.
            </span>
          ) : (
            <span className="mt-1 block text-[0.6875rem] leading-snug text-texto-suave">
              Es el de toda la organización y el que va al SENA. Va sin el
              dígito de verificación: si lo pega pegado, se separa solo.
            </span>
          )}
        </label>

        <label className="block">
          <span className={ROTULO}>
            {porSuCuenta ? "A nombre de" : "Razón social"}
          </span>
          <input
            className={CLASE_CONTROL}
            value={v.razonSocial}
            onChange={(e) => poner("razonSocial", e.target.value)}
          />
        </label>

        <label className="block">
          <span className={ROTULO}>Dígito de verificación</span>
          <input
            className={CLASE_CONTROL}
            value={v.digitoVerificacion}
            inputMode="numeric"
            maxLength={1}
            onChange={(e) =>
              poner("digitoVerificacion", e.target.value.replace(/\D/g, ""))
            }
          />
          <span className="mt-1 block text-[0.6875rem] leading-snug text-texto-suave">
            Sale calculado al escribir el NIT. Si el RUT de la empresa dice
            otro, cámbielo aquí.
          </span>
        </label>

        <label className="block">
          <span className={ROTULO}>Dirección</span>
          <input
            className={CLASE_CONTROL}
            value={v.direccion}
            onChange={(e) => poner("direccion", e.target.value)}
          />
        </label>

        <label className="block">
          <span className={ROTULO}>Teléfono</span>
          <input
            className={CLASE_CONTROL}
            value={v.telefono}
            onChange={(e) => poner("telefono", e.target.value)}
          />
        </label>

        <label className="block">
          <span className={ROTULO}>Departamento</span>
          <select
            className={CLASE_CONTROL}
            value={v.departamentoSepId}
            onChange={(e) => poner("departamentoSepId", e.target.value)}
          >
            <option value="">—</option>
            {(catalogos?.departamentos ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={ROTULO}>Municipio</span>
          <select
            className={CLASE_CONTROL}
            value={v.municipioSepId}
            disabled={v.departamentoSepId === ""}
            onChange={(e) => poner("municipioSepId", e.target.value)}
          >
            <option value="">
              {v.departamentoSepId === "" ? "Elija departamento" : "—"}
            </option>
            {municipios.map((m) => (
              <option key={m[0]} value={m[0]}>
                {m[2]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={ROTULO}>Sector económico</span>
          {/* Desplegable y no texto libre: al F7 solo le entran
              los tres del Decreto 957, y un «servicios» en
              minúscula le tumba el archivo entero. */}
          <select
            className={CLASE_CONTROL}
            value={v.sectorEconomico}
            onChange={(e) => poner("sectorEconomico", e.target.value)}
          >
            <option value="">—</option>
            {(catalogos?.sectoresEconomicos ?? []).map((s) => (
              <option key={s.id} value={s.etiqueta}>
                {s.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={ROTULO}>Número de trabajadores</span>
          <input
            className={CLASE_CONTROL}
            value={v.numeroTrabajadores}
            inputMode="numeric"
            onChange={(e) =>
              poner("numeroTrabajadores", e.target.value.replace(/\D/g, ""))
            }
          />
        </label>

        {!porSuCuenta && (
          <>
            <label className="block">
              <span className={ROTULO}>Persona de contacto</span>
              <input
                className={CLASE_CONTROL}
                value={v.contactoNombre}
                onChange={(e) => poner("contactoNombre", e.target.value)}
              />
            </label>

            <label className="block">
              <span className={ROTULO}>Su cargo</span>
              <input
                className={CLASE_CONTROL}
                value={v.contactoCargo}
                onChange={(e) => poner("contactoCargo", e.target.value)}
              />
            </label>

            <label className="block">
              <span className={ROTULO}>Su correo</span>
              <input
                className={CLASE_CONTROL}
                type="email"
                value={v.contactoCorreo}
                onChange={(e) => poner("contactoCorreo", e.target.value)}
              />
            </label>
          </>
        )}
      </div>

          </div>

          <footer className="flex flex-wrap items-center gap-3 border-t border-borde p-6">
            <Boton
              disabled={!hayCambios || guardando || faltaNit}
              onClick={() => {
                const datos = loQueCambio();
                if (Object.keys(datos).length === 0) return;
                setGuardando(true);

                /// El modal se cierra SOLO si de verdad se guardó.
                ///
                /// `alGuardar` se traga el error --avisa por su
                /// toast y sigue--, así que cerrar en el `then` lo
                /// cerraría también al fallar, y con él lo que el
                /// asesor acababa de teclear. Un falso éxito es peor
                /// que un error.
                let guardado = false;
                void alGuardar(
                  async () => {
                    await crmApi.guardarDatosEmpresa(participanteId, datos);
                    guardado = true;
                  },
                  crear
                    ? "Organización registrada."
                    : "Datos de la empresa guardados.",
                )
                  .then(() => {
                    if (guardado) setAbierto(false);
                  })
                  .finally(() => setGuardando(false));
              }}
            >
              {guardando
                ? crear
                  ? "Registrando…"
                  : "Guardando…"
                : crear
                  ? "Registrar organización"
                  : "Guardar"}
            </Boton>

            <button
              type="button"
              onClick={cerrar}
              disabled={guardando}
              className="rounded-lg border border-borde bg-superficie px-4 py-2 text-sm font-semibold text-titulo hover:bg-superficie-alterna"
            >
              Cancelar
            </button>

            {faltaNit ? (
              <span className="text-[0.78125rem] text-aviso">
                Escriba el NIT para registrar la organización.
              </span>
            ) : (
              !hayCambios && (
                <span className="text-[0.78125rem] text-texto-suave">
                  Todavía no ha cambiado nada.
                </span>
              )
            )}
          </footer>
        </div>
      </div>
    </>
  );
}
