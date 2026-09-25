"use client";

/**
 * EL PARTICIPANTE, UNO A UNO, DENTRO DE SEGUIMIENTO DEL AULA.
 *
 * «Te dije que abrir lead es una visual de Seguimiento del aula,
 * como de resumen del participante, porque ya es el 1 a 1. ¿Por qué
 * me muestras la vista de Control de inscritos?» (cliente, 25 sep
 * 2026).
 *
 * El cajón llevaba a `/admin/participantes/[id]`, que es la ficha de
 * Gestión de leads: otro módulo, otra miga y una pantalla que habla
 * de etapas, de habeas data y del formato SEP. Todo eso es verdad de
 * la PERSONA, pero quien viene del aula viene a mirar otra cosa:
 * cómo va en el curso.
 *
 * CON EL MISMO ARMAZÓN QUE EL LEAD INDIVIDUAL: «¿no se puede una
 * visual profesional y limpia como el lead individual de Gestión de
 * leads, para que exista una armonía?» (cliente, 25 sep 2026).
 *
 * Y es el mismo, banda por banda, copiado de `participantes/[id]`:
 *
 *   1 · IDENTIDAD ---círculo con las iniciales, nombre grande, la
 *       línea de datos con puntos de separación, y a la derecha el
 *       rótulo en versalitas con su valor en color---.
 *   2 · LA BARRA, pegada a la identidad y sobre fondo distinto. Allí
 *       es donde se cambia la etapa; aquí NO SE CAMBIA NADA ---lo
 *       manda el LMS---, así que lleva el contexto del curso y la
 *       única acción que sí es nuestra: escribir una nota.
 *   3 · EL CUERPO en dos columnas: lo que se mira a la izquierda y
 *       la caja de datos a la derecha, 370 px como allá.
 *
 * Las medidas van en `style` y no en clases por la misma razón que
 * en aquella: son las de un maquetado concreto, se leen de corrido
 * al lado de su porqué, y así no aparecen catorce utilidades
 * arbitrarias en una pantalla que tiene una sola forma.
 *
 * LO QUE NO HACE: duplicar la ficha. Sus datos personales, su
 * empresa y su autorización viven en un solo sitio y se trabajan
 * desde Inscripciones.
 *
 * SE PIDE AL SERVIDOR aunque el cajón ya tuviera la fila: a esta
 * dirección se llega pegando el enlace, y entonces no hay lista de
 * la que sacarla. La calcula `academico()`, el mismo sitio que la
 * lista, así que el estado de aquí no puede discrepar del de la
 * tabla.
 */

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { CajonDelAula } from "@/components/admin/cajon-del-aula";
import { nombreLargoDeActividad } from "@/components/admin/columnas-del-aula";
import { colorEtapa } from "@/components/admin/etapa";
import { Aviso } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import { fechaDeCalendario } from "@/lib/dia-de-calendario";
import {
  type Academico,
  AYUDA_ACADEMICA,
  crmApi,
  type EstadoAcademico,
  ETIQUETA_ACADEMICA,
  type FilaAcademica,
} from "@/lib/crm-api";

const COLOR: Record<EstadoAcademico, string> = {
  SIN_INGRESO: colorEtapa("PERDIDO"),
  SIN_EMPEZAR: colorEtapa("CONTACTADO"),
  ATRASADO: colorEtapa("EN_FORMACION"),
  AL_DIA: colorEtapa("CERTIFICADO"),
  COMPLETADO: colorEtapa("INSCRITO"),
  CERTIFICADO: colorEtapa("CERTIFICADO"),
};

