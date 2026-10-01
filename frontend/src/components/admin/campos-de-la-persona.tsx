"use client";

/** Los campos de una persona, una sola vez. */

/// Estaban escritos dentro de `datos-sena.tsx`, atados a una
/// ficha que ya existe: la pantalla de crear no podia usarlos
/// y por eso pedia diez campos de los diecisiete. Escribirlos
/// otra vez alli habria dejado dos formularios para los mismos
/// datos --y el dia que se anada uno, uno de los dos se queda
/// sin el, que es el patron que este proyecto lleva cuatro
/// rondas documentando.
///
/// Este componente NO guarda: recibe los valores y los
/// devuelve. Quien guarda es quien sabe a donde --la ficha con
/// `actualizar`, la pantalla nueva con `crear`--.

import { useMemo } from "react";

import { Desplegable } from "@/components/admin/desplegable";
import { Campo, CLASE_CONTROL } from "@/components/admin/marco-admin";
import type { CatalogosSep } from "@/lib/crm-api";

/**
 * Un campo igual que `Campo`, pero en `<div>` y no en `<label>`.
 *
 * Una etiqueta se ata al primer control ATABLE que lleva dentro,
 * y el disparador del `Desplegable` es un `<button>`, que no lo
 * es: el `<label>` se quedaria apuntando al vacio --un nombre
 * que no nombra a nada-- y encima el clic en el rotulo no haria
 * nada, que es peor que no tener rotulo. Asi que los
 * desplegables van en un `div` y el nombre se da por
 * `etiquetaAria`.
 *
 * Se escribe aqui y no en `marco-admin` porque `Campo` lo usan
 * veinte pantallas con `input` dentro, donde el `<label>` SI
 * sirve y no hay por que quitarselo.
 */
function CampoLista({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1.5 block text-xs text-texto-suave">{ayuda}</span>}
    </div>
  );
}

/** Lo que el cargue al SEP necesita de cada persona. */
export type DatosDeLaPersona = {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  generoSepId: number | null;
  estrato: number | null;
  departamentoSepId: number | null;
  municipioSepId: number | null;
  barrio: string;
  direccion: string;
  nivelOcupacionalSepId: number | null;
  cargoEnEmpresa: string;
  beneficiarioPrevio: boolean | null;
  fechaNacimiento: string;
  correo: string;
  celular: string;
};

/** Todos en blanco, para empezar una ficha. */
export function personaEnBlanco(): DatosDeLaPersona {
  return {
    primerNombre: "",
    segundoNombre: "",
    primerApellido: "",
    segundoApellido: "",
    generoSepId: null,
    estrato: null,
    departamentoSepId: null,
    municipioSepId: null,
    barrio: "",
    direccion: "",
    nivelOcupacionalSepId: null,
    cargoEnEmpresa: "",
    beneficiarioPrevio: null,
    fechaNacimiento: "",
    correo: "",
    celular: "",
  };
}

/**
 * Lo que se le manda al servidor, ya limpio.
 *
 * Vive aqui y no en cada pantalla porque las dos reglas
 * --recortar los espacios y mandar `undefined` en vez de
 * cadena vacia-- son las que deciden si un campo se guarda
 * vacio o no se toca. Escritas dos veces acaban discrepando.
 */
export function aCuerpo(c: DatosDeLaPersona) {
  const texto = (v: string) => v.trim() || undefined;
  return {
    primerNombre: texto(c.primerNombre),
    segundoNombre: texto(c.segundoNombre),
    primerApellido: texto(c.primerApellido),
    segundoApellido: texto(c.segundoApellido),
    generoSepId: c.generoSepId,
    estrato: c.estrato,
    departamentoSepId: c.departamentoSepId,
    municipioSepId: c.municipioSepId,
    barrio: texto(c.barrio),
    direccion: texto(c.direccion),
    nivelOcupacionalSepId: c.nivelOcupacionalSepId,
    cargoEnEmpresa: texto(c.cargoEnEmpresa),
    beneficiarioPrevio: c.beneficiarioPrevio ?? undefined,
    fechaNacimiento: c.fechaNacimiento || undefined,
    correo: texto(c.correo),
    celular: texto(c.celular),
  };
}

