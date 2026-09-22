"use client";

import { useEffect, useMemo, useState } from "react";

import { Boton, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { crmApi, type CatalogosSep, type Ficha } from "@/lib/crm-api";

type Empresa = NonNullable<Ficha["empresa"]>;

/// Todo como TEXTO, incluidos los números.
///
/// Un `number | null` dentro de un input obliga a decidir qué
/// es «vacío» en cada tecla, y con `enableImplicitConversion`
/// del backend una cadena vacía en un campo numérico llega
/// como cero. Aquí se guarda lo tecleado tal cual y la
/// conversión se hace UNA vez, al mandar.
function desde(e: Empresa) {
  return {
    razonSocial: e.razonSocial ?? "",
    digitoVerificacion: e.digitoVerificacion ?? "",
    direccion: e.direccion ?? "",
    telefono: e.telefono ?? "",
    departamentoSepId:
      e.departamentoSepId === null ? "" : String(e.departamentoSepId),
    municipioSepId: e.municipioSepId === null ? "" : String(e.municipioSepId),
    sectorEconomico: e.sectorEconomico ?? "",
    numeroTrabajadores:
      e.numeroTrabajadores === null ? "" : String(e.numeroTrabajadores),
    contactoNombre: e.contactoNombre ?? "",
    contactoCargo: e.contactoCargo ?? "",
    contactoCorreo: e.contactoCorreo ?? "",
  };
}

type Campos = ReturnType<typeof desde>;

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
  empresa: Empresa;
  /// Independiente con RUT: no tiene jefe directo a quien
  /// preguntarle, así que los tres del contacto no se piden.
  porSuCuenta: boolean;
  puedeEscribir: boolean;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [v, setV] = useState<Campos>(() => desde(empresa));

  const original = useMemo(() => desde(empresa), [empresa]);

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

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-4 h-[34px] rounded-lg border border-borde bg-superficie px-3.5 text-[0.78125rem] font-semibold text-titulo hover:bg-superficie-alterna"
      >
        Corregir los datos de la empresa
      </button>
    );
  }

  const ROTULO = "mb-1 block text-[0.71875rem] text-texto-suave";

  return (
    <div className="mt-4 rounded-xl border border-borde p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[0.78125rem] leading-relaxed text-texto-suave">
          Lo que se corrija aquí es de la empresa, no de este lead: lo verán
          todas las personas del mismo NIT. Queda registrado quién lo puso.
        </p>
        <button
          type="button"
          onClick={() => {
            setV(original);
            setAbierto(false);
          }}
          className="shrink-0 rounded-lg border border-error/40 bg-error-suave px-4 py-2 text-sm font-semibold text-error"
        >
          Cancelar
        </button>
      </div>

      {/* El NIT, en lectura y con su motivo al lado. Sin el
          motivo se lee como un olvido, y alguien lo «arregla»
          abriendo la llave de una fila que comparten todas las
          fichas de esa empresa. */}
      <p className="mt-3 text-[0.78125rem] text-texto-suave">
        NIT <span className="font-medium text-texto">{empresa.nit}</span> — no se
        cambia desde aquí: es el que identifica a la empresa ante el SENA.
      </p>

      <div className="mt-3 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
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

      <div className="mt-4 flex items-center gap-3">
        <Boton
          disabled={!hayCambios || guardando}
          onClick={() => {
            const datos = loQueCambio();
            if (Object.keys(datos).length === 0) return;
            setGuardando(true);
            void alGuardar(async () => {
              await crmApi.guardarDatosEmpresa(participanteId, datos);
            }, "Datos de la empresa guardados.").finally(() =>
              setGuardando(false),
            );
          }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>

        {!hayCambios && (
          <span className="text-[0.78125rem] text-texto-suave">
            Todavía no ha cambiado nada.
          </span>
        )}
      </div>
    </div>
  );
}
