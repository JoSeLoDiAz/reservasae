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
 * informe correspondiente de Control de Inscritos y pinta cuatro
 * cifras y un corte. La matriz, los acordeones y las listas por
 * persona se quedan donde están: si el Resumen las copiara, serían
 * dos pantallas contando lo mismo con dos reglas, que es el defecto
 * que este repositorio lleva media docena de veces documentando.
 *
 * CADA MÓDULO PIDE LO SUYO, Y SOLO SI PUEDE. El Resumen es hoy la
 * única pantalla del panel sin cerradura de área, y un `Promise.all`
 * con un 403 dentro apagaría la portada entera. Así que cada bloque
 * mira el permiso ANTES de pedir —y antes de pintar «cargando», o se
 * quedaría girando para siempre a quien no puede verlo—.
 *
 * Y CADA UNO CON SU CADENCIA. El académico y el tráfico no cambian
 * cada medio minuto; la pre-reserva sí, y esa se queda como estaba.
 */

import Link from "next/link";
import { createContext, useCallback, useContext } from "react";

import { ListaBarras, n } from "./graficos";
import { useAdmin } from "./marco-admin";
import { PendientesDeHoy } from "./pendientes-de-hoy";
import { Bloque, Esqueleto, TarjetaCifra, Vacio } from "./piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  crmApi,
  type Control,
  type TableroAcademico,
  type EmbudoPublico,
} from "@/lib/crm-api";
import { porCanal } from "@/lib/canales-del-resumen";
import { MINIMO_PARA_TASA, porcentaje, visitasDe } from "@/lib/trafico-comun";

/// Un minuto para lo que se trabaja hoy, cinco para lo que no se
/// mueve en una mañana. El módulo 1 se queda en 30 s, que es lo que
/// tenía.
const CADA_MINUTO = 60_000;
const CADA_CINCO = 5 * 60_000;

/** El rótulo con su número, que es el orden que pidió el cliente. */
function tituloDe(numero: number, texto: string): string {
  /// El número va en el TÍTULO y no en un círculo relleno de
  /// color, como lo dibuja la maqueta: «el color va en el texto y
  /// en marcas pequeñas, no en fondos», y este panel ya deshizo ese
  /// mismo adorno una vez (`piezas.tsx`).
  return `${numero} · ${texto}`;
}