function instante(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** El día, escrito entero: «19 de julio de 2026». */
function fechaLarga(iso: string | null): string | null {
  if (!iso) return null;
  return fechaDeCalendario(iso, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PaginaDelParticipante() {
  const { id } = useParams<{ id: string }>();

  const cargar = useCallback(() => crmApi.academicoDeUno(id), [id]);
  const vivos = useDatosVivos<Academico>(cargar, { clave: id });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto conCifras />;

  const fila = vivos.datos.personas[0];
  if (!fila) {
    return (
      <div className="px-4 pt-3">
        <Aviso tipo="error">
          Esta persona no está en el aula. Solo aparece aquí quien esté en
          formación en una acción virtual.{" "}
          <Link href="/admin/participantes/academico" className="underline">
            Volver a Seguimiento del aula
          </Link>
        </Aviso>
      </div>
    );
  }

  return <Resumen fila={fila} criterio={vivos.datos.criterio} />;
}

function Resumen({
  fila,
  criterio,
}: {
  fila: FilaAcademica;
  criterio: Academico["criterio"];
}) {
  /// PARA ESCRIBIR UNA NOTA SE ABRE EL CAJÓN, que ya lo tiene
  /// resuelto ---el canal, el resultado, lo anterior---. Copiar aquí
  /// ese formulario sería la segunda copia del mismo.
  const [enElCajon, setEnElCajon] = useState<FilaAcademica | null>(null);

  const hechas = fila.actividades.filter((a) => a.completada).length;
  const deHoy = calcularDeHoy(fila, hechas);

  /// Dos letras, como en el lead: la del nombre y la del apellido.
  const partes = fila.nombre.split(" ").filter(Boolean);
  const iniciales =
    `${partes[0]?.[0] ?? ""}${partes[partes.length - 1]?.[0] ?? ""}`.toLocaleUpperCase(
      "es-CO",
    ) || "?";

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      <Link
        href="/admin/participantes/academico"
        className="text-[0.78125rem] text-texto-suave no-underline hover:text-texto"
      >
        ← Seguimiento del aula
      </Link>

      {/* UNA SOLA TARJETA EN TRES BANDAS, como el lead individual. */}
      <section className="overflow-hidden rounded-lg border border-borde bg-superficie">
        {/* ── 1 · IDENTIDAD ──────────────────────────────── */}
        <div
          style={{
            background: "var(--superficie)",
            borderBottom: "1px solid var(--borde)",
            padding: "16px 28px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              flex: "0 0 44px",
              borderRadius: "50%",
              background: "var(--marca-suave)",
              color: "var(--marca)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.90625rem",
            }}
          >
            {iniciales}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: "1.4375rem",
                lineHeight: 1.15,
                letterSpacing: "-.022em",
                color: "var(--titulo)",
              }}
            >
              {fila.nombre}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                fontSize: "0.75rem",
                color: "var(--texto-suave)",
                flexWrap: "wrap",
              }}
            >
              <span>{fila.documento}</span>
              {fila.correo && (
                <>
                  <Punto />
                  <span>{fila.correo}</span>
                </>
              )}
              <Punto />
              <span>
                En el sistema hace {fila.diasDeAntiguedad}{" "}
                {fila.diasDeAntiguedad === 1 ? "día" : "días"}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: "0.625rem",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--texto-suave)",
              }}
            >
              Estado en el aula
            </span>
            {/* El valor en el color de su estado, sin píldora ni
                punto: el color va en la letra. Igual que allá. */}
            <span
              title={AYUDA_ACADEMICA[fila.estado]}
              style={{
                marginTop: 3,
                fontSize: "0.90625rem",
                fontWeight: 700,
                color: COLOR[fila.estado],
              }}
            >
              {ETIQUETA_ACADEMICA[fila.estado]}
            </span>
          </div>
        </div>

        {/* ── 2 · LA BARRA ───────────────────────────────────
            En el lead es donde se cambia la etapa. Aquí NO SE CAMBIA
            NADA: lo del aula lo manda el LMS. Así que lleva el
            contexto del curso ---dónde está matriculado--- y la única
            acción que sí es nuestra, que es dejar una nota.

            Sobre fondo distinto y pegada a la identidad, como allá:
            es la franja que responde «¿de qué curso estamos
            hablando?» antes de mirar nada más. */}
        <div
          style={{
            background: "var(--superficie-alterna)",
            borderBottom: "1px solid var(--borde)",
            padding: "14px 28px",
            display: "flex",
            alignItems: "flex-end",
            /// `columnGap` mayor que `rowGap`: entre columnas hace
            /// falta aire para que no se lean como una frase, y entre
            /// renglones ---cuando la fila se parte en una pantalla
            /// angosta--- 10 px bastan y no abren un boquete.
            columnGap: 24,
            rowGap: 10,
            flexWrap: "wrap",
          }}
        >
          {/* LA ACCIÓN, ENTERA Y EN SU PROPIO RENGLÓN.
              «Vuelve y juega» (cliente, 25 sep 2026), viendo «AF1 ·
              GESTIÓN DE LA ATENCIÓN Y NEUROEDU…» todavía cortado.
              Tenía tope de 300 px, puesto con el argumento de que
              son noventa letras y sin límite se lleva la barra
              entera. Se la lleva, sí ---y hace bien---: es el dato
              que dice de qué curso estamos hablando, y recortado no
              sirve de nada.
              Ocupa la fila completa y los otros seis bajan al
              siguiente renglón, donde caben de sobra. */}
          <EnLaBarra
            titulo="Acción de formación"
            valor={fila.accion}
            solaEnSuRenglon
          />
          <EnLaBarra
            titulo="Grupo"
            valor={fila.grupo === null ? null : `Grupo ${fila.grupo}`}
          />
          <EnLaBarra titulo="Departamento" valor={fila.departamento} />
          <EnLaBarra titulo="Asesor responsable" valor={fila.asesor?.nombre ?? null} />
          {/* EL CALENDARIO SUBE AQUÍ (cliente, 25 sep 2026: «¿de esto
              qué se puede colocar en la segunda captura, para que al
              mismo margen de Unidad temática de hoy?»).

              Estaban en la columna de la derecha, que con siete datos
              quedaba mucho más larga que la columna de la izquierda y
              las dos terminaban a alturas distintas. Estos tres son
              de la misma familia que los cuatro de al lado ---de qué
              curso estamos hablando--- y la barra tenía el hueco
              vacío. La derecha se queda con lo que de verdad es de
              esta persona: su avance y su gestión. */}
          {/* «CURSO» EN LOS DOS RÓTULOS (cliente, 25 sep 2026: «como
              que diga fecha inicio curso, fecha fin curso, porque
              queda raro»). Sueltas, al lado de «Asesor responsable»,
              esas dos fechas podían ser de cualquier cosa ---de la
              inscripción, del grupo, de la reserva---. */}
          <EnLaBarra titulo="Fecha inicio curso" valor={fechaLarga(fila.fechaInicio)} />
          <EnLaBarra titulo="Fecha fin curso" valor={fechaLarga(fila.fechaFin)} />
          {/* «HORARIO DEL GRUPO», que es lo que es: los días y las
              horas de las sesiones que ese grupo tiene cargadas en
              Oferta ---`SesionDeGrupo`---. «Horario, ¿a qué hace
              referencia? No entiendo y ya lo pregunté» (cliente, 25
              sep 2026); se lo contesté en el chat y no arreglé el
              rótulo, que es donde hacía falta la respuesta. */}
          <EnLaBarra titulo="Horario del grupo" valor={fila.horario} />
          <button
            type="button"
            onClick={() => setEnElCajon(fila)}
            style={{ marginLeft: "auto" }}
            className="inline-flex h-[34px] shrink-0 items-center rounded-lg bg-marca px-4 text-[0.78125rem] font-semibold text-marca-texto transition hover:bg-marca-fuerte sin-aro"
          >
            Registrar seguimiento
          </button>
        </div>

        {/* ── 3 · EL CUERPO, en dos columnas ────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 22,
            padding: "24px 28px 30px",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 480 }}>
            <h2
              style={{
                margin: 0,
                fontWeight: 600,
                fontSize: "0.90625rem",
                color: "var(--titulo)",
              }}
            >
              Cómo va en el aula
            </h2>
            {/* DICE DE DÓNDE SALE Y POR QUÉ NO SE TOCA. Sin esta
                línea, quien ve una actividad sin marcar y no
                encuentra cómo marcarla piensa que está rota. */}
            <p className="mt-1 text-[0.75rem] leading-snug text-texto-suave">
              Lo manda el aula y es la fuente de la verdad: aquí no se edita. Si
              algo no cuadra, se corrige allá y llega solo.
            </p>

            {fila.actividades.length === 0 ? (
              <p className="mt-4 text-sm text-texto-suave">
                Su acción de formación no tiene actividades cargadas todavía.
              </p>
            ) : (
              <ol className="mt-4 flex flex-col gap-1.5">
                {fila.actividades.map((a) => (
                  <li
                    key={a.orden}
                    className="flex items-center gap-3 rounded-lg border border-borde px-3 py-2"
                  >
                    <span
                      aria-hidden
                      className={
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold " +
                        (a.completada
                          ? "bg-exito text-[var(--superficie)]"
                          : "border border-borde text-texto-suave")
                      }
                    >
                      {a.completada ? "✓" : a.orden}
                    </span>
                    {/* EL NOMBRE ENTERO, que aquí cabe: «Unidad
                        Temática 1» y no «UT1» (cliente, 25 sep
                        2026). El corto es el del dato ---el que
                        manda el LMS---; esto es cómo se escribe
                        cuando hay sitio. */}
                    <span className="min-w-0 grow truncate text-sm font-medium">
                      {nombreLargoDeActividad(a.titulo)}
                    </span>
                    <span
                      className={
                        "shrink-0 text-[0.78125rem] " +
                        (a.completada ? "text-exito" : "text-texto-suave")
                      }
                    >
                      {a.completada ? "Completada" : "Pendiente"}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {/* DÓNDE DEBERÍA IR HOY SEGÚN EL CALENDARIO, y si cuadra
                (cliente, 25 sep 2026: «otro campo, unidad temática
                por fecha actual, y que diga la respuesta: UT coincide
                con fecha actual»; y tenía razón en que ya lo había
                pedido).

                Es LA pregunta de esta pantalla ---no «cuántas lleva»
                sino «¿va donde debería ir hoy?»---, así que va en su
                propio recuadro y no en una frase al pie, que es donde
                estaba y había que traducirla uno mismo. */}
            <div
              className={
                "mt-4 rounded-lg border px-3.5 py-3 " +
                (deHoy.cuadra === undefined
                  ? "border-borde"
                  : deHoy.cuadra
                    ? "border-exito/40 bg-exito-suave"
                    : "border-aviso/40 bg-aviso-suave")
              }
            >
              <p className="text-[0.625rem] font-semibold tracking-[0.08em] text-texto-suave uppercase">
                Unidad temática de hoy
              </p>
              <p className="mt-1 text-[0.9375rem] font-bold">
                {deHoy.nombre ?? "—"}
              </p>
              <p
                className={
                  "mt-0.5 text-[0.78125rem] leading-snug " +
                  (deHoy.cuadra === undefined
                    ? "text-texto-suave"
                    : deHoy.cuadra
                      ? "text-exito"
                      : "font-medium text-aviso")
                }
              >
                {deHoy.veredicto}
              </p>
            </div>
          </div>

          {/* LA COLUMNA DE LA DERECHA: 370 px, como el lead. Allá es
              «Acciones»; aquí es el resumen de cifras y el calendario
              del curso ---lo que se consulta de reojo mientras se
              mira la lista de la izquierda---. */}
          <aside style={{ width: 370, flex: "none" }}>
            <div
              style={{
                background: "var(--superficie)",
                border: "1px solid var(--borde)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.90625rem",
                    color: "var(--titulo)",
                  }}
                >
                  Resumen
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--texto-suave)" }}>
                  Cómo va y cuándo se le tocó.
                </div>
              </div>

              <dl style={{ padding: "14px 18px 18px", margin: 0 }}>
                <Dato
                  titulo="Avance"
                  valor={`${fila.porcentaje} %`}
                  pie={`${hechas} de ${fila.actividades.length} actividades · se certifica con el ${Math.round(
                    criterio.minimoParaCertificar * 100,
                  )} %`}
                  color={fila.listoParaCertificar ? "var(--exito)" : undefined}
                />
                <Dato
                  titulo="Último ingreso al aula"
                  valor={fila.ultimoAcceso ? instante(fila.ultimoAcceso) : "Nunca"}
                  pie={
                    fila.diasSinEntrar === null
                      ? "No ha entrado ni una vez"
                      : `Hace ${fila.diasSinEntrar} ${fila.diasSinEntrar === 1 ? "día" : "días"}`
                  }
                  color={fila.ultimoAcceso === null ? "var(--peligro)" : undefined}
                />
                <Dato
                  titulo="Días sin gestión"
                  valor={String(fila.diasSinGestion)}
                  /* LAS NOTAS NO SON POR ACTIVIDAD, y el pie lo dice:
                     «¿o sea, según entiendo, es una nota por
                     actividad o algo así?» (cliente, 25 sep 2026).
                     Son la bitácora del asesor ---cada llamada, cada
                     correo---, que es otra cosa. */
                  pie={
                    fila.notas === 0
                      ? "Nunca se le ha escrito: se cuenta desde que entró"
                      : `${fila.notas} ${fila.notas === 1 ? "gestión registrada" : "gestiones registradas"} · última el ${instante(fila.ultimaNota)}`
                  }
                  color={fila.diasSinGestion >= 7 ? "var(--peligro)" : undefined}
                />
                {/* Las tres del calendario ---inicio, fin y
                    horario--- se fueron a la barra de arriba: son
                    del curso y no de esta persona, y aquí alargaban
                    la columna hasta dejarla desparejada con la de
                    al lado. */}
                <Dato
                  titulo="Nota final"
                  valor={fila.notaFinal === null ? null : String(fila.notaFinal)}
                  ultimo
                />
              </dl>
            </div>
          </aside>
        </div>
      </section>

      {/* SIN ENLACE A LA FICHA (cliente, 25 sep 2026: «esto no, o sea
          no; y no es aparte, es muy aparte»). Estaba al pie con la
          idea de no duplicar los datos de la persona, pero esta
          pantalla es del AULA: un enlace a otro módulo al final la
          termina en un sitio que no es el suyo. Los datos de la
          persona se trabajan desde Inscripciones. */}

      {enElCajon && (
        <CajonDelAula fila={enElCajon} alCerrar={() => setEnElCajon(null)} />
      )}
    </div>
  );
}

/** El separador de la línea de datos: el mismo punto del lead. */
function Punto() {
  return (
    <span
      aria-hidden
      style={{
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: "var(--texto-suave)",
        opacity: 0.6,
      }}
    />
  );
}

/**
 * Un dato de la barra de contexto.
 *
 * MIDE LO QUE MIDE SU VALOR, sin ancho clavado.
 *
 * Los tuvo ---130 px para una fecha, 190 para el horario--- copiando
 * los desplegables del lead, que sí son de ancho fijo. El resultado
 * fue «17 de octubre de 20…» y «de 07:00 a 11…» recortados CON media
 * barra vacía a la derecha: «¿por qué se ve cortado, si hay
 * espacio?» (cliente, 25 sep 2026). Y me preguntó de paso si había
 * comprobado que todo esto se ajusta a la pantalla; no lo había
 * hecho, y una medida en píxeles dentro de una fila que escala es
 * justo lo que este repositorio lleva advirtiendo.
 *
 * Ahora cada uno pide lo suyo ---`nowrap` y sin `width`--- y la
 * fila reparte: si no caben todos, baja el último a un segundo
 * renglón, que se lee; recortar el dato no.
 *
 * El único con tope es la acción de formación, y por su motivo: son
 * noventa letras y sin límite se lleva la barra entera.
 */
function EnLaBarra({
  titulo,
  valor,
  solaEnSuRenglon,
}: {
  titulo: string;
  valor: string | null;
  /// Se lleva la fila entera y empuja al resto abajo. Para el
  /// valor largo de verdad ---el nombre de la acción, noventa
  /// letras--- que no se puede recortar sin dejar de servir.
  solaEnSuRenglon?: boolean;
}) {
  return (
    <div
      style={
        solaEnSuRenglon
          ? { flex: "1 0 100%", minWidth: 0 }
          : { minWidth: 0, flex: "0 0 auto" }
      }
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: "0.625rem",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--texto-suave)",
        }}
      >
        {titulo}
      </div>
      <div
        title={valor ?? undefined}
        style={{
          marginTop: 4,
          fontSize: "0.84375rem",
          color: "var(--texto)",
          /// El que va solo en su renglón SÍ puede partirse en dos
          /// líneas si la ventana es angosta; los cortos, nunca.
          whiteSpace: solaEnSuRenglon ? "normal" : "nowrap",
        }}
      >
        {valor ?? <span style={{ color: "var(--texto-suave)" }}>—</span>}
      </div>
    </div>
  );
}

