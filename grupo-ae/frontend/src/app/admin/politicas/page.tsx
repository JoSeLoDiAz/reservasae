"use client";

import { useCallback, useEffect, useState } from "react";

import { ANCHO_FORMULARIO, BloqueDeBanda, Rotulo } from "@/components/admin/bloques";
import { Cargando } from "@/components/admin/piezas";
import { Estado } from "@/components/admin/datos-del-negocio";
import { Boton, Campo, CLASE_CONTROL } from "@/components/admin/marco-admin";
import {
  AvisoDeSeccion,
  CabeceraDePantalla,
  Seccion,
} from "@/components/admin/secciones";
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
      "Sin este texto vigente no se puede publicar ningún formulario de empresas.",
  },
  {
    valor: "PARTICIPANTE",
    ayuda:
      "La acepta cada persona al dejar sus datos. Es la que autoriza el tratamiento " +
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
    return <Cargando />;
  }

  const sinTexto = cobertura.filter((c) => !c.reserva);

  return (
    <div className="flex min-h-0 grow flex-col">
      {/* «Habeas Data» y no «Políticas de datos».
          El menú y la miga dicen una cosa y el título decía
          otra, que es justo el lío que se acaba de arreglar en
          las dos pantallas hermanas de este módulo. Lo que la
          cosa ES lo explica la bajada, que para eso está. */}
      <CabeceraDePantalla
        titulo="Habeas Data"
        nota="El texto que la gente acepta. Se versiona: el que alguien ya aceptó no se cambia nunca, se publica uno nuevo."
      />

      {/* Los avisos van en una banda con su punto, no en una
          tarjeta teñida de rosa. Y el punto NO es rojo: en este
          panel el rojo dice «alguien lleva esperando respuesta»
          y nada más, así que un aviso de validación se lee por
          lo que escribe, no por el color de su fondo. */}
      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}
      {exito && <AvisoDeSeccion color="var(--exito)">{exito}</AvisoDeSeccion>}

      {sinTexto.length > 0 && (
        <AvisoDeSeccion color="var(--texto-suave)">
          <p className="text-titulo" style={{ fontWeight: 700 }}>
            {sinTexto.length === 1
              ? "Una unidad de negocio no puede publicar formularios"
              : `${sinTexto.length} unidades de negocio no pueden publicar formularios`}
          </p>
          <p className="mt-1 max-w-[68ch] text-texto-suave">
            Falta la política de datos de personas en{" "}
            {sinTexto.map((c) => c.convenio.sigla ?? c.convenio.nombre).join(" y ")}.
            Mientras no exista, publicar un formulario público se rechaza.
          </p>
        </AvisoDeSeccion>
      )}

      {cobertura.map((c) => (
        <Seccion key={c.convenio.id}>
          <div className="@container px-6 pt-5 pb-6">
            {/* La unidad de negocio es el rótulo de la banda, no
                una franja azul con su caja: cinco bandas azules
                apiladas se leían como cinco pantallas pegadas. */}
            <div className="flex flex-wrap items-baseline gap-x-3">
              <Rotulo>{c.convenio.sigla ?? c.convenio.nombre}</Rotulo>
              <span className="text-texto-suave" style={{ fontSize: "0.71875rem" }}>
                {c.convenio.nombre}
              </span>
            </div>

            {/* LAS DOS POLÍTICAS, UNA AL LADO DE LA OTRA.

                Son dos y siempre van a ser dos: la que acepta la
                empresa y la que acepta la persona. Se leen
                comparándolas —«¿cuál de las dos falta?», que es
                exactamente lo que bloquea publicar un
                formulario—, y apiladas esa comparación son dos
                pantallazos de desplazamiento con mil doscientos
                píxeles de blanco a la derecha de cada una.

                El texto es prosa y topa en 68 caracteres: no
                crece aunque haya ancho. Lo que hace el ancho
                sobrante es poner la segunda al lado, que es la
                otra respuesta legítima —dedicarlo a una segunda
                región útil— y no dejarlo en blanco.

                Cuando se está redactando, la que se escribe se
                lleva las dos columnas: un texto legal se escribe
                en el ancho que haya. */}
            <div className="mt-5 grid gap-x-10 gap-y-6 @[1100px]:grid-cols-2">
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
                  <section
                    key={d.valor}
                    className={`min-w-0 ${abierto ? "@[1100px]:col-span-2" : ""}`}
                  >
                    {/* El estado PEGADO a su título, no repartido
                        con `justify-between`: a 1920 eso lo
                        mandaba a la x 1890, a mil cuatrocientos
                        píxeles del texto cuyo estado dice. Es la
                        misma forma que usan Formularios y
                        Campañas —nombre, y el estado justo
                        detrás—. */}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3
                        className="text-titulo"
                        style={{ fontSize: "0.8125rem", fontWeight: 700 }}
                      >
                        {ETIQUETA_DESTINATARIO[d.valor]}
                      </h3>
                      {/* Vigente en verde —publicado, activo—; sin
                          publicar apagado. No en rojo: no publicar
                          todavía no es un error, es un estado. */}
                      <Estado tono={vigente ? "exito" : "apagado"}>
                        {vigente ? `Vigente · v${vigente.version}` : "Sin publicar"}
                      </Estado>
                    </div>

                    <p
                      className="mt-1.5 max-w-[68ch] text-texto-suave"
                      style={{ fontSize: "0.71875rem", lineHeight: 1.55 }}
                    >
                      {d.ayuda}
                    </p>

                    {vigente && (
                      <details className="mt-3">
                        <summary
                          className="cursor-pointer text-marca"
                          style={{ fontSize: "0.71875rem" }}
                        >
                          Ver el texto vigente
                          {vigente.aceptaciones > 0 &&
                            ` · lo han aceptado ${vigente.aceptaciones}`}
                        </summary>
                        {/* El texto legal retrocede a
                            `--superficie-alterna`: es el único
                            sub-bloque del panel que tiene que
                            pesar menos que lo que lo rodea. */}
                        <p
                          className="mt-2 max-w-[68ch] rounded-[6px] bg-superficie-alterna p-4 whitespace-pre-wrap"
                          style={{ fontSize: "0.8125rem", lineHeight: 1.55 }}
                        >
                          {vigente.contenido}
                        </p>
                      </details>
                    )}

                    {versiones.length > 1 && (
                      <p
                        className="mt-2 max-w-[68ch] text-texto-suave"
                        style={{ fontSize: "0.71875rem" }}
                      >
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
          </div>
        </Seccion>
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
    /// Sin marco propio: es un bloque dentro de una banda y ya
    /// está sangrado por ella. Tres marcos anidados para dos
    /// campos es lo que hacía que esta pantalla se viera cruda.
    <BloqueDeBanda>
      <div className={`${ANCHO_FORMULARIO} mt-4 space-y-4`}>
        <p className="max-w-[68ch] text-texto-suave" style={{ fontSize: "0.71875rem" }}>
          Se publicará como{" "}
          <strong className="font-normal text-texto">versión {siguiente}</strong> y
          cerrará la anterior. La anterior no se borra.
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
            className={`${CLASE_CONTROL} min-h-64`}
            style={{ fontSize: "0.8125rem", lineHeight: 1.55 }}
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
          />
        </Campo>

        {corto && contenido.length > 0 && (
          <p className="text-texto" style={{ fontSize: "0.71875rem" }}>
            Un texto legal de menos de 50 caracteres no es un texto legal.
          </p>
        )}

        <div className="flex items-end gap-4">
          <Boton
            onClick={() => alGuardar(titulo.trim(), contenido.trim())}
            disabled={!titulo.trim() || corto}
          >
            Publicar versión {siguiente}
          </Boton>
          <button
            onClick={alCancelar}
            className="text-texto-suave"
            style={{ fontSize: "0.71875rem" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </BloqueDeBanda>
  );
}
