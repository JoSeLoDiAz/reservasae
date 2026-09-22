"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import {
  aCuerpo,
  CamposDeLaPersona,
  personaEnBlanco,
  type DatosDeLaPersona,
} from "@/components/admin/campos-de-la-persona";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETIQUETA_ORIGEN,
  type Origen,
  type CatalogosSep,
} from "@/lib/crm-api";

type Convenio = { id: string; nombre: string; sigla: string | null; activo: boolean };

export default function PaginaNuevoParticipante() {
  const router = useRouter();
  const [convenios, setConvenios] = useState<Convenio[] | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /// Los datos de la persona son los MISMOS que los de su
  /// ficha: mismo tipo, mismos campos, mismo componente. Aquí
  /// estaban escritos aparte y eran diez de diecisiete, así
  /// que para dejar una ficha completa había que guardarla,
  /// abrirla y volver a editarla.
  const [p, setP] = useState<DatosDeLaPersona>(personaEnBlanco);

  const [f, setF] = useState({
    // 1 = cedula de ciudadania en el catalogo del SEP
    tipoDocumentoSepId: 1,
    numeroDocumento: "",
    convenioId: "",
    origen: "ASESOR" as Origen,
  });

  useEffect(() => {
    void adminApi
      .convenios()
      .then((lista) => {
        const activos = lista.filter((c) => c.activo);
        setConvenios(activos);
        if (activos.length === 1) {
          setF((v) => ({ ...v, convenioId: activos[0].id }));
        }
      })
      .catch((e) => setError((e as ErrorApi).message));

    // las listas del SEP, para los desplegables
    void crmApi
      .catalogos()
      .then(setCatalogos)
      .catch((e) => setError((e as ErrorApi).message));
  }, []);

  /// Lo mínimo sigue siendo lo mínimo: documento, nombre,
  /// apellido y convenio. Lo demás se puede llenar aquí o
  /// después, y exigirlo sería hacer el sistema más rígido
  /// que el proceso.
  const listo =
    f.numeroDocumento.trim().length >= 4 &&
    p.primerNombre.trim() &&
    p.primerApellido.trim() &&
    f.convenioId;

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      const creado = await crmApi.crear({
        tipoDocumentoSepId: f.tipoDocumentoSepId,
        numeroDocumento: f.numeroDocumento.trim(),
        convenioId: f.convenioId,
        origen: f.origen,
        ...aCuerpo(p),
        /// `aCuerpo` los deja opcionales porque al EDITAR una
        /// ficha un campo vacío quiere decir «no lo toques».
        /// Al crear son obligatorios y el DTO los exige, así
        /// que se mandan explícitos.
        primerNombre: p.primerNombre.trim(),
        primerApellido: p.primerApellido.trim(),
      });
      router.push(`/admin/participantes/${creado.id}`);
    } catch (e) {
      setError((e as ErrorApi).message);
      setGuardando(false);
    }
  }

  return (
    /// Sin `min-h-0 grow`: es un formulario, no scrollea nada de
    /// dentro. Ver `usuarios/page.tsx`.
    <div className="flex flex-col pb-3">
      <header className="border-b border-borde bg-superficie px-7 pt-[18px] pb-[22px]">
        <Link
          href="/admin/participantes"
          className="inline-flex items-center gap-1 text-[0.75rem] text-texto-suave transition hover:text-marca"
        >
          <span aria-hidden="true">&larr;</span> Gestión de leads
        </Link>
        <h1 className="mt-2 text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
          Inscribir a alguien
        </h1>
        <p className="mt-1 text-texto-suave">
          Con el documento y el nombre basta para empezar, pero aquí caben todos
          sus datos. La acción de formación y el grupo se asignan después, desde
          su lead.
        </p>
      </header>

      {error && (
        <div className="px-7 pt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <Tarjeta
        titulo="Quién es"
        descripcion="El documento identifica a la persona en todo el sistema: si ya está en otro curso, se reconoce sola. Lo que quede en blanco se puede completar después desde su lead."
      >
        <div className="space-y-4">
          <CamposDeLaPersona
            c={p}
            setC={setP}
            catalogos={catalogos}
            identidad={
              <>
                <Campo etiqueta="Tipo de documento">
                  <select
                    className={CLASE_CONTROL}
                    value={f.tipoDocumentoSepId}
                    onChange={(e) =>
                      setF({ ...f, tipoDocumentoSepId: Number(e.target.value) })
                    }
                  >
                    {(catalogos?.documentosPersona ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.etiqueta}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo etiqueta="Número de documento">
                  <input
                    className={CLASE_CONTROL}
                    value={f.numeroDocumento}
                    onChange={(e) =>
                      setF({ ...f, numeroDocumento: e.target.value })
                    }
                    placeholder="1019456782"
                    inputMode="numeric"
                  />
                </Campo>
              </>
            }
          />

          <p className="text-xs text-texto-suave">
            Los nombres van en cuatro casillas porque el cargue al SENA los pide
            separados, y partir «María del Carmen de la Hoz» por espacios se
            equivoca siempre.
          </p>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="De dónde viene"
        descripcion="El convenio decide quién la ve y a qué catálogo pertenece. No se cambia después."
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-7 gap-y-4">
          <Campo etiqueta="Convenio">
            <select
              className={CLASE_CONTROL}
              value={f.convenioId}
              onChange={(e) => setF({ ...f, convenioId: e.target.value })}
            >
              <option value="">Elija uno</option>
              {(convenios ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sigla ?? c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Origen">
            <select
              className={CLASE_CONTROL}
              value={f.origen}
              onChange={(e) => setF({ ...f, origen: e.target.value as Origen })}
            >
              {Object.entries(ETIQUETA_ORIGEN).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Tarjeta>

      <div className="flex items-center gap-4 px-7 py-5">
        <Boton onClick={guardar} disabled={!listo || guardando}>
          {guardando ? "Guardando…" : "Inscribir"}
        </Boton>
        <Link
          href="/admin/participantes"
          className="text-[0.78125rem] text-texto-suave underline-offset-2 transition hover:text-marca hover:underline"
        >
          Cancelar
        </Link>
      </div>
    </div>
  );
}
