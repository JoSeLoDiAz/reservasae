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
import {
  aCuerpo,
  CamposDeLaPersona,
  type DatosDeLaPersona,
} from "@/components/admin/campos-de-la-persona";
import { IconoPerfil } from "@/components/admin/iconos";
import { crmApi, type CatalogosSep, type Ficha } from "@/lib/crm-api";

/// El tipo vive con los campos: los dos cambian juntos.
type Campos = DatosDeLaPersona & {
  /// La identidad. Sale del formulario corto y aqui no se
  /// veia: el asesor tenia que subir a la cabecera de la
  /// lead para leer un apellido, y no habia forma de
  /// corregirlo desde donde se corrige todo lo demas.
  /* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
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

  async function guardar() {
    setGuardando(true);
    try {
      await alGuardar(async () => {
        await crmApi.actualizar(lead.id, aCuerpo(c));
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
        {/* Los campos son los MISMOS que los de crear una
            ficha: viven en `campos-de-la-persona.tsx`. Aqui
            la identidad va en solo lectura porque el documento
            es la llave de la persona en todo el sistema y
            cambiarlo partiria su historia en dos. */}
        <CamposDeLaPersona
          c={c}
          setC={setC}
          catalogos={catalogos}
          identidad={
            <>
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
            </>
          }
        />

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
  );
}
