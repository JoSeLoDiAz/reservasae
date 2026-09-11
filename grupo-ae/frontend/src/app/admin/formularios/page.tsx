"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BloqueDeBanda, ANCHO_FORMULARIO } from "@/components/admin/bloques";
import { Desplegable } from "@/components/admin/desplegable";
import {
  Boton,
  Campo,
  CLASE_CONTROL,
  useAdmin,
} from "@/components/admin/marco-admin";
import { EnlaceConCampana } from "@/components/admin/enlace-con-campana";
import {
  CifrasDeLaPuerta,
  loQueEntroPor,
  LoQueHaTraido,
  LoQueTrajoLaPuerta,
} from "@/components/admin/leads-de-la-puerta";
import { Esqueleto } from "@/components/admin/piezas";
import { Estado } from "@/components/admin/datos-del-negocio";
import {
  AvisoDeSeccion,
  CabeceraDePantalla,
  Seccion,
} from "@/components/admin/secciones";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { campanasApi } from "@/lib/campanas-api";
import { formulariosApi, type ResumenFormulario } from "@/lib/formularios-api";
import { oportunidadesApi, type ResumenDeVentas } from "@/lib/oportunidades-api";

type Convenio = { id: string; slug: string; nombre: string; sigla: string | null };

export default function PaginaFormularios() {
  const [formularios, setFormularios] = useState<ResumenFormulario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  /// CUÁL PUERTA SE ESTÁ MIRANDO.
  ///
  /// Null hasta que llega la lista, y entonces la primera: la
  /// región de la derecha en blanco esperando un clic sería
  /// medio ancho de pantalla diciendo «elija algo».
  const [senalada, setSenalada] = useState<string | null>(null);
  const esSuperadmin = useAdmin().admin.rol === "SUPERADMIN";

  /// Lo que ha entrado por cada puerta, y las campañas de correo
  /// que sugerir al armar un enlace.
  ///
  /// Las dos SIN romper la pantalla si fallan: el constructor de
  /// formularios tiene que abrirse aunque el embudo esté caído, y
  /// quien solo tiene permiso de formularios no tiene por qué
  /// verlo en rojo.
  const [resumen, setResumen] = useState<ResumenDeVentas | null>(null);
  const [campanas, setCampanas] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    const lista = await formulariosApi.listar();
    setFormularios(lista);
    /// Se señala la primera SOLO si la señalada ya no está —o
    /// no había ninguna—: recargar tras duplicar no tiene por
    /// qué mover al usuario de puerta.
    setSenalada((antes) =>
      antes && lista.some((f) => f.id === antes) ? antes : (lista[0]?.id ?? null),
    );
  }, []);

  useEffect(() => {
    void cargar();
    void oportunidadesApi.resumen().then(setResumen).catch(() => undefined);
    void campanasApi
      .listar()
      .then((cs) => setCampanas([...new Set(cs.map((c) => c.nombre))]))
      .catch(() => undefined);
  }, [cargar]);

  /// LO QUE HAN TRAÍDO TODAS LAS PUERTAS, SUMADO.
  ///
  /// Es la cifra de portada de esta pantalla y es dinero, como en
  /// las demás: un formulario publicado ES una campaña, y lo que
  /// se viene a mirar aquí no es cuántos formularios hay, es
  /// cuánto vale lo que han metido.
  const total = useMemo(() => {
    const puertas = (formularios ?? []).map((f) => loQueEntroPor(f.slug, resumen));
    return {
      cuantas: puertas.reduce((s, p) => s + p.cuantas, 0),
      abierto: puertas.reduce((s, p) => s + p.abierto, 0),
      ganado: puertas.reduce((s, p) => s + p.ganado, 0),
    };
  }, [formularios, resumen]);

  /// La puerta señalada, entera.
  const puerta = formularios?.find((f) => f.id === senalada) ?? null;

  return (
    <div className="flex min-h-0 grow flex-col">
      {/* El nombre entero va AQUI y no en el menu: en la barra
          salia cortado como «Formularios de reserva (...». */}
      <CabeceraDePantalla
        titulo="Formularios de empresas"
        nota="Por donde entra un lead de empresa. Cada formulario publicado es una puerta: lo que se pregunte aquí es lo que llega a la ficha, y de qué campaña vino se sabe por el enlace con el que se comparte."
        acciones={
          !creando && (
            <Boton type="button" onClick={() => setCreando(true)}>
              Crear formulario
            </Boton>
          )
        }
      />

      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}

      {/* La banda de cifras solo cuando hay algo que contar.
          Tres rayas de 34 px se leen como tres cifras rotas, y
          una banda vacía es justo el «bloque para rellenar aire»
          que este rediseño quita.

          Es la ÚNICA cifra de 34 px de la pantalla: el detalle de
          la derecha enseña el reparto por anuncio, no vuelve a
          pintar la portada. Dos cifras de 34 en la misma pantalla
          son dos cifras medianas. */}
      {total.cuantas > 0 && (
        <Seccion>
          <div className="px-6 pt-5 pb-6">
            <CifrasDeLaPuerta
              cuantas={total.cuantas}
              abierto={total.abierto}
              ganado={total.ganado}
            />
          </div>
        </Seccion>
      )}

      {creando && (
        <Seccion>
          <div className="px-6 pt-5 pb-6">
            <NuevoFormulario
              alCrear={async () => {
                await cargar();
                setCreando(false);
              }}
              alCancelar={() => setCreando(false)}
              alFallar={setError}
            />
          </div>
        </Seccion>
      )}

      {!formularios && (
        <Seccion>
          <div className="px-6 py-5">
            <Esqueleto filas={3} />
          </div>
        </Seccion>
      )}

      {/* LAS PUERTAS A LA IZQUIERDA, LO QUE ENTRÓ POR UNA A LA
          DERECHA.

          Esta lista no pasa de diez filas —hoy son dos— y no
          tiene ocho datos comparables que meter en columna:
          forzarlos sería inventar columnas de aire. Para una
          lista corta, la respuesta al ancho sobrante es la otra:
          dedicarlo a una SEGUNDA REGIÓN útil, y aquí esa región
          es el detalle de la puerta señalada —qué entró por
          ella, de qué anuncio, y con qué enlace se reparte—.

          Antes ese detalle no existía en esta pantalla: había
          que entrar a la ficha de cada formulario para verlo, y
          mientras tanto la fila apilaba sus cinco datos en 500 px
          con la plata sola al otro extremo, a 1100 px. Y el
          enlace, cuando se abría, se abría a lo ancho de 1636 px:
          un campo de 1190 px para escribir «meta-octubre».

          La región del detalle es la FIJA —760 px, que es lo que
          miden el enlace con su QR y la tabla de anuncios— y la
          de las puertas es la que absorbe: dos puertas con su
          plata al canto de su región son dos cifras en columna,
          que es como se comparan. Al revés —el detalle
          absorbiendo— la columna «anuncio» crecía a 740 px para
          un anuncio de 190 y la cuenta se iba a ochocientos
          píxeles de su nombre, que es el mismo defecto otra
          vez. */}
      {formularios && formularios.length > 0 && (
        <div className="@container min-h-0 grow border-b border-borde bg-superficie">
          <div className="grid @[1200px]:grid-cols-[minmax(0,1fr)_560px] @[1560px]:grid-cols-[minmax(0,1fr)_760px]">
            <div className="min-w-0">
              {formularios.map((f) => (
                <FilaDePuerta
                  key={f.id}
                  formulario={f}
                  resumen={resumen}
                  senalada={senalada === f.id}
                  alSenalar={() => setSenalada(f.id)}
                />
              ))}
            </div>

            {/* La raya cambia de sitio según dónde esté la
                región: al lado, separa dos columnas; debajo,
                separa dos bandas. */}
            <div className="min-w-0 border-t border-borde @[1200px]:border-t-0 @[1200px]:border-l @[1200px]:border-l-borde">
              {puerta && (
                <div className="space-y-6 px-6 pt-5 pb-6">
                  <BloqueDeBanda
                    rotulo="Por esta puerta"
                    acciones={
                      <span
                        className="text-texto-suave"
                        style={{ fontSize: "0.71875rem" }}
                      >
                        {puerta.titulo}
                      </span>
                    }
                  >
                    {/* Sin las tres cifras: las de arriba ya son
                        las de la pantalla, y lo que esta puerta
                        vale se lee en su propia fila, a la
                        izquierda y en 20/700. Aquí lo que hace
                        falta es el REPARTO por anuncio, que es lo
                        que decide si se sigue pagando uno. */}
                    <LoQueHaTraido
                      slug={puerta.slug}
                      resumen={resumen}
                      conCifras={false}
                    />
                  </BloqueDeBanda>

                  {/* Un borrador no está en la calle: ofrecerle un
                      enlace para repartir sería ofrecer un 404. */}
                  {puerta.publicado && (
                    <div className="border-t border-hairline pt-5">
                      <BloqueDeBanda rotulo="El enlace que se reparte">
                        <EnlaceConCampana
                          slug={puerta.slug}
                          ruta={`/${puerta.slug}`}
                          titulo={puerta.titulo}
                          campanas={campanas}
                        />
                      </BloqueDeBanda>
                    </div>
                  )}

                  {esSuperadmin && (
                    <div className="border-t border-hairline pt-5">
                      {duplicando === puerta.id ? (
                        <Duplicar
                          origen={puerta}
                          alTerminar={() => {
                            setDuplicando(null);
                            cargar();
                          }}
                          alCancelar={() => setDuplicando(null)}
                          alFallar={setError}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDuplicando(puerta.id)}
                          className="text-marca"
                          style={{ fontSize: "0.71875rem" }}
                        >
                          Duplicar esta puerta
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Una puerta en la lista de la izquierda.
 *
 * Cinco datos y la plata al canto de SU región, que mide 560 px
 * y no 1684: la cifra queda a un palmo del nombre al que
 * pertenece en vez de a mil cien píxeles. La fila entera señala;
 * el nombre sigue llevando a la ficha, y para eso para el clic
 * antes de que suba.
 */
function FilaDePuerta({
  formulario: f,
  resumen,
  senalada,
  alSenalar,
}: {
  formulario: ResumenFormulario;
  resumen: ResumenDeVentas | null;
  senalada: boolean;
  alSenalar: () => void;
}) {
  return (
    <div
      onClick={alSenalar}
      className={`flex cursor-pointer items-start gap-4 border-b border-hairline px-6 py-3.5 transition hover:bg-tabla-fila-resaltada ${
        senalada ? "bg-tabla-fila-resaltada" : ""
      }`}
    >
      <div className="min-w-0 grow">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link
            href={`/admin/formularios/${f.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-titulo no-underline hover:underline"
            style={{ fontSize: "0.8125rem", fontWeight: 700 }}
          >
            {f.titulo}
          </Link>
          {/* La pieza compartida, no un span con estilo
              propio: un formulario publicado y un negocio
              ganado son la misma clase de dato y se
              escriben igual -- punto de color, 6 px de
              aire y el rotulo del mismo color a peso 600
              --. Escrito a mano aqui, en Campanas y en
              Habeas Data, salian tres estados que no se
              parecian entre si. */}
          <Estado tono={f.publicado ? "exito" : "apagado"}>
            {f.publicado ? "Publicado" : "Borrador"}
          </Estado>
        </div>
        <p
          className="mt-1 truncate text-texto-suave tabular-nums"
          style={{ fontSize: "0.65625rem", letterSpacing: "0.02em" }}
        >
          /{f.slug}
        </p>
        <p
          className="mt-1.5 truncate text-texto-suave"
          style={{ fontSize: "0.71875rem" }}
        >
          {f.convenioSigla ?? f.convenio} · {f.preguntas} preguntas en{" "}
          {f.secciones} secciones
        </p>
      </div>

      {/* Lo que ha traído. A la derecha y en 20/700: es la
          única cifra por la que se entra a esta pantalla
          sin venir a editar nada. */}
      <LoQueTrajoLaPuerta slug={f.slug} resumen={resumen} />
    </div>
  );
}

function NuevoFormulario({
  alCrear,
  alCancelar,
  alFallar,
}: {
  alCrear: () => Promise<void>;
  alCancelar: () => void;
  alFallar: (mensaje: string) => void;
}) {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    void adminApi.convenios().then((datos) => {
      setConvenios(datos);
      if (datos[0]) setConvenioId(datos[0].id);
    });
  }, []);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setCreando(true);
    try {
      await formulariosApi.crear({ convenioId, slug, titulo });
      setTitulo("");
      setSlug("");
      await alCrear();
    } catch (e) {
      alFallar((e as ErrorApi).message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <BloqueDeBanda
      rotulo="Nuevo formulario"
      nota="Nace en borrador. No se puede publicar hasta que tenga los campos que el sistema necesita para crear un lead."
    >
      {/* El formulario topa en 720: un identificador de URL no
          necesita el ancho de un monitor de 27". */}
      <form onSubmit={enviar} className={`${ANCHO_FORMULARIO} grid gap-4 sm:grid-cols-2`}>
        <Campo etiqueta="Línea de negocio">
          {/* El desplegable de la casa, no el del sistema
              operativo: el nativo se pinta distinto en cada
              navegador y en tema oscuro abre una lista blanca. */}
          <Desplegable
            valor={convenioId}
            alElegir={setConvenioId}
            opciones={convenios.map((c) => ({
              valor: c.id,
              etiqueta: c.sigla ?? c.nombre,
              detalle: c.sigla ? c.nombre : undefined,
            }))}
          />
        </Campo>

        <Campo etiqueta="Título">
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={CLASE_CONTROL}
          />
        </Campo>

        <Campo
          etiqueta="Identificador en la URL"
          ayuda="Minúsculas, números y guiones. Es la ruta pública: /su-identificador"
        >
          <input
            required
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[̀-ͯ]/g, "")
                  .replace(/[^a-z0-9-]/g, "-")
                  .replace(/-+/g, "-"),
              )
            }
            className={`${CLASE_CONTROL} tabular-nums`}
          />
        </Campo>

        <div className="flex items-end gap-4">
          <Boton type="submit" disabled={creando}>
            {creando ? "Creando…" : "Crear"}
          </Boton>
          <button
            type="button"
            onClick={alCancelar}
            className="text-texto-suave"
            style={{ fontSize: "0.71875rem" }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </BloqueDeBanda>
  );
}

/** Copiar uno existente: pide slug y título nuevos. */
function Duplicar({
  origen,
  alTerminar,
  alCancelar,
  alFallar,
}: {
  origen: ResumenFormulario;
  alTerminar: () => void;
  alCancelar: () => void;
  alFallar: (mensaje: string) => void;
}) {
  const [slug, setSlug] = useState(`${origen.slug}-copia`);
  const [titulo, setTitulo] = useState(`${origen.titulo} (copia)`);
  const [copiando, setCopiando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCopiando(true);
    try {
      await formulariosApi.duplicar(origen.id, { slug, titulo });
      alTerminar();
    } catch (err) {
      alFallar(err instanceof Error ? err.message : "No se pudo duplicar.");
      setCopiando(false);
    }
  }

  return (
    <form onSubmit={enviar} className={`${ANCHO_FORMULARIO} space-y-4`}>
      <p className="max-w-[68ch] text-texto-suave" style={{ fontSize: "0.71875rem" }}>
        Copia las preguntas, las opciones y la apariencia. Nace en borrador y sin
        respuestas.
      </p>
      <Campo etiqueta="Título de la copia">
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className={CLASE_CONTROL}
        />
      </Campo>
      <Campo etiqueta="Identificador en la URL" ayuda="Es la ruta pública">
        <input
          required
          value={slug}
          onChange={(e) =>
            setSlug(
              e.target.value
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/-+/g, "-"),
            )
          }
          className={`${CLASE_CONTROL} tabular-nums`}
        />
      </Campo>
      <div className="flex items-end gap-4">
        <Boton type="submit" disabled={copiando}>
          {copiando ? "Copiando…" : "Crear la copia"}
        </Boton>
        <button
          type="button"
          onClick={alCancelar}
          className="text-texto-suave"
          style={{ fontSize: "0.71875rem" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
