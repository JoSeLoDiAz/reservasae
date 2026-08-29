import type { CSSProperties } from "react";

import { ETIQUETA_ETAPA, type Etapa } from "@/lib/crm-api";

/** El token de color que el admin edita en Apariencia. */
const VARIABLE_ETAPA: Record<Etapa, string> = {
  INTERESADO: "--etapa-interesado",
  CONTACTADO: "--etapa-contactado",
  DATOS_COMPLETOS: "--etapa-datos-completos",
  INSCRITO: "--etapa-inscrito",
  EN_FORMACION: "--etapa-en-formacion",
  CERTIFICADO: "--etapa-certificado",
  PERDIDO: "--etapa-perdido",
  RETIRADO: "--etapa-retirado",
  NO_APROBO: "--etapa-no-aprobo",
  DESERTO: "--etapa-deserto",
  ABANDONO: "--etapa-abandono",
};

/** El color de una etapa, ya envuelto en `var()`. */
export function colorEtapa(etapa: Etapa): string {
  return `var(${VARIABLE_ETAPA[etapa]})`;
}

/** Deja `--etapa` puesto para quien cuelgue debajo. */
export function estiloEtapa(etapa: Etapa): CSSProperties {
  return { ["--etapa"]: colorEtapa(etapa) } as CSSProperties;
}

/** Etiqueta con color. El texto va siempre: el color acompaña. */
export function PildoraEtapa({ etapa }: { etapa: Etapa }) {
  return (
    <span className="pildora-etapa" style={estiloEtapa(etapa)}>
      {ETIQUETA_ETAPA[etapa]}
    </span>
  );
}
