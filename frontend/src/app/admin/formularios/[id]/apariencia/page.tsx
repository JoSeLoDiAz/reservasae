"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { EditorColores } from "@/components/admin/editor-colores";
import { GestorLogos } from "@/components/admin/gestor-logos";
import { Aviso, Boton, Tarjeta } from "@/components/admin/marco-admin";
import { adminApi, type Marca } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { formulariosApi, type FormularioAdmin } from "@/lib/formularios-api";
import type { ColoresTema, Esquema } from "@/lib/tema";

type Propios = Record<Esquema, ColoresTema>;

const VACIO: Propios = { CLARO: {}, OSCURO: {} };

/** Solo lo que se aparta de la marca general. */
function soloDiferencias(general: ColoresTema, propuesta: ColoresTema): ColoresTema {
  const salida: ColoresTema = {};
  for (const [clave, valor] of Object.entries(propuesta)) {
    if (general[clave] !== valor) salida[clave] = valor;
  }
  return salida;
}

export default function PaginaAparienciaFormulario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [formulario, setFormulario] = useState<FormularioAdmin | null>(null);
  const [general, setGeneral] = useState<Marca | null>(null);
  const [propios, setPropios] = useState<Propios>(VACIO);
  const [pestana, setPestana] = useState<Esquema>("CLARO");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void Promise.all([formulariosApi.obtener(id), adminApi.marca()]).then(
      ([f, m]) => {
        setFormulario(f);
        setGeneral(m);
        setPropios({ CLARO: f.coloresClaro ?? {}, OSCURO: f.coloresOscuro ?? {} });
      },
    );
  }, [id]);

  if (!formulario || !general) return <p className="text-texto-suave">Cargando…</p>;

  // lo que se ve = general + lo propio
  const temas: Propios = {
    CLARO: { ...general.temas.CLARO, ...propios.CLARO },
    OSCURO: { ...general.temas.OSCURO, ...propios.OSCURO },
  };

  function cambiarPropios(siguiente: Propios) {
    setPropios(siguiente);
    setGuardado(false);
  }

  async function conError(accion: () => Promise<unknown>) {
    setError(null);
    setOcupado(true);
    try {
      await accion();
      setFormulario(await formulariosApi.obtener(id));
      setGuardado(true);
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
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
          . Lo que no cambie aquí sigue a la apariencia general, y cambiará con
          ella.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {guardado && !error && <Aviso tipo="exito">Cambios guardados.</Aviso>}

      <Tarjeta
        titulo="Logos del formulario"
        descripcion="Hasta tres, uno por entidad. Sin ninguno propio se muestran los de la apariencia general. SVG, PNG o WebP con fondo transparente, máximo 1 MB cada uno; se ven a 80 px de alto."
      >
        <GestorLogos formularioId={id} heredados={general.logos} />
      </Tarjeta>

      <Tarjeta titulo="Colores">
        <EditorColores
          temas={temas}
          catalogo={general.catalogoColores}
          esquema={pestana}
          alCambiarEsquema={setPestana}
          alCambiarColor={(clave, valor) =>
            cambiarPropios({
              ...propios,
              [pestana]: { ...propios[pestana], [clave]: valor },
            })
          }
          alReemplazarTemas={(nuevos) =>
            cambiarPropios({
              CLARO: soloDiferencias(general.temas.CLARO, nuevos.CLARO),
              OSCURO: soloDiferencias(general.temas.OSCURO, nuevos.OSCURO),
            })
          }
          herencia={{
            sobreescritos: {
              CLARO: Object.keys(propios.CLARO),
              OSCURO: Object.keys(propios.OSCURO),
            },
            alHeredarClave: (esquema, clave) => {
              const copia = { ...propios[esquema] };
              delete copia[clave];
              cambiarPropios({ ...propios, [esquema]: copia });
            },
            alHeredarTodo: () => cambiarPropios(VACIO),
          }}
          acciones={
            <div className="flex flex-wrap gap-3">
              <Boton
                type="button"
                disabled={ocupado}
                onClick={() =>
                  conError(() =>
                    adminApi.aparienciaDeFormulario(id, {
                      coloresClaro: propios.CLARO,
                      coloresOscuro: propios.OSCURO,
                    }),
                  )
                }
              >
                {ocupado ? "Guardando…" : "Guardar colores"}
              </Boton>
            </div>
          }
        />
      </Tarjeta>
    </div>
  );
}
