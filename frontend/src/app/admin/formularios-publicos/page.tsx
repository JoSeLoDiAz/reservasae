"use client";

/** Los dos formularios que están en la calle, en una vista. */

/// Estaban en dos pantallas separadas y eso obligaba a ir y
/// volver para responder una pregunta que se hace todo el
/// tiempo: «¿esto en cuál de los dos se pide?». Son dos
/// momentos de UNA misma recolección -- lo que se pregunta en
/// el corto no se vuelve a pedir en el largo -- así que se
/// leen juntos o no se entienden.

import { useEffect, useState } from "react";

import {
  EnlacePublico,
  LoQuePregunta,
  type Bloque,
} from "@/components/admin/formulario-publico";
import { Tarjeta, useAdmin } from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";

const CORTO: Bloque[] = [
  {
    titulo: "Quién es",
    campos: [
      { etiqueta: "Tipo de documento", obligatorio: true },
      { etiqueta: "Número de documento", obligatorio: true },
      { etiqueta: "Primer nombre", obligatorio: true },
      { etiqueta: "Segundo nombre" },
      { etiqueta: "Primer apellido", obligatorio: true },
      { etiqueta: "Segundo apellido" },
      { etiqueta: "Género" },
    ],
  },
  {
    titulo: "Cómo ubicarlo",
    campos: [
      { etiqueta: "Celular" },
      { etiqueta: "Correo" },
      { etiqueta: "Departamento" },
      { etiqueta: "Ciudad" },
    ],
  },
  {
    titulo: "Qué quiere estudiar",
    campos: [{ etiqueta: "Acción de formación", obligatorio: true }],
  },
  {
    titulo: "Permiso",
    campos: [
      {
        etiqueta: "Política y Tratamiento de Datos Personales",
        obligatorio: true,
      },
    ],
  },
];

const LARGO: Bloque[] = [
  {
    titulo: "Primero, su organización",
    campos: [
      { etiqueta: "NIT y dígito de verificación" },
      { etiqueta: "Razón social" },
      { etiqueta: "Dirección" },
      { etiqueta: "Teléfono" },
      { etiqueta: "Departamento y municipio" },
      { etiqueta: "Sector económico" },
      { etiqueta: "Número de trabajadores" },
      { etiqueta: "Persona de contacto, su cargo y correo" },
      { etiqueta: "O bien: «trabajo por mi cuenta», y su cédula es su RUT" },
      { etiqueta: "O bien: «no estoy trabajando», y ahí se le agradece" },
    ],
  },
  {
    titulo: "Después, lo suyo",
    campos: [
      { etiqueta: "Fecha de nacimiento" },
      { etiqueta: "Estrato" },
      { etiqueta: "Dirección y barrio" },
      { etiqueta: "Departamento y municipio donde vive" },
      { etiqueta: "Nivel educativo" },
      { etiqueta: "Cargo en la empresa" },
      { etiqueta: "Nivel ocupacional" },
      { etiqueta: "Si ya fue beneficiario antes" },
      { etiqueta: "Población vulnerable, una sola y opcional" },
    ],
  },
];

type Cual = "CORTO" | "LARGO";

export default function FormulariosActivos() {
  const { gremios, gremio } = useAdmin();
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [cual, setCual] = useState<Cual>("CORTO");

  useEffect(() => {
    void adminApi
      .convenios()
      .then((cs) => {
        const m: Record<string, string> = {};
        for (const c of cs) m[c.id] = c.slug;
        setSlugs(m);
      })
      .catch(() => undefined);
  }, []);

  const origen = typeof window === "undefined" ? "" : window.location.origin;
  const cuales = gremio
    ? gremios.filter((g) => g.convenioId === gremio)
    : gremios;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Formularios activos
        </h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Los dos momentos de una misma recolección. El corto es público y trae
          a la persona al embudo; el largo se le manda después, uno por uno, y
          solo le pregunta lo que le falte.
        </p>
      </header>

      {/* Pestañas y no dos páginas: la pregunta que uno trae
          aquí casi siempre es «¿esto en cuál se pide?», y esa
          se responde comparando, no navegando. */}
      <div
        role="tablist"
        aria-label="Cuál de los dos formularios"
        className="inline-flex rounded-xl border border-borde bg-superficie p-1"
      >
        {(
          [
            ["CORTO", "Formulario 1 · Corto"],
            ["LARGO", "Formulario 2 · Largo"],
          ] as Array<[Cual, string]>
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={cual === valor}
            onClick={() => setCual(valor)}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              cual === valor
                ? "bg-marca font-medium text-marca-texto shadow-sm"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {cual === "CORTO" ? (
        <>
          <Tarjeta
            titulo="Formulario 1 · Corto"
            descripcion="Público, el mismo para todos. Se reparte por QR y por enlace."
          >
            <p className="text-sm text-texto-suave">
              Los datos básicos. Con esto la persona ya entra al embudo y se le
              puede hacer seguimiento. Pedirle más en este punto es perderlo.
            </p>
          </Tarjeta>

          <Tarjeta titulo="Lo que le pregunta">
            <LoQuePregunta bloques={CORTO} />
            <p className="mt-4 text-xs text-texto-suave">
              Lo marcado con <span className="text-aviso">*</span> es
              obligatorio. El resto se le vuelve a pedir en el Formulario 2, y
              solo lo que falte.
            </p>
          </Tarjeta>

          {cuales.map((g) =>
            slugs[g.convenioId] ? (
              <EnlacePublico
                key={g.convenioId}
                sigla={g.sigla}
                url={`${origen}/${slugs[g.convenioId]}/preinscripcion`}
              />
            ) : null,
          )}
        </>
      ) : (
        <>
          <Tarjeta
            titulo="Formulario 2 · Largo"
            descripcion="Personal y de un solo uso. No es público."
          >
            <p className="text-sm text-texto-suave">
              Lo que falta para poder reportar a la persona al SENA. Se le manda
              después de que llene el corto.
            </p>
          </Tarjeta>

          <Tarjeta titulo="Este no tiene QR, y no es un olvido">
            <div className="space-y-2 text-sm">
              <p>
                Cada enlace de este formulario es{" "}
                <strong>personal y de un solo uso</strong>: se emite desde la
                ficha del lead, caduca, y el siguiente anula al anterior.
              </p>
              <p className="text-texto-suave">
                Un QR pegado en una pared solo puede llevar a un sitio, y esta
                dirección cambia por persona. Para mandárselo a alguien, abra su
                lead en <strong>Gestión de leads</strong> y use «Enlace para que
                complete sus datos».
              </p>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Lo que le pregunta">
            <LoQuePregunta bloques={LARGO} />
            <p className="mt-4 text-xs text-texto-suave">
              Solo se le pregunta lo que falta. Lo que ya dio en el corto no se
              le vuelve a pedir.
            </p>
          </Tarjeta>
        </>
      )}
    </div>
  );
}
