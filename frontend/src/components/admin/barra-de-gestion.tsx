"use client";

/** La barra oscura de la ficha: lo único que cambia el estado. */

/// Es una sola pieza y no tres controles sueltos, y eso es a
/// propósito. Antes cada uno guardaba por su cuenta —«Asignar»
/// para el asesor, «Guardar» para la acción— y en la barra
/// salían dos botones apretados entre los campos. El diseño
/// pide UN botón, «Guardar gestión», y para eso el estado de
/// los tres tiene que vivir en el mismo sitio.
///
/// Los colores van literales del archivo de diseño. Están
/// juntos arriba para poder compararlos de un vistazo contra
/// el original, que es como se comprueba que son iguales.

import { useState } from "react";

import {
  crmApi,
  ETAPAS_A_MANO,
  ETAPAS_SALIDA,
  ETIQUETA_ETAPA,
  type Etapa,
  type Ficha,
  type Opciones,
} from "@/lib/crm-api";

const D = {
  barra: {
    background: "#0f172a",
    color: "#e2e8f0",
    padding: "16px 28px",
    display: "flex",
    alignItems: "flex-end",
    gap: 20,
    flexWrap: "wrap" as const,
  },
  campo: { flex: 1, minWidth: 160 },
  rotulo: {
    fontWeight: 600, fontSize: 10,
    letterSpacing: ".12em",
    color: "#7c89a0",
    marginBottom: 7,
  },
  control: {
    background: "#1c2738",
    border: "1px solid #2c394d",
    borderRadius: 10,
    padding: "10px 13px",
    fontSize: 14,
    color: "#fff",
    width: "100%",
    appearance: "none" as const,
    cursor: "pointer",
  },
  /// El gris del diseño para «Sin asignar»: un valor vacío no
  /// se lee igual que uno puesto.
  vacio: { color: "#94a3b8" },
  /// Azul de marca, no el verde del handoff anterior.
  /// DECISIONES 10 lo fija: el primario es `--marca`, que
  /// ademas es el color que cada gremio edita.
  boton: {
    background: "var(--marca)",
    color: "var(--marca-texto)",
    border: "none",
    borderRadius: 10,
    padding: "11px 22px",
    fontWeight: 600, fontSize: 14,
    cursor: "pointer",
    flex: "none" as const,
  },
};

