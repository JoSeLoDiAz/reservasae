"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
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

  const [f, setF] = useState({
    // 1 = cedula de ciudadania en el catalogo del SEP
    tipoDocumentoSepId: 1,
    numeroDocumento: "",
    primerNombre: "",
    segundoNombre: "",
    primerApellido: "",
    segundoApellido: "",
    correo: "",
    celular: "",
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

  const listo =
    f.numeroDocumento.trim().length >= 4 &&
    f.primerNombre.trim() &&
    f.primerApellido.trim() &&
    f.convenioId;

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      const creado = await crmApi.crear({
        tipoDocumentoSepId: f.tipoDocumentoSepId,
        numeroDocumento: f.numeroDocumento.trim(),
        primerNombre: f.primerNombre.trim(),
        segundoNombre: f.segundoNombre.trim() || undefined,
        primerApellido: f.primerApellido.trim(),
        segundoApellido: f.segundoApellido.trim() || undefined,
        correo: f.correo.trim() || undefined,
        celular: f.celular.trim() || undefined,
        convenioId: f.convenioId,
        origen: f.origen,
      });
      router.push(`/admin/participantes/${creado.id}`);
    } catch (e) {
      setError((e as ErrorApi).message);
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Inscribir a alguien</h1>
        <p className="mt-1 text-texto-suave">
          Con el documento y el nombre basta para empezar. La acción de formación y el
          grupo se asignan después, desde su ficha.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta
        titulo="Quién es"
        descripcion="El documento identifica a la persona en todo el sistema: si ya está en otro curso, se reconoce sola."
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-[1fr_1.4fr]">
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

            <Campo etiqueta="Número">
              <input
                className={CLASE_CONTROL}
                value={f.numeroDocumento}
                onChange={(e) => setF({ ...f, numeroDocumento: e.target.value })}
                placeholder="1019456782"
                inputMode="numeric"
              />
            </Campo>
          </div>

          <div className="grid sm:grid-cols-2">
            <Campo etiqueta="Primer nombre">
              <input
                className={CLASE_CONTROL}
                value={f.primerNombre}
                onChange={(e) => setF({ ...f, primerNombre: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Segundo nombre">
              <input
                className={CLASE_CONTROL}
                value={f.segundoNombre}
                onChange={(e) => setF({ ...f, segundoNombre: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Primer apellido">
              <input
                className={CLASE_CONTROL}
                value={f.primerApellido}
                onChange={(e) => setF({ ...f, primerApellido: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Segundo apellido">
              <input
                className={CLASE_CONTROL}
                value={f.segundoApellido}
                onChange={(e) => setF({ ...f, segundoApellido: e.target.value })}
              />
            </Campo>
          </div>

          <p className="text-xs text-texto-suave">
            Van en cuatro casillas porque el cargue al SENA los pide separados, y partir
            «María del Carmen de la Hoz» por espacios se equivoca siempre.
          </p>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Cómo contactarla"
        descripcion="Hace falta al menos uno de los dos para poder matricularla."
      >
        <div className="grid sm:grid-cols-2">
          <Campo etiqueta="Correo">
            <input
              className={CLASE_CONTROL}
              value={f.correo}
              onChange={(e) => setF({ ...f, correo: e.target.value })}
              inputMode="email"
            />
          </Campo>
          <Campo etiqueta="Celular">
            <input
              className={CLASE_CONTROL}
              value={f.celular}
              onChange={(e) => setF({ ...f, celular: e.target.value })}
              inputMode="tel"
            />
          </Campo>
        </div>
      </Tarjeta>

      <Tarjeta titulo="De dónde viene">
        <div className="grid sm:grid-cols-2">
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

      <div className="flex items-center gap-4">
        <Boton onClick={guardar} disabled={!listo || guardando}>
          {guardando ? "Guardando…" : "Inscribir"}
        </Boton>
        <button onClick={() => router.back()} className="underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
