import type { CSSProperties } from "react";

import { ETIQUETA_ETAPA, type Etapa } from "@/lib/crm-api";

/** El token de color que el admin edita en Apariencia. */
const VARIABLE_ETAPA: Record<Etapa, string> = {
  NUEVO: "--etapa-nuevo",
  CONTACTADO: "--etapa-contactado",
  DATOS_COMPLETOS: "--etapa-datos-completos",
  MATRICULADO: "--etapa-matriculado",
  EN_FORMACION: "--etapa-en-formacion",
  CERTIFICADO: "--etapa-certificado",
  PERDIDO: "--etapa-perdido",
  RETIRADO: "--etapa-retirado",
  NO_APROBO: "--etapa-no-aprobo",
};

/** Deja `--etapa` puesto para quien cuelgue debajo. */
export function estiloEtapa(etapa: Etapa): CSSProperties {
  return { ["--etapa"]: `var(${VARIABLE_ETAPA[etapa]})` } as CSSProperties;
}

/** Etiqueta con color. El texto va siempre: el color acompaña. */
export function PildoraEtapa({ etapa }: { etapa: Etapa }) {
  return (
    <span className="pildora-etapa" style={estiloEtapa(etapa)}>
      <span className="punto-etapa" aria-hidden />
      {ETIQUETA_ETAPA[etapa]}
    </span>
  );
}
