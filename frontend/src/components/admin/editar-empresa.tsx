"use client";

/**
 * CORREGIR UNA ORGANIZACIÓN YA REGISTRADA, EL NIT INCLUIDO.
 *
 * «Tener la opción de modificar los datos a nivel general: NIT, razón
 * social y demás datos. Al momento de ajustar o corregir un número de
 * NIT no me lo permite, afectándome un montón los datos de Gestión de
 * leads, ya que esto va asociado» (cliente, 28 sep 2026).
 *
 * «Empresas registradas» era de solo lectura. Un NIT mal digitado se
 * quedaba mal para siempre, y con él las reservas y los leads que
 * cuelgan de esa organización.
 *
 * POR QUÉ CORREGIR EL NIT NO ROMPE LOS LEADS ---que era el miedo---:
 * nadie apunta a una organización por su NIT. Las reservas y los
 * participantes la referencian por su id interno, así que al
 * corregirla LA ACOMPAÑAN. Es exactamente lo contrario de lo que
 * parecía: no corregirlo era lo que dejaba los datos mal.
 */

import { useState } from "react";

import { Cajon } from "./cajon";
import { Desplegable } from "./desplegable";
import { Aviso, Boton, Campo, CLASE_CONTROL } from "./marco-admin";
import { ErrorApi } from "@/lib/api";
import { tablerosApi, type FilaEmpresa } from "@/lib/tableros-api";

/// Los campos de texto que se pueden corregir desde aquí.
type Clave =
  | "razonSocial"
  | "direccion"
  | "telefono"
  | "contactoNombre"
  | "contactoCargo"
  | "contactoCorreo"
  | "sectorEconomico"
  | "clasificacion";

/**
 * Los campos que se pueden corregir, en el orden en que se leen.
 *
 * NO ESTÁN TODOS los de la ficha a propósito: los códigos DANE de
 * departamento y municipio se eligen de un catálogo, no se escriben,
 * y un cuadro de texto donde va un código es la forma más rápida de
 * meter un municipio que no existe. Eso pide su propio selector y es
 * otra entrega.
 */
const CAMPOS: ReadonlyArray<{
  clave: Clave;
  rotulo: string;
  /// A dos columnas: la razón social y la dirección son largas y en
  /// media fila se leen cortadas.
  anchoEntero?: boolean;
}> = [
  { clave: "razonSocial", rotulo: "Razón social", anchoEntero: true },
  { clave: "direccion", rotulo: "Dirección", anchoEntero: true },
  { clave: "telefono", rotulo: "Teléfono" },
  { clave: "contactoNombre", rotulo: "Persona de contacto" },
  { clave: "contactoCargo", rotulo: "Cargo del contacto" },
  { clave: "contactoCorreo", rotulo: "Correo del contacto" },
  { clave: "sectorEconomico", rotulo: "Sector económico" },
  { clave: "clasificacion", rotulo: "Clasificación" },
];

/// NIT o RUT, por su id del catálogo SEP. Son los dos que usan las
/// organizaciones de los gremios; uno distinto que ya traiga la ficha
/// se respeta tal cual (ver `opcionesDeTipo`).
const TIPOS = [
  { valor: "6", etiqueta: "NIT" },
  { valor: "21", etiqueta: "RUT" },
];

/// Los tres papeles que admite el F7, tal cual su cabecera. El
/// servidor rechaza cualquier otro.
const PAPELES = [
  "Conviniente",
  "Beneficiaria",
  "Perteneciente a la Cadena Productiva",
];