/**
 * Lo que se pinta cuando un módulo no se puede pedir o no tiene
 * con qué llenarse.
 *
 * NUNCA SE DEJA EN BLANCO. «Nunca media pantalla vacía; un bloque
 * vacío dice POR QUÉ lo está» (el handoff de diseño). Un cero sin
 * explicar se lee como un dato que no cargó.
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
    <Bloque titulo={tituloDe(numero, titulo)} descripcion={descripcion} partible>
      <Vacio titulo={porque}>{children}</Vacio>
    </Bloque>
  );
}

/** El pie de cada módulo: a dónde se va a ver el detalle. */
function VerDetalle({ a, children }: { a: string; children: React.ReactNode }) {
  /// ENLACE Y NO BOTÓN: «la navegación hacia atrás es un enlace, no
  /// un botón. Los botones son acciones» (el handoff). Ir a mirar el
  /// detalle no cambia nada.
  return (
    <p className="mt-1 text-[0.78125rem]">
      <Link href={a} className="font-semibold text-marca underline underline-offset-2">
        {children}
      </Link>
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULOS 2 y 5 · una sola llamada para los dos
   ═══════════════════════════════════════════════════════════════ */

/**
 * UNA SOLA LLAMADA PARA LOS MÓDULOS 2 Y 5.
 *
 * `porAsesor` viaja DENTRO de la misma respuesta que el embudo y la
 * cola, así que el de asesores no cuesta una petición. Pero el
 * cliente los quiere en su sitio —2, 3, 4 y 5— y el de asesores va
 * el último, con el académico y el tráfico en medio. Por eso el dato
 * se levanta a un contexto en vez de que un componente pinte los
 * dos seguidos: así el orden de la pantalla lo decide la pantalla, y
 * no de dónde viene el dato.
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

  if (!puede)
    return (
      <Apagado
        numero={2}
        titulo="Leads e inscripciones"
        descripcion="Quién llegó, si ya se le contactó y cuántos se inscribieron."
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
        titulo="Leads e inscripciones"
        descripcion="Quién llegó, si ya se le contactó y cuántos se inscribieron."
        porque="No se pudieron traer las cifras"
      >
        {error}
      </Apagado>
    );

  const esperando = d ? d.sinContactar.reduce((s, t) => s + t.total, 0) : 0;

  return (
    <>
      <Bloque
        titulo={tituloDe(2, "Leads e inscripciones")}
        descripcion="Quién llegó, si ya se le contactó y cuántos se inscribieron. El detalle, en Control de Inscritos."
        partible
      >
        {!d ? (
          <Esqueleto conCifras />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="imprimible-cifras grid gap-px overflow-hidden rounded-lg border border-borde bg-hairline sm:grid-cols-2 lg:grid-cols-4">
              {/* «Llegaron a inscrito» y NO «inscritos» a secas: el
                  módulo 1 tiene su propia cifra de inscritos, con otra
                  regla. Dos cifras, dos nombres. */}
              <TarjetaCifra
                compacta
                etiqueta="Llegaron a inscrito"
                valor={n(d.total)}
                pie="desde que hay registro"
              />
              <TarjetaCifra
                compacta
                etiqueta="Sin asesor"
                valor={n(d.sinAsignar)}
                pie={d.sinAsignar > 0 ? "hoy no los llama nadie" : "todos repartidos"}
                tono={d.sinAsignar > 0 ? "aviso" : "neutro"}
              />
              <TarjetaCifra
                compacta
                etiqueta="Esperan primera llamada"
                valor={n(esperando)}
                pie="siguen en Interesado"
                tono={esperando > 0 ? "aviso" : "neutro"}
              />
              <TarjetaCifra
                compacta
                etiqueta="De lead a inscrito"
                valor={d.diasHastaInscribir === null ? "—" : `${d.diasHastaInscribir} d`}
                pie={d.diasHastaInscribir === null ? "aún sin medir" : "en promedio"}
                tono="neutro"
              />
            </div>

            {/* La única lista accionable, entera y con sus enlaces ya
                recortados. Su propio docblock pide que se mueva sin
                reescribirla. */}
            <PendientesDeHoy control={d} />

            <div>
              <h3 className="mb-2 text-sm font-bold">Qué convierte cada canal</h3>
              {/* LOS CUATRO CANALES DEL NEGOCIO, no los doce orígenes
                  de la base. La agrupación vive en `canales-del-resumen`
                  y la fuerza el compilador: un origen nuevo sin
                  clasificar no compila. */}
              <ListaBarras
                datos={porCanal(d.conversionPorOrigen)
                  .filter((c) => c.leads >= 5)
                  .map((c) => ({
                    clave: c.canal,
                    etiqueta: c.nombre,
                    valor: Math.round((c.inscritos / c.leads) * 100),
                    detalle: `${n(c.inscritos)} de ${n(c.leads)}`,
                  }))}
                sufijo=" %"
                vacio="Todavía no hay ningún canal con cinco leads."
              />
              {/* La base, dicha: con menos de cinco leads un 50 % son
                  dos personas, y se lee igual que uno de mil. */}
              <p className="mt-1.5 text-[0.71875rem] text-texto-suave">
                Solo los canales con cinco leads o más. «Se inscribió solo» es
                quien llegó al formulario por un enlace sin etiqueta: no se sabe
                por dónde vino.
              </p>
            </div>

            <VerDetalle a="/admin/control?pantalla=metas">
              Ver el proceso de inscripción completo
            </VerDetalle>
          </div>
        )}
      </Bloque>
    </>
  );
}

