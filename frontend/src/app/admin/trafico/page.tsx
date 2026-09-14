"use client";

/**
 * Qué pasa entre el anuncio y la preinscripción.
 *
 * Existe porque la pauta gastaba dinero, la gente llegaba al
 * formulario y no se preinscribía nadie — y no había forma de
 * saber dónde se iba. La conversión solo se contaba al final.
 *
 * Las cifras son un SUELO, no un total: no ven a quien se va
 * antes de que la página termine de pintar ni a quien usa
 * bloqueador. Eso se dice en pantalla, no en un tooltip.
 */

import { useCallback, useState } from "react";

import {
  EmbudoProceso,
  type Hito,
  type NotaDelEmbudo,
} from "@/components/admin/embudo-proceso";
import { n } from "@/components/admin/graficos";
import { Aviso } from "@/components/admin/marco-admin";
import { Encabezado, Vacio } from "@/components/admin/piezas";
import { ErrorApi } from "@/lib/api";
import { crmApi, type CorteDeVisitas, type EmbudoPublico } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/// Cómo se lee cada peldaño, y de qué color. El color sale de
/// las etapas del CRM para no inventar una segunda paleta.
const PELDANOS: Array<{ paso: string; etiqueta: string; etapa: Hito["etapa"] }> = [
  { paso: "LLEGO", etiqueta: "Abrieron la página", etapa: "INTERESADO" },
  { paso: "CATALOGO_LISTO", etiqueta: "Vieron el formulario", etapa: "INTERESADO" },
  { paso: "ELIGIO_UBICACION", etiqueta: "Eligieron su ciudad", etapa: "CONTACTADO" },
  { paso: "VIO_ACCIONES", etiqueta: "Vieron los cursos", etapa: "CONTACTADO" },
  { paso: "ELIGIO_ACCION", etiqueta: "Eligieron un curso", etapa: "DATOS_COMPLETOS" },
  { paso: "AUTORIZO", etiqueta: "Autorizaron sus datos", etapa: "DATOS_COMPLETOS" },
  { paso: "DATOS_COMPLETOS", etiqueta: "Llenaron todo", etapa: "INSCRITO" },
  { paso: "ENVIO", etiqueta: "Pulsaron confirmar", etapa: "INSCRITO" },
  { paso: "REGISTRADO", etiqueta: "Quedaron preinscritos", etapa: "CERTIFICADO" },
];

const COMO_SE_LEE: Record<string, string> = Object.fromEntries(
  PELDANOS.map((p) => [p.paso, p.etiqueta]),
);

const RANGOS = [
  { valor: "HOY", etiqueta: "Hoy" },
  { valor: "SEMANA", etiqueta: "7 días" },
  { valor: "MES", etiqueta: "30 días" },
  { valor: "TODO", etiqueta: "Todo" },
];

const NOMBRE_PUERTA: Record<string, string> = {
  SUBDOMINIO: "Por el subdominio del gremio",
  RUTA: "Por la dirección general",
  CRUZADA: "Cruzada: el gremio no coincide",
};

const NOMBRE_ANCHO: Record<string, string> = {
  MOVIL: "Celular",
  TABLET: "Tableta",
  ESCRITORIO: "Computador",
};

/// De dónde venían. «No dejó rastro» y no «Directa»: lo cierto
/// es la ausencia de referencia, no que tecleara la dirección.
///
/// Este diccionario vive AQUÍ y en ningún otro sitio. Hubo una
/// copia en el servidor que nadie importaba: dos diccionarios sin
/// nada que los ate es el defecto que este cambio vino a evitar.
const NOMBRE_PROCEDENCIA: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  /// Sabemos que fue Meta y no cuál de las dos: no se inventa.
  META: "Meta (sin precisar cuál)",
  CORREO: "Correo",
  WHATSAPP: "WhatsApp",
  BUSQUEDA: "Buscador",
  QR: "Código QR",
  INTERNO: "Otra página nuestra",
  OTRA_WEB: "Otra página web",
  OTRO_DECLARADO: "Otro canal etiquetado",
  SIN_REFERENCIA: "No dejó rastro",
};

