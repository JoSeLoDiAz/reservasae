"use client";

/** La barra de gestión de la ficha: lo único que cambia el estado. */

/// Es una sola pieza y no tres controles sueltos, y eso es a
/// propósito. Antes cada uno guardaba por su cuenta —«Asignar»
/// para el asesor, «Guardar» para la acción— y en la barra
/// salían dos botones apretados entre los campos. El diseño
/// pide UN botón, «Guardar gestión», y para eso el estado de
/// los tres tiene que vivir en el mismo sitio.
///
/// CLARA, no oscura, y con los campos SUBRAYADOS.
///
/// Era una barra `var(--titulo)` con los cuatro valores metidos en
/// cajas. Eso venía del handoff de la ficha, que es anterior;
/// el rediseño premium la pone sobre `--superficie-alterna` y
/// deja los valores con una sola raya debajo. La diferencia no
/// es de gusto: una barra negra en medio de una pantalla clara
/// parte la ficha en dos y hace que lo de abajo parezca otra
/// página. Con la raya sola sigue leyéndose que son campos y
/// deja de competir con el contenido.
///
/// Y todo por token, no en hexadecimal: el gremio edita su
/// color y en modo oscuro estos valores se recalculan.

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
import { bonito } from "@/lib/api";

const D = {
  barra: {
    background: "var(--superficie-alterna)",
    borderBottom: "1px solid var(--borde)",
    padding: "14px 28px 16px",
    display: "flex",
    alignItems: "flex-end",
    gap: 24,
    flexWrap: "wrap" as const,
  },
  campo: { flex: "1 1 170px", minWidth: 150 },
  /// La flecha va en un envoltorio y no en el `select`: con
  /// `appearance:none` el navegador le quita la suya, y sin
  /// ninguna los cuatro campos parecian texto plano. Un control
  /// que no parece control no se pulsa.
  envoltorio: { position: "relative" as const },
  flecha: {
    position: "absolute" as const,
    right: 0,
    bottom: 8,
    fontSize: 9,
    color: "var(--texto-suave)",
    pointerEvents: "none" as const,
  },
  rotulo: {
    fontWeight: 600,
    fontSize: "0.625rem",
    letterSpacing: ".1em",
    textTransform: "uppercase" as const,
    color: "var(--texto-suave)",
  },
  /// Una raya debajo, no una caja. `appearance:none` le quita
  /// al `select` su marco propio, que es lo que volvia a
  /// dibujar la caja en Chrome.
  control: {
    marginTop: 6,
    paddingRight: 16,
    paddingBottom: 6,
    background: "transparent",
    border: "none",
    borderBottom: "1px solid var(--campo-borde)",
    borderRadius: 0,
    fontSize: "0.84375rem",
    color: "var(--titulo)",
    width: "100%",
    appearance: "none" as const,
    cursor: "pointer",
  },
  /// Un valor vacío no se lee igual que uno puesto.
  vacio: { color: "var(--texto-suave)" },
  boton: {
    background: "var(--marca)",
    color: "var(--marca-texto)",
    border: "1px solid var(--marca)",
    borderRadius: 10,
    height: 36,
    padding: "0 18px",
    fontWeight: 600,
    fontSize: "0.78125rem",
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
        <div style={D.envoltorio}>
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
        <span aria-hidden style={D.flecha}>▾</span>
        </div>
      </div>

      <div style={D.campo}>
        <div style={D.rotulo}>ASESOR RESPONSABLE</div>
        {puedeRepartir ? (
          <div style={D.envoltorio}>
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
          <span aria-hidden style={D.flecha}>▾</span>
          </div>
        ) : (
          <div style={{ ...D.control, cursor: "default" }}>
            {ficha.asesor?.nombre ?? "Sin asignar"}
          </div>
        )}
      </div>

      <div style={D.campo}>
        <div style={D.rotulo}>ACCIÓN DE FORMACIÓN</div>
        <div style={D.envoltorio}>
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
              {/* En capitalizacion normal. La base los guarda en
                  MAYUSCULAS y aqui salian tal cual: setenta
                  caracteres gritando dentro de un desplegable.
                  El resto del panel ya los pasa por `bonito()`. */}
              {bonito(a.etiqueta)}
              {a.cubre ? "" : " · sin cobertura"}
            </option>
          ))}
        </select>
        <span aria-hidden style={D.flecha}>▾</span>
        </div>
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
