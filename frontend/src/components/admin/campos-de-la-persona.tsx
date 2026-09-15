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

import { Campo, CLASE_CONTROL } from "@/components/admin/marco-admin";
import type { CatalogosSep } from "@/lib/crm-api";

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

        <Campo etiqueta="Género">
          <select
            className={CLASE_CONTROL}
            value={c.generoSepId ?? ""}
            onChange={(e) => poner("generoSepId", numero(e.target.value))}
          >
            <option value="">Sin indicar</option>
            {(catalogos?.generos ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Estrato socioeconómico">
          <select
            className={CLASE_CONTROL}
            value={c.estrato ?? ""}
            onChange={(e) => poner("estrato", numero(e.target.value))}
          >
            <option value="">Sin indicar</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Nivel ocupacional">
          <select
            className={CLASE_CONTROL}
            value={c.nivelOcupacionalSepId ?? ""}
            onChange={(e) =>
              poner("nivelOcupacionalSepId", numero(e.target.value))
            }
          >
            <option value="">Sin indicar</option>
            {(catalogos?.nivelesOcupacionales ?? []).map((n) => (
              <option key={n.id} value={n.id}>
                {n.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

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
        <Campo
          etiqueta="Departamento de domicilio"
          ayuda="Dónde vive, no dónde es el curso."
        >
          <select
            className={CLASE_CONTROL}
            value={c.departamentoSepId ?? ""}
            onChange={(e) => {
              const dep = numero(e.target.value);
              // el municipio cuelga del departamento
              setC((v) => ({
                ...v,
                departamentoSepId: dep,
                municipioSepId: null,
              }));
            }}
          >
            <option value="">Sin indicar</option>
            {(catalogos?.departamentos ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Municipio de domicilio">
          <select
            className={CLASE_CONTROL}
            value={c.municipioSepId ?? ""}
            disabled={c.departamentoSepId === null}
            onChange={(e) => poner("municipioSepId", numero(e.target.value))}
          >
            <option value="">
              {c.departamentoSepId === null
                ? "Elija el departamento"
                : "Sin indicar"}
            </option>
            {municipios.map((m) => (
              <option key={m[0]} value={m[0]}>
                {m[2]}
              </option>
            ))}
          </select>
        </Campo>

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

        <Campo etiqueta="¿Se ha beneficiado antes?">
          <select
            className={CLASE_CONTROL}
            value={
              c.beneficiarioPrevio === null
                ? ""
                : c.beneficiarioPrevio
                  ? "si"
                  : "no"
            }
            onChange={(e) =>
              poner(
                "beneficiarioPrevio",
                e.target.value === "" ? null : e.target.value === "si",
              )
            }
          >
            <option value="">Sin indicar</option>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </Campo>
      </div>
    </div>
  );
}
