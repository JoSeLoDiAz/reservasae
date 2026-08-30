"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { AparienciaHeredada } from "@/components/admin/apariencia-heredada";
import { adminApi, type Marca } from "@/lib/admin-api";
import { formulariosApi, type FormularioAdmin } from "@/lib/formularios-api";

export default function PaginaAparienciaFormulario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [formulario, setFormulario] = useState<FormularioAdmin | null>(null);
  const [general, setGeneral] = useState<Marca | null>(null);

  useEffect(() => {
    void Promise.all([formulariosApi.obtener(id), adminApi.marca()]).then(
      ([f, m]) => {
        setFormulario(f);
        setGeneral(m);
      },
    );
  }, [id]);

  if (!formulario || !general) return <p className="text-texto-suave">Cargando…</p>;

  return (
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <Link
          href={`/admin/formularios/${id}`}
          className="text-sm text-marca hover:underline"
        >
          ← {formulario.titulo}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Apariencia del formulario</h1>
        <p className="mt-1 text-texto-suave">
          Solo afecta a{" "}
          <Link
            href={`/${formulario.slug}`}
            target="_blank"
            className="font-mono text-marca hover:underline"
          >
            /{formulario.slug}
          </Link>
          .
        </p>
      </header>

      <AparienciaHeredada
        formularioId={id}
        general={general}
        iniciales={{
          CLARO: formulario.coloresClaro ?? {},
          OSCURO: formulario.coloresOscuro ?? {},
        }}
        tituloLogos="Logos del formulario"
        tituloColores="Colores"
        descripcionLogos="Hasta tres, uno por entidad. Sin ninguno propio se muestran los de la apariencia general. SVG, PNG o WebP con fondo transparente, máximo 1 MB cada uno; se ven a 80 px de alto."
      />
    </div>
  );
}
