"use client";

/** La firma del producto: el signo, el nombre y la frase. */

/**
 * Vive aquí y no repetida en cada pantalla porque aparece en
 * cuatro sitios —la barra del panel, el login, el pie de los
 * formularios públicos y la ficha del perfil— y una firma que
 * se escribe cuatro veces acaba diciendo cuatro cosas.
 *
 * El año y la versión salen de `/api/estado`, que es pública.
 * El año se toma del reloj DEL SERVIDOR y no del navegador: en
 * un componente que se pinta en los dos lados, `new Date()`
 * puede dar años distintos y eso rompe la hidratación en
 * Nochevieja, que es justo el día en que nadie lo va a mirar.
 */

import { useEffect, useState } from "react";

import { SignoConvoca } from "@/components/admin/signo-convoca";

const FRASE = "Relaciones que generan resultados";

type Estado = { version: string; hora: string };

/** La versión y el año, del servidor. */
export function usarEstado(): Estado | null {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let vivo = true;
    void fetch("/api/estado")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // si no responde, la firma sale sin version
        if (vivo && d?.version) setEstado({ version: d.version, hora: d.hora });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}

/** El signo con el nombre y, si cabe, la frase. */
export function FirmaConvoca({
  tamano = 32,
  conFrase = true,
  className,
}: {
  tamano?: number;
  conFrase?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <SignoConvoca tamano={tamano} className="shrink-0" />
      <span className="flex min-w-0 flex-col gap-0.5 leading-none">
        <span className="text-[1.05rem] font-bold tracking-tight">Convoca</span>
        {conFrase && (
          <span className="text-[10.5px] leading-snug font-medium opacity-65">
            {FRASE}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * La línea legal: quién lo gestiona, el año y la versión.
 *
 * La versión va aquí y no en una constante del código porque
 * `/api/estado` la saca del `package.json` del backend: es la
 * que de verdad está corriendo, no la que alguien recordó
 * escribir. Y en pruebas trae el sufijo, así que la pantalla
 * dice sola en qué entorno está.
 */
export function PieDeConvoca({ className }: { className?: string }) {
  const estado = usarEstado();
  const ano = estado ? new Date(estado.hora).getFullYear() : null;

  return (
    <p className={`text-[11px] leading-relaxed opacity-60 ${className ?? ""}`}>
      Gestionado por <strong className="font-semibold">Grupo AE</strong>
      {ano ? ` · © ${ano}, todos los derechos reservados` : ""}
      {estado ? (
        <>
          {" · "}
          <span className="font-mono">Convoca {estado.version}</span>
        </>
      ) : null}
    </p>
  );
}