/**
 * MÓDULO 5 · los asesores.
 *
 * «Cuántos asesores, cuántos tiene asignados, de esos cuántos
 * inscribió, y un porcentaje de conversión sobre lo que le es
 * asignado» (Catalina, 22 sep 2026).
 *
 * Lo que trae `porAsesor` ya responde eso entero. Lo que NO responde
 * —y hay que decirlo— es «cuántos inscribió»: `asesorId` es el dueño
 * de HOY, así que si una líder reasigna una ficha ya inscrita, el
 * mérito se muda con ella. Por eso la columna se llama «suyos
 * inscritos» y no «inscribió».
 */
export function ModuloAsesores() {
  const { datos: control, error, puede } = useContext(ContextoDeControl);
  const { admin } = useAdmin();
  /// Quien no responde por el equipo recibe SOLO su fila, y el
  /// servidor ya se encargó de eso. Esto es para poder nombrar bien
  /// lo que se está mirando: una tabla de una sola fila titulada
  /// «Seguimiento de asesores» se lee como si faltara gente.
  const veElEquipo = admin.puede?.verElEquipo === true;

  if (!puede)
    return (
      <Apagado
        numero={5}
        titulo="Seguimiento de asesores"
        descripcion="Cuántos leads lleva cada asesor y cuántos de ellos están inscritos."
        porque="Su cuenta no tiene acceso a inscripciones"
      />
    );

  if (error)
    return (
      <Apagado
        numero={5}
        titulo="Seguimiento de asesores"
        descripcion="Cuántos leads lleva cada asesor y cuántos de ellos están inscritos."
        porque="No se pudieron traer las cifras"
      >
        {error}
      </Apagado>
    );

  if (!control) {
    return (
      <Bloque
        titulo={tituloDe(5, veElEquipo ? "Seguimiento de asesores" : "Su gestión")}
        descripcion="Cuántos leads lleva y cuántos de ellos están inscritos."
        partible
      >
        <Esqueleto conCifras />
      </Bloque>
    );
  }

  /// Sin asesor NO es un asesor. La fila con `asesorId` nulo es la
  /// cola de nadie, y ya se cuenta arriba en «Sin asesor»: dejarla
  /// aquí la contaría como una persona más del equipo.
  const asesores = control.porAsesor.filter((a) => a.asesorId !== null);
  const conFichas = asesores.filter((a) => a.asignados > 0).length;
  const repartidas = asesores.reduce((s, a) => s + a.asignados, 0);
  const suyosInscritos = asesores.reduce((s, a) => s + a.inscritosSiempre, 0);

  return (
    <Bloque
      titulo={tituloDe(5, veElEquipo ? "Seguimiento de asesores" : "Su gestión")}
      descripcion={
        veElEquipo
          ? "Cuántos leads lleva cada asesor y cuántos de ellos están inscritos."
          : "Cuántos leads lleva usted y cuántos de ellos están inscritos."
      }
      partible
    >
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
        <div className="flex flex-col gap-4">
          <div className="imprimible-cifras grid gap-px overflow-hidden rounded-lg border border-borde bg-hairline sm:grid-cols-3">
            {/* «Asesores con leads» solo dice algo cuando se ve el
                equipo: con una sola fila siempre valdría uno. */}
            <TarjetaCifra
              compacta
              etiqueta={veElEquipo ? "Asesores con leads" : "Asesores"}
              valor={n(veElEquipo ? conFichas : 1)}
              pie={veElEquipo ? `de ${n(asesores.length)} con fichas alguna vez` : "usted"}
            />
            <TarjetaCifra
              compacta
              etiqueta={veElEquipo ? "Leads repartidos" : "Sus leads"}
              valor={n(repartidas)}
            />
            <TarjetaCifra
              compacta
              etiqueta="De esos, inscritos"
              valor={n(suyosInscritos)}
              pie={porcentaje(suyosInscritos, repartidas) + " de lo repartido"}
              tono="neutro"
            />
          </div>

          <div className="caja-scroll overflow-x-auto">
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="border-b border-hairline text-left text-[0.71875rem] text-texto-suave">
                  <th className="py-1.5 pr-3 font-semibold">Asesor</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Asignados</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Suyos inscritos</th>
                  <th className="py-1.5 text-right font-semibold">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {[...asesores]
                  .sort((a, b) => b.asignados - a.asignados)
                  .map((a) => (
                    <tr key={a.asesorId ?? a.etiqueta} className="border-b border-hairline last:border-0">
                      <td className="py-1.5 pr-3">
                        {/* A SU LISTA, con el filtro puesto: «una cifra
                            que pide hacer algo tiene que llevar a
                            exactamente esa gente». */}
                        <Link
                          href={`/admin/participantes?asesor=${encodeURIComponent(a.asesorId ?? "")}`}
                          className="underline underline-offset-2"
                        >
                          {a.etiqueta}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{n(a.asignados)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {n(a.inscritosSiempre)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {/* El mismo suelo que el tráfico: una conversión
                            de dos fichas no se imprime como tasa. */}
                        {a.asignados >= 5 ? porcentaje(a.inscritosSiempre, a.asignados) : "—"}
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
            {/* SE DICE QUE ESTA RECORTADO. Una tabla de una fila sin
                explicar se lee como que falta gente, no como que no
                se puede ver. */}
            {!veElEquipo && (
              <>
                {" "}
                Aquí sale <strong className="font-semibold text-texto">solo su gestión</strong>:
                el trabajo del resto del equipo lo ve quien responde por él.
              </>
            )}
          </p>

          <VerDetalle a="/admin/participantes?cola=por-trabajar">
            Repartir leads entre asesores
          </VerDetalle>
        </div>
      )}
    </Bloque>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO 3 · el académico
   ═══════════════════════════════════════════════════════════════ */

export function ModuloAcademico() {
  const { admin } = useAdmin();
  const puede = admin.rol !== "CONSULTA" && admin.permisos?.academico !== "NADA";

  const vivos = useDatosVivos<TableroAcademico>(
    useCallback(() => crmApi.tableroAcademico(), []),
    { activo: puede, intervaloMs: CADA_CINCO },
  );

  if (!puede)
    return (
      <Apagado
        numero={3}
        titulo="Seguimiento académico"
        descripcion="Quién está en el aula, cómo avanza y quién puede certificarse."
        porque="Su cuenta no tiene acceso al área académica"
      />
    );

  if (vivos.error)
    return (
      <Apagado
        numero={3}
        titulo="Seguimiento académico"
        descripcion="Quién está en el aula, cómo avanza y quién puede certificarse."
        porque="No se pudieron traer las cifras"
      >
        {vivos.error}
      </Apagado>
    );

  const d = vivos.datos;

  /// EL AULA VACÍA SE EXPLICA, y no es un fallo: el avance lo carga
  /// el LMS, que todavía no está conectado. Sin esta frase, un
  /// tablero en ceros se lee como un tablero roto —y en producción
  /// hoy hay cero actividades y cero avances cargados—.
  if (d && d.total === 0)
    return (
      <Apagado
        numero={3}
        titulo="Seguimiento académico"
        descripcion="Quién está en el aula, cómo avanza y quién puede certificarse."
        porque="Todavía no ha entrado nadie al aula"
      >
        Estas cifras salen del avance de cada persona, que lo carga la plataforma
        de formación. Mientras no haya nadie matriculado ni avances cargados, el
        bloque se queda en cero y no es un error.
      </Apagado>
    );

  return (
    <Bloque
      titulo={tituloDe(3, "Seguimiento académico")}
      descripcion="Quién está en el aula, cómo avanza y quién puede certificarse."
      partible
    >
      {!d ? (
        <Esqueleto conCifras />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="imprimible-cifras grid gap-px overflow-hidden rounded-lg border border-borde bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            <TarjetaCifra compacta etiqueta="Pisaron el aula" valor={n(d.total)} />
            <TarjetaCifra
              compacta
              etiqueta="Listos para certificar"
              valor={n(d.listos)}
              pie={`con el ${Math.round(d.minimoParaCertificar * 100)} % o más`}
              tono="exito"
            />
            <TarjetaCifra
              compacta
              etiqueta="Certificados"
              valor={n(d.certificados)}
              pie={porcentaje(d.certificados, d.total) + " del aula"}
              tono="exito"
            />
            <TarjetaCifra
              compacta
              etiqueta="Avance medio"
              valor={`${Math.round(d.avanceMedio * 100)} %`}
              /// SOBRE LOS MEDIBLES, dicho: quien no tiene
              /// actividades cargadas no se puede medir, y meterlo en
              /// el promedio lo hundiría sin que nada fallara.
              pie={
                d.sinMedir > 0
                  ? `sobre ${n(d.medibles)}; ${n(d.sinMedir)} sin actividades`
                  : `sobre ${n(d.medibles)} medibles`
              }
              tono="neutro"
            />
          </div>

          <VerDetalle a="/admin/participantes/academico/tablero">
            Ver el tablero académico por acción y grupo
          </VerDetalle>
        </div>
      )}
    </Bloque>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO 4 · el tráfico
   ═══════════════════════════════════════════════════════════════ */

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

  if (!puede)
    return (
      <Apagado
        numero={4}
        titulo="Tráfico del formulario"
        descripcion="Cuánta gente abre el formulario y cuántos terminan preinscritos."
        porque="Su cuenta no tiene acceso a inscripciones"
      />
    );

  if (vivos.error)
    return (
      <Apagado
        numero={4}
        titulo="Tráfico del formulario"
        descripcion="Cuánta gente abre el formulario y cuántos terminan preinscritos."
        porque="No se pudieron traer las cifras"
      >
        {vivos.error}
      </Apagado>
    );

  const d = vivos.datos;
  const eligieron = d ? visitasDe(d.hitos, "ELIGIO_ACCION") : 0;
  const registrados = d ? visitasDe(d.hitos, "REGISTRADO") : 0;
  const aperturas = d ? visitasDe(d.hitos, "LLEGO") : 0;

  return (
    <Bloque
      titulo={tituloDe(4, "Tráfico del formulario")}
      descripcion="Cuánta gente abre el formulario y cuántos terminan preinscritos. El detalle, en Control de Inscritos."
      partible
    >
      {!d ? (
        <Esqueleto conCifras />
      ) : d.contandoDesde === null ? (
        <Vacio titulo="El contador todavía no ha registrado ninguna visita">
          Se cuenta desde que alguien abre un enlace del formulario público.
        </Vacio>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="imprimible-cifras grid gap-px overflow-hidden rounded-lg border border-borde bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            {/* PERSONAS Y NO «USUARIOS ÚNICOS»: no se sabe quién es
                quien. Esto es «siguió ahí pasados unos segundos o tocó
                el formulario», y es un suelo, no una cuenta. */}
            <TarjetaCifra
              compacta
              etiqueta="Personas"
              valor={n(d.personas)}
              pie="descontando lo que abren solas las máquinas"
            />
            <TarjetaCifra
              compacta
              etiqueta="Abrieron el enlace"
              valor={n(aperturas)}
              pie="máquinas incluidas"
              tono="neutro"
            />
            <TarjetaCifra
              compacta
              etiqueta="Eligieron un curso"
              valor={n(eligieron)}
              pie={
                d.personas >= MINIMO_PARA_TASA
                  ? porcentaje(eligieron, d.personas) + " de las personas"
                  : "aún sin tasa"
              }
              tono="neutro"
            />
            <TarjetaCifra
              compacta
              etiqueta="Se preinscribieron"
              valor={n(registrados)}
              pie={
                d.personas >= MINIMO_PARA_TASA
                  ? porcentaje(registrados, d.personas) + " de las personas"
                  : "aún sin tasa"
              }
              tono="exito"
            />
          </div>

          <p className="text-[0.71875rem] text-texto-suave">
            La unidad es la visita, no la persona: quien vuelve otro día cuenta
            dos veces. Las tasas no se imprimen por debajo de {MINIMO_PARA_TASA}{" "}
            personas.
          </p>

          <VerDetalle a="/admin/control?pantalla=trafico">
            Ver el tráfico completo, con sus nueve peldaños
          </VerDetalle>
        </div>
      )}
    </Bloque>
  );
}
