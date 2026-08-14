"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
import {
  ETIQUETA_DESTINATARIO,
  politicasApi,
  type Cobertura,
  type Destinatario,
  type Politica,
} from "@/lib/politicas-api";

const DESTINATARIOS: Array<{ valor: Destinatario; ayuda: string }> = [
  {
    valor: "RESERVA",
    ayuda:
      "La acepta quien diligencia el formulario en nombre de su organización. " +
      "Sin este texto vigente no se puede publicar ninguna acción de formación.",
  },
  {
    valor: "PARTICIPANTE",
    ayuda:
      "La acepta cada persona al inscribirse. Es la que autoriza el tratamiento " +
      "de sus datos: una empresa no puede autorizarlo por sus empleados.",
  },
];

export default function PaginaPoliticas() {
  const [politicas, setPoliticas] = useState<Politica[] | null>(null);
  const [cobertura, setCobertura] = useState<Cobertura[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [redactando, setRedactando] = useState<{
    convenioId: string;
    destinatario: Destinatario;
  } | null>(null);

  const cargar = useCallback(async () => {
    const [lista, cob] = await Promise.all([
      politicasApi.listar(),
      politicasApi.cobertura(),
    ]);
    setPoliticas(lista);
    setCobertura(cob);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function conError(accion: () => Promise<void>) {
    setError(null);
    setExito(null);
    try {
      await accion();
      await cargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }

  if (!politicas || !cobertura) {
    return <p className="text-texto-suave">Cargando…</p>;
  }

  const sinTexto = cobertura.filter((c) => !c.reserva);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Políticas de datos</h1>
        <p className="mt-1 text-texto-suave">
          El texto que la gente acepta. Se versiona: el que alguien ya aceptó no se
          cambia nunca, se publica uno nuevo.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="exito">{exito}</Aviso>}

      {sinTexto.length > 0 && (
        <Aviso tipo="error">
          <p className="font-medium">
            {sinTexto.length === 1
              ? "Un convenio no puede publicar formación"
              : `${sinTexto.length} convenios no pueden publicar formación`}
          </p>
          <p className="mt-1">
            Falta la política de preinscripción en{" "}
            {sinTexto.map((c) => c.convenio.sigla ?? c.convenio.nombre).join(" y ")}.
            Mientras no exista, publicar una acción de formación se rechaza.
          </p>
        </Aviso>
      )}

      {cobertura.map((c) => (
        <Tarjeta
          key={c.convenio.id}
          titulo={c.convenio.sigla ?? c.convenio.nombre}
          descripcion={c.convenio.nombre}
        >
          <div className="space-y-6">
            {DESTINATARIOS.map((d) => {
              const versiones = politicas
                .filter(
                  (p) =>
                    p.convenio.id === c.convenio.id && p.destinatario === d.valor,
                )
                .sort((a, b) => b.version - a.version);
              const vigente = versiones.find((v) => v.vigente) ?? null;
              const abierto =
                redactando?.convenioId === c.convenio.id &&
                redactando.destinatario === d.valor;

              return (
                <section key={d.valor} className="border-t border-borde pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">
                        {ETIQUETA_DESTINATARIO[d.valor]}
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-texto-suave">
                        {d.ayuda}
                      </p>
                    </div>
                    <span
                      className={
                        vigente
                          ? "rounded-full bg-exito-suave px-3 py-1 text-sm"
                          : "rounded-full bg-error-suave px-3 py-1 text-sm"
                      }
                    >
                      {vigente ? `Vigente · v${vigente.version}` : "Sin publicar"}
                    </span>
                  </div>

                  {vigente && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-texto-suave">
                        Ver el texto vigente
                        {vigente.aceptaciones > 0 &&
                          ` · lo han aceptado ${vigente.aceptaciones}`}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap rounded-md bg-superficie-alterna p-4 text-sm">
                        {vigente.contenido}
                      </p>
                    </details>
                  )}

                  {versiones.length > 1 && (
                    <p className="mt-2 text-sm text-texto-suave">
                      Hay {versiones.length} versiones. Las anteriores se conservan
                      porque son la prueba de lo que cada persona leyó.
                    </p>
                  )}

                  {abierto ? (
                    <Redactor
                      titulo={vigente?.titulo ?? ""}
                      contenido={vigente?.contenido ?? ""}
                      siguiente={(versiones[0]?.version ?? 0) + 1}
                      alCancelar={() => setRedactando(null)}
                      alGuardar={(titulo, contenido) =>
                        conError(async () => {
                          await politicasApi.crear({
                            convenioId: c.convenio.id,
                            destinatario: d.valor,
                            titulo,
                            contenido,
                          });
                          setRedactando(null);
                          setExito(
                            `Publicada la versión ${(versiones[0]?.version ?? 0) + 1}.`,
                          );
                        })
                      }
                    />
                  ) : (
                    <div className="mt-3">
                      <Boton
                        onClick={() =>
                          setRedactando({
                            convenioId: c.convenio.id,
                            destinatario: d.valor,
                          })
                        }
                      >
                        {vigente ? "Publicar una versión nueva" : "Escribir el texto"}
                      </Boton>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}

function Redactor({
  titulo: tituloInicial,
  contenido: contenidoInicial,
  siguiente,
  alGuardar,
  alCancelar,
}: {
  titulo: string;
  contenido: string;
  siguiente: number;
  alGuardar: (titulo: string, contenido: string) => void;
  alCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(tituloInicial);
  const [contenido, setContenido] = useState(contenidoInicial);

  const corto = contenido.trim().length < 50;

  return (
    <div className="mt-4 space-y-4 rounded-md border border-borde p-4">
      <p className="text-sm text-texto-suave">
        Se publicará como <strong>versión {siguiente}</strong> y cerrará la anterior.
        La anterior no se borra.
      </p>

      <Campo etiqueta="Título">
        <input
          className={CLASE_CONTROL}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Términos y Condiciones — Habeas Data"
        />
      </Campo>

      <Campo
        etiqueta="Texto completo"
        ayuda="Es lo que la persona va a leer y aceptar. Se guarda tal cual."
      >
        <textarea
          className={`${CLASE_CONTROL} min-h-64 font-mono text-sm`}
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
        />
      </Campo>

      {corto && contenido.length > 0 && (
        <p className="text-sm text-error">
          Un texto legal de menos de 50 caracteres no es un texto legal.
        </p>
      )}

      <div className="flex gap-3">
        <Boton
          onClick={() => alGuardar(titulo.trim(), contenido.trim())}
          disabled={!titulo.trim() || corto}
        >
          Publicar versión {siguiente}
        </Boton>
        <button onClick={alCancelar} className="underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
