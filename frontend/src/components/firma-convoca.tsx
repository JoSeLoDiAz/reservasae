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
export function useEstado(): Estado | null {
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
  apilado = false,
  className,
}: {
  tamano?: number;
  conFrase?: boolean;
  /// El signo encima del nombre en vez de a su lado. Para el
  /// pie, donde la firma cierra la pagina centrada y en
  /// columna; al lado del nombre solo funciona cuando va
  /// alineada a un borde.
  apilado?: boolean;
  className?: string;
}) {
  /// El texto crece con el signo, no aparte.
  ///
  /// Un nombre de 1,05rem al lado de un signo de 56 px se lee
  /// como un pie de foto. El umbral son 44: por debajo es
  /// firma, por encima es cabecera.
  const grande = tamano >= 44;

  return (
    <span
      className={`flex ${
        apilado
          ? "flex-col items-center gap-2 text-center"
          : `items-center ${grande ? "gap-3.5" : "gap-2.5"}`
      } ${className ?? ""}`}
    >
      <SignoConvoca tamano={tamano} className="shrink-0" />
      <span
        className={`flex min-w-0 flex-col gap-0.5 leading-none ${
          apilado ? "items-center" : ""
        }`}
      >
        <span
          className={`font-bold tracking-tight ${
            grande ? "text-[1.75rem]" : "text-[1.05rem]"
          }`}
        >
          Convoca
        </span>
        {conFrase && (
          <span
            className={`leading-snug font-medium opacity-65 ${
              grande ? "text-[13px]" : "text-[10.5px]"
            }`}
          >
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
  const estado = useEstado();
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