export function CamposDeLaPersona({
  c,
  setC,
  catalogos,
  identidad,
}: {
  c: DatosDeLaPersona;
  setC: (f: (v: DatosDeLaPersona) => DatosDeLaPersona) => void;
  catalogos: CatalogosSep | null;
  /// Lo que va en las dos primeras casillas: en la ficha, el
  /// documento en solo lectura --es la llave de la persona en
  /// todo el sistema--; al crear, los campos de verdad.
  identidad: React.ReactNode;
}) {
  // los municipios del departamento elegido, y nada mas
  const municipios = useMemo(() => {
    if (!catalogos || c.departamentoSepId === null) return [];
    return catalogos.municipios
      .filter((m) => m[1] === c.departamentoSepId)
      .sort((a, b) => a[2].localeCompare(b[2], "es"));
  }, [catalogos, c.departamentoSepId]);

  const poner = <K extends keyof DatosDeLaPersona>(
    clave: K,
    valor: DatosDeLaPersona[K],
  ) => setC((v) => ({ ...v, [clave]: valor }));

  const numero = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {identidad}

        <Campo etiqueta="Primer nombre">
          <input
            className={CLASE_CONTROL}
            value={c.primerNombre}
            onChange={(e) => poner("primerNombre", e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Segundo nombre">
          <input
            className={CLASE_CONTROL}
            value={c.segundoNombre}
            onChange={(e) => poner("segundoNombre", e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Primer apellido">
          <input
            className={CLASE_CONTROL}
            value={c.primerApellido}
            onChange={(e) => poner("primerApellido", e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Segundo apellido">
          <input
            className={CLASE_CONTROL}
            value={c.segundoApellido}
            onChange={(e) => poner("segundoApellido", e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Fecha de nacimiento">
          <input
            type="date"
            className={CLASE_CONTROL}
            value={c.fechaNacimiento}
            onChange={(e) => poner("fechaNacimiento", e.target.value)}
          />
        </Campo>

        {/* LOS DESPLEGABLES, CON EL DE LA CASA Y NO CON `<select>`.
            «No debe haber desplegables cuadrados, todos deben ser
            redondeados» (cliente, 1 oct 2026). La lista de un
            `<select>` la dibuja Windows: cuadrada, con su azul de
            sistema, y no hay CSS que llegue ahi.

            `enPortal` en todos: estos campos viven en la pestana
            «Datos» de la ficha, y esa pantalla entera va dentro de
            una `<section className="overflow-hidden">`. Lo que
            sobresale de un contenedor con `overflow` se recorta, asi
            que una lista de treinta y tres departamentos quedaria
            cortada por el canto de la banda. */}
        <CampoLista etiqueta="Género">
          <Desplegable
            enPortal
            etiquetaAria="Género"
            marcador="Sin indicar"
            valor={c.generoSepId === null ? "" : String(c.generoSepId)}
            alElegir={(v) => poner("generoSepId", numero(v))}
            opciones={[
              /// «Sin indicar» SI va en la lista: no es un marcador
              /// falso, es un valor de verdad --`null`-- y sin el no
              /// habria forma de deshacer un genero puesto por error.
              { valor: "", etiqueta: "Sin indicar" },
              ...(catalogos?.generos ?? []).map((g) => ({
                valor: String(g.id),
                etiqueta: g.etiqueta,
              })),
            ]}
          />
        </CampoLista>

        <CampoLista etiqueta="Estrato socioeconómico">
          <Desplegable
            enPortal
            etiquetaAria="Estrato socioeconómico"
            marcador="Sin indicar"
            valor={c.estrato === null ? "" : String(c.estrato)}
            alElegir={(v) => poner("estrato", numero(v))}
            opciones={[
              { valor: "", etiqueta: "Sin indicar" },
              ...[1, 2, 3, 4, 5, 6].map((n) => ({
                valor: String(n),
                etiqueta: String(n),
              })),
            ]}
          />
        </CampoLista>

        <CampoLista etiqueta="Nivel ocupacional">
          <Desplegable
            enPortal
            etiquetaAria="Nivel ocupacional"
            marcador="Sin indicar"
            valor={
              c.nivelOcupacionalSepId === null
                ? ""
                : String(c.nivelOcupacionalSepId)
            }
            alElegir={(v) => poner("nivelOcupacionalSepId", numero(v))}
            opciones={[
              { valor: "", etiqueta: "Sin indicar" },
              ...(catalogos?.nivelesOcupacionales ?? []).map((n) => ({
                valor: String(n.id),
                etiqueta: n.etiqueta,
              })),
            ]}
          />
        </CampoLista>

        <Campo etiqueta="Correo">
          <input
            className={CLASE_CONTROL}
            value={c.correo}
            onChange={(e) => poner("correo", e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Celular">
          <input
            className={CLASE_CONTROL}
            value={c.celular}
            onChange={(e) => poner("celular", e.target.value)}
          />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoLista
          etiqueta="Departamento de domicilio"
          ayuda="Dónde vive, no dónde es el curso."
        >
          <Desplegable
            enPortal
            etiquetaAria="Departamento de domicilio"
            marcador="Sin indicar"
            valor={
              c.departamentoSepId === null ? "" : String(c.departamentoSepId)
            }
            alElegir={(v) => {
              const dep = numero(v);
              // el municipio cuelga del departamento
              setC((x) => ({
                ...x,
                departamentoSepId: dep,
                municipioSepId: null,
              }));
            }}
            opciones={[
              { valor: "", etiqueta: "Sin indicar" },
              ...(catalogos?.departamentos ?? []).map((d) => ({
                valor: String(d.id),
                etiqueta: d.etiqueta,
              })),
            ]}
          />
        </CampoLista>

        <CampoLista etiqueta="Municipio de domicilio">
          <Desplegable
            enPortal
            etiquetaAria="Municipio de domicilio"
            desactivado={c.departamentoSepId === null}
            /// Sin departamento el marcador DICE que falta elegirlo
            /// antes: un desplegable apagado y vacio, sin explicacion,
            /// parece roto.
            marcador={
              c.departamentoSepId === null
                ? "Elija el departamento"
                : "Sin indicar"
            }
            valor={c.municipioSepId === null ? "" : String(c.municipioSepId)}
            alElegir={(v) => poner("municipioSepId", numero(v))}
            opciones={[
              { valor: "", etiqueta: "Sin indicar" },
              ...municipios.map((m) => ({
                valor: String(m[0]),
                etiqueta: m[2],
              })),
            ]}
          />
        </CampoLista>

        <Campo etiqueta="Barrio o vereda">
          <input
            className={CLASE_CONTROL}
            value={c.barrio}
            onChange={(e) => poner("barrio", e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Dirección">
          <input
            className={CLASE_CONTROL}
            value={c.direccion}
            onChange={(e) => poner("direccion", e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Cargo en la empresa">
          <input
            className={CLASE_CONTROL}
            value={c.cargoEnEmpresa}
            onChange={(e) => poner("cargoEnEmpresa", e.target.value)}
          />
        </Campo>

        <CampoLista etiqueta="¿Se ha beneficiado antes?">
          <Desplegable
            enPortal
            etiquetaAria="¿Se ha beneficiado antes?"
            marcador="Sin indicar"
            valor={
              c.beneficiarioPrevio === null
                ? ""
                : c.beneficiarioPrevio
                  ? "si"
                  : "no"
            }
            alElegir={(v) =>
              poner("beneficiarioPrevio", v === "" ? null : v === "si")
            }
            opciones={[
              { valor: "", etiqueta: "Sin indicar" },
              { valor: "no", etiqueta: "No" },
              { valor: "si", etiqueta: "Sí" },
            ]}
          />
        </CampoLista>
      </div>
    </div>
  );
}