/// Desde cuándo hay contador. Sin esta frase, «1 visita en todo»
/// se lee como «solo ha llegado una persona en toda la campaña»,
/// que es falso y es la peor clase de cifra.
function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

/// Por debajo de esto no se imprime porcentaje.
///
/// Una tasa con dos visitas se lee igual que una con tres mil, y
/// con nueve procedencias el primer día hay filas de un dígito.
/// Es la misma regla que el resto del panel: mejor ningún número
/// que uno que parece exacto.
const MINIMO_PARA_TASA = 30;

function tasa(parte: number, total: number): string {
  if (total < MINIMO_PARA_TASA) return "—";
  const pct = (parte / total) * 100;
  return pct > 0 && pct < 10 ? `${pct.toFixed(1)} %` : `${Math.round(pct)} %`;
}

export default function PaginaTrafico() {
  const [rango, setRango] = useState("SEMANA");
  const [datos, setDatos] = useState<EmbudoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await crmApi.embudoPublico(rango));
      setError(null);
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, [rango]);

  useDatosVivos(cargar, { intervaloMs: 30_000 });

  const porPaso = new Map((datos?.hitos ?? []).map((h) => [h.paso, h.visitas]));
  const llegaron = porPaso.get("LLEGO") ?? 0;
  const vieron = porPaso.get("CATALOGO_LISTO") ?? 0;
  const quedaron = porPaso.get("REGISTRADO") ?? 0;

  const hitos: Hito[] = PELDANOS.map((p) => ({
    etapa: p.etapa,
    etiqueta: p.etiqueta,
    total: porPaso.get(p.paso) ?? 0,
  }));

  const notas: NotaDelEmbudo[] = [
    {
      cifra: llegaron,
      etiqueta: "Abrieron la página",
      detalle: "Cada visita cuenta una vez, no cada recarga.",
      tono: "marca",
    },
    {
      cifra: quedaron,
      etiqueta: "Se preinscribieron",
      detalle: `${tasa(quedaron, llegaron)} de quienes llegaron.`,
      tono: quedaron > 0 ? "exito" : "error",
    },
    {
      cifra: Math.max(llegaron - vieron, 0),
      etiqueta: "Se fueron antes de ver nada",
      detalle: "Cerraron mientras la página todavía cargaba.",
      tono: "aviso",
    },
  ];

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Tráfico del formulario"
        descripcion={
          <>
            Qué pasa entre el anuncio y la preinscripción. Cuenta visitas, no
            personas.
            {datos?.contandoDesde && (
              <>
                {" "}
                <strong className="text-texto">
                  El contador empezó el {cuando(datos.contandoDesde)}
                </strong>
                : lo anterior a esa hora no se contó, aunque sí hubiera llegado
                gente.
              </>
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-1">
          {RANGOS.map((r) => (
            <button
              key={r.valor}
              type="button"
              onClick={() => setRango(r.valor)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                rango === r.valor
                  ? "bg-marca font-medium text-marca-texto"
                  : "border border-borde bg-superficie text-texto-suave hover:bg-superficie-alterna"
              }`}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>
      </Encabezado>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {datos && llegaron === 0 ? (
        <Vacio titulo="Todavía no hay visitas contadas">
          {datos.contandoDesde ? (
            <>
              El contador funciona desde el{" "}
              {new Date(datos.contandoDesde).toLocaleDateString("es-CO")}, pero en{" "}
              {datos.etiqueta.toLowerCase()} no llegó nadie. Si la pauta está activa,
              revise que el enlace del anuncio apunte a esta dirección.
            </>
          ) : (
            <>
              No se ha registrado ni una visita desde que existe esta pantalla. Si la
              página sí está recibiendo gente, lo que falla es la medición y no la
              pauta.
            </>
          )}
        </Vacio>
      ) : (
        <>
          {datos?.caidaMayor && (
            <div className="rounded-2xl border border-aviso/40 bg-aviso-suave p-5">
              <p className="text-xs font-semibold tracking-wide text-aviso uppercase">
                Donde más gente se va
              </p>
              <p className="mt-1 text-lg font-semibold text-texto">
                {datos.caidaMayor.sePerdieron === 1
                  ? "1 persona se fue"
                  : `${n(datos.caidaMayor.sePerdieron)} personas se fueron`}{" "}
                entre «{COMO_SE_LEE[datos.caidaMayor.de] ?? datos.caidaMayor.de}» y «
                {COMO_SE_LEE[datos.caidaMayor.a] ?? datos.caidaMayor.a}».
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-borde bg-superficie p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-texto-suave uppercase">
              De la pauta a la preinscripción · {datos?.etiqueta ?? ""}
            </h2>
            <EmbudoProceso hitos={hitos} notas={notas} />
          </div>

          <Corte
            titulo="De dónde venían"
            filas={datos?.procedencia ?? []}
            nombre={(v) => NOMBRE_PROCEDENCIA[v ?? ""] ?? "Sin dato"}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Corte
              titulo="Por dispositivo"
              filas={datos?.dispositivo ?? []}
              nombre={(v) => NOMBRE_ANCHO[v ?? ""] ?? "Sin dato"}
            />
            <Corte
              titulo="Por qué dirección entraron"
              filas={datos?.entrada ?? []}
              nombre={(v) => NOMBRE_PUERTA[v ?? ""] ?? "Sin dato"}
            />
            <Corte
              titulo="Por campaña"
              filas={datos?.campana ?? []}
              nombre={(v) => v ?? "Sin campaña: entrada directa"}
            />
          </div>
        </>
      )}

      <div className="rounded-2xl border border-borde bg-superficie-alterna p-5 text-sm text-texto-suave">
        <p className="font-medium text-texto">Cómo leer estas cifras</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            Son un <strong>suelo, no un total</strong>: no cuentan a quien se va antes
            de que la página termine de cargar, ni a quien usa bloqueador.
          </li>
          <li>
            <strong>Y no cuentan nada anterior al contador.</strong> Quien se
            preinscribió antes de que esto existiera no aparece aquí, aunque sí
            esté en Gestión de leads.
          </li>
          <li>
            La unidad es la <strong>visita</strong>, no la persona. Quien vuelve otro
            día cuenta dos veces; quien va y viene entre pantallas cuenta una.
          </li>
          <li>
            «Quedaron preinscritos» lo escribe el servidor, no el navegador: es la
            única cifra que no se pierde aunque se cierre la pestaña.
          </li>
          <li>
            El registro del servidor cuenta lo mismo sin depender del navegador. Si
            las dos cifras se separan mucho, la diferencia son bloqueadores.
          </li>
          <li>
            <strong>El porcentaje no sale con menos de {MINIMO_PARA_TASA} visitas.</strong>{" "}
            Una tasa hecha de dos visitas no dice nada, y con nueve procedencias
            las primeras semanas hay filas de un dígito.
          </li>
          <li>
            <strong>Esta cifra será MENOR que los clics que reporta Meta</strong>, y
            no es un error: aquí no entran los rastreadores —que no ejecutan
            JavaScript— ni quien se va antes de que la página cargue. Para
            contrastar con Meta sirve el registro del servidor, no esta pantalla.
          </li>
          <li>
            <strong>«No dejó rastro» no quiere decir que escribieran la dirección.</strong>{" "}
            Quiere decir que no llegó ninguna señal — y así entra casi todo el
            correo y casi todo WhatsApp, que no dejan referencia. Para que esos
            dos canales se vean, sus enlaces tienen que salir etiquetados.
          </li>
        </ul>
      </div>
    </div>
  );
}

/// Un corte con su conversión. La misma forma para los tres.
function Corte({
  titulo,
  filas,
  nombre,
}: {
  titulo: string;
  filas: CorteDeVisitas[];
  nombre: (valor: string | null) => string;
}) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5">
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-texto-suave uppercase">
        {titulo}
      </h3>
      {filas.length === 0 ? (
        <p className="text-sm text-texto-suave">Sin visitas en este periodo.</p>
      ) : (
        <ul className="space-y-2.5">
          {filas.map((f) => (
            <li
              key={f.valor ?? "sin"}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-texto">
                {nombre(f.valor)}
              </span>
              <span className="shrink-0 text-sm text-texto-suave tabular-nums">
                {n(f.visitas)} ·{" "}
                <strong className="text-texto">{tasa(f.envios, f.visitas)}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
