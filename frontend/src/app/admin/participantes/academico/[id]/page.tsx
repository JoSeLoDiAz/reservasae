"use client";

/**
 * EL PARTICIPANTE, UNO A UNO, DENTRO DE SEGUIMIENTO DEL AULA.
 *
 * Aqui solo se piden los datos: lo que se pinta vive en
 * `SeguimientoAcademicoDeUno`, porque desde el 26 sep 2026 la misma
 * vista sale tambien dentro de la ficha del lead, en la pestania
 * «Seguimiento Academico». Una sola copia de las reglas.
 */

import Link from "next/link";
import { useCallback } from "react";
import { useParams } from "next/navigation";

import { Aviso } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { SeguimientoAcademicoDeUno } from "@/components/admin/seguimiento-academico-de-uno";
import { useDatosVivos } from "@/lib/datos-vivos";
import { type Academico, crmApi } from "@/lib/crm-api";

export default function PaginaDelParticipante() {
  const { id } = useParams<{ id: string }>();

  const cargar = useCallback(() => crmApi.academicoDeUno(id), [id]);
  const vivos = useDatosVivos<Academico>(cargar, { clave: id });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto conCifras />;

  const fila = vivos.datos.personas[0];
  if (!fila) {
    return (
      <div className="px-4 pt-3">
        <Aviso tipo="error">
          Esta persona no está en el aula. Solo aparece aquí quien esté en
          formación en una acción virtual.{" "}
          <Link href="/admin/participantes/academico" className="underline">
            Volver a Seguimiento del aula
          </Link>
        </Aviso>
      </div>
    );
  }

  return (
    <SeguimientoAcademicoDeUno fila={fila} criterio={vivos.datos.criterio} />
  );
}
