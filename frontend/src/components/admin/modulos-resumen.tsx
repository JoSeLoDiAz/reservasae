"use client";

/** Los módulos 2 a 5 del Resumen: leads, académico, tráfico y asesores. */

/**
 * POR QUÉ ESTÁN AQUÍ Y QUÉ NO HACEN.
 *
 * «En el resumen quiero que se proyecten cuatro módulos… podemos
 * integrar todo sin dañar lo que ya hay… porque esto es un RESUMEN,
 * el detalle va a quedar aparte, el detalle queda como está»
 * (cliente, 22 sep 2026). Y Catalina añadió el quinto, el de los
 * asesores.
 *
 * NINGUNO CALCULA NADA. Cada uno llama a la ruta que ya sirve el
 * informe correspondiente de Control de Inscritos y pinta una frase,
 * cuatro cifras y un corte. La matriz, los acordeones y las listas
 * por persona se quedan donde están: si el Resumen las copiara,
 * serían dos pantallas contando lo mismo con dos reglas.
 *
 * CADA MÓDULO PIDE LO SUYO, Y SOLO SI PUEDE. El Resumen es la única
 * pantalla del panel sin cerradura de área, y un `Promise.all` con
 * un 403 dentro apagaría la portada entera. Así que cada bloque mira
 * el permiso ANTES de pedir —y antes de pintar «cargando», o se
 * quedaría girando para siempre a quien no puede verlo—.
 */

import { createContext, useCallback, useContext } from "react";

import { DosSeriesPorDiaConEje, ListaBarras, n } from "./graficos";
import { useAdmin } from "./marco-admin";
import { PendientesDeHoy } from "./pendientes-de-hoy";
import {
  ACENTO,
  BarrasDobles,
  Cifra,
  CifraDelModulo,
  Cifras,
  FraseDelModulo,
  Leyenda,
  Modulo,
  VerDetalle,
} from "./piezas-modulo";
import { Esqueleto, Vacio } from "./piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  crmApi,
  type Control,
  type TableroAcademico,
  type EmbudoPublico,
} from "@/lib/crm-api";
import { porCanal } from "@/lib/canales-del-resumen";
import {
  MINIMO_PARA_TASA,
  PELDANOS_DEL_TRAFICO,
  porcentaje,
  visitasDe,
} from "@/lib/trafico-comun";

/// Un minuto para lo que se trabaja hoy, cinco para lo que no se
/// mueve en una mañana.
const CADA_MINUTO = 60_000;
const CADA_CINCO = 5 * 60_000;

/**
 * Cómo se lee cada procedencia.
 *
 * Copia corta del diccionario de `panel-trafico.tsx`. Lo que NO se
 * copia es la REGLA —«No dejó rastro» nunca se llama «Directa»,
 * porque lo cierto es la ausencia de referencia y no que la persona
 * tecleara la dirección—: allí está razonada y aquí se respeta.
 */
const NOMBRE_PROCEDENCIA: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  META: "Meta (sin precisar cuál)",
  CORREO: "Correo",
  WHATSAPP: "WhatsApp",
  BUSQUEDA: "Buscador",
  QR: "Código QR",
  RESERVA: "Reserva de empresa",
  INTERNO: "Otra página nuestra",
  OTRA_WEB: "Otra página web",
  OTRO_DECLARADO: "Otro canal etiquetado",
  SIN_REFERENCIA: "No dejó rastro",
};

/**
 * Lo que se pinta cuando un módulo no se puede pedir o no tiene con
 * qué llenarse.
 *
 * NUNCA SE DEJA EN BLANCO. «Nunca media pantalla vacía; un bloque
 * vacío dice POR QUÉ lo está» (el handoff). Un cero sin explicar se
 * lee como un dato que no cargó.
 */
