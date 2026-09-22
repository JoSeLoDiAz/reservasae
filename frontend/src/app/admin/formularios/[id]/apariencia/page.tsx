"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Cargando } from "@/components/admin/piezas";
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
  /// Logos y colores de un formulario son la cara del gremio para
  /// todos: los cambian solo los correos de `EDITORES_DE_MARCA`
  /// (cliente, 21 sep 2026). `null` mientras no se sabe.
  const [editor, setEditor] = useState<boolean | null>(null);

  useEffect(() => {
    void Promise.all([formulariosApi.obtener(id), adminApi.marca(), adminApi.yo()]).then(
      ([f, m, yo]) => {
        setFormulario(f);
        setGeneral(m);
        setEditor(yo.puede?.editarMarca === true);
      },
    );
  }, [id]);

  if (!formulario || !general || editor === null) return <Cargando />;

  return (
    <div>
      <header className="mx-3 mb-3 rounded-2xl border border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
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

      {editor ? (
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
      ) : (
        <p className="mx-3 rounded-xl border border-linea bg-superficie-alt p-4 text-sm">
          Los logos y los colores de los formularios los cambian solo las personas
          autorizadas. Los colores de su panel sí los puede elegir en{" "}
          <Link href="/admin/marca" className="font-medium text-marca hover:underline">
            Apariencia
          </Link>
          , y le quedan solo a usted.
        </p>
      )}
    </div>
  );
}