export function EditarEmpresa({
  empresa,
  alCerrar,
  alGuardar,
}: {
  empresa: FilaEmpresa;
  alCerrar: () => void;
  /// Se llama con la organización ya guardada, para que la lista se
  /// refresque sin recargar la página entera.
  alGuardar: () => void;
}) {
  const [nit, setNit] = useState(empresa.nit);
  const [dv, setDv] = useState(empresa.digitoVerificacion ?? "");
  const [trabajadores, setTrabajadores] = useState(
    empresa.numeroTrabajadores === null ? "" : String(empresa.numeroTrabajadores),
  );
  const [campos, setCampos] = useState<Record<Clave, string>>(() =>
    Object.fromEntries(
      CAMPOS.map((c) => [c.clave, (empresa[c.clave] as string | null) ?? ""]),
    ) as Record<Clave, string>,
  );
  const tipoDeHoy =
    empresa.tipoDocumentoSepId === null ? "" : String(empresa.tipoDocumentoSepId);
  const papelDeHoy = empresa.papelEnConvenio ?? "";
  const [tipo, setTipo] = useState(tipoDeHoy);
  const [papel, setPapel] = useState(papelDeHoy);
  /// Si la ficha trae un tipo o un papel que no está en la lista, se
  /// enseña como opción para no pintar el desplegable en blanco
  /// encima de un dato que sí existe.
  const opcionesDeTipo = [
    { valor: "", etiqueta: "Sin clasificar" },
    ...TIPOS,
    ...(tipoDeHoy && !TIPOS.some((t) => t.valor === tipoDeHoy)
      ? [{ valor: tipoDeHoy, etiqueta: "El que tiene hoy" }]
      : []),
  ];
  const opcionesDePapel = [
    { valor: "", etiqueta: "Sin definir" },
    ...PAPELES.map((p) => ({ valor: p, etiqueta: p })),
    ...(papelDeHoy && !PAPELES.includes(papelDeHoy)
      ? [{ valor: papelDeHoy, etiqueta: `${papelDeHoy} (como está hoy)` }]
      : []),
  ];
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const cambioElNit = nit.replace(/\D/g, "") !== empresa.nit;

  async function guardar() {
    setGuardando(true);
    setFalla(null);
    try {
      await tablerosApi.editarEmpresa(empresa.id, {
        nit,
        digitoVerificacion: dv,
        numeroTrabajadores: trabajadores,
        ...campos,
        /// Solo si se tocaron: un papel antiguo escrito a mano no es
        /// de los tres y el servidor lo rechazaría aunque nadie lo
        /// haya cambiado ahora.
        ...(tipo !== tipoDeHoy ? { tipoDocumentoSepId: tipo } : {}),
        ...(papel !== papelDeHoy ? { papelEnConvenio: papel } : {}),
      });
      alGuardar();
      alCerrar();
    } catch (e) {
      /// El fallo se pinta DENTRO del cajón. Mandarlo arriba del todo
      /// deja el botón pareciendo que no hace nada, y el error que más
      /// va a salir aquí ---«ese NIT ya es de otra»--- es justo el que
      /// hay que leer con el formulario delante.
      setFalla((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Cajon
      titulo="Corregir la organización"
      subtitulo={empresa.razonSocial}
      alCerrar={alCerrar}
      pie={
        <div className="flex flex-wrap items-center gap-3">
          <Boton type="button" onClick={() => void guardar()} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
          <button
            type="button"
            onClick={alCerrar}
            className="text-[0.8125rem] text-texto-suave underline underline-offset-2 hover:text-texto"
          >
            Cancelar
          </button>
        </div>
      }
    >
      {falla && <Aviso tipo="error">{falla}</Aviso>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="NIT">
          <input
            value={nit}
            onChange={(e) => setNit(e.target.value)}
            inputMode="numeric"
            className={CLASE_CONTROL}
          />
        </Campo>
        <Campo etiqueta="Dígito de verificación">
          <input
            value={dv}
            onChange={(e) => setDv(e.target.value.replace(/\D/g, "").slice(0, 1))}
            inputMode="numeric"
            className={CLASE_CONTROL}
          />
        </Campo>
        <Campo etiqueta="NIT o RUT">
          <Desplegable
            enPortal
            etiquetaAria="NIT o RUT"
            marcador="Sin clasificar"
            valor={tipo}
            alElegir={setTipo}
            opciones={opcionesDeTipo}
          />
        </Campo>
        <Campo etiqueta="Papel en el convenio">
          <Desplegable
            enPortal
            etiquetaAria="Papel en el convenio"
            marcador="Sin definir"
            valor={papel}
            alElegir={setPapel}
            opciones={opcionesDePapel}
          />
        </Campo>

        {CAMPOS.map((c) => (
          <div key={c.clave} className={c.anchoEntero ? "sm:col-span-2" : ""}>
            <Campo etiqueta={c.rotulo}>
              <input
                value={campos[c.clave]}
                onChange={(e) =>
                  setCampos((v) => ({ ...v, [c.clave]: e.target.value }))
                }
                className={CLASE_CONTROL}
              />
            </Campo>
          </div>
        ))}

        <Campo etiqueta="Trabajadores">
          <input
            value={trabajadores}
            onChange={(e) => setTrabajadores(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className={CLASE_CONTROL}
          />
        </Campo>
      </div>

      {/* QUÉ PASA CON LOS LEADS AL CAMBIAR EL NIT, dicho antes de
          guardar y no después. Era el miedo del cliente, y la
          respuesta es tranquilizadora: hay que decirla donde se toma
          la decisión. */}
      {cambioElNit && (
        <p className="mt-3 rounded-lg border border-borde bg-superficie-alterna px-3 py-2 text-[0.8125rem] text-texto">
          Va a cambiar el NIT de{" "}
          <strong className="font-semibold">{empresa.nit}</strong> a{" "}
          <strong className="font-semibold">{nit.replace(/\D/g, "")}</strong>. Sus{" "}
          {empresa.reservas === 1 ? "reserva" : "reservas"} y los leads que trabajan
          aquí siguen siendo de esta misma organización: van con ella, no se
          desconectan. Queda registrado quién lo corrigió y de qué a qué.
        </p>
      )}

      <p className="mt-3 text-[0.78125rem] text-texto-suave">
        El departamento y el municipio no se corrigen aquí: son códigos de
        catálogo y necesitan su propio selector.
      </p>
    </Cajon>
  );
}