function Apagado({
  numero,
  titulo,
  descripcion,
  porque,
  children,
}: {
  numero: number;
  titulo: string;
  descripcion: string;
  porque: string;
  children?: React.ReactNode;
}) {
  return (
    <Modulo numero={numero} titulo={titulo} descripcion={descripcion}>
      <Vacio titulo={porque}>{children}</Vacio>
    </Modulo>
  );
}

/* ── módulos 2 y 5: una sola llamada para los dos ─────────────── */

/**
 * `porAsesor` viaja DENTRO de la misma respuesta que el embudo y la
 * cola, así que el de asesores no cuesta una petición. Pero el
 * cliente los quiere en su sitio —2, 3, 4 y 5— con el académico y el
 * tráfico en medio, así que el dato se levanta a un contexto: el
 * orden lo decide la pantalla, no de dónde viene el dato.
 */
type Traido = { datos: Control | null; error: string | null; puede: boolean };
const ContextoDeControl = createContext<Traido>({
  datos: null,
  error: null,
  puede: false,
});

export function ProveedorDeControl({ children }: { children: React.ReactNode }) {
  const { admin } = useAdmin();
  /// `CrmController` lleva `@Roles(SUPERADMIN, GESTOR)` en la clase
  /// y pide `inscritos` en la ruta: las dos condiciones, o el 403.
  const puede = admin.rol !== "CONSULTA" && admin.permisos?.inscritos !== "NADA";

  const vivos = useDatosVivos<Control>(
    useCallback(() => crmApi.control(), []),
    { activo: puede, intervaloMs: CADA_MINUTO },
  );

  return (
    <ContextoDeControl.Provider
      value={{ datos: vivos.datos, error: vivos.error, puede }}
    >
      {children}
    </ContextoDeControl.Provider>
  );
}

