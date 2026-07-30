"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { formulariosApi, type ResumenFormulario } from "@/lib/formularios-api";

type Convenio = { id: string; slug: string; nombre: string; sigla: string | null };

export default function PaginaFormularios() {
  const [formularios, setFormularios] = useState<ResumenFormulario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setFormularios(await formulariosApi.listar());
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Formularios</h1>
        <p className="mt-1 text-texto-suave">
          Lo que ve quien entra a reservar. Puede crear preguntas, agruparlas en
          secciones y publicarlas sin tocar el código.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <NuevoFormulario alCrear={cargar} alFallar={setError} />

      {!formularios && <p className="text-texto-suave">Cargando…</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {formularios?.map((f) => (
          <Link
            key={f.id}
            href={`/admin/formularios/${f.id}`}
            className="rounded-xl border border-borde bg-superficie p-5 transition hover:border-marca hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium leading-snug">{f.titulo}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  f.publicado ? "bg-exito-suave text-exito" : "bg-fondo text-texto-suave"
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
          </Link>
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
    <Tarjeta
      titulo="Nuevo formulario"
      descripcion="Nace en borrador. No se puede publicar hasta que tenga los campos que el sistema necesita para crear una reserva."
    >
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Convenio">
          <select
            value={convenioId}
            onChange={(e) => setConvenioId(e.target.value)}
            className={CLASE_CONTROL}
          >
            {convenios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sigla ?? c.nombre}
              </option>
            ))}
          </select>
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
          ayuda="Minúsculas, números y guiones. Será /formularios/…"
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
    </Tarjeta>
  );
}

