"use client";

/** Formulario 1 Corto: los datos básicos. */

/// El primer momento. Es público y el mismo para todos, así
/// que se reparte por QR y por enlace. Lo que pida aquí es lo
/// único que hace falta para que alguien entre al embudo:
/// pedirle más en este punto es perderlo.

import { useEffect, useState } from "react";

import {
  EnlacePublico,
  LoQuePregunta,
  type Bloque,
} from "@/components/admin/formulario-publico";
import { Tarjeta, useAdmin } from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";

const BLOQUES: Bloque[] = [
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
      { etiqueta: "Política y Tratamiento de Datos Personales", obligatorio: true },
    ],
  },
];

export default function Corto() {
  const { gremios, gremio } = useAdmin();
  const [slugs, setSlugs] = useState<Record<string, string>>({});

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
  const cuales = gremio ? gremios.filter((g) => g.convenioId === gremio) : gremios;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Formulario 1 Corto</h1>
        <p className="mt-1 text-texto-suave">
          Los datos básicos. Es el primer momento: con esto la persona ya entra al
          embudo y se le puede hacer seguimiento.
        </p>
      </header>

      <Tarjeta titulo="Lo que le pregunta">
        <LoQuePregunta bloques={BLOQUES} />
        <p className="mt-4 text-xs text-texto-suave">
          Lo marcado con <span className="text-aviso">*</span> es obligatorio. El
          resto se le vuelve a pedir en el Formulario 2, y solo lo que falte.
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
    </div>
  );
}
