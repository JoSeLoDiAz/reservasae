"use client";

/** Nuevo contacto: apuntar a mano a alguien que no llegó por un formulario. */

/**
 * La pantalla hermana de «Inscribir a alguien» en Convoca, traída al
 * negocio de Grupo AE.
 *
 * Allí se inscribe a una persona en una formación, con los datos que
 * pide el SENA. Aquí no hay formación ni reporte: hay una persona, la
 * organización donde trabaja y un NEGOCIO que abrir con ella. Por eso
 * se quitó todo lo del SEP —género, domicilio, caracterización— y se
 * añadió lo que un vendedor de licencias sí necesita: la organización,
 * el cargo y a quién se le vende.
 *
 * Guardar NO crea una ficha de formación. Crea —o reconoce, por el
 * documento— a la persona, y le abre un negocio en «Solicitud de
 * negocio» en el embudo que se elija, que es lo único que este CRM
 * enseña en sus listas. Si ya había un negocio vivo con ella, no se
 * abre otro: se anota ahí lo que se supo hoy. El porqué entero está en
 * el backend, en `crm/contacto-nuevo.ts`.
 *
 * Lo mínimo es lo mínimo: documento, nombre, apellido y un correo o un
 * celular. Lo demás ayuda, pero exigirlo sería hacer el sistema más
 * rígido que la llamada en la que se consiguió el contacto.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { Rotulo } from "@/components/admin/bloques";
import { Boton, Campo, CLASE_CONTROL, useAdmin } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { AvisoDeSeccion, CabeceraDePantalla, Seccion } from "@/components/admin/secciones";
import { alcanza } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import {
  CANALES_A_MANO,
  contactosApi,
  type CanalAMano,
  type OpcionesDeContacto,
  type ResultadoDelContacto,
} from "@/lib/contactos-api";
import { ETIQUETA_ORIGEN, type Origen } from "@/lib/crm-api";
import type { TipoEmbudo } from "@/lib/oportunidades-api";

/// La rejilla de campos. Se reparte sola por el ancho y a 360 px
/// queda en una columna, sin que nada se salga de lado.
const REJILLA = "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-7 gap-y-4";

type Formulario = {
  convenioId: string;
  tipoDocumentoSepId: number;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  correo: string;
  celular: string;
  organizacion: string;
  nit: string;
  cargo: string;
  embudo: TipoEmbudo;
  interes: string;
  origen: Origen;
  autorizo: boolean;
  canalAutorizacion: CanalAMano;
  nota: string;
};

/// 1 = cédula de ciudadanía, la que trae casi todo el mundo.
const EN_BLANCO: Formulario = {
  convenioId: "",
  tipoDocumentoSepId: 1,
  numeroDocumento: "",
  primerNombre: "",
  segundoNombre: "",
  primerApellido: "",
  segundoApellido: "",
  correo: "",
  celular: "",
  organizacion: "",
  nit: "",
  cargo: "",
  embudo: "PERSONA",
  interes: "",
  origen: "ASESOR",
  autorizo: false,
  canalAutorizacion: "VERBAL_ASESOR",
  nota: "",
};

/// Lo vacío no viaja: el servidor distingue «no lo mandó» de «lo
/// mandó en blanco», y un "" en el correo sería lo segundo.
const oNada = (v: string) => (v.trim() ? v.trim() : undefined);

const RUTA_DEL_EMBUDO: Record<TipoEmbudo, { href: string; rotulo: string }> = {
  PERSONA: { href: "/admin/leads/personas", rotulo: "Leads de personas" },
  EMPRESA: { href: "/admin/leads/empresas", rotulo: "Leads de empresas" },
};

export default function PaginaNuevoContacto() {
  const { admin, gremio } = useAdmin();
  /// El mismo permiso que pide el servidor: sin escribir en Gestión
  /// de leads, el formulario solo serviría para fallar al guardar.
  const puedeCrear =
    admin.rol === "SUPERADMIN" || alcanza(admin.permisos?.inscripciones, "ESCRIBIR");

  const [opciones, setOpciones] = useState<OpcionesDeContacto | null>(null);
  const [f, setF] = useState<Formulario>(EN_BLANCO);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState<ResultadoDelContacto | null>(null);

  useEffect(() => {
    if (!puedeCrear) return;
    void contactosApi
      .opciones()
      .then((o) => {
        setOpciones(o);
        /// Si solo hay una línea, o la de arriba ya está elegida, no
        /// se le pregunta: sería un desplegable de una sola opción.
        const deArriba = o.lineas.find((l) => l.id === gremio);
        const sola = o.lineas.length === 1 ? o.lineas[0] : null;
        const cual = deArriba ?? sola;
        if (cual) setF((v) => ({ ...v, convenioId: cual.id }));
      })
      .catch((e) =>
        setError(e instanceof ErrorApi ? e.message : "No pudimos preparar el formulario."),
      );
  }, [puedeCrear, gremio]);

  const cambiar = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setF((v) => ({ ...v, [clave]: valor }));

  const aLaOrganizacion = f.embudo === "EMPRESA";

  /// Lo que falta, en palabras, para que el botón no sea un
  /// misterio cuando está apagado.
  const falta: string[] = [];
  if (!f.convenioId) falta.push("la línea de negocio");
  if (f.numeroDocumento.trim().length < 4) falta.push("el documento");
  if (!f.primerNombre.trim()) falta.push("el primer nombre");
  if (!f.primerApellido.trim()) falta.push("el primer apellido");
  if (!f.correo.trim() && !f.celular.trim()) falta.push("un correo o un celular");
  if (aLaOrganizacion && !f.organizacion.trim()) falta.push("el nombre de la organización");
  if (aLaOrganizacion && !f.nit.trim()) falta.push("el NIT de la organización");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (falta.length > 0 || guardando) return;
    setError(null);
    setGuardando(true);
    try {
      const resultado = await contactosApi.crear({
        convenioId: f.convenioId,
        tipoDocumentoSepId: f.tipoDocumentoSepId,
        numeroDocumento: f.numeroDocumento.trim(),
        primerNombre: f.primerNombre.trim(),
        segundoNombre: oNada(f.segundoNombre),
        primerApellido: f.primerApellido.trim(),
        segundoApellido: oNada(f.segundoApellido),
        correo: oNada(f.correo),
        celular: oNada(f.celular),
        organizacion: oNada(f.organizacion),
        nit: oNada(f.nit),
        cargo: oNada(f.cargo),
        embudo: f.embudo,
        interes: oNada(f.interes),
        origen: f.origen,
        autorizo: f.autorizo,
        canalAutorizacion: f.autorizo ? f.canalAutorizacion : undefined,
        nota: oNada(f.nota),
      });
      setHecho(resultado);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No pudimos guardar el contacto.");
    } finally {
      setGuardando(false);
    }
  }

  /// Otro contacto, conservando lo que suele repetirse en una
  /// jornada: la línea de negocio y el canal por el que llegan.
  function otro() {
    setF((v) => ({ ...EN_BLANCO, convenioId: v.convenioId, origen: v.origen }));
    setHecho(null);
    setError(null);
  }

  const cabecera = (
    <CabeceraDePantalla
      titulo="Nuevo contacto"
      volver={{ href: "/admin/leads/personas", texto: "Leads de personas" }}
      nota="Para quien no llegó por un formulario: lo conoció en una feria, llamó a preguntar o se lo refirió un cliente. Queda como un negocio en «Solicitud de negocio», listo para trabajarlo."
    />
  );

  if (!puedeCrear) {
    return (
      <div className="flex flex-col pb-3">
        {cabecera}
        <AvisoDeSeccion color="var(--texto-suave)">
          Su cuenta puede consultar los leads, pero no crear contactos. Pídale a quien
          administra los usuarios el permiso de escritura en Gestión de leads.
        </AvisoDeSeccion>
      </div>
    );
  }

  if (hecho) {
    const destino = RUTA_DEL_EMBUDO[hecho.oportunidad.embudo];
    return (
      <div className="flex flex-col pb-3">
        {cabecera}
        <AvisoDeSeccion color="var(--exito)">
          {hecho.que === "CREADO" && (
            <>
              Listo: el negocio <strong>{hecho.oportunidad.codigo}</strong> quedó en{" "}
              {destino.rotulo}, en «Solicitud de negocio», con una tarea para contactarlo hoy.
            </>
          )}
          {hecho.que === "ANOTADO" && (
            <>
              Esta persona ya tenía un negocio abierto,{" "}
              <strong>{hecho.oportunidad.codigo}</strong>. No se abrió otro para que no la
              llamen dos asesores: lo que escribió quedó anotado en ese.
            </>
          )}
          {hecho.que === "YA_ESTABA" && (
            <>
              Este contacto ya se había guardado hace un momento como{" "}
              <strong>{hecho.oportunidad.codigo}</strong>. No se creó nada nuevo.
            </>
          )}
        </AvisoDeSeccion>

        {hecho.que === "CREADO" && !hecho.asignadoAQuienLoCreo && (
          <AvisoDeSeccion color="var(--texto-suave)">
            Quedó sin asesor, porque su cuenta no tiene rol comercial en esa línea de
            negocio. Asígneselo a alguien desde la lista.
          </AvisoDeSeccion>
        )}
        {hecho.loQueNoSePiso.length > 0 && (
          <AvisoDeSeccion color="var(--texto-suave)">
            Esta persona ya estaba en el CRM y se conservaron sus datos. No se guardó{" "}
            {hecho.loQueNoSePiso.join(", ")}: confírmelo con ella antes de cambiarlo.
          </AvisoDeSeccion>
        )}
        {hecho.constancia === "SIN_POLITICA" && (
          <AvisoDeSeccion color="var(--texto-suave)">
            La autorización de datos no quedó registrada: esta línea de negocio no tiene
            política publicada. Publíquela en Habeas Data y vuelva a pedírsela.
          </AvisoDeSeccion>
        )}
        {hecho.constancia === "NO_DIJO" && (
          <AvisoDeSeccion color="var(--texto-suave)">
            Falta su autorización para el tratamiento de datos. Quedó apuntado en la tarea
            para pedírsela en la primera llamada.
          </AvisoDeSeccion>
        )}

        <div className="flex flex-wrap items-center gap-4 px-6 py-5">
          <Link
            href={destino.href}
            className="text-marca underline-offset-2 hover:underline"
          >
            Ir a {destino.rotulo}
          </Link>
          <Boton type="button" onClick={otro}>
            Crear otro contacto
          </Boton>
        </div>
      </div>
    );
  }

  return (
    /// Sin `min-h-0 grow`: es un formulario, no scrollea nada por
    /// dentro. Lo mismo que «Inscribir a alguien» en Convoca.
    <form className="flex flex-col pb-3" onSubmit={guardar} noValidate>
      {cabecera}

      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}

      {!opciones && !error && (
        <Seccion>
          <div className="px-6 py-8">
            <Cargando que="Preparando el formulario…" />
          </div>
        </Seccion>
      )}

      {opciones && opciones.lineas.length === 0 && (
        <AvisoDeSeccion color="var(--texto-suave)">
          Su cuenta no tiene ninguna línea de negocio activa en la que pueda crear
          contactos.
        </AvisoDeSeccion>
      )}

      {opciones && opciones.lineas.length > 0 && (
        <>
          <Seccion>
            <div className="px-6 pt-5 pb-6">
              <Rotulo>Quién es</Rotulo>
              <p className="secundario prosa mt-1">
                El documento la identifica en todo el CRM: si ya estaba, se reconoce sola y
                no se duplica.
              </p>
              <div className={`${REJILLA} mt-4`}>
                <Campo etiqueta="Tipo de documento">
                  <select
                    className={CLASE_CONTROL}
                    value={f.tipoDocumentoSepId}
                    onChange={(e) => cambiar("tipoDocumentoSepId", Number(e.target.value))}
                  >
                    {opciones.tiposDeDocumento.map((t) => (
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
                    onChange={(e) => cambiar("numeroDocumento", e.target.value)}
                    placeholder="1019456782"
                    inputMode={f.tipoDocumentoSepId === 1 ? "numeric" : "text"}
                    autoComplete="off"
                  />
                </Campo>
                <Campo etiqueta="Primer nombre">
                  <input
                    className={CLASE_CONTROL}
                    value={f.primerNombre}
                    onChange={(e) => cambiar("primerNombre", e.target.value)}
                    autoComplete="off"
                  />
                </Campo>
                <Campo etiqueta="Segundo nombre">
                  <input
                    className={CLASE_CONTROL}
                    value={f.segundoNombre}
                    onChange={(e) => cambiar("segundoNombre", e.target.value)}
                    autoComplete="off"
                  />
                </Campo>
                <Campo etiqueta="Primer apellido">
                  <input
                    className={CLASE_CONTROL}
                    value={f.primerApellido}
                    onChange={(e) => cambiar("primerApellido", e.target.value)}
                    autoComplete="off"
                  />
                </Campo>
                <Campo etiqueta="Segundo apellido">
                  <input
                    className={CLASE_CONTROL}
                    value={f.segundoApellido}
                    onChange={(e) => cambiar("segundoApellido", e.target.value)}
                    autoComplete="off"
                  />
                </Campo>
              </div>
            </div>
          </Seccion>

          <Seccion>
            <div className="px-6 pt-5 pb-6">
              <Rotulo>Cómo contactarlo</Rotulo>
              <p className="secundario prosa mt-1">
                Con uno de los dos basta. El celular tiene que ser de diez dígitos y empezar
                por 3: un fijo no recibe WhatsApp.
              </p>
              <div className={`${REJILLA} mt-4`}>
                <Campo etiqueta="Correo">
                  <input
                    className={CLASE_CONTROL}
                    type="email"
                    value={f.correo}
                    onChange={(e) => cambiar("correo", e.target.value)}
                    placeholder="nombre@organizacion.com"
                    autoComplete="off"
                  />
                </Campo>
                <Campo etiqueta="Celular">
                  <input
                    className={CLASE_CONTROL}
                    type="tel"
                    value={f.celular}
                    onChange={(e) => cambiar("celular", e.target.value)}
                    placeholder="300 111 2222"
                    inputMode="tel"
                    autoComplete="off"
                  />
                </Campo>
              </div>
            </div>
          </Seccion>

          <Seccion>
            <div className="px-6 pt-5 pb-6">
              <Rotulo>Dónde trabaja</Rotulo>
              <p className="secundario prosa mt-1">
                Si se le vende a la persona, esto queda en la tarea del negocio para leerlo
                antes de llamar. Si se le vende a su organización, el NIT es obligatorio.
              </p>
              <div className={`${REJILLA} mt-4`}>
                <Campo etiqueta="Organización">
                  <input
                    className={CLASE_CONTROL}
                    value={f.organizacion}
                    onChange={(e) => cambiar("organizacion", e.target.value)}
                    placeholder="Colegio San Bartolomé"
                    autoComplete="off"
                  />
                </Campo>
                <Campo etiqueta="NIT" ayuda="Con o sin dígito de verificación.">
                  <input
                    className={CLASE_CONTROL}
                    value={f.nit}
                    onChange={(e) => cambiar("nit", e.target.value)}
                    placeholder="860007322-1"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </Campo>
                <Campo etiqueta="Cargo">
                  <input
                    className={CLASE_CONTROL}
                    value={f.cargo}
                    onChange={(e) => cambiar("cargo", e.target.value)}
                    placeholder="Coordinador de tecnología"
                    autoComplete="off"
                  />
                </Campo>
              </div>
            </div>
          </Seccion>

          <Seccion>
            <div className="px-6 pt-5 pb-6">
              <Rotulo>El negocio</Rotulo>
              <fieldset className="mt-3">
                <legend className="rotulo-bloque mb-1.5 block">¿A quién se le vende?</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="embudo"
                      checked={f.embudo === "PERSONA"}
                      onChange={() => cambiar("embudo", "PERSONA")}
                    />
                    A la persona (Leads de personas)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="embudo"
                      checked={f.embudo === "EMPRESA"}
                      onChange={() => cambiar("embudo", "EMPRESA")}
                    />
                    A su organización (Leads de empresas)
                  </label>
                </div>
              </fieldset>

              <div className={`${REJILLA} mt-4`}>
                <Campo
                  etiqueta="Qué le interesa"
                  ayuda="Si todavía no lo sabe, déjelo en blanco y cámbielo desde el negocio."
                >
                  <input
                    className={CLASE_CONTROL}
                    value={f.interes}
                    onChange={(e) => cambiar("interes", e.target.value)}
                    placeholder="Google Workspace para 40 personas"
                    maxLength={160}
                    autoComplete="off"
                  />
                </Campo>
                {opciones.lineas.length > 1 && (
                  <Campo etiqueta="Línea de negocio">
                    <select
                      className={CLASE_CONTROL}
                      value={f.convenioId}
                      onChange={(e) => cambiar("convenioId", e.target.value)}
                    >
                      <option value="">Elija una</option>
                      {opciones.lineas.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.sigla ?? l.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                )}
                <Campo etiqueta="Cómo llegó">
                  <select
                    className={CLASE_CONTROL}
                    value={f.origen}
                    onChange={(e) => cambiar("origen", e.target.value as Origen)}
                  >
                    {(Object.entries(ETIQUETA_ORIGEN) as Array<[Origen, string]>).map(
                      ([valor, rotulo]) => (
                        <option key={valor} value={valor}>
                          {rotulo}
                        </option>
                      ),
                    )}
                  </select>
                </Campo>
              </div>

              <div className="mt-4">
                <Campo etiqueta="Nota" ayuda="Dónde se conocieron, qué preguntó, cuándo volver a llamar.">
                  <textarea
                    className={CLASE_CONTROL}
                    rows={3}
                    value={f.nota}
                    onChange={(e) => cambiar("nota", e.target.value)}
                    maxLength={1000}
                  />
                </Campo>
              </div>
            </div>
          </Seccion>

          <Seccion>
            <div className="px-6 pt-5 pb-6">
              <Rotulo>Autorización de datos</Rotulo>
              <p className="secundario prosa mt-1">
                La Ley 1581 pide poder demostrar que la persona autorizó el tratamiento de sus
                datos. Márquelo solo si ya lo hizo; si no, el negocio queda con la tarea de
                pedírsela.
              </p>
              <label className="mt-3 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={f.autorizo}
                  onChange={(e) => cambiar("autorizo", e.target.checked)}
                />
                Autorizó el tratamiento de sus datos personales
              </label>
              {f.autorizo && (
                <div className={`${REJILLA} mt-4`}>
                  <Campo etiqueta="Cómo lo autorizó">
                    <select
                      className={CLASE_CONTROL}
                      value={f.canalAutorizacion}
                      onChange={(e) => cambiar("canalAutorizacion", e.target.value as CanalAMano)}
                    >
                      {CANALES_A_MANO.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.rotulo}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
              )}
            </div>
          </Seccion>

          <div className="flex flex-wrap items-center gap-4 px-6 py-5">
            <Boton type="submit" disabled={falta.length > 0 || guardando}>
              {guardando ? "Guardando…" : "Crear contacto"}
            </Boton>
            <Link
              href="/admin/leads/personas"
              className="text-texto-suave underline-offset-2 transition hover:text-marca hover:underline"
            >
              Cancelar
            </Link>
            {falta.length > 0 && (
              <p className="secundario" role="status">
                Falta {falta.join(", ")}.
              </p>
            )}
          </div>
        </>
      )}
    </form>
  );
}
