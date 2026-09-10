"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Desplegable } from "@/components/admin/desplegable";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  useAdmin,
} from "@/components/admin/marco-admin";
import { Bloque, Esqueleto } from "@/components/admin/piezas";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { formulariosApi, type ResumenFormulario } from "@/lib/formularios-api";

type Convenio = { id: string; slug: string; nombre: string; sigla: string | null };

export default function PaginaFormularios() {
  const [formularios, setFormularios] = useState<ResumenFormulario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState<string | null>(null);
  const esSuperadmin = useAdmin().admin.rol === "SUPERADMIN";

  const cargar = useCallback(async () => {
    setFormularios(await formulariosApi.listar());
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4 pb-6">
      {/* El nombre entero va AQUI y no en el menu: en la barra
          salia cortado como «Formularios de reserva (...». */}
      <header>
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
          Formularios de reserva (empresas)
        </h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Lo que ve quien entra a reservar. Puede crear preguntas, agruparlas en
          secciones y publicarlas sin tocar el código.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div>
        <NuevoFormulario alCrear={cargar} alFallar={setError} />
      </div>

      {!formularios && <Esqueleto filas={3} />}

      {/* Con aire entre las fichas. Pegadas, la rejilla se leia
          como una tabla sin rayas: dos cajas tocandose no son
          dos cosas, son una partida. */}
      <div className="grid gap-4 md:grid-cols-2">
        {formularios?.map((f) => (
          <div
            key={f.id}
            /// Llevaba un `hover:` suelto al final, sin utilidad
            /// detrás. Tailwind no lo genera y no rompe nada,
            /// pero es un resto de algo que se borró a medias.
            className="rounded-xl border border-borde bg-superficie p-5 transition hover:border-marca"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/admin/formularios/${f.id}`}
                className="font-medium leading-snug hover:underline"
              >
                {f.titulo}
              </Link>
              <span
                /// El color va en la letra, sin fondo. Quedaban
                /// el `bg-exito-suave` y el `bg-fondo` de
                /// cuando esto era una píldora: sin relleno
                /// alrededor, pintan una mancha pegada al
                /// texto. Es la regla 2 del panel.
                className={`shrink-0 text-[0.75rem] font-semibold ${
                  f.publicado ? "text-exito" : "text-texto-suave"
                }`}
              >
                {f.publicado ? "Publicado" : "Borrador"}
              </span>
            </div>
            <p className="mt-2 font-mono text-sm text-texto-suave">/{f.slug}</p>
            <p className="mt-3 text-sm text-texto-suave">
              {f.convenioSigla ?? f.convenio} · {f.preguntas} preguntas en{" "}
              {f.secciones} secciones
            </p>

            {!esSuperadmin ? null : duplicando === f.id ? (
              <Duplicar
                origen={f}
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
                onClick={() => setDuplicando(f.id)}
                className="mt-4 text-sm text-marca underline"
              >
                Duplicar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevoFormulario({
  alCrear,
  alFallar,
}: {
  alCrear: () => Promise<void>;
  alFallar: (mensaje: string) => void;
}) {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [abierto, setAbierto] = useState(false);
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
      setAbierto(false);
      setTitulo("");
      setSlug("");
      await alCrear();
    } catch (e) {
      alFallar((e as ErrorApi).message);
    } finally {
      setCreando(false);
    }
  }

  if (!abierto) {
    return (
      <Boton type="button" onClick={() => setAbierto(true)}>
        Crear formulario
      </Boton>
    );
  }

  return (
    <Bloque
      titulo="Nuevo formulario"
      descripcion="Nace en borrador. No se puede publicar hasta que tenga los campos que el sistema necesita para crear una reserva."
    >
      {/* Con aire entre los campos: pegados, las dos columnas
          se leían como una sola caja partida. */}
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Convenio">
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
            className={`${CLASE_CONTROL} font-mono`}
          />
        </Campo>

        <div className="flex items-end gap-3">
          <Boton type="submit" disabled={creando}>
            {creando ? "Creando…" : "Crear"}
          </Boton>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="text-sm text-texto-suave underline"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Bloque>
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
    <form onSubmit={enviar} className="mt-4 space-y-3 border-t border-borde pt-4">
      <p className="text-sm text-texto-suave">
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
          className={`${CLASE_CONTROL} font-mono`}
        />
      </Campo>
      <div className="flex items-end gap-3">
        <Boton type="submit" disabled={copiando}>
          {copiando ? "Copiando…" : "Crear la copia"}
        </Boton>
        <button
          type="button"
          onClick={alCancelar}
          className="text-sm text-texto-suave underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