/** MÓDULO 2 · los leads. */
export function ModuloLeads() {
  const { datos: d, error, puede } = useContext(ContextoDeControl);
  const titulo = "Leads e inscripciones";
  const bajada =
    "Quién llegó, por qué canal, si ya lo contactamos y cómo avanzan las inscripciones.";

  if (!puede)
    return (
      <Apagado
        numero={2}
        titulo={titulo}
        descripcion={bajada}
        porque="Su cuenta no tiene acceso a inscripciones"
      >
        Estas cifras son del área de inscripciones. Quien lleve esa área en su
        gremio las ve aquí.
      </Apagado>
    );

  if (error)
    return (
      <Apagado
        numero={2}
        titulo={titulo}
        descripcion={bajada}
        porque="No se pudieron traer las cifras"
      >
        {error}
      </Apagado>
    );

  const esperando = d ? d.sinContactar.reduce((s, t) => s + t.total, 0) : 0;
  const canales = d ? porCanal(d.conversionPorOrigen) : [];
  const leads = canales.reduce((s, c) => s + c.leads, 0);

  return (
    <Modulo numero={2} titulo={titulo} descripcion={bajada}>
      {!d ? (
        <Esqueleto conCifras />
      ) : (
        <>
          <FraseDelModulo numero={2}>
            Entraron <Cifra>{n(leads)}</Cifra> leads y <Cifra>{n(d.total)}</Cifra>{" "}
            llegaron a inscribirse. <Cifra>{n(d.sinAsignar)}</Cifra> siguen sin
            asesor y <Cifra>{n(esperando)}</Cifra> esperan su primera llamada.
          </FraseDelModulo>

          <Cifras>
            {/* «Llegaron a inscrito» y NO «inscritos» a secas: el
                módulo 1 tiene su propia cifra de inscritos, con otra
                regla. Dos cifras, dos nombres. */}
            <CifraDelModulo
              etiqueta="Llegaron a inscrito"
              valor={n(d.total)}
              pie="desde que hay registro"
              tono={d.total > 0 ? "bueno" : undefined}
            />
            <CifraDelModulo
              etiqueta="Sin asesor"
              valor={n(d.sinAsignar)}
              pie={d.sinAsignar > 0 ? "hoy no los llama nadie" : "todos repartidos"}
              tono={d.sinAsignar > 0 ? "aviso" : "bueno"}
            />
            <CifraDelModulo
              etiqueta="Esperan primera llamada"
              valor={n(esperando)}
              pie="siguen en Interesado"
              tono={esperando > 0 ? "aviso" : "bueno"}
            />
            <CifraDelModulo
              etiqueta="De lead a inscrito"
              valor={d.diasHastaInscribir === null ? "—" : `${d.diasHastaInscribir} d`}
              pie={d.diasHastaInscribir === null ? "aún sin medir" : "en promedio"}
            />
          </Cifras>

          {/* La única lista accionable, entera y con sus enlaces ya
              recortados. Su docblock pide que se mueva sin
              reescribirla. */}
          <PendientesDeHoy control={d} />

          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold">Leads e inscritos por día</h3>
            {/* Las dos series que de verdad se tienen: cuándo
                ENTRÓ cada lead y cuándo llegó alguien a inscrito.
                No es «acumulado por canal» como la maqueta, porque
                el canal no viaja en la serie: inventarlo sería una
                línea que nadie puede comprobar. */}
            <DosSeriesPorDiaConEje
              a={{
                nombre: "Leads que entraron",
                color: "var(--etapa-interesado)",
                datos: d.leadsPorDia.map((x) => ({ dia: x.dia, total: x.total })),
              }}
              b={{
                nombre: "Llegaron a inscrito",
                color: "var(--exito)",
                datos: d.serie.map((x) => ({ dia: x.dia, total: x.total })),
              }}
              vacio="Todavía no hay días con movimiento."
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold">Avance de inscripciones por canal</h3>
            <div className="caja-scroll overflow-x-auto">
              <table className="w-full text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-hairline text-left text-[0.71875rem] text-texto-suave">
                    <th className="py-1.5 pr-3 font-semibold">Canal</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Leads</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Inscritos</th>
                    <th className="py-1.5 text-right font-semibold">Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {canales.map((c) => (
                    <tr key={c.canal} className="border-b border-hairline last:border-0">
                      <td className="py-1.5 pr-3">{c.nombre}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{n(c.leads)}</td>
                      <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                        {n(c.inscritos)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {/* Con menos de cinco leads no se imprime: un
                            50 % de dos personas se lee igual que uno
                            de mil. */}
                        {c.leads >= 5 ? porcentaje(c.inscritos, c.leads) : "—"}
                      </td>
                    </tr>
                  ))}
                  {canales.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-2 text-texto-suave">
                        Todavía no ha entrado ningún lead.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[0.71875rem] text-texto-suave">
              «Se inscribió solo» es quien llegó al formulario por un enlace sin
              etiqueta: no se sabe por dónde vino, y por eso no se reparte entre
              los otros canales.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold">Antigüedad de quien espera llamada</h3>
            <ListaBarras
              datos={d.sinContactar.map((t) => ({
                clave: String(t.dias),
                etiqueta: t.dias === 0 ? "Menos de 3 días" : `${t.dias} días o más`,
                valor: t.total,
              }))}
              sufijo=" personas"
              sufijoUno=" persona"
              vacio="No hay nadie esperando una primera llamada."
            />
            <p className="text-[0.71875rem] text-texto-suave">
              Días desde que el lead entró al CRM. Solo cuenta a quien sigue en
              Interesado: en cuanto se le contacta, sale de aquí.
            </p>
          </div>

          <VerDetalle a="/admin/control?pantalla=metas">
            Ver el proceso de inscripción completo
          </VerDetalle>
        </>
      )}
    </Modulo>
  );
}

/**
 * MÓDULO 5 · los asesores.
 *
 * «Cuántos asesores, cuántos tiene asignados, de esos cuántos
 * inscribió, y un porcentaje de conversión sobre lo que le es
 * asignado» (Catalina, 22 sep 2026).
 *
 * Lo que NO responde —y hay que decirlo— es «cuántos inscribió»:
 * `asesorId` es el dueño de HOY, así que si una líder reasigna una
 * ficha ya inscrita, el mérito se muda con ella. Por eso la columna
 * se llama «suyos inscritos» y no «inscribió».
 */
export function ModuloAsesores() {
  const { datos: control, error, puede } = useContext(ContextoDeControl);
  const { admin } = useAdmin();
  /// Quien no responde por el equipo recibe SOLO su fila, y el
  /// servidor ya se encargó de eso. Esto es para poder nombrar bien
  /// lo que se está mirando: una tabla de una sola fila titulada
  /// «Seguimiento de asesores» se lee como si faltara gente.
  const veElEquipo = admin.puede?.verElEquipo === true;
  const titulo = veElEquipo ? "Seguimiento de asesores" : "Su gestión";
  const bajada = veElEquipo
    ? "Cuántos leads lleva cada asesor y cuántos de ellos están inscritos."
    : "Cuántos leads lleva usted y cuántos de ellos están inscritos.";

  if (!puede)
    return (
      <Apagado
        numero={5}
        titulo={titulo}
        descripcion={bajada}
        porque="Su cuenta no tiene acceso a inscripciones"
      />
    );

  if (error)
    return (
      <Apagado
        numero={5}
        titulo={titulo}
        descripcion={bajada}
        porque="No se pudieron traer las cifras"
      >
        {error}
      </Apagado>
    );

  if (!control)
    return (
      <Modulo numero={5} titulo={titulo} descripcion={bajada}>
        <Esqueleto conCifras />
      </Modulo>
    );

  /// Sin asesor NO es un asesor. La fila con `asesorId` nulo es la
  /// cola de nadie, y ya se cuenta arriba en «Sin asesor»: dejarla
  /// aquí la contaría como una persona más del equipo.
  const asesores = control.porAsesor.filter((a) => a.asesorId !== null);
  const conFichas = asesores.filter((a) => a.asignados > 0).length;
  const repartidas = asesores.reduce((s, a) => s + a.asignados, 0);
  const suyosInscritos = asesores.reduce((s, a) => s + a.inscritosSiempre, 0);

  return (
    <Modulo numero={5} titulo={titulo} descripcion={bajada}>
      {asesores.length === 0 ? (
        <Vacio
          titulo={
            veElEquipo
              ? "Todavía no hay ningún lead con asesor"
              : "Todavía no le han asignado ningún lead"
          }
        >
          {veElEquipo
            ? "En cuanto se reparta el primero aparece aquí, con lo que lleva y lo que ha inscrito."
            : "En cuanto le asignen el primero aparece aquí, con lo que lleva y lo que ha inscrito."}
        </Vacio>
      ) : (
        <>
          <FraseDelModulo numero={5}>
            {veElEquipo ? (
              <>
                <Cifra>{n(conFichas)}</Cifra>{" "}
                {conFichas === 1 ? "asesor lleva" : "asesores llevan"}{" "}
                <Cifra>{n(repartidas)}</Cifra> leads, y{" "}
                <Cifra>{n(suyosInscritos)}</Cifra> de ellos ya están inscritos (
                {porcentaje(suyosInscritos, repartidas)}).
              </>
            ) : (
              <>
                Lleva <Cifra>{n(repartidas)}</Cifra> leads y{" "}
                <Cifra>{n(suyosInscritos)}</Cifra> están inscritos (
                {porcentaje(suyosInscritos, repartidas)}).
              </>
            )}
          </FraseDelModulo>

          <Cifras>
            <CifraDelModulo
              etiqueta={veElEquipo ? "Asesores con leads" : "Asesor"}
              valor={n(veElEquipo ? conFichas : 1)}
              pie={
                veElEquipo ? `de ${n(asesores.length)} con fichas alguna vez` : "usted"
              }
            />
            <CifraDelModulo
              etiqueta={veElEquipo ? "Leads repartidos" : "Sus leads"}
              valor={n(repartidas)}
            />
            <CifraDelModulo
              etiqueta="De esos, inscritos"
              valor={n(suyosInscritos)}
              pie={`${porcentaje(suyosInscritos, repartidas)} de lo repartido`}
              tono={suyosInscritos > 0 ? "bueno" : undefined}
            />
          </Cifras>

          <div className="caja-scroll overflow-x-auto">
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="border-b border-hairline text-left text-[0.71875rem] text-texto-suave">
                  <th className="py-1.5 pr-3 font-semibold">Asesor</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Asignados</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">
                    Suyos inscritos
                  </th>
                  <th className="py-1.5 text-right font-semibold">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {[...asesores]
                  .sort((a, b) => b.asignados - a.asignados)
                  .map((a) => (
                    <tr
                      key={a.asesorId ?? a.etiqueta}
                      className="border-b border-hairline last:border-0"
                    >
                      <td className="py-1.5 pr-3">
                        {/* A SU LISTA, con el filtro puesto: «una cifra
                            que pide hacer algo tiene que llevar a
                            exactamente esa gente». */}
                        <VerDetalle
                          a={`/admin/participantes?asesor=${encodeURIComponent(a.asesorId ?? "")}`}
                        >
                          {a.etiqueta}
                        </VerDetalle>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {n(a.asignados)}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                        {n(a.inscritosSiempre)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {a.asignados >= 5
                          ? porcentaje(a.inscritosSiempre, a.asignados)
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <p className="text-[0.71875rem] text-texto-suave">
            «Suyos inscritos» son los que lleva hoy y ya están inscritos, no los
            que él inscribió: una ficha que cambia de asesor se lleva su cuenta
            consigo. La conversión no se imprime por debajo de cinco leads.
            {!veElEquipo && (
              <>
                {" "}
                Aquí sale{" "}
                <strong className="font-semibold text-texto">solo su gestión</strong>:
                el trabajo del resto del equipo lo ve quien responde por él.
              </>
            )}
          </p>

          {veElEquipo && (
            <VerDetalle a="/admin/participantes?cola=por-trabajar">
              Repartir leads entre asesores
            </VerDetalle>
          )}
        </>
      )}
    </Modulo>
  );
}

/* ── módulo 3: el académico ───────────────────────────────────── */

const ACENTO_3 = ACENTO[3];
const TENUE_3 = "color-mix(in srgb, var(--etapa-en-formacion) 30%, transparent)";

export function ModuloAcademico() {
  const { admin } = useAdmin();
  const puede = admin.rol !== "CONSULTA" && admin.permisos?.academico !== "NADA";

  const vivos = useDatosVivos<TableroAcademico>(
    useCallback(() => crmApi.tableroAcademico(), []),
    { activo: puede, intervaloMs: CADA_CINCO },
  );

  const titulo = "Seguimiento académico";
  const bajada = "Matriculados por acción, con el avance y el estado de cada grupo.";

  if (!puede)
    return (
      <Apagado
        numero={3}
        titulo={titulo}
        descripcion={bajada}
        porque="Su cuenta no tiene acceso al área académica"
      />
    );

  if (vivos.error)
    return (
      <Apagado
        numero={3}
        titulo={titulo}
        descripcion={bajada}
        porque="No se pudieron traer las cifras"
      >
        {vivos.error}
      </Apagado>
    );

  const d = vivos.datos;

  /// EL AULA VACÍA SE EXPLICA, y no es un fallo: el avance lo carga
  /// el LMS, que todavía no está conectado. Sin esta frase, un
  /// tablero en ceros se lee como un tablero roto —y hoy en
  /// producción hay cero actividades y cero avances cargados—.
  if (d && d.total === 0)
    return (
      <Apagado
        numero={3}
        titulo={titulo}
        descripcion={bajada}
        porque="Todavía no ha entrado nadie al aula"
      >
        Estas cifras salen del avance de cada persona, que lo carga la plataforma
        de formación. Mientras no haya nadie matriculado ni avances cargados, el
        bloque se queda en cero y no es un error.
      </Apagado>
    );

  return (
    <Modulo numero={3} titulo={titulo} descripcion={bajada}>
      {!d ? (
        <Esqueleto conCifras />
      ) : (
        <>
          <FraseDelModulo numero={3}>
            De <Cifra>{n(d.total)}</Cifra> que pisaron el aula,{" "}
            <Cifra>{n(d.dentro)}</Cifra> siguen dentro,{" "}
            <Cifra>{n(d.certificados)}</Cifra> se certificaron y{" "}
            <Cifra>{n(d.salidas)}</Cifra> salieron o no aprobaron.
          </FraseDelModulo>

          <Cifras>
            <CifraDelModulo etiqueta="Pisaron el aula" valor={n(d.total)} />
            <CifraDelModulo
              etiqueta="Listos para certificar"
              valor={n(d.listos)}
              pie={`con el ${Math.round(d.minimoParaCertificar * 100)} % o más`}
              tono={d.listos > 0 ? "bueno" : undefined}
            />
            <CifraDelModulo
              etiqueta="Certificados"
              valor={n(d.certificados)}
              pie={`${porcentaje(d.certificados, d.total)} del aula`}
              tono={d.certificados > 0 ? "bueno" : undefined}
            />
            <CifraDelModulo
              etiqueta="Avance medio"
              valor={`${Math.round(d.avanceMedio * 100)} %`}
              /// SOBRE LOS MEDIBLES, dicho: quien no tiene actividades
              /// cargadas no se puede medir, y meterlo en el promedio
              /// lo hundiría sin que nada fallara.
              pie={
                d.sinMedir > 0
                  ? `sobre ${n(d.medibles)}; ${n(d.sinMedir)} sin actividades`
                  : `sobre ${n(d.medibles)} medibles`
              }
            />
          </Cifras>

          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold">En qué estado está cada quien</h3>
            {/* LOS SEIS QUE EL TABLERO SABE. La maqueta dibuja diez;
                cuatro de ellos --sin ingreso, sin empezar, al día y
                atrasado-- son juicios de RITMO que se calculan
                contra el calendario del grupo y viven en el tablero
                académico, no aquí. Pintar diez casillas y dejar
                cuatro en cero siempre sería peor que pintar seis
                ciertas. */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { q: "Siguen dentro", v: d.dentro, c: "var(--etapa-en-formacion)" },
                { q: "Listos para certificar", v: d.listos, c: "var(--etapa-inscrito)" },
                { q: "Certificados", v: d.certificados, c: "var(--etapa-certificado)" },
                { q: "Desertaron o abandonaron", v: d.porAccion.reduce((x, a) => x + a.desertaron + a.abandonaron, 0), c: "var(--etapa-deserto)" },
                { q: "Retirados", v: d.porAccion.reduce((x, a) => x + a.retirados, 0), c: "var(--etapa-retirado)" },
                { q: "No aprobaron", v: d.porAccion.reduce((x, a) => x + a.noAprobaron, 0), c: "var(--etapa-no-aprobo)" },
              ].map((e) => (
                <div
                  key={e.q}
                  className="flex items-center gap-2.5 rounded-lg border border-borde px-3 py-2 text-[0.8125rem]"
                >
                  {/* El color acompaña; NUNCA es lo único que
                      distingue: la etiqueta lo dice con palabras. */}
                  <i
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: e.c }}
                  />
                  <span className="min-w-0 flex-1 truncate">{e.q}</span>
                  <strong className="font-bold tabular-nums">{n(e.v)}</strong>
                  <small className="w-10 text-right text-texto-suave tabular-nums">
                    {porcentaje(e.v, d.total)}
                  </small>
                </div>
              ))}
            </div>
          </div>

          {d.porAccion.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h3 className="text-sm font-bold">
                Dentro y fuera, por acción de formación
              </h3>
              <Leyenda
                de={[
                  { nombre: "Siguen dentro o certificados", color: ACENTO_3 },
                  { nombre: "Salieron o no aprobaron", color: TENUE_3 },
                ]}
              />
              <BarrasDobles
                filas={d.porAccion.map((a) => ({
                  clave: a.codigo + a.nombre,
                  etiqueta: `${a.codigo} · ${a.nombre}`,
                  hecho: a.dentro + a.certificados,
                  total: a.enAula,
                  derecha: <>{n(a.enAula)} en el aula</>,
                }))}
                colorHecho={ACENTO_3}
                colorFalta={TENUE_3}
                maximoFilas={8}
              />
            </div>
          )}

          <VerDetalle a="/admin/participantes/academico/tablero">
            Ver el tablero académico por acción, grupo y persona
          </VerDetalle>
        </>
      )}
    </Modulo>
  );
}

/* ── módulo 4: el tráfico ─────────────────────────────────────── */

const ACENTO_4 = ACENTO[4];

export function ModuloTrafico() {
  const { admin } = useAdmin();
  /// Esta ruta NO lleva `@Roles`, y es deliberado: quien la mira es
  /// la cuenta de la pauta, que es CONSULTA por concesión.
  const puede = admin.permisos?.inscripciones !== "NADA";

  const vivos = useDatosVivos<EmbudoPublico>(
    /// `rango` EXPLÍCITO: la ruta defaultea a una semana, y sin
    /// fijarlo este módulo contaría siete días al lado de otros que
    /// cuentan desde el principio.
    useCallback(() => crmApi.embudoPublico({ rango: "TODO" }), []),
    { activo: puede, intervaloMs: CADA_CINCO },
  );

  const titulo = "Tráfico de página";
  const bajada =
    "Cuánta gente abre el formulario, de dónde llega y cuántos terminan preinscritos.";

  if (!puede)
    return (
      <Apagado
        numero={4}
        titulo={titulo}
        descripcion={bajada}
        porque="Su cuenta no tiene acceso a inscripciones"
      />
    );

  if (vivos.error)
    return (
      <Apagado
        numero={4}
        titulo={titulo}
        descripcion={bajada}
        porque="No se pudieron traer las cifras"
      >
        {vivos.error}
      </Apagado>
    );

  const d = vivos.datos;
  const aperturas = d ? visitasDe(d.hitos, "LLEGO") : 0;
  const eligieron = d ? visitasDe(d.hitos, "ELIGIO_ACCION") : 0;
  const registrados = d ? visitasDe(d.hitos, "REGISTRADO") : 0;

  return (
    <Modulo numero={4} titulo={titulo} descripcion={bajada}>
      {!d ? (
        <Esqueleto conCifras />
      ) : d.contandoDesde === null ? (
        <Vacio titulo="El contador todavía no ha registrado ninguna visita">
          Se cuenta desde que alguien abre un enlace del formulario público.
        </Vacio>
      ) : (
        <>
          <FraseDelModulo numero={4}>
            Hubo <Cifra>{n(aperturas)}</Cifra> aperturas de{" "}
            <Cifra>{n(d.personas)}</Cifra> personas.{" "}
            <Cifra>{n(registrados)}</Cifra> terminaron preinscritos
            {d.personas >= MINIMO_PARA_TASA && (
              <> ({porcentaje(registrados, d.personas)} de las personas)</>
            )}
            .
          </FraseDelModulo>

          <Cifras>
            {/* PERSONAS Y NO «USUARIOS ÚNICOS»: no se sabe quién es
                quién. Esto es «siguió ahí pasados unos segundos o
                tocó el formulario», y es un suelo, no una cuenta. */}
            <CifraDelModulo
              etiqueta="Personas"
              valor={n(d.personas)}
              pie="descontando lo que abren solas las máquinas"
            />
            <CifraDelModulo
              etiqueta="Abrieron el enlace"
              valor={n(aperturas)}
              pie="máquinas incluidas"
            />
            <CifraDelModulo
              etiqueta="Eligieron un curso"
              valor={n(eligieron)}
              pie={
                d.personas >= MINIMO_PARA_TASA
                  ? `${porcentaje(eligieron, d.personas)} de las personas`
                  : "aún sin tasa"
              }
            />
            <CifraDelModulo
              etiqueta="Se preinscribieron"
              valor={n(registrados)}
              pie={
                d.personas >= MINIMO_PARA_TASA
                  ? `${porcentaje(registrados, d.personas)} de las personas`
                  : "aún sin tasa"
              }
              tono={registrados > 0 ? "bueno" : undefined}
            />
          </Cifras>

          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold">Aperturas y preinscritos por día</h3>
            {/* DOS EJES, y aquí sí: son dos órdenes de magnitud
                distintos --cientos de aperturas contra decenas de
                preinscritos-- y con uno solo la segunda línea queda
                pegada al suelo y no se puede leer su forma. La
                pantalla de Tráfico usa esta misma gráfica. */}
            <DosSeriesPorDiaConEje
              a={{
                nombre: "Aperturas",
                color: "var(--aviso)",
                datos: d.porDia.map((x) => ({ dia: x.dia, total: x.llegaron })),
              }}
              b={{
                nombre: "Se preinscribieron",
                color: "var(--exito)",
                datos: d.porDia.map((x) => ({ dia: x.dia, total: x.preinscritos })),
              }}
              vacio="Todavía no hay días con movimiento."
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold">Del clic a la preinscripción</h3>
            {/* EL EMBUDO NO PUEDE SUBIR: cada peldaño acredita a la
                visita todos los de debajo de su máximo, así que la
                lista es monótona por construcción. */}
            <div className="flex flex-col gap-1.5">
              {PELDANOS_DEL_TRAFICO.map((p, i) => {
                const v = visitasDe(d.hitos, p.paso);
                const antes =
                  i === 0 ? v : visitasDe(d.hitos, PELDANOS_DEL_TRAFICO[i - 1].paso);
                return (
                  <div
                    key={p.paso}
                    className="grid grid-cols-[minmax(104px,150px)_minmax(0,1fr)_auto] items-center gap-3 text-[0.78125rem]"
                  >
                    <span className="truncate">{p.etiqueta}</span>
                    <div className="flex h-5 items-center">
                      <span
                        className="flex h-full min-w-[2.5rem] items-center rounded-[5px] px-2 text-[0.71875rem] font-bold text-marca-texto"
                        style={{
                          width: `${aperturas > 0 ? Math.max(6, (v / aperturas) * 100) : 6}%`,
                          background: ACENTO_4,
                        }}
                      >
                        {n(v)}
                      </span>
                    </div>
                    <span className="text-right text-[0.71875rem] whitespace-nowrap text-texto-suave tabular-nums">
                      {i === 0 ? "" : `${porcentaje(v, antes)} del anterior`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[0.71875rem] text-texto-suave">
              Cada porcentaje es sobre el paso anterior. La unidad es la visita,
              no la persona: quien vuelve otro día cuenta dos veces.
            </p>
          </div>

          {d.procedencia.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h3 className="text-sm font-bold">De dónde llegan</h3>
              <ListaBarras
                datos={d.procedencia.slice(0, 8).map((p) => ({
                  clave: p.valor ?? "sin",
                  etiqueta: NOMBRE_PROCEDENCIA[p.valor ?? ""] ?? p.valor ?? "Sin dato",
                  valor: p.personas,
                  detalle: `${n(p.envios)} preinscritos`,
                }))}
                sufijo=" personas"
                sufijoUno=" persona"
                vacio="Todavía no hay procedencias medidas."
              />
            </div>
          )}

          <VerDetalle a="/admin/control?pantalla=trafico">
            Ver el tráfico completo, con sus nueve peldaños y sus cortes
          </VerDetalle>
        </>
      )}
    </Modulo>
  );
}
