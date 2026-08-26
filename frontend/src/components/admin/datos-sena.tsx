"use client";

import { useEffect, useMemo, useState } from "react";

import { Boton, Campo, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { crmApi, type CatalogosSep, type Ficha } from "@/lib/crm-api";

/** Lo que el cargue al SEP necesita de cada persona. */
type Campos = {
  /// La identidad. Sale del formulario corto y aqui no se
  /// veia: el asesor tenia que subir a la cabecera de la
  /// ficha para leer un apellido, y no habia forma de
  /// corregirlo desde donde se corrige todo lo demas.
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

const soloFecha = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function desdeFicha(f: Ficha): Campos {
  return {
    primerNombre: f.persona.primerNombre,
    segundoNombre: f.persona.segundoNombre ?? "",
    primerApellido: f.persona.primerApellido,
    segundoApellido: f.persona.segundoApellido ?? "",
    generoSepId: f.persona.generoSepId,
    estrato: f.persona.estrato,
    departamentoSepId: f.persona.departamentoSepId,
    municipioSepId: f.persona.municipioSepId,
    barrio: f.persona.barrio ?? "",
    direccion: f.persona.direccion ?? "",
    nivelOcupacionalSepId: f.nivelOcupacionalSepId,
    cargoEnEmpresa: f.cargoEnEmpresa ?? "",
    beneficiarioPrevio: f.beneficiarioPrevio,
    fechaNacimiento: soloFecha(f.persona.fechaNacimiento),
    correo: f.persona.correo ?? "",
    celular: f.persona.celular ?? "",
  };
}

export function DatosSena({
  ficha,
  alGuardar,
}: {
  ficha: Ficha;
  alGuardar: (accion: () => Promise<void>) => Promise<void>;
}) {
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);
  const [c, setC] = useState<Campos>(() => desdeFicha(ficha));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void crmApi.catalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, []);

  useEffect(() => {
    setC(desdeFicha(ficha));
  }, [ficha]);

  // los municipios del departamento elegido, y nada mas
  const municipios = useMemo(() => {
    if (!catalogos || c.departamentoSepId === null) return [];
    return catalogos.municipios
      .filter((m) => m[1] === c.departamentoSepId)
      .sort((a, b) => a[2].localeCompare(b[2], "es"));
  }, [catalogos, c.departamentoSepId]);

  /// Lo que hay contra lo que había. Se compara el objeto
  /// entero: enumerar campo por campo garantiza que el día
  /// que se agregue uno, alguien olvide añadirlo aquí.
  const hayCambios =
    JSON.stringify(c) !== JSON.stringify(desdeFicha(ficha));

  function poner<K extends keyof Campos>(clave: K, valor: Campos[K]) {
    setC((v) => ({ ...v, [clave]: valor }));
  }

  const numero = (v: string) => (v === "" ? null : Number(v));

  async function guardar() {
    setGuardando(true);
    try {
      await alGuardar(async () => {
        await crmApi.actualizar(ficha.id, {
          primerNombre: c.primerNombre.trim() || undefined,
          segundoNombre: c.segundoNombre.trim() || undefined,
          primerApellido: c.primerApellido.trim() || undefined,
          segundoApellido: c.segundoApellido.trim() || undefined,
          generoSepId: c.generoSepId,
          estrato: c.estrato,
          departamentoSepId: c.departamentoSepId,
          municipioSepId: c.municipioSepId,
          barrio: c.barrio.trim() || undefined,
          direccion: c.direccion.trim() || undefined,
          nivelOcupacionalSepId: c.nivelOcupacionalSepId,
          cargoEnEmpresa: c.cargoEnEmpresa.trim() || undefined,
          beneficiarioPrevio: c.beneficiarioPrevio ?? undefined,
          fechaNacimiento: c.fechaNacimiento || undefined,
          correo: c.correo.trim() || undefined,
          celular: c.celular.trim() || undefined,
        });
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta
      /// El título dice en qué punto va, y por eso cambia.
      ///
      /// «Datos para el reporte» hablaba del SENA, que es lo
      /// último que le importa a quien está mirando la ficha.
      /// Ahora nombra a la persona, y al pasar a inscrito el
      /// título cambia con ella: la transición se ve.
      titulo={
        ficha.etapa === "INSCRITO" ? "Datos del inscrito" : "Datos del interesado"
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* El documento no se edita: es la llave de la
              persona en todo el sistema y cambiarlo aqui
              partiria su historia en dos. Se ve, no se toca. */}
          <Campo etiqueta="Tipo de documento">
            <input
              readOnly
              className={`${CLASE_CONTROL} opacity-70`}
              value={
                catalogos?.documentosPersona.find(
                  (d) => d.id === ficha.persona.tipoDocumentoSepId,
                )?.etiqueta ?? String(ficha.persona.tipoDocumentoSepId)
              }
            />
          </Campo>

          <Campo etiqueta="Número de documento">
            <input
              readOnly
              className={`${CLASE_CONTROL} font-mono opacity-70`}
              value={ficha.persona.numeroDocumento}
            />
          </Campo>

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
              onChange={(e) => poner("nivelOcupacionalSepId", numero(e.target.value))}
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
          <Campo etiqueta="Departamento de domicilio" ayuda="Dónde vive, no dónde es el curso.">
            <select
              className={CLASE_CONTROL}
              value={c.departamentoSepId ?? ""}
              onChange={(e) => {
                const dep = numero(e.target.value);
                // el municipio cuelga del departamento
                setC((v) => ({ ...v, departamentoSepId: dep, municipioSepId: null }));
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
                {c.departamentoSepId === null ? "Elija el departamento" : "Sin indicar"}
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
              value={c.beneficiarioPrevio === null ? "" : c.beneficiarioPrevio ? "si" : "no"}
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

        <div className="flex items-center gap-3">
          {/* Gris hasta que haya algo que guardar.
              
              Un botón siempre activo no dice si uno tocó algo
              o no, y en una tarjeta de veinte campos esa duda
              es constante. Igual que «Guardar asignación». */}
          <Boton onClick={guardar} disabled={guardando || !hayCambios}>
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
          <span className="text-xs text-texto-suave">
            La caracterización de población se pedirá aparte: es dato sensible.
          </span>
        </div>
      </div>
    </Tarjeta>
  );
}