export function BarraDeGestion({
  ficha,
  opciones,
  puedeRepartir,
  alGuardar,
}: {
  ficha: Ficha;
  opciones: Opciones | null;
  /// Quien no reparte fichas ve de quién es, pero no la mueve.
  puedeRepartir: boolean;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const [asesorId, setAsesorId] = useState(ficha.asesor?.id ?? "");
  const [accionId, setAccionId] = useState<string | null>(null);
  const [coberturaId, setCoberturaId] = useState(ficha.cobertura?.id ?? "");
  const [guardando, setGuardando] = useState(false);

  if (!opciones) return null;

  /// La acción guardada se DERIVA de la oferta que tiene la
  /// ficha, no se copia en un efecto: así, cuando las opciones
  /// llegan tarde, el desplegable ya sale con su valor puesto
  /// en vez de en blanco.
  const guardada = ficha.oferta
    ? (opciones.acciones.find((a) => a.ofertaId === ficha.oferta!.id)
        ?.accionFormacionId ?? "")
    : "";
  const accionElegida = accionId ?? guardada;
  const accion = opciones.acciones.find(
    (a) => a.accionFormacionId === accionElegida,
  );

  const grupos = accion?.cubre
    ? opciones.grupos.filter(
        (g) =>
          g.accionFormacionId === accion.accionFormacionId &&
          (g.modalidad === "VIRTUAL" || g.ubicacion === accion.ubicacion),
      )
    : [];

  const cambioAsesor = asesorId !== (ficha.asesor?.id ?? "");
  const cambioAccion =
    (accion?.ofertaId ?? "") !== (ficha.oferta?.id ?? "") ||
    coberturaId !== (ficha.cobertura?.id ?? "");
  const hayCambios = cambioAsesor || cambioAccion;

  /// Sin cobertura no se guarda nada: esa acción no llega al
  /// departamento de esta persona y el servidor lo rechaza
  /// igual. Ofrecer el botón sería ofrecer un error.
  const bloqueado = accion !== undefined && !accion.cubre;

  function mover(destino: Etapa) {
    if (destino === ficha.etapa) return;
    let motivo: string | undefined;
    if (ETAPAS_SALIDA.includes(destino)) {
      const escrito = window.prompt(
        `¿Por qué pasa a «${ETIQUETA_ETAPA[destino]}»? Es obligatorio.`,
      );
      if (!escrito?.trim()) return;
      motivo = escrito.trim();
    }
    void alGuardar(
      async () => {
        await crmApi.cambiarEtapa(ficha.id, destino, motivo);
      },
      `Ahora está en «${ETIQUETA_ETAPA[destino]}».`,
    );
  }

  async function guardarGestion() {
    setGuardando(true);
    try {
      await alGuardar(async () => {
        /// El asesor primero y la acción después, cada uno solo
        /// si cambió. Mandar los dos siempre escribiría en el
        /// historial cambios que nadie hizo.
        if (cambioAsesor) {
          await crmApi.actualizar(ficha.id, { asesorId: asesorId || null });
        }
        if (cambioAccion && accion?.ofertaId) {
          let motivo: string | undefined;
          if (accion.disponibles === 0 && accion.ofertaId !== ficha.oferta?.id) {
            const escrito = window.prompt(
              `«${accion.etiqueta}» no tiene cupos libres. ` +
                "¿Por qué se coloca por encima del cupo? Queda registrado a su nombre.",
            );
            if (!escrito?.trim()) return;
            motivo = escrito.trim();
          }
          await crmApi.asignar(
            ficha.id,
            accion.ofertaId,
            coberturaId || undefined,
            motivo,
          );
        }
      }, "Gestión guardada.");
    } finally {
      setGuardando(false);
    }
  }

  /// La etapa actual puede NO ser de las que se mueven a mano.
  /// Se añade como opción deshabilitada para que el desplegable
  /// diga la verdad en vez de enseñar la primera de la lista.
  const etapas = ETAPAS_A_MANO.includes(ficha.etapa)
    ? ETAPAS_A_MANO
    : [ficha.etapa, ...ETAPAS_A_MANO];

  return (
    <div style={D.barra}>
      <div style={D.campo}>
        <div style={D.rotulo}>MOVER DE ETAPA</div>
        <select
          style={D.control}
          value={ficha.etapa}
          onChange={(e) => mover(e.target.value as Etapa)}
        >
          {etapas.map((e) => (
            <option key={e} value={e} disabled={!ETAPAS_A_MANO.includes(e)}>
              {ETIQUETA_ETAPA[e]}
            </option>
          ))}
        </select>
      </div>

      <div style={D.campo}>
        <div style={D.rotulo}>ASESOR RESPONSABLE</div>
        {puedeRepartir ? (
          <select
            style={{ ...D.control, ...(asesorId ? {} : D.vacio) }}
            value={asesorId}
            onChange={(e) => setAsesorId(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {opciones.asesores.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ ...D.control, cursor: "default" }}>
            {ficha.asesor?.nombre ?? "Sin asignar"}
          </div>
        )}
      </div>

      <div style={D.campo}>
        <div style={D.rotulo}>ACCIÓN DE FORMACIÓN</div>
        <select
          style={{ ...D.control, ...(accionElegida ? {} : D.vacio) }}
          value={accionElegida}
          onChange={(e) => {
            setAccionId(e.target.value);
            setCoberturaId("");
          }}
        >
          <option value="">Sin asignar</option>
          {opciones.acciones.map((a) => (
            <option key={a.accionFormacionId} value={a.accionFormacionId}>
              {a.etiqueta}
              {a.cubre ? "" : " · sin cobertura"}
            </option>
          ))}
        </select>
      </div>

      <div style={D.campo}>
        <div style={D.rotulo}>GRUPO</div>
        <select
          style={{ ...D.control, ...(coberturaId ? {} : D.vacio) }}
          value={coberturaId}
          disabled={!accion?.cubre}
          onChange={(e) => setCoberturaId(e.target.value)}
        >
          <option value="">
            {bloqueado ? "Sin cobertura" : "Sin asignar"}
          </option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        style={{
          ...D.boton,
          opacity: !hayCambios || guardando || bloqueado ? 0.5 : 1,
        }}
        disabled={!hayCambios || guardando || bloqueado}
        onClick={() => void guardarGestion()}
        title={
          bloqueado
            ? "Esta acción no tiene cobertura donde vive la persona: corresponde escribirle un correo de agradecimiento."
            : undefined
        }
      >
        {guardando ? "Guardando…" : "Guardar gestión"}
      </button>
    </div>
  );
}