/** Una cifra de la columna derecha, con su explicación debajo. */
function Dato({
  titulo,
  valor,
  pie,
  color,
  ultimo,
}: {
  titulo: string;
  valor: string | null;
  pie?: string;
  color?: string;
  /// Sin la raya de abajo: es el último de la lista.
  ultimo?: boolean;
}) {
  return (
    <div
      style={{
        paddingBottom: 10,
        marginBottom: 10,
        borderBottom: ultimo ? "none" : "1px solid var(--hairline)",
      }}
    >
      <dt
        style={{
          fontWeight: 600,
          fontSize: "0.625rem",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--texto-suave)",
        }}
      >
        {titulo}
      </dt>
      <dd
        style={{
          margin: "3px 0 0",
          fontSize: "0.90625rem",
          fontWeight: 700,
          color: color ?? "var(--texto)",
        }}
      >
        {valor ?? <span style={{ color: "var(--texto-suave)" }}>—</span>}
      </dd>
      {pie && (
        <dd
          style={{
            margin: "2px 0 0",
            fontSize: "0.71875rem",
            lineHeight: 1.35,
            color: "var(--texto-suave)",
          }}
        >
          {pie}
        </dd>
      )}
    </div>
  );
}

/**
 * EN QUÉ ACTIVIDAD TOCARÍA IR HOY, y si esta persona va ahí.
 *
 * `esperadas` lo calcula el SERVIDOR contra las fechas del grupo: si
 * el curso lleva corrido el 70 % del tiempo, tocarían el 70 % de las
 * actividades. Aquí solo se traduce ese número al nombre de la
 * actividad que ocupa esa posición y se compara con cuántas lleva.
 *
 * Se compara por CANTIDAD y no por cuál: alguien puede tener la UT2
 * y la UT5 hechas saltándose la UT3, y preguntar «¿va en la que
 * toca?» sobre un avance con huecos no tiene respuesta buena.
 * Cuántas lleva contra cuántas tocarían sí la tiene.
 *
 * Tres casos que no son «va bien» ni «va mal» y hay que decir con
 * sus palabras: el grupo no tiene calendario, el curso no ha
 * empezado, y el curso ya terminó. Meterlos en el mismo «coincide»
 * es como se acaba diciendo que alguien va al día cuando su grupo ni
 * siquiera arrancó.
 */
function calcularDeHoy(
  fila: FilaAcademica,
  hechas: number,
): { nombre: string | null; veredicto: string; cuadra?: boolean } {
  if (fila.esperadas === null) {
    return {
      nombre: null,
      veredicto:
        "Su grupo no tiene calendario cargado: no hay contra qué medirlo.",
    };
  }
  if (fila.esperadas === 0) {
    return { nombre: "Todavía ninguna", veredicto: "Su curso aún no empieza." };
  }

  const cual =
    fila.actividades[Math.min(fila.esperadas, fila.actividades.length) - 1];
  const nombre = cual ? nombreLargoDeActividad(cual.titulo) : null;

  const diferencia = hechas - fila.esperadas;
  if (diferencia >= 0) {
    return {
      nombre,
      cuadra: true,
      veredicto:
        diferencia === 0
          ? "Coincide: va justo donde toca a esta fecha."
          : `Va ${diferencia} por delante de lo que toca a esta fecha.`,
    };
  }
  return {
    nombre,
    cuadra: false,
    veredicto: `No coincide: lleva ${hechas} y a esta fecha tocarían ${fila.esperadas}.`,
  };
}
