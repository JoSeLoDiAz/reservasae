"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Boton,
  Campo,
  CLASE_CONTROL,
  EncabezadoSeccion,
  RotuloDeGrupo,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { IconoPerfil } from "@/components/admin/iconos";
import { Caracterizacion } from "@/components/admin/caracterizacion";
import { crmApi, type CatalogosSep, type Ficha } from "@/lib/crm-api";

/** Lo que el cargue al SEP necesita de cada persona. */
type Campos = {
  /// La identidad. Sale del formulario corto y aqui no se
  /// veia: el asesor tenia que subir a la cabecera de la
  /// lead para leer un apellido, y no habia forma de
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


/// Un dato en modo lectura: rotulo pequenio arriba, valor
/// debajo. Es como se ve el 90 % del tiempo.
function Leido({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-texto-suave">{etiqueta}</p>
      <p className="mt-1 truncate text-sm font-medium">
        {valor === "" || valor === null || valor === undefined ? (
          <span className="text-texto-suave">—</span>
        ) : (
          valor
        )}
      </p>
    </div>
  );
}

/// Un grupo de campos: su rotulo verde y la rejilla de dos.
function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-borde py-4 last:border-b-0">
      <RotuloDeGrupo>{titulo}</RotuloDeGrupo>
      <div className="mt-3 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

export function DatosSena({
  lead,
  alGuardar,
}: {
  lead: Ficha;
  alGuardar: (accion: () => Promise<void>) => Promise<void>;
}) {
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);
  const [c, setC] = useState<Campos>(() => desdeFicha(lead));
  const [guardando, setGuardando] = useState(false);
  /// Lectura por defecto, edicion a peticion.
  ///
  /// Los veinte campos salian SIEMPRE como cajas de input, y
  /// eso convierte un lead que se consulta cien veces al dia
  /// en un formulario que parece a medio llenar. En lectura se
  /// leen como datos; el boton los abre cuando hay algo que
  /// corregir.
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    void crmApi.catalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, []);

  useEffect(() => {
    setC(desdeFicha(lead));
  }, [lead]);

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
    JSON.stringify(c) !== JSON.stringify(desdeFicha(lead));

  function poner<K extends keyof Campos>(clave: K, valor: Campos[K]) {
    setC((v) => ({ ...v, [clave]: valor }));
  }

  const numero = (v: string) => (v === "" ? null : Number(v));

  async function guardar() {
    setGuardando(true);
    try {
      await alGuardar(async () => {
        await crmApi.actualizar(lead.id, {
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
    <>
    <Tarjeta
      /// El título dice en qué punto va, y por eso cambia.
      ///
      /// «Datos para el reporte» hablaba del SENA, que es lo
      /// último que le importa a quien está mirando el lead.
      /// Ahora nombra a la persona, y al pasar a inscrito el
      /// título cambia con ella: la transición se ve.
      titulo={
        lead.etapa === "INSCRITO" ? "Datos del inscrito" : "Datos del interesado"
      }
      /// FIJA, no plegable.
      ///
      /// Fue plegable mientras compartía columna con el
      /// historial y las notas: sus veinte campos los empujaban
      /// fuera de pantalla. Ahora vive en su propia columna y
      /// nada de lo de abajo depende de su alto, así que
      /// plegarla solo servía para esconder lo que se viene a
      /// mirar.
    >
      {/* Sin icono y SIN repetir el titulo.
          La tarjeta ya lo pone arriba, y aqui salia otra vez
          tres centimetros mas abajo con un circulo al lado:
          uno lee dos veces lo mismo y busca la diferencia.
          Por eso no se usa `EncabezadoSeccion`: ese existe para
          llevar icono y titulo, y aqui sobran los dos. */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-[0.78125rem] leading-relaxed text-texto-suave">
          Información básica de identificación del beneficiario.
        </p>
        {
          <button
            type="button"
            onClick={() => {
              /// Al cancelar se descarta lo tecleado y se vuelve
              /// a lo guardado. Sin esto, cerrar la edicion
              /// dejaria a la vista valores que no estan en la
              /// base y nadie sabria cuales.
              if (editando) setC(desdeFicha(lead));
              setEditando(!editando);
            }}
            className={
              editando
                ? "shrink-0 rounded-lg border border-error/40 bg-error-suave px-4 py-2 text-sm font-semibold text-error"
                : "shrink-0 rounded-lg border border-borde bg-superficie px-3.5 h-[34px] text-[0.78125rem] font-semibold text-titulo hover:bg-superficie-alterna"
            }
          >
            {editando ? "Cancelar" : "Editar datos"}
          </button>
        }
      </div>

      {!editando && (
        <div className="mt-2">
          <Grupo titulo="Identificación">
            <Leido
              etiqueta="Tipo de documento"
              valor={
                catalogos?.documentosPersona.find(
                  (d) => d.id === lead.persona.tipoDocumentoSepId,
                )?.etiqueta ?? String(lead.persona.tipoDocumentoSepId)
              }
            />
            <Leido
              etiqueta="Número de documento"
              valor={lead.persona.numeroDocumento}
            />
          </Grupo>

          <Grupo titulo="Nombre completo">
            <Leido etiqueta="Primer nombre" valor={c.primerNombre} />
            <Leido etiqueta="Segundo nombre" valor={c.segundoNombre} />
            <Leido etiqueta="Primer apellido" valor={c.primerApellido} />
            <Leido etiqueta="Segundo apellido" valor={c.segundoApellido} />
          </Grupo>

          <Grupo titulo="Perfil">
            <Leido
              etiqueta="Fecha de nacimiento"
              valor={
                c.fechaNacimiento
                  ? new Date(`${c.fechaNacimiento}T00:00:00`).toLocaleDateString(
                      "es-CO",
                    )
                  : ""
              }
            />
            <Leido
              etiqueta="Género"
              valor={
                (catalogos?.generos ?? []).find((g) => g.id === c.generoSepId)
                  ?.etiqueta ?? ""
              }
            />
            <Leido
              etiqueta="Estrato socioeconómico"
              valor={c.estrato === null ? "" : String(c.estrato)}
            />
            <Leido
              etiqueta="Nivel ocupacional"
              valor={
                (catalogos?.nivelesOcupacionales ?? []).find(
                  (n) => n.id === c.nivelOcupacionalSepId,
                )?.etiqueta ?? ""
              }
            />
          </Grupo>

          <Grupo titulo="Contacto">
            <Leido etiqueta="Correo" valor={c.correo} />
            <Leido etiqueta="Celular" valor={c.celular} />
          </Grupo>

          <Grupo titulo="Domicilio">
            <Leido
              etiqueta="Departamento"
              valor={
                (catalogos?.departamentos ?? []).find(
                  (d) => d.id === c.departamentoSepId,
                )?.etiqueta ?? ""
              }
            />
            <Leido
              etiqueta="Municipio"
              valor={
                municipios.find((m) => m[0] === c.municipioSepId)?.[2] ?? ""
              }
            />
            <Leido etiqueta="Barrio o vereda" valor={c.barrio} />
            <Leido etiqueta="Dirección" valor={c.direccion} />
          </Grupo>

          <Grupo titulo="Vínculo">
            <Leido etiqueta="Cargo en la empresa" valor={c.cargoEnEmpresa} />
            <Leido
              etiqueta="¿Se ha beneficiado antes?"
              valor={
                c.beneficiarioPrevio === null
                  ? ""
                  : c.beneficiarioPrevio
                    ? "Sí"
                    : "No"
              }
            />
          </Grupo>
        </div>
      )}

      {editando && (
      <div className="mt-4 space-y-4">
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
                  (d) => d.id === lead.persona.tipoDocumentoSepId,
                )?.etiqueta ?? String(lead.persona.tipoDocumentoSepId)
              }
            />
          </Campo>

          <Campo etiqueta="Número de documento">
            <input
              readOnly
              className={`${CLASE_CONTROL} font-mono opacity-70`}
              value={lead.persona.numeroDocumento}
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

        <div className="flex justify-end">
          {/* Gris hasta que haya algo que guardar: un boton
              siempre activo no dice si uno toco algo o no. */}
          <Boton onClick={guardar} disabled={guardando || !hayCambios}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Boton>
        </div>
      </div>
      )}

        {/* La caracterización YA NO se remite a otro sitio.

            Aquí había una nota que decía que «se gestiona por
            separado por tratarse de datos sensibles». La razón
            era cierta y la consecuencia falsa: no se gestionaba
            en ninguna parte salvo por el enlace público, que
            además no se le emite a quien ya estaba en el sistema.

            Ahora se captura en su propio bloque, con los candados
            en el servidor: sin autorización viva no se guarda,
            cuelga de la de su convenio, y queda en la
            auditoría. */}
      </Tarjeta>

      {/* En su PROPIA tarjeta, no dentro de la de arriba.

          No es un campo mas del SEP: se guarda por otro camino,
          tiene sus propios candados y su propio permiso. Meterlo
          entre el estrato y el barrio lo haria parecer lo que no
          es. */}
      {catalogos && (
        <Caracterizacion
          catalogo={catalogos.caracterizaciones}
          grupos={catalogos.gruposCaracterizacion}
          ninguna={catalogos.caracterizacionNinguna}
          elegidas={(lead.persona.caracterizaciones ?? []).map(
            (x) => x.caracterizacionSepId,
          )}
          rechazada={lead.persona.caracterizacionRechazada ?? false}
          preguntadaEn={lead.persona.caracterizacionPreguntada ?? null}
          /// Viva y de ESTE convenio: es la que el servidor va a
          /// exigir, asi que la pantalla mira la misma.
          tieneAutorizacion={(lead.persona.autorizaciones ?? []).some(
            (a) =>
              a.revocadaEn === null &&
              a.politica.convenioId === lead.convenio.id,
          )}
          puedeEscribir={editando}
          alGuardar={(v) =>
            alGuardar(async () => {
              await crmApi.actualizar(lead.id, v);
            })
          }
        />
      )}
    </>
  );
}
